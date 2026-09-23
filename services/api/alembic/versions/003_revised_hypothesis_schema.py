"""revised hypothesis derived schema

Revision ID: 003
Revises: 002
Create Date: 2026-09-14
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '003'
down_revision: Union[str, None] = '002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    hypothesis_state = postgresql.ENUM('CANDIDATE', 'NEEDS_VERIFICATION', 'SUPPORTED', 'REJECTED', name='hypothesisstate', create_type=False)
    hypothesis_state.create(op.get_bind(), checkfirst=True)
    recommendation_type = postgresql.ENUM(
        'FLAG_SUBVERSIVE_ACTIVITY', 'FLAG_TERROR_LINK', 'FLAG_FORGED_DOCUMENTS',
        'FLAG_SOCIAL_NETWORK', 'FLAG_CREDENTIAL_INCONSISTENCY', 'FLAG_FINANCIAL_ANOMALY',
        'BOOK_EXTERNAL_INT_DESK', 'COLLECT_HUMAN_INTEL', name='recommendationtype', create_type=False,
    )
    recommendation_type.create(op.get_bind(), checkfirst=True)
    recommendation_status = postgresql.ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', name='recommendationstatus', create_type=False)
    recommendation_status.create(op.get_bind(), checkfirst=True)

    # ── Hypotheses: drop legacy shape, adopt derived schema ──────────────
    op.add_column('hypotheses', sa.Column('entity_pair', postgresql.JSON, nullable=False, server_default='{}'))
    op.add_column('hypotheses', sa.Column('notes', sa.Text, nullable=True))
    op.add_column('hypotheses', sa.Column('timestamp_hypothesis_generated', sa.DateTime, nullable=True))
    op.add_column('hypotheses', sa.Column('contributing_signal_highlights', postgresql.JSON, nullable=True))
    op.add_column('hypotheses', sa.Column('state', postgresql.ENUM('CANDIDATE', 'NEEDS_VERIFICATION', 'SUPPORTED', 'REJECTED', name='hypothesisstate', create_type=False), nullable=False, server_default='CANDIDATE'))
    op.add_column('hypotheses', sa.Column('numeric_value', sa.Float, nullable=False, server_default='0'))
    op.add_column('hypotheses', sa.Column('quality_factor', sa.Float, nullable=False, server_default='1.0'))
    op.add_column('hypotheses', sa.Column('engine_version', sa.String(50), nullable=True))
    op.add_column('hypotheses', sa.Column('hypothesis_type', sa.String(50), nullable=True))

    for col in (
        'statement', 'target_relationship_type', 'source_entity_id', 'target_entity_id',
        'strength_index', 'supporting_records', 'contradicting_records', 'missing_information',
        'proposed_action', 'score_breakdown', 'data_coverage',
    ):
        op.drop_column('hypotheses', col)

    op.create_index('ix_hypothesis_case_key', 'hypotheses', ['case_id', 'stable_key'])

    # ── HypothesisSignals: family metadata + contradiction flag ───────────
    op.add_column('hypothesis_signals', sa.Column('family', sa.String(50), nullable=False, server_default=''))
    op.add_column('hypothesis_signals', sa.Column('entity_pair', postgresql.JSON, nullable=False, server_default='{}'))
    op.add_column('hypothesis_signals', sa.Column('quality_factor', sa.Float, nullable=False, server_default='1.0'))
    op.add_column('hypothesis_signals', sa.Column('feature_details', postgresql.JSON, nullable=True))
    op.add_column('hypothesis_signals', sa.Column('contradiction', sa.Boolean, nullable=False, server_default='false'))
    op.alter_column('hypothesis_signals', 'signal_id', existing_type=postgresql.UUID(as_uuid=True), nullable=True)
    op.create_index('ix_hypothesis_signals_signal_id', 'hypothesis_signals', ['signal_id'])

    # ── HypothesisRecommendations ─────────────────────────────────────────
    op.create_table('hypothesis_recommendations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('hypothesis_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('hypotheses.id'), nullable=False, index=True),
        sa.Column('type', postgresql.ENUM(
            'FLAG_SUBVERSIVE_ACTIVITY', 'FLAG_TERROR_LINK', 'FLAG_FORGED_DOCUMENTS',
            'FLAG_SOCIAL_NETWORK', 'FLAG_CREDENTIAL_INCONSISTENCY', 'FLAG_FINANCIAL_ANOMALY',
            'BOOK_EXTERNAL_INT_DESK', 'COLLECT_HUMAN_INTEL', name='recommendationtype', create_type=False,
        ), nullable=False),
        sa.Column('status', postgresql.ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', name='recommendationstatus', create_type=False), nullable=False, server_default='PENDING'),
        sa.Column('estimated_completion_days', sa.Integer, nullable=True),
        sa.Column('rationale', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('hypothesis_recommendations')
    op.drop_index('ix_hypothesis_signals_signal_id', table_name='hypothesis_signals')

    op.alter_column('hypothesis_signals', 'signal_id', existing_type=postgresql.UUID(as_uuid=True), nullable=False)
    for col in ('contradiction', 'feature_details', 'quality_factor', 'entity_pair', 'family'):
        op.drop_column('hypothesis_signals', col)

    op.drop_index('ix_hypothesis_case_key', table_name='hypotheses')
    for col in ('hypothesis_type', 'engine_version', 'quality_factor', 'numeric_value', 'state',
                'contributing_signal_highlights', 'timestamp_hypothesis_generated', 'notes', 'entity_pair'):
        op.drop_column('hypotheses', col)

    op.add_column('hypotheses', sa.Column('statement', sa.Text, nullable=False, server_default=''))
    op.add_column('hypotheses', sa.Column('target_relationship_type', sa.String(50), nullable=True))
    op.add_column('hypotheses', sa.Column('source_entity_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('entities.id'), nullable=True))
    op.add_column('hypotheses', sa.Column('target_entity_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('entities.id'), nullable=True))
    op.add_column('hypotheses', sa.Column('strength_index', sa.Integer, nullable=False, server_default='0'))
    op.add_column('hypotheses', sa.Column('supporting_records', postgresql.JSON, nullable=True))
    op.add_column('hypotheses', sa.Column('contradicting_records', postgresql.JSON, nullable=True))
    op.add_column('hypotheses', sa.Column('missing_information', postgresql.JSON, nullable=True))
    op.add_column('hypotheses', sa.Column('proposed_action', sa.Text, nullable=True))
    op.add_column('hypotheses', sa.Column('score_breakdown', postgresql.JSON, nullable=True))
    op.add_column('hypotheses', sa.Column('data_coverage', postgresql.JSON, nullable=True))

    recommendation_status = postgresql.ENUM(name='recommendationstatus', create_type=False)
    recommendation_status.drop(op.get_bind(), checkfirst=True)
    recommendation_type = postgresql.ENUM(name='recommendationtype', create_type=False)
    recommendation_type.drop(op.get_bind(), checkfirst=True)
    hypothesis_state = postgresql.ENUM(name='hypothesistate', create_type=False)
    hypothesis_state.drop(op.get_bind(), checkfirst=True)