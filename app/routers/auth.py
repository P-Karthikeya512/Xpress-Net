from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.security import create_access_token, create_refresh_token, get_password_hash, verify_password, decode_refresh_token
from app.schemas import UserCreate, UserOut, RefreshTokenRequest, Token
from app.models import Users, RefreshToken
from app.database import get_db

authRouter = APIRouter(prefix='/auth', tags=['auth'])

@authRouter.post('/register', response_model=UserOut)
def register(user_in : UserCreate, db : Session = Depends(get_db)):
    existing_user = db.query(Users).filter(Users.email == user_in.email).first()
    if existing_user is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Email is already registered')

    user = Users(
        email = user_in.email,
        hashed_password = get_password_hash(user_in.password),
    )

    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@authRouter.post('/login', response_model=Token)
def login(form_data:OAuth2PasswordRequestForm = Depends(), db :Session = Depends(get_db)):
    user = db.query(Users).filter(Users.email == form_data.username).first()

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")

    access_token = create_access_token(user.id)
    refresh_token, jti, refresh_exp = create_refresh_token(user.id)

    refresh_token_data = RefreshToken(user_id = user.id, jti = jti, expires_at= refresh_exp.replace(tzinfo=None))

    db.add(refresh_token_data)
    db.commit()

    return {
        'access_token' : access_token,
        'refresh_token' : refresh_token,
        'token_type' : 'bearer',
    }

@authRouter.post('/refresh', response_model=Token)
def refresh_tokens(payload : RefreshTokenRequest, db : Session = Depends(get_db)):
    data = decode_refresh_token(payload.refresh_token)
    jti = data.get("jti")
    user_id = data.get("sub")

    if user_id is None or jti is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )

    token_row = (
        db.query(RefreshToken).filter(RefreshToken.user_id == int(user_id), RefreshToken.jti == jti, RefreshToken.revoked.is_(False)).first()
    )

    if not token_row:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh Token not found")
    if token_row.expires_at < datetime.now(timezone.utc).replace(tzinfo=None):
        token_row.revoked = True
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token expired")

    # rotate old refresh token
    token_row.revoked = True

    new_access_token = create_access_token(int(user_id))
    new_refresh_token, new_jti, new_refresh_exp = create_refresh_token(int(user_id))

    db.add(
        RefreshToken(
            user_id=int(user_id),
            jti=new_jti,
            expires_at=new_refresh_exp.replace(tzinfo=None),
        )
    )
    db.commit()

    return {
        "access_token": new_access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer",
    }

@authRouter.post('/logout')
def logout(payload : RefreshTokenRequest, db : Session = Depends(get_db)):
    data = decode_refresh_token(payload.refresh_token)
    jti = data.get('jti')
    user_id = data.get("sub")

    token_row = (db.query(RefreshToken).filter(RefreshToken.user_id == int(user_id), RefreshToken.jti == jti, RefreshToken.revoked.is_(False)).first())

    if token_row:
        token_row.revoked = True
        db.commit()

    return {"message" : "Logged out successfully"}