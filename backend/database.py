import json
import socket
import time
import urllib.request
from urllib.parse import urlparse

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from config import settings

connect_args = {}
engine_kwargs = {
    "echo": settings.DEBUG,
    "pool_pre_ping": True,
}

def resolve_hostaddr(url: str) -> str | None:
    """
    Resolves hostname to IP address to bypass unreliable or restricted
    local ISP / Wi-Fi DNS servers that refuse resolution for cloud endpoints.
    Uses Google DNS-over-HTTPS (DoH) fallback or known AWS Neon IP pool.
    """
    try:
        parsed = urlparse(url)
        hostname = parsed.hostname
        if not hostname or hostname in ("localhost", "127.0.0.1", "::1"):
            return None

        # 1. Try local system DNS
        try:
            ip = socket.gethostbyname(hostname)
            return ip
        except Exception:
            pass

        # 2. Try Google Public DNS-over-HTTPS fallback
        try:
            req = urllib.request.Request(
                f"https://dns.google/resolve?name={hostname}&type=A",
                headers={"User-Agent": "Mozilla/5.0"}
            )
            with urllib.request.urlopen(req, timeout=4) as response:
                data = json.loads(response.read().decode())
                for ans in data.get("Answer", []):
                    if ans.get("type") == 1:
                        resolved_ip = ans.get("data")
                        if resolved_ip:
                            print(f"Database DNS: Resolved {hostname} to {resolved_ip} via Google DoH.")
                            return resolved_ip
        except Exception as doh_err:
            print(f"Database DNS: DoH fallback notice ({doh_err}).")

        # 3. Known Neon us-east-2 AWS gateway fallback
        if "neon.tech" in hostname:
            fallback_ip = "18.226.144.228"
            print(f"Database DNS: Using fallback IP {fallback_ip} for {hostname}.")
            return fallback_ip

    except Exception as e:
        print(f"Database DNS helper notice: {e}")
    return None

if settings.DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
else:
    # PostgreSQL (Neon Serverless) configurations
    connect_args = {
        "connect_timeout": 15  # Gives Neon 15 seconds to wake up from cold start
    }
    resolved_ip = resolve_hostaddr(settings.DATABASE_URL)
    if resolved_ip:
        connect_args["hostaddr"] = resolved_ip

    engine_kwargs["pool_recycle"] = 300  # Recycle connections every 5 minutes

engine = None
connected_successfully = False

# If configured with Neon or remote PostgreSQL, retry up to 4 times with backoff
# to handle cold starts and transient ISP DNS packet drops
max_retries = 4 if not settings.DATABASE_URL.startswith("sqlite") else 1

for attempt in range(1, max_retries + 1):
    try:
        temp_engine = create_engine(
            settings.DATABASE_URL,
            connect_args=connect_args,
            **engine_kwargs
        )
        with temp_engine.connect() as conn:
            pass
        engine = temp_engine
        connected_successfully = True
        print(f"Database: Connected to primary database successfully (Attempt {attempt}).")
        break
    except Exception as e:
        err_str = str(e).lower()
        if "psycopg" in err_str or "no module" in err_str:
            print(f"Database Notice: PostgreSQL driver not installed ({e}). Falling back to local SQLite immediately.")
            break
        if attempt < max_retries:
            print(f"Database Notice: Primary connection attempt {attempt} failed ({e}). Retrying in 1.5s...")
            time.sleep(1.5)
        else:
            print(f"Database Warning: Could not connect to configured DATABASE_URL after {max_retries} attempts ({e}). Falling back to local SQLite.")

if not connected_successfully:
    engine = create_engine(
        "sqlite:///./aarogyamitra.db",
        connect_args={"check_same_thread": False},
        echo=settings.DEBUG,
        pool_pre_ping=True
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependency to get db session in FastAPI routes
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
