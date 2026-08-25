from pydantic import BaseModel, EmailStr, ConfigDict
from datetime import datetime

class UserCreate(BaseModel):
    email : EmailStr
    password : str

class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id : int
    email : EmailStr
    created_at : datetime
    is_active : bool

class Token(BaseModel):
    access_token : str
    refresh_token : str
    token_type : str = "bearer"

class TokenData(BaseModel):
    user_id : int | None = None

class RefreshTokenRequest(BaseModel):
    refresh_token : str

class HistoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int
    predicted_emotion: str
    confidence: float
    created_at: datetime
    inference_ms: float | None = None