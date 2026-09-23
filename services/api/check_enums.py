import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.config import get_settings

async def check():
    settings = get_settings()
    engine = create_async_engine(settings.DATABASE_URL)
    async with engine.connect() as conn:
        result = await conn.execute(text("SELECT typname, enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid ORDER BY typname, enumsortorder;"))
        for row in result:
            print(f'{row[0]}: {row[1]}')

asyncio.run(check())