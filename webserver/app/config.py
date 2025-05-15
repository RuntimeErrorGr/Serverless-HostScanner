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
    
    MYSQL_HOST: str
    MYSQL_PORT: int
    MYSQL_ROOT_PASSWORD: str
    MYSQL_DB: str
    MYSQL_USER: str
    MYSQL_PASSWORD: str

    KEYCLOAK_HOST: str
    KEYCLOAK_CLIENT_ID: str
    KEYCLOAK_CLIENT_SECRET: str
    KEYCLOAK_ADMIN_CLIENT_SECRET: str
    KEYCLOAK_REALM: str
    
    WEBSERVER_HOST: str
    FRONTEND_HOST: str
    FRONTEND_PORT: int
    OPENFAAS_HOST: str
    OPENFAAS_PORT: int

    SCANNER_NAME: str

    @property
    def FRONTEND_CALLBACK_URI(self):
        return f"http://{self.FRONTEND_HOST}:{self.FRONTEND_PORT}"

    @property
    def KEYCLOAK_SERVER_URL(self):
        return f"https://{self.KEYCLOAK_HOST}"
    
    @property
    def OPENFAAS_FUNCTION_URL(self):
        return f"http://{self.OPENFAAS_HOST}:{self.OPENFAAS_PORT}/function/{self.SCANNER_NAME}"

    @property
    def OPENFAAS_ASYNC_FUNCTION_URL(self):
        return f"http://{self.OPENFAAS_HOST}:{self.OPENFAAS_PORT}/async-function/{self.SCANNER_NAME}"
    

# Load settings using env var ENV (or default to 'dev')
settings = Settings()
log.debug("Loaded settings for ENV: %s", settings.ENV)
