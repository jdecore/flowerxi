from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    app_name: str = "flowerxi-api"
    app_env: str = "development"
    app_port: int = 8000
    database_url: str = Field(
        default="",
        description="PostgreSQL connection string (required in production)",
    )
    cors_origins: str = "http://localhost:4321"

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    @property
    def database_configured(self) -> bool:
        return bool(self.database_url)


settings = Settings()

# Log de configuración al inicio
import logging

logger = logging.getLogger("flowerxi-config")
if not settings.database_configured:
    logger.warning(
        "DATABASE_URL no configurada. La app iniciará pero endpoints de DB fallarán."
    )
else:
    logger.info("Base de datos configurada correctamente.")
