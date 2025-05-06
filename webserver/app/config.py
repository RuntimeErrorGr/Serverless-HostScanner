import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from app.log import get_logger

log = get_logger(__name__)

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=os.getenv("ENV_FILE", None),
        env_file_encoding="utf-8",
        case_sensitive=True,
    )

    API_VERSION: str
    PROJECT_NAME: str
    ENV: str = "dev"

    SERVER_HOST: str
    SERVER_PORT: int

    REDIS_HOST: str
    REDIS_PORT: int
    REDIS_DB: int
    


# Load settings using env var ENV (or default to 'dev')
settings = Settings()
log.debug("Loaded settings for ENV: %s", settings.ENV)
