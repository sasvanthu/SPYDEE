import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.config import get_settings

async def check():
    settings = get_settings()
    engine = create_async_engine(settings.DATABASE_URL)
    async with engine.connect() as conn:
        result = await conn.execute(text("SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'userrole');"))
        for row in result:
            print(row[0])

asyncio.run(check())