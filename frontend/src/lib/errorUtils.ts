/**
 * Universal Human-Friendly Error Handler for AarogyaMitra
 * Guarantees clean, meaningful, contextual error messages across the entire kiosk and doctor portal.
 * Prevents raw exceptions, '[object Object]', or cryptic stack traces from ever reaching the user.
 */

export function extractErrorMessage(err: any, fallback = 'Something went wrong. Please check your details and try again.'): string {
  if (!err) return fallback;

  // 1. If already a clean string
  if (typeof err === 'string') {
    if (err.includes('[object') || err.trim() === '') {
      return fallback;
    }
    return sanitizeTechnicalTerms(err);
  }

  // 2. If object has a detail property (FastAPI format)
  const detail = err.detail || (err.data && err.data.detail) || (err.response && err.response.data && err.response.data.detail);

  if (typeof detail === 'string') {
    if (!detail.includes('[object') && detail.trim() !== '') {
      return sanitizeTechnicalTerms(detail);
    }
  }

  // 3. If FastAPI 422 validation array: [{"loc": ["body", "pin"], "msg": "Value error, ..."}]
  if (Array.isArray(detail)) {
    const formatted = detail
      .map((d: any) => {
        if (typeof d === 'string') return d;
        if (d && typeof d === 'object' && d.msg) {
          const field = Array.isArray(d.loc) ? d.loc[d.loc.length - 1] : '';
          const cleanMsg = String(d.msg).replace(/^Value error,\s*/i, '').trim();
          if (field === 'pin' || field === 'login_pin') {
            return 'PIN must be exactly 6 digits';
          }
          if (field === 'mobile_number') {
            return 'Mobile number must be a valid 10-digit number';
          }
          if (field === 'pin_code') {
            return 'Postal PIN code must be 6 digits';
          }
          if (field === 'age') {
            return 'Please enter a valid age between 1 and 120';
          }
          if (field === 'full_name') {
            return 'Please enter patient full name';
          }
          return field ? `${field}: ${cleanMsg}` : cleanMsg;
        }
        return '';
      })
      .filter(Boolean)
      .join('. ');

    if (formatted) return sanitizeTechnicalTerms(formatted);
  }

  // 4. If detail is an object
  if (typeof detail === 'object' && detail !== null) {
    if (typeof detail.msg === 'string') return sanitizeTechnicalTerms(detail.msg);
    if (typeof detail.message === 'string') return sanitizeTechnicalTerms(detail.message);
    if (typeof detail.error === 'string') return sanitizeTechnicalTerms(detail.error);
  }

  // 5. If standard Error object or has message string
  let rawMsg = '';
  if (err instanceof Error) {
    rawMsg = err.message || '';
  } else if (typeof err.message === 'string') {
    rawMsg = err.message;
  } else if (typeof err.error === 'string') {
    rawMsg = err.error;
  } else if (typeof err.error_description === 'string') {
    rawMsg = err.error_description;
  }

  if (rawMsg && !rawMsg.includes('[object') && rawMsg.trim() !== '') {
    return sanitizeTechnicalTerms(rawMsg);
  }

  // 6. Check err.data or err.response.data directly
  const data = err.data || (err.response && err.response.data);
  if (data && typeof data === 'object') {
    if (typeof data.message === 'string' && !data.message.includes('[object')) {
      return sanitizeTechnicalTerms(data.message);
    }
    if (typeof data.error === 'string' && !data.error.includes('[object')) {
      return sanitizeTechnicalTerms(data.error);
    }
  }

  return fallback;
}

/**
 * Transforms common backend/Firebase/network exceptions into polished, human-friendly explanations.
 */
export function sanitizeTechnicalTerms(msg: string): string {
  if (!msg || typeof msg !== 'string') return 'An error occurred. Please try again.';

  const trimmed = msg.trim();
  const lower = trimmed.toLowerCase();

  // If already an object representation, discard
  if (lower.includes('[object object]')) {
    return 'Invalid details entered. Please check and try again.';
  }

  // PIN Errors
  if ((lower.includes('incorrect') || lower.includes('wrong') || lower.includes('invalid')) && (lower.includes('pin') || lower.includes('password'))) {
    return 'Incorrect 6-digit Login PIN. Please check your PIN and re-enter.';
  }
  if (lower.includes('pin') && (lower.includes('digit') || lower.includes('6 digit') || lower.includes('length'))) {
    return 'Please enter a valid 6-digit Login PIN.';
  }

  // Mobile / Registration Errors
  if (lower.includes('no patient registered') || (lower.includes('not registered') && lower.includes('mobile'))) {
    return 'Mobile number is not registered yet. Please tap "Register as New Patient".';
  }
  if (lower.includes('already exists') || lower.includes('already registered')) {
    return 'This mobile number is already registered. Please login with your 6-digit PIN.';
  }
  if (lower.includes('10 digit') || (lower.includes('invalid') && lower.includes('mobile'))) {
    return 'Please enter a valid 10-digit Indian mobile number.';
  }

  // OTP Errors
  if (lower.includes('invalid otp') || lower.includes('invalid-verification-code') || lower.includes('incorrect otp')) {
    return 'Incorrect OTP code. Please check the SMS on your mobile phone and try again.';
  }
  if (lower.includes('expired') && lower.includes('otp')) {
    return 'OTP has expired. Please tap "Resend OTP" to receive a fresh code.';
  }
  if (lower.includes('too many') || lower.includes('too-many-requests')) {
    return 'Too many attempts. For security, please wait a minute before trying again.';
  }

  // Auth / Credentials
  if (lower.includes('invalid credentials') || lower.includes('unauthorized') || lower.includes('invalid doctor login') || lower.includes('invalid admin credentials')) {
    return 'Invalid username or password. Please verify your credentials and try again.';
  }

  // Network / Connection
  if (lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('econnrefused')) {
    return 'Unable to connect to the hospital server. Please check your network connection or try again shortly.';
  }
  if (lower.includes('500') || lower.includes('internal server error')) {
    return 'Hospital server error. Please retry in a few moments or notify the kiosk desk.';
  }
  if (lower.includes('404') || lower.includes('not found')) {
    return 'Requested record or service was not found. Please verify details.';
  }

  // Clean technical prefixes
  return trimmed
    .replace(/^Value error,\s*/i, '')
    .replace(/^Error:\s*/i, '')
    .replace(/^HTTPException:\s*/i, '')
    .replace(/^(400|401|403|404|422|500):\s*/, '');
}
