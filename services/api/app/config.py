from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://spydee:spydee_dev_pass@localhost:5432/spydee"
    DATABASE_URL_SYNC: str = "postgresql://spydee:spydee_dev_pass@localhost:5432/spydee"
    SECRET_KEY: str = "prototype-dev-secret-key-do-not-use-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    UPLOAD_DIR: str = "./data/uploads"
    DEMO_MODE: bool = True
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:5174"
    MAX_UPLOAD_BYTES: int = 50_000_000
    LLM_PROVIDER: str = ""
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.1"
    LLM_API_KEY: str = ""

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
