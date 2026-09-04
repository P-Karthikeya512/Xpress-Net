import time
from functools import lru_cache
from pathlib import Path

import torch
from fastapi import HTTPException
from PIL import Image as PILImage

from app.ml.preprocess import detect_n_preprocess_image
from app.ml.model import ConvolutionalNetwork


EMOTIONS = [
    "Angry",
    "Disgust",
    "Fear",
    "Happy",
    "Sad",
    "Surprise",
    "Neutral",
]

WEIGHTS_PATH = Path(__file__).parent / "emotion_model.pth"

device = torch.device(
    "cuda" if torch.cuda.is_available() else "cpu"
)


@lru_cache(maxsize=1)
def load_model() -> ConvolutionalNetwork:
    model = ConvolutionalNetwork()

    state_dict = torch.load(
        WEIGHTS_PATH,
        map_location=device
    )

    model.load_state_dict(state_dict)
    model.to(device)
    model.eval()

    return model


def predict_emotion(image: PILImage.Image) -> dict:
    start = time.perf_counter()

    try:
        face_tensor = detect_n_preprocess_image(image)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Failed to preprocess image",
        )

    model = load_model()

    face_tensor = face_tensor.to(device)

    with torch.no_grad():
        outputs = model(face_tensor)

        probs = torch.softmax(outputs, dim=1)

        pred_idx = torch.argmax(
            probs,
            dim=1
        ).item()

        confidence = probs[0][pred_idx].item()

    inference_ms = round(
        (time.perf_counter() - start) * 1000,
        2
    )

    return {
        "predicted_emotion": EMOTIONS[pred_idx],
        "confidence": round(confidence, 4),
        "inference_ms": inference_ms,
    }