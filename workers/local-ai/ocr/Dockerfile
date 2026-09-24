FROM python:3.10-slim-bookworm

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    HOME=/home/ocr \
    PADDLE_PDX_MODEL_SOURCE=BOS

RUN apt-get update \
    && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 10001 ocr

WORKDIR /app

COPY workers/local-ai/ocr/requirements.txt /app/requirements.txt
RUN python -m pip install --no-cache-dir paddlepaddle==3.2.0 \
      -i https://www.paddlepaddle.org.cn/packages/stable/cpu/ \
    && python -m pip install --no-cache-dir -r /app/requirements.txt

COPY workers/local-ai/ocr/app.py /app/app.py
COPY workers/local-ai/ocr/ocr_once.py /app/ocr_once.py
COPY workers/local-ai/ocr/preload.py /app/preload.py

RUN mkdir -p /home/ocr/.paddlex \
    && chown -R ocr:ocr /home/ocr /app

USER ocr

CMD ["python", "-m", "uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8788", "--workers", "1", "--no-access-log"]
