from fastapi import FastAPI
from app.database import Base, engine
from app.routers.auth import authRouter
from app.routers.users import router as user_router
from fastapi.staticfiles import StaticFiles

api = FastAPI(title="XpressNet")
api.mount(
    "/static",
    StaticFiles(directory="app/static"),
    name="static",
)

Base.metadata.create_all(bind=engine)

api.include_router(authRouter)
api.include_router(user_router)

@api.get('/')
def root():
    return {
        "message": "Welcome to XpressNet API"
    }