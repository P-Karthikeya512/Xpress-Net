# ─────────────────────────────────────────────────────────────
# Xpress-Net  ·  Production Dockerfile  ·  CPU-only
# ─────────────────────────────────────────────────────────────
FROM python:3.12-slim

# ── Python container best-practices ──────────────────────────
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# ── System libraries required by OpenCV-headless / Pillow ────
#    libgl1 + libglib2.0-0  → OpenCV-headless core deps
#    libsm6 libxext6 libxrender1 → image-format helpers
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        libgl1 \
        libglib2.0-0 \
        libsm6 \
        libxext6 \
        libxrender1 \
    && rm -rf /var/lib/apt/lists/*

# ── Working directory ────────────────────────────────────────
#    The app uses relative paths like "app/static", "app/ml/",
#    "app/uploads", so CWD must be the repo root equivalent.
WORKDIR /app-root

# ── Install Python dependencies (layer-cached) ──────────────
#    1. Install CPU-only PyTorch + torchvision FIRST from the
#       official CPU index.  This avoids pulling ~2 GB of CUDA
#       runtime when the generic "torch" line in requirements.txt
#       is processed (pip sees them as already satisfied).
#    2. Then install the rest of requirements.txt normally.
COPY app/requirements.txt .

RUN pip install --no-cache-dir \
        torch torchvision \
        --index-url https://download.pytorch.org/whl/cpu && \
    pip install --no-cache-dir -r requirements.txt

# ── Copy application source + ML model weights ──────────────
#    Model files (app/ml/emotion_model.pth, app/ml/yolov8n-face.pt)
#    are git-tracked and included via COPY.
COPY app/ app/

# ── Ensure the uploads directory exists ──────────────────────
RUN mkdir -p app/uploads

# ── Runtime configuration ────────────────────────────────────
#    PORT is set by hosting platforms (HF Spaces default: 7860).
#    MYSQL_CA_PATH should be overridden to point at a mounted
#    secret, e.g. /etc/secrets/ca.pem
ENV PORT=7860

EXPOSE ${PORT}

# ── Start the application ────────────────────────────────────
#    Single-process Uvicorn; no --reload.
#    Shell form so ${PORT} is expanded at runtime.
CMD uvicorn app.main:api --host 0.0.0.0 --port ${PORT}
