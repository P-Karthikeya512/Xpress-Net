from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    sqlalchemy_database_url: str
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    mysql_ca_path: str = "certs/ca.pem"

    model_config = SettingsConfigDict(
        env_file="app/.env"
    )


settings = Settings()