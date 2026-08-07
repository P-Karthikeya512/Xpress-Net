## here we will be writing functions for getting the current user
from fastapi import HTTPException, Depends, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import TokenData
from app.models import Users
from app.security import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl='auth/login')

def get_current_user(db : Session = Depends(get_db), token : str = Depends(oauth2_scheme)):
    payload = decode_access_token(token)
    user_id = payload.get('sub')

    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user_dict = {'user_id' : user_id}
    token_data = TokenData(**user_dict)

    user = db.query(Users).filter(Users.id == token_data.user_id).first()

    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User Not Found")

    return user
def get_current_active_user(current_user = Depends(get_current_user)):
    if current_user.is_active == False:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive User")
    return current_user

