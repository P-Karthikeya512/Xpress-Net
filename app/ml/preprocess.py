from ultralytics import YOLO
from PIL import Image as PILImage
import numpy as np
import torch
from torchvision import transforms
from fastapi import HTTPException
from pathlib import Path


MODEL_PATH = Path(__file__).parent / "yolov8n-face.pt"

face_model = YOLO(MODEL_PATH)

eval_transform = transforms.Compose([
    transforms.Grayscale(num_output_channels=1),
    transforms.Resize((75, 75)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.5], std=[0.5])
])

def detect_n_preprocess_image(image : PILImage.Image) -> torch.Tensor:
    img_array = np.array(image.convert("RGB"))

    result = face_model(img_array, conf=0.5, verbose=False)[0]
    boxes = result.boxes

    if boxes is None or len(boxes) == 0:
        raise HTTPException(status_code=400, detail="No face detected in the image")

    if len(boxes) > 1:
        raise HTTPException(
            status_code=400,
            detail="Multiple faces detected. Please upload an image containing only one face."
        )

    x1, y1, x2, y2 = boxes.xyxy[0].cpu().numpy().astype(int)

    h, w = img_array.shape[:2]

    box_w = x2 - x1
    box_h = y2 - y1

    padding = 0.10

    pad_x = int(box_w * padding)
    pad_y = int(box_h * padding)

    x1 = max(0, x1 - pad_x)
    y1 = max(0, y1 - pad_y)
    x2 = min(w, x2 + pad_x)
    y2 = min(h, y2 + pad_y)

    if x2 <= x1 or y2 <= y1:
        raise HTTPException(status_code=400, detail="Invalid face crop")

    face_crop = img_array[y1:y2, x1:x2]
    if face_crop.size == 0:
        raise HTTPException(status_code=400, detail="Invalid face crop")

    face_pil = PILImage.fromarray(face_crop)

    tensor = eval_transform(face_pil)
    tensor = tensor.unsqueeze(0)  # [1, 1, 75, 75]
    return tensor