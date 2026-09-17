import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache
from dotenv import load_dotenv

_REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
_ROOT_ENV = os.path.join(_REPO_ROOT, ".env")
load_dotenv(_ROOT_ENV)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(_ROOT_ENV, ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    DATABASE_URL: str = "postgresql+asyncpg://spydee:spydee_dev_pass@localhost:5432/spydee"
    DATABASE_URL_SYNC: str = "postgresql://spydee:spydee_dev_pass@localhost:5432/spydee"
    SECRET_KEY: str = "prototype-dev-secret-key-do-not-use-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    UPLOAD_DIR: str = "./data/uploads"
    DEMO_MODE: bool = True
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:5174"
    MAX_UPLOAD_BYTES: int = 50_000_000
    MAX_DOCUMENT_TEXT_CHARS: int = 2_000_000
    LLM_PROVIDER: str = ""
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.1"
    LLM_API_KEY: str = ""
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""


@lru_cache()
def get_settings() -> Settings:
    return Settings()
