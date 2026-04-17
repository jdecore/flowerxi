from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "flowerxi-api"
    app_env: str = "development"
    app_port: int = 8000
    database_url: str
    cors_origins: str = "http://localhost:4321"

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )


settings = Settings()
