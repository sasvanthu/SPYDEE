"""merge suggestions and performance indexes

Revision ID: 002
Revises: 001
Create Date: 2026-09-14
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '002'
down_revision: Union[str, None] = '001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('merge_suggestions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('case_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('cases.id'), nullable=False, index=True),
        sa.Column('primary_entity_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('entities.id'), nullable=False, index=True),
        sa.Column('secondary_entity_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('entities.id'), nullable=False, index=True),
        sa.Column('basis', sa.String(100), nullable=False),
        sa.Column('confidence', sa.Float, nullable=False, server_default='0.0'),
        sa.Column('evidence_record_ids', postgresql.JSON, nullable=True),
        sa.Column('reason', sa.Text, nullable=True),
        sa.Column('review_state', postgresql.ENUM('new', 'needs_verification', 'supported_by_reviewer', 'rejected', 'archived', name='reviewstate', create_type=False), nullable=False, server_default='new'),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column('resolved_at', sa.DateTime, nullable=True),
    )
    op.create_index('ix_merge_case_pair', 'merge_suggestions', ['case_id', 'primary_entity_id', 'secondary_entity_id'])

    op.add_column('entities', sa.Column('attributes', postgresql.JSON, nullable=True))
    op.execute("ALTER TYPE entitytype ADD VALUE IF NOT EXISTS 'vehicle'")

    op.create_index('ix_identifier_case_value', 'identifiers', ['case_id', 'id_value'])
    op.create_index('ix_source_record_case_created', 'source_records', ['case_id', 'created_at'])
    op.create_index('ix_event_case_start', 'events', ['case_id', 'start_time'])


def downgrade() -> None:
    op.drop_index('ix_event_case_start', table_name='events')
    op.drop_index('ix_source_record_case_created', table_name='source_records')
    op.drop_index('ix_identifier_case_value', table_name='identifiers')
    op.drop_index('ix_merge_case_pair', table_name='merge_suggestions')
    op.drop_table('merge_suggestions')
    op.drop_column('entities', 'attributes')