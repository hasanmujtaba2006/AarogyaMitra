import logging
import base64
import httpx
from config import settings

logger = logging.getLogger("sms_service")

async def send_real_sms(mobile_number: str, otp: str) -> dict:
    """
    Sends a real SMS OTP using configured SMS gateway (Fast2SMS, Twilio, 2Factor),
    with intelligent fallback to terminal logging for local development & hackathons.
    """
    clean_mobile = mobile_number.strip().replace("+91", "").replace(" ", "").replace("-", "")
    sms_message = f"Your AarogyaMitra Kiosk verification OTP is: {otp}. Valid for 5 minutes. Do not share this code with anyone."
    
    # 1. Try Fast2SMS (India Quick DLT/OTP Gateway)
    if settings.FAST2SMS_API_KEY:
        try:
            logger.info(f"Dispatching real SMS OTP to {clean_mobile} via Fast2SMS...")
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    "https://www.fast2sms.com/dev/bulkV2",
                    headers={
                        "authorization": settings.FAST2SMS_API_KEY,
                        "Content-Type": "application/json"
                    },
                    json={
                        "route": "otp",
                        "variables_values": otp,
                        "numbers": clean_mobile
                    }
                )
                data = resp.json()
                if resp.status_code == 200 and data.get("return") is True:
                    logger.info(f"Fast2SMS OTP successfully delivered to {clean_mobile}")
                    return {
                        "success": True,
                        "provider": "Fast2SMS",
                        "message": f"Real SMS OTP dispatched to +91-{clean_mobile}"
                    }
                else:
                    logger.warning(f"Fast2SMS API responded with error: {data}")
        except Exception as e:
            logger.error(f"Failed to send SMS via Fast2SMS: {e}")

    # 2. Try Twilio Gateway
    if settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN and settings.TWILIO_PHONE_NUMBER:
        try:
            logger.info(f"Dispatching real SMS OTP to {clean_mobile} via Twilio...")
            twilio_url = f"https://api.twilio.com/2010-04-01/Accounts/{settings.TWILIO_ACCOUNT_SID}/Messages.json"
            async with httpx.AsyncClient(timeout=10.0) as client:
                auth = (settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
                resp = await client.post(
                    twilio_url,
                    auth=auth,
                    data={
                        "To": f"+91{clean_mobile}",
                        "From": settings.TWILIO_PHONE_NUMBER,
                        "Body": sms_message
                    }
                )
                if resp.status_code in [200, 201]:
                    logger.info(f"Twilio OTP successfully delivered to +91{clean_mobile}")
                    return {
                        "success": True,
                        "provider": "Twilio",
                        "message": f"Real SMS OTP dispatched to +91-{clean_mobile}"
                    }
                else:
                    logger.warning(f"Twilio API responded with error {resp.status_code}: {resp.text}")
        except Exception as e:
            logger.error(f"Failed to send SMS via Twilio: {e}")

    # 3. Try 2Factor.in Gateway
    if settings.TWOFACTOR_API_KEY:
        try:
            logger.info(f"Dispatching real SMS OTP to {clean_mobile} via 2Factor...")
            twofactor_url = f"https://2factor.in/v3/{settings.TWOFACTOR_API_KEY}/SMS/{clean_mobile}/{otp}/OTP1"
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(twofactor_url)
                if resp.status_code == 200:
                    logger.info(f"2Factor OTP successfully delivered to {clean_mobile}")
                    return {
                        "success": True,
                        "provider": "2Factor",
                        "message": f"Real SMS OTP dispatched to +91-{clean_mobile}"
                    }
        except Exception as e:
            logger.error(f"Failed to send SMS via 2Factor: {e}")

    # 4. Terminal & Console Fallback
    print("\n" + "=" * 62)
    print("[SMS-SERVICE] [AAROGYAMITRA REAL OTP DISPATCH - TERMINAL SIMULATION]")
    print(f"   Destination Mobile : +91 {clean_mobile}")
    print(f"   Generated OTP Code : {otp}")
    print("   Validity           : 5 Minutes")
    print("   Provider Notice    : Fallback mode active. Set FAST2SMS_API_KEY")
    print("                        or TWILIO credentials in .env for live carrier SMS.")
    print("=" * 62 + "\n")

    return {
        "success": True,
        "provider": "Terminal/Console",
        "message": f"Demo OTP generated for +91-{clean_mobile} (Check terminal output)"
    }
