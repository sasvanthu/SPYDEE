import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.models import User, UserRole
from app.auth.auth import get_current_user, require_role, hash_password
from app.schemas.schemas import UserCreate, UserResponse, UserUpdate

router = APIRouter(prefix="/api/v1/users", tags=["users"])


def _validate_role(role: str) -> UserRole:
    try:
        return UserRole(role)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid role: {role}")


@router.get("", response_model=list[UserResponse])
async def list_users(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.ADMINISTRATOR)),
):
    result = await db.execute(select(User).order_by(User.username))
    return [UserResponse.model_validate(u) for u in result.scalars().all()]


@router.post("", response_model=UserResponse, status_code=201)
async def create_user(
    req: UserCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.ADMINISTRATOR)),
):
    existing = await db.execute(select(User).where(User.username == req.username))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Username already exists")

    role = _validate_role(req.role)
    new_user = User(
        username=req.username,
        email=req.email,
        display_name=req.display_name,
        hashed_password=hash_password(req.password),
        role=role,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return UserResponse.model_validate(new_user)


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: uuid.UUID,
    req: UserUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.ADMINISTRATOR)),
):
    result = await db.execute(select(User).where(User.id == user_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    if req.display_name is not None:
        target.display_name = req.display_name
    if req.role is not None:
        target.role = _validate_role(req.role)
    if req.is_active is not None:
        if target.id == user.id and not req.is_active:
            raise HTTPException(status_code=400, detail="Cannot deactivate your own account")
        target.is_active = req.is_active

    await db.commit()
    await db.refresh(target)
    return UserResponse.model_validate(target)