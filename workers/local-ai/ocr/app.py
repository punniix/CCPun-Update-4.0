import asyncio
import hashlib
import hmac
import json
import os
import subprocess
import tempfile
import time
import uuid
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from PIL import Image, ImageOps, UnidentifiedImageError

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
_gate = asyncio.Semaphore(1)

ALLOWED_TYPES = {"image/png", "image/jpeg", "image/webp"}
MAX_BYTES = int(os.environ.get("OCR_MAX_BYTES", str(8 * 1024 * 1024)))
MAX_SIDE = int(os.environ.get("OCR_MAX_SIDE", "2400"))
TIMEOUT = int(os.environ.get("OCR_TIMEOUT_SECONDS", "90"))
TOKEN = os.environ.get("OCR_SHARED_TOKEN", "").strip()
Image.MAX_IMAGE_PIXELS = 20_000_000

def safe_log(event, **fields):
    record = {"event": event, "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), **fields}
    print(json.dumps(record, ensure_ascii=True), flush=True)

def authorized(request: Request):
    header = request.headers.get("authorization", "")
    if len(TOKEN) < 43 or not header.startswith("Bearer "):
        return False
    return hmac.compare_digest(header[7:].strip(), TOKEN)

@app.get("/healthz")
async def health():
    return {
        "status": "ready",
        "engine": "paddleocr",
        "model": "PP-OCRv5/th-mobile",
        "concurrency": 1,
        "storesInput": False,
    }

@app.post("/v1/ocr")
async def ocr(request: Request):
    if not authorized(request):
        raise HTTPException(status_code=401, detail="unauthorized")

    content_type = (request.headers.get("content-type") or "").split(";", 1)[0].strip().lower()
    if content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=415, detail="image-required")

    body = await request.body()
    if not body or len(body) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="image-too-large")

    request_id = str(uuid.uuid4())
    image_digest = hashlib.sha256(body).hexdigest()
    started = time.monotonic()

    async with _gate:
        input_path = None
        try:
            with tempfile.NamedTemporaryFile(dir="/tmp", suffix=".jpg", delete=False) as tmp:
                input_path = Path(tmp.name)

            try:
                from io import BytesIO
                with Image.open(BytesIO(body)) as image:
                    image = ImageOps.exif_transpose(image).convert("RGB")
                    image.thumbnail((MAX_SIDE, MAX_SIDE), Image.Resampling.LANCZOS)
                    image.save(input_path, format="JPEG", quality=88, optimize=True)
            except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
                raise HTTPException(status_code=422, detail="invalid-image")

            proc = await asyncio.to_thread(
                subprocess.run,
                ["python", "/app/ocr_once.py", str(input_path)],
                capture_output=True,
                text=True,
                timeout=TIMEOUT,
                check=False,
                env={**os.environ, "PYTHONUNBUFFERED": "1"},
            )

            if proc.returncode != 0:
                safe_log("ocr-failed", requestId=request_id, category="engine-failure")
                raise HTTPException(status_code=503, detail="ocr-engine-failed")

            try:
                result = json.loads(proc.stdout.strip())
            except json.JSONDecodeError:
                safe_log("ocr-failed", requestId=request_id, category="invalid-engine-output")
                raise HTTPException(status_code=503, detail="ocr-output-invalid")

            elapsed_ms = round((time.monotonic() - started) * 1000)
            safe_log(
                "ocr-succeeded",
                requestId=request_id,
                bytes=len(body),
                durationMs=elapsed_ms,
                lineCount=len(result.get("lines") or []),
            )
            return JSONResponse({
                "requestId": request_id,
                "imageDigestSha256": image_digest,
                "durationMs": elapsed_ms,
                **result,
            })
        except subprocess.TimeoutExpired:
            safe_log("ocr-failed", requestId=request_id, category="timeout")
            raise HTTPException(status_code=504, detail="ocr-timeout")
        finally:
            if input_path is not None:
                try:
                    input_path.unlink(missing_ok=True)
                except Exception:
                    pass
