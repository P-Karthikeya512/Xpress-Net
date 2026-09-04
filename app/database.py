from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.config import settings

connect_args = {}

if settings.sqlalchemy_database_url.startswith("mysql+pymysql://"):
    connect_args = {
        "ssl": {
            "ca": settings.mysql_ca_path
        }
    }

engine = create_engine(settings.sqlalchemy_database_url, connect_args=connect_args, pool_pre_ping=True)

SessionLocal = sessionmaker(autocommit = False, autoflush=False, bind=engine)

class Base(DeclarativeBase):
    pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()