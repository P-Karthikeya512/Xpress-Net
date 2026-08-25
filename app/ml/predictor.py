import time
import torch

from pathlib import Path
from PIL import Image as PILImage

from app.ml.preprocess import detect_n_preprocess_image
from app.ml.model import ConvolutionalNetwork
from fastapi import HTTPException

EMOTIONS = ['Angry', 'Disgust', 'Fear', 'Happy', 'Sad', 'Surprise', 'Neutral']

WEIGHTS_PATH = Path(__file__).parent/"emotion_model.pth"
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

def load_model() -> ConvolutionalNetwork:
    model = ConvolutionalNetwork()
    state_dict = torch.load(WEIGHTS_PATH, map_location=device)
    model.load_state_dict(state_dict)
    model.to(device)
    model.eval()
    return model

model = load_model()

def predict_emotion(image : PILImage.Image)->dict:
    start = time.perf_counter()
    try:
        face_tensor = detect_n_preprocess_image(image)
    except HTTPException:
        # Raised when no face or multiple faces are detected
        raise
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Failed to preprocess image",
        )
    face_tensor = face_tensor.to(device)

    with torch.no_grad():
        outputs = model(face_tensor)
        probs = torch.softmax(outputs, dim = 1)
        pred_idx = torch.argmax(probs, dim = 1).item()
        confidence = probs[0][pred_idx].item()

    inference_ms = round((time.perf_counter() - start)*1000, 2)

    return{
        "predicted_emotion" : EMOTIONS[pred_idx],
        "confidence" : round(confidence, 4),
        "inference_ms" : inference_ms
    }