"""Server-side EmailJS transport. Credentials are read only from server environment."""

import logging
import os
import time
from typing import Any, Dict

import requests
from dotenv import load_dotenv

from app.observability import elapsed_ms, log_event, mask_email, safe_error

load_dotenv()

EMAILJS_API_URL = "https://api.emailjs.com/api/v1.0/email/send"
logger = logging.getLogger(__name__)


def _emailjs_config() -> tuple[str, str, str, str]:
    """Read credentials at call time so dotenv/runtime env changes are honored."""
    return (
        os.getenv("EMAILJS_SERVICE_ID", "").strip(),
        os.getenv("EMAILJS_TEMPLATE_ID", "").strip(),
        os.getenv("EMAILJS_PUBLIC_KEY", "").strip(),
        os.getenv("EMAILJS_PRIVATE_KEY", "").strip(),
    )


def send_otp_via_emailjs(to_email: str, otp_code: str, action_type: str = "signup") -> Dict[str, Any]:
    """Send a validated auth OTP without exposing provider responses or secrets in logs."""
    started = time.perf_counter()
    recipient = mask_email(to_email)
    log_event(logger, logging.INFO, "emailjs_send_started", action=action_type, recipient=recipient)
    service_id, template_id, public_key, private_key = _emailjs_config()
    if not all((service_id, template_id, public_key, private_key)):
        log_event(logger, logging.ERROR, "emailjs_configuration_missing", action=action_type)
        return {"success": False, "error": "email_delivery_not_configured"}
    if not to_email or len(to_email) > 254 or not otp_code or len(otp_code) > 8:
        log_event(logger, logging.ERROR, "emailjs_payload_invalid", recipient=recipient)
        return {"success": False, "error": "invalid_email_payload"}
    if action_type not in {"signup", "recovery"}:
        log_event(logger, logging.ERROR, "emailjs_action_invalid", action=action_type)
        return {"success": False, "error": "unsupported_email_action"}

    action_label = "استعادة كلمة المرور" if action_type == "recovery" else "تأكيد الحساب"
    subject = "رمز استعادة كلمة المرور — نبيه SafeLink" if action_type == "recovery" else "رمز تأكيد حسابك — نبيه SafeLink"
    payload = {
        "service_id": service_id,
        "template_id": template_id,
        "user_id": public_key,
        "accessToken": private_key,
        "template_params": {
            "email": to_email,
            "to_name": to_email.split("@", 1)[0],
            "otp": otp_code,
            "subject": subject,
            "app_name": "Nabeh SafeLink",
            "action_type": action_label,
        },
    }
    try:
        response = requests.post(
            EMAILJS_API_URL,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=10,
        )
        if response.status_code == 200:
            log_event(logger, logging.INFO, "emailjs_send_succeeded", action=action_type, recipient=recipient, duration_ms=elapsed_ms(started))
            return {"success": True}
        if response.status_code == 403:
            return {"success": False, "error": "email_provider_server_access_disabled"}
        if response.status_code == 429:
            return {"success": False, "error": "email_provider_rate_limited"}
        if response.status_code in {400, 404}:
            error_code = "email_provider_bad_request" if response.status_code == 400 else "email_provider_resource_not_found"
        elif response.status_code in {401, 402}:
            error_code = "email_provider_authentication_failed"
        else:
            error_code = "email_provider_rejected_request"
        # Provider bodies may contain request identifiers, PII, or credentials;
        # expose only the status code in application logs.
        log_event(logger, logging.ERROR, "emailjs_send_failed", action=action_type, recipient=recipient, status=response.status_code, duration_ms=elapsed_ms(started))
        return {"success": False, "error": error_code}
    except requests.RequestException as error:
        log_event(logger, logging.ERROR, "emailjs_connection_failed", action=action_type, recipient=recipient, error_type=safe_error(error), duration_ms=elapsed_ms(started))
        return {"success": False, "error": "email_provider_unavailable"}
