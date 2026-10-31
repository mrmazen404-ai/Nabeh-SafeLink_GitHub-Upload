import logging
import re
import time
from contextlib import asynccontextmanager
from pathlib import Path
from uuid import uuid4
from urllib.parse import urlsplit

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.concurrency import run_in_threadpool

from app.config import settings
from app.auth.routes import router as auth_router
from app.scans.routes import router as scans_router
from app.statistics.routes import router as stats_router
from app.dashboard.routes import router as dashboard_router
from app.support.routes import router as support_router
from app.legal.routes import router as legal_router
from app.admin.routes import router as admin_router
from app.admin.settings_routes import router as admin_settings_router
from app.public.routes import router as public_router
from app.legal.terms_consent import router as terms_consent_router
from app.system_settings import SystemSettingsUnavailable, get_system_settings
from app.observability import configure_logging, elapsed_ms, install_request_id_filter, log_event, reset_request_id, set_request_id, safe_error, safe_error_code
from app.ml.predictor import get_model_readiness
from app.gemini.client import get_provider_readiness
from app.virustotal.client import get_provider_readiness as get_virustotal_readiness

configure_logging()
install_request_id_filter()
logger = logging.getLogger(__name__)

@asynccontextmanager
async def application_lifespan(_app: FastAPI):
    settings.validate_admin_security()
    log_event(
        logger,
        logging.INFO,
        "application_started",
        app_name=settings.APP_NAME,
        version=settings.APP_VERSION,
        cors_origins=len(settings.CORS_ALLOWED_ORIGINS),
    )
    yield
    log_event(logger, logging.INFO, "application_stopped")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Nabeh SafeLink API — Intelligent Fraud Detection System",
    lifespan=application_lifespan,
)

if not settings.CORS_ALLOWED_ORIGINS or any(origin == "*" for origin in settings.CORS_ALLOWED_ORIGINS):
    raise RuntimeError("NABEH_CORS_ALLOWED_ORIGINS must contain explicit origins; wildcard is forbidden.")
for origin in settings.CORS_ALLOWED_ORIGINS:
    parsed_origin = urlsplit(origin)
    local_http = parsed_origin.scheme == "http" and parsed_origin.hostname in {"localhost", "127.0.0.1"}
    if not parsed_origin.netloc or (parsed_origin.scheme != "https" and not local_http) or parsed_origin.path:
        raise RuntimeError("Every CORS origin must be an HTTPS origin (localhost HTTP is development-only).")

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.CORS_ALLOWED_ORIGINS),
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
    expose_headers=["X-Request-ID"],
)

app.include_router(auth_router, prefix="/api/v1/auth", tags=["Auth"])
app.include_router(scans_router, prefix="/api/v1/scans", tags=["Scans"])
app.include_router(stats_router, prefix="/api/v1/statistics", tags=["Statistics"])
app.include_router(dashboard_router, prefix="/api/v1/dashboard", tags=["Dashboard"])
app.include_router(support_router, prefix="/api/v1/support", tags=["Support"])
app.include_router(legal_router, prefix="/api/v1/legal", tags=["Legal"])
app.include_router(terms_consent_router)
app.include_router(admin_router)
app.include_router(admin_settings_router)
app.include_router(public_router, prefix="/api/v1")


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    supplied_request_id = (request.headers.get("x-request-id") or "").strip()
    # Accept only a short, log-safe correlation value.  Invalid or multiline
    # values are replaced rather than echoed into logs or response headers.
    request_id_value = (
        supplied_request_id
        if len(supplied_request_id) <= 128 and re.fullmatch(r"[A-Za-z0-9._:-]+", supplied_request_id)
        else str(uuid4())
    )
    request_token = set_request_id(request_id_value)
    request.state.request_id = request_id_value
    started = time.perf_counter()
    log_event(logger, logging.INFO, "request_started", method=request.method, route=request.url.path, user_context="system")
    response = None
    try:
        path = request.url.path
        is_admin_path = path == "/api/v1/admin" or path.startswith("/api/v1/admin/")
        is_runtime_config = path == "/api/v1/public/runtime-config"
        is_health = path in {"/health", "/api/v1/health", "/ready", "/api/v1/ready"}
        if path.startswith("/api/v1/") and not (is_admin_path or is_runtime_config or is_health):
            try:
                maintenance_mode = await run_in_threadpool(
                    lambda: get_system_settings()["system.maintenance_mode"]
                )
            except SystemSettingsUnavailable:
                response = JSONResponse(
                    status_code=503,
                    content={"detail": "خدمة النظام غير متاحة مؤقتاً"},
                    headers={"Cache-Control": "no-store"},
                )
            else:
                if maintenance_mode:
                    response = JSONResponse(
                        status_code=503,
                        content={"detail": "النظام في وضع الصيانة حالياً"},
                        headers={"Cache-Control": "no-store"},
                    )
                else:
                    response = await call_next(request)
        else:
            response = await call_next(request)
        log_event(
            logger,
            logging.INFO if response.status_code < 400 else logging.WARNING,
            "request_succeeded" if response.status_code < 400 else "request_failed",
            method=request.method,
            route=request.url.path,
            status=response.status_code,
            duration_ms=elapsed_ms(started),
        )
        response.headers["X-Request-ID"] = request_id_value
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        if request.url.scheme == "https":
            response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        return response
    except Exception as error:
        log_event(
            logger,
            logging.ERROR,
            "request_failed",
            method=request.method,
            route=request.url.path,
            error_type=safe_error(error),
            error_code=safe_error_code(error),
            duration_ms=elapsed_ms(started),
        )
        raise
    finally:
        reset_request_id(request_token)


def request_id_for_header() -> str:
    """Read the current request id without exposing implementation details."""
    from app.observability import request_id

    return request_id()


@app.get("/health")
@app.get("/api/v1/health")
def health(response: Response):
    ml_readiness = get_model_readiness()
    virustotal_readiness = get_virustotal_readiness()
    gemini_readiness = get_provider_readiness()
    data = {
        "status": "healthy",
        "readiness": "ready" if ml_readiness.get("status") == "ready" and virustotal_readiness.get("status") == "configured" else "degraded",
        "ml_model": ml_readiness,
        "gemini": gemini_readiness,
        "virustotal": virustotal_readiness,
    }
    log_event(logger, logging.INFO, "health_liveness_completed", status="succeeded", readiness=data["readiness"], provider="LOCAL")
    return data


@app.get("/ready")
@app.get("/api/v1/ready")
def readiness(response: Response):
    """Readiness is separate from liveness and never calls external providers."""
    ml = get_model_readiness()
    vt = get_virustotal_readiness()
    gemini = get_provider_readiness()
    ready = ml.get("status") == "ready" and vt.get("status") == "configured"
    if not ready:
        response.status_code = 503
    log_event(
        logger,
        logging.INFO if ready else logging.WARNING,
        "readiness_check_completed",
        status="succeeded" if ready else "degraded",
        ml_status=ml.get("status"),
        virustotal_status=vt.get("status"),
        gemini_status=gemini.get("status"),
    )
    return {"status": "ready" if ready else "degraded", "ml_model": ml, "virustotal": vt, "gemini": gemini}


# Local production-like mode: one URL serves both the built React app and the API.
# Vercel and Vite deployments can continue to use their own frontend serving path.
def _resolve_frontend_dist() -> Path:
    candidates = [
        Path.cwd() / "frontend" / "dist",
        Path(__file__).resolve().parent.parent.parent / "frontend" / "dist",
        Path(__file__).resolve().parent.parent / "frontend" / "dist",
    ]
    for candidate in candidates:
        if (candidate / "index.html").is_file():
            return candidate
    return candidates[0]


FRONTEND_DIST = _resolve_frontend_dist()
FRONTEND_INDEX = FRONTEND_DIST / "index.html"

if FRONTEND_INDEX.is_file():
    assets_dir = FRONTEND_DIST / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="frontend-assets")

    @app.get("/", include_in_schema=False)
    async def frontend_root():
        return FileResponse(
            FRONTEND_INDEX,
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
                "Pragma": "no-cache",
                "Expires": "0",
            }
        )

    @app.get("/{full_path:path}", include_in_schema=False)
    async def frontend_spa(full_path: str):
        if full_path.startswith("api/") or full_path in {"docs", "redoc", "openapi.json", "health"}:
            raise HTTPException(status_code=404, detail="Not found")
        requested = (FRONTEND_DIST / full_path).resolve()
        if requested.is_file() and FRONTEND_DIST.resolve() in requested.parents:
            media_type = None
            if requested.suffix == ".css":
                media_type = "text/css"
            elif requested.suffix == ".js":
                media_type = "application/javascript"
            elif requested.suffix == ".svg":
                media_type = "image/svg+xml"
            elif requested.suffix == ".json":
                media_type = "application/json"
            return FileResponse(
                requested,
                media_type=media_type,
                headers={"Cache-Control": "public, max-age=31536000, immutable"}
            )
        if FRONTEND_INDEX.is_file():
            return FileResponse(
                FRONTEND_INDEX,
                headers={
                    "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
                    "Pragma": "no-cache",
                    "Expires": "0",
                }
            )
        raise HTTPException(status_code=404, detail="Not found")
