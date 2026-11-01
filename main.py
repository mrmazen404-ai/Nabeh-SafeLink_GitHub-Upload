"""ASGI entrypoint for the Nabeh SafeLink deployment."""
from pathlib import Path
import sys
import zipfile

from fastapi.responses import FileResponse, JSONResponse

ROOT = Path(__file__).resolve().parent
LOCAL_BACKEND = ROOT / "backend"
BACKEND_ARCHIVE = ROOT / "backend_bundle.zip"
BACKEND_RUNTIME = Path("/tmp/nabeh_backend_bundle")

# Prefer local backend source if present for live development, otherwise extract bundle
if LOCAL_BACKEND.exists() and (LOCAL_BACKEND / "app").exists():
    if str(LOCAL_BACKEND) not in sys.path:
        sys.path.insert(0, str(LOCAL_BACKEND))
else:
    if not BACKEND_RUNTIME.exists():
        BACKEND_RUNTIME.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(BACKEND_ARCHIVE) as archive:
            archive.extractall(BACKEND_RUNTIME)

    if str(BACKEND_RUNTIME) not in sys.path:
        sys.path.insert(0, str(BACKEND_RUNTIME))

from app.main import app  # noqa: E402

# Keep API routes ahead of this SPA fallback.  FastAPI has no ``app.frontend``
# helper; serving the built files explicitly also makes local and Vercel
# behavior consistent.
def _resolve_frontend_dist() -> Path:
    candidates = [
        Path.cwd() / "frontend" / "dist",
        ROOT / "frontend" / "dist",
        Path(__file__).resolve().parent / "frontend" / "dist",
    ]
    for candidate in candidates:
        if (candidate / "index.html").is_file():
            return candidate
    return candidates[0]


FRONTEND_DIST = _resolve_frontend_dist()
FRONTEND_INDEX = FRONTEND_DIST / "index.html"


@app.get("/{full_path:path}", include_in_schema=False)
async def frontend_fallback(full_path: str):
    # Unknown API paths must remain API 404s; they must not receive index.html.
    # The same rule prevents the SPA fallback from masking health/docs routes.
    if full_path == "health" or full_path == "openapi.json" or full_path.startswith(("api/", "docs", "redoc")):
        return JSONResponse({"detail": "Not found"}, status_code=404)
    if not FRONTEND_INDEX.is_file():
        return JSONResponse({"detail": "Frontend build is unavailable"}, status_code=404)

    requested = (FRONTEND_DIST / full_path).resolve()
    try:
        requested.relative_to(FRONTEND_DIST.resolve())
    except ValueError:
        return JSONResponse({"detail": "Not found"}, status_code=404)

    if requested.is_file():
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
    return FileResponse(
        FRONTEND_INDEX,
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0",
        }
    )
