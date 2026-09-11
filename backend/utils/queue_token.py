import re
import datetime
from sqlalchemy.orm import Session
from sqlalchemy import or_
import models


def extract_token_number(token: str | None) -> int | None:
    """
    Extracts the trailing integer from an OPD token string.
    Example: 'OPD-102-05' -> 5, '102-01' -> 1
    """
    if not token:
        return None
    match = re.search(r'-(\d+)$', token.strip())
    if match:
        try:
            return int(match.group(1))
        except ValueError:
            return None
    return None


def generate_unique_queue_token(db: Session, doctor_room: str, doctor_id: str | None = None) -> str:
    """
    Generates a guaranteed-unique sequential token for this doctor/room (e.g. OPD-102-01, OPD-102-02).
    Inspects all existing sessions for this room and doctor to find the maximum assigned token number,
    increments by 1, and ensures the candidate token is not already held by any session.
    """
    room_str = str(doctor_room).strip() if doctor_room else "101"

    # Query all sessions assigned to this room or doctor
    query = db.query(models.PatientSession).filter(
        or_(
            models.PatientSession.assigned_doctor_room == room_str,
            models.PatientSession.assigned_doctor_id == doctor_id
        )
    )
    existing_sessions = query.all()

    max_token_num = 0
    assigned_tokens = set()

    for s in existing_sessions:
        if s.queue_token:
            assigned_tokens.add(s.queue_token.strip())
            num = extract_token_number(s.queue_token)
            if num is not None and num > max_token_num:
                max_token_num = num

    candidate_num = max(1, max_token_num + 1)
    candidate_token = f"OPD-{room_str}-{candidate_num:02d}"

    # Double check uniqueness against database globally
    while candidate_token in assigned_tokens or db.query(models.PatientSession).filter(
        models.PatientSession.queue_token == candidate_token
    ).first():
        candidate_num += 1
        candidate_token = f"OPD-{room_str}-{candidate_num:02d}"

    return candidate_token


def deduplicate_sessions_for_room(db: Session, room: str) -> int:
    """
    Inspects all sessions in a specific doctor room for duplicate tokens.
    If duplicates exist, preserves the token for the earliest assigned session,
    and assigns new sequential unique tokens to the subsequent sessions.
    Returns number of sessions updated.
    """
    room_str = str(room).strip()
    sessions = db.query(models.PatientSession).filter(
        models.PatientSession.assigned_doctor_room == room_str
    ).all()

    # Sort sessions chronologically: earliest first
    def get_sort_key(s):
        dt = s.queue_assigned_at or s.created_at or datetime.datetime.min
        return dt

    sessions_sorted = sorted(sessions, key=get_sort_key)

    seen_tokens = set()
    used_numbers = set()
    updated_count = 0

    # First pass: collect valid tokens and their numbers
    for s in sessions_sorted:
        if s.queue_token and s.queue_token not in seen_tokens:
            seen_tokens.add(s.queue_token)
            num = extract_token_number(s.queue_token)
            if num is not None:
                used_numbers.add(num)

    # Second pass: reassign duplicates or missing tokens
    claimed_tokens = set()
    for s in sessions_sorted:
        needs_new_token = False
        if not s.queue_token:
            needs_new_token = True
        elif s.queue_token in claimed_tokens:
            needs_new_token = True

        if needs_new_token:
            # Find next free number
            next_num = 1
            while next_num in used_numbers:
                next_num += 1
            
            new_token = f"OPD-{room_str}-{next_num:02d}"
            # Ensure not claimed globally
            while db.query(models.PatientSession).filter(
                models.PatientSession.queue_token == new_token,
                models.PatientSession.id != s.id
            ).first():
                next_num += 1
                new_token = f"OPD-{room_str}-{next_num:02d}"

            s.queue_token = new_token
            used_numbers.add(next_num)
            claimed_tokens.add(new_token)
            updated_count += 1
        else:
            claimed_tokens.add(s.queue_token)

    if updated_count > 0:
        db.commit()

    return updated_count
