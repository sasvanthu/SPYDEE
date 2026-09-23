"""merge suggestion reversibility: store apply manifest

Adds merge_manifest to merge_suggestions so an investigator-approved merge can
be reverted without data loss (which identifier links, event participants and
relationship endpoints were moved onto the primary entity).

Revision ID: 006
Revises: 005
Create Date: 2026-09-15
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '006'
down_revision: Union[str, None] = '005'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'merge_suggestions',
        sa.Column('merge_manifest', postgresql.JSON, nullable=True),
    )


def downgrade() -> None:
    op.drop_column('merge_suggestions', 'merge_manifest')