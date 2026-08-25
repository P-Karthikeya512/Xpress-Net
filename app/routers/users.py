import uuid
import shutil
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from PIL import Image
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_active_user
from app.ml.predictor import predict_emotion
from app.models import History, Users
from app.schemas import HistoryOut

router = APIRouter(prefix="/api", tags=["api"])

# Store uploads OUTSIDE public static files for privacy
UPLOAD_DIR = Path("app/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_TYPES = {"image/jpeg", "image/png"}
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png"}


@router.post("/predict", response_model=HistoryOut, status_code=status.HTTP_201_CREATED)
def predict(
    file: UploadFile = File(...),
    current_user: Users = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Only JPG and PNG images are allowed")

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Invalid file extension")

    filename = f"{uuid.uuid4().hex}{ext}"
    file_path = UPLOAD_DIR / filename

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        try:
            image = Image.open(file_path).convert("RGB")
        except Exception:
            file_path.unlink(missing_ok=True)
            raise HTTPException(status_code=400, detail="Invalid image file")

        try:
            result = predict_emotion(image)
        except HTTPException:
            file_path.unlink(missing_ok=True)
            raise
        finally:
            image.close()

        history = History(
            user_id=current_user.id,
            image_path=filename,   # store only filename
            predicted_emotion=result.get("predicted_emotion"),
            confidence=result.get("confidence"),
        )

        db.add(history)
        db.commit()
        db.refresh(history)

        history.inference_ms = result.get("inference_ms")

        return history

    except HTTPException:
        raise

    except Exception:
        db.rollback()
        file_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail="Something went wrong")

    finally:
        file.file.close()


@router.get("/history", response_model=list[HistoryOut])
def get_history(
    current_user: Users = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(History)
        .filter(History.user_id == current_user.id)
        .order_by(History.created_at.desc())
        .all()
    )


@router.get("/history/{history_id}/image")
def get_history_image(
    history_id: int,
    current_user: Users = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    record = (
        db.query(History)
        .filter(
            History.id == history_id,
            History.user_id == current_user.id,
        )
        .first()
    )

    if not record:
        raise HTTPException(status_code=404, detail="Not found")

    file_path = UPLOAD_DIR / record.image_path

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Image file not found")

    return FileResponse(file_path)