# XpressNet

**AI-powered facial emotion recognition, served through a FastAPI backend with JWT-secured user accounts and a lightweight web dashboard.**

Upload a photo, XpressNet detects the face in it, classifies the expression into one of seven emotions, and keeps a private history of every prediction you make.

---

## How it works

1. **Face detection** — a YOLOv8 (`yolov8n-face`) model locates a single face in the uploaded image and crops it (with a small margin).
2. **Preprocessing** — the crop is converted to grayscale, resized to 75×75, and normalized.
3. **Classification** — a custom 4-block convolutional neural network (built in PyTorch) predicts one of 7 emotions and returns a confidence score.
4. **Persistence** — the image and the prediction are saved to the signed-in user's history in the database.

**Emotions recognized:** Angry · Disgust · Fear · Happy · Sad · Surprise · Neutral

### Model performance

The CNN was trained for 50 epochs on a labeled, class-balanced facial-expression image dataset (organized into `train` / `val` / `test` splits) and reached:

| Metric | Score |
|---|---|
| Best validation accuracy | 92.11% |
| Test accuracy | 92.00% |

Per-class test accuracy:

| Emotion | Accuracy |
|---|---|
| Angry | 97.65% |
| Disgust | 92.94% |
| Fear | 99.83% |
| Happy | 89.75% |
| Neutral | 78.66% |
| Sad | 88.74% |
| Surprise | 96.47% |

The full training pipeline — data loading, augmentation, the model definition, the training/validation loop, and evaluation — is in [`train.ipynb`](./train.ipynb).

---

## Features

- **Face-based emotion prediction** from an uploaded JPG/PNG image
- **JWT authentication** with short-lived access tokens and rotating, revocable refresh tokens
- **Per-user prediction history**, including the original uploaded image and the predicted emotion/confidence
- **Web dashboard** (vanilla HTML/CSS/JS + Tailwind) for signing up, logging in, uploading images (gallery or camera), and browsing history
- Uploaded images are stored outside the public static directory and are only accessible to the account that uploaded them

---

## Tech stack

| Layer | Technology |
|---|---|
| API | FastAPI |
| ML / inference | PyTorch, Ultralytics YOLOv8 (face detection) |
| Database ORM | SQLAlchemy |
| Auth | PyJWT + `pwdlib` password hashing |
| Frontend | Static HTML/CSS/JS with Tailwind |
| Config | `pydantic-settings` |

---

## Project structure

```
Xpress-Net/
├── app/
│   ├── main.py            # FastAPI app entrypoint
│   ├── config.py          # Environment-driven settings
│   ├── database.py        # SQLAlchemy engine/session setup
│   ├── models.py          # Users, History, RefreshToken tables
│   ├── schemas.py         # Pydantic request/response models
│   ├── security.py        # Password hashing + JWT issuing/verification
│   ├── dependencies.py    # Auth dependencies (current user, etc.)
│   ├── ml/
│   │   ├── model.py       # CNN architecture
│   │   ├── predictor.py   # Loads weights, runs inference
│   │   ├── preprocess.py  # Face detection + tensor preprocessing
│   │   ├── emotion_model.pth   # (not tracked in git — see Setup)
│   │   └── yolov8n-face.pt     # (not tracked in git — see Setup)
│   ├── routers/
│   │   ├── auth.py        # /auth/register, /auth/login, /auth/refresh, /auth/logout
│   │   └── users.py       # /api/predict, /api/history, /api/history/{id}/image
│   └── static/             # Dashboard, login, and history pages (HTML/CSS/JS)
├── train.ipynb              # Model training & evaluation notebook
└── requirments.txt          # Python dependencies (see note below)
```

---

## Getting started

### Prerequisites

- Python 3.10+
- pip (or a virtual environment tool of your choice)

### 1. Clone the repository

```bash
git clone https://github.com/P-Karthikeya512/Xpress-Net.git
cd Xpress-Net
```

### 2. Create a virtual environment and install dependencies

```bash
python -m venv venv
source venv/bin/activate        # on Windows: venv\Scripts\activate
pip install -r requirments.txt
```

> **Note:** `requirments.txt` covers the data-science/model-training dependencies (PyTorch, pandas, scikit-learn, etc.). To run the **API server** you'll also need the web-layer packages it imports, which aren't currently listed in that file:
>
> ```bash
> pip install fastapi "uvicorn[standard]" sqlalchemy pydantic-settings \
>             pyjwt pwdlib[argon2] python-multipart ultralytics
> ```

### 3. Configure environment variables

The app reads settings from `app/.env`. Create that file with at least:

```env
sqlalchemy_database_url=sqlite:///./xpressnet.db
secret_key=replace-this-with-a-long-random-secret
algorithm=HS256
access_token_expire_minutes=15
refresh_token_expire_days=7
```

Swap `sqlalchemy_database_url` for a Postgres/MySQL URL if you don't want SQLite.

### 4. Add the model weights

Trained model files are not committed to the repository (see `.gitignore`). Place the following files in `app/ml/` before starting the server:

- `emotion_model.pth` — the trained CNN weights (produced by `train.ipynb`, saved via `torch.save(model.state_dict(), ...)`)
- `yolov8n-face.pt` — a YOLOv8 face-detection checkpoint

### 5. Run the API

```bash
uvicorn app.main:api --reload
```

The API will be available at `http://127.0.0.1:8000`, and the dashboard at `http://127.0.0.1:8000/static/login.html`.

Interactive API docs (Swagger UI) are available at `http://127.0.0.1:8000/docs`.

---

## API overview

| Method | Endpoint | Description | Auth required |
|---|---|---|---|
| `POST` | `/auth/register` | Create a new user account | No |
| `POST` | `/auth/login` | Log in, receive access + refresh tokens | No |
| `POST` | `/auth/refresh` | Rotate a refresh token for a new access token | No |
| `POST` | `/auth/logout` | Revoke a refresh token | No |
| `POST` | `/api/predict` | Upload an image (JPG/PNG), get the predicted emotion | Yes |
| `GET` | `/api/history` | List the current user's past predictions | Yes |
| `GET` | `/api/history/{id}/image` | Retrieve the image for a specific history entry | Yes |

Authenticated requests use a bearer access token:

```
Authorization: Bearer <access_token>
```

---

## Retraining the model

`train.ipynb` walks through the full pipeline:

1. Loading a `dataset/train` / `dataset/val` / `dataset/test` directory (in `ImageFolder` format, one subfolder per emotion class)
2. Data augmentation (horizontal flip, rotation, affine translation) for the training split
3. Defining and training the CNN for 50 epochs with a validation-loss scheduler
4. Evaluating on the held-out test split, including per-class accuracy
5. Saving the best-performing weights to `best_emotion_model.pth`

To use a retrained model in the API, copy/rename the saved weights to `app/ml/emotion_model.pth`.

---

