"""investigation workspace: contradictions, leads, gaps, actions, evidence text

Revision ID: 005
Revises: 004
Create Date: 2026-09-15
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '005'
down_revision: Union[str, None] = '004'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    contradiction_status = postgresql.ENUM('OPEN', 'NEEDS_CLARIFICATION', 'RESOLVED', 'DISMISSED', name='contradictionstatus', create_type=False)
    contradiction_status.create(op.get_bind(), checkfirst=True)
    lead_priority = postgresql.ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL', name='leadpriority', create_type=False)
    lead_priority.create(op.get_bind(), checkfirst=True)
    lead_status = postgresql.ENUM('OPEN', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED', name='leadstatus', create_type=False)
    lead_status.create(op.get_bind(), checkfirst=True)
    gap_status = postgresql.ENUM('OPEN', 'ADDRESSED', 'DISMISSED', name='gapstatus', create_type=False)
    gap_status.create(op.get_bind(), checkfirst=True)
    action_status = postgresql.ENUM('PROPOSED', 'IN_PROGRESS', 'COMPLETED', 'FAILED', name='actionstatus', create_type=False)
    action_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        'contradictions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('case_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('cases.id'), nullable=False, index=True),
        sa.Column('title', sa.String(300), nullable=False),
        sa.Column('statements', postgresql.JSON, nullable=False, server_default='[]'),
        sa.Column('entity_ids', postgresql.JSON, nullable=True),
        sa.Column('time_context', sa.Text, nullable=True),
        sa.Column('detection_method', sa.String(100), nullable=True),
        sa.Column('explanation', sa.Text, nullable=True),
        sa.Column('status', postgresql.ENUM('OPEN', 'NEEDS_CLARIFICATION', 'RESOLVED', 'DISMISSED', name='contradictionstatus', create_type=False), nullable=False, server_default='OPEN'),
        sa.Column('resolution_note', sa.Text, nullable=True),
        sa.Column('resolved_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('analysis_run_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('analysis_runs.id'), nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.text('now()')),
    )
    op.create_index('ix_contradictions_case_status', 'contradictions', ['case_id', 'status'])

    op.create_table(
        'contradiction_reviews',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('contradiction_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('contradictions.id'), nullable=False, index=True),
        sa.Column('reviewer_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('decision', sa.String(50), nullable=False),
        sa.Column('note', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.text('now()')),
    )

    op.create_table(
        'leads',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('case_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('cases.id'), nullable=False, index=True),
        sa.Column('title', sa.String(300), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('origin_type', sa.String(50), nullable=True),
        sa.Column('origin_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('entity_ids', postgresql.JSON, nullable=True),
        sa.Column('supporting_evidence_refs', postgresql.JSON, nullable=True),
        sa.Column('conflicting_evidence_refs', postgresql.JSON, nullable=True),
        sa.Column('priority', postgresql.ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL', name='leadpriority', create_type=False), nullable=False, server_default='MEDIUM'),
        sa.Column('priority_rationale', sa.Text, nullable=True),
        sa.Column('status', postgresql.ENUM('OPEN', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED', name='leadstatus', create_type=False), nullable=False, server_default='OPEN'),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.text('now()')),
    )
    op.create_index('ix_leads_case_status', 'leads', ['case_id', 'status'])

    op.create_table(
        'lead_reviews',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('lead_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('leads.id'), nullable=False, index=True),
        sa.Column('reviewer_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('decision', sa.String(50), nullable=False),
        sa.Column('note', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.text('now()')),
    )

    op.create_table(
        'information_gaps',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('case_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('cases.id'), nullable=False, index=True),
        sa.Column('lead_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('leads.id'), nullable=True, index=True),
        sa.Column('title', sa.String(300), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('related_entity_ids', postgresql.JSON, nullable=True),
        sa.Column('related_evidence_refs', postgresql.JSON, nullable=True),
        sa.Column('status', postgresql.ENUM('OPEN', 'ADDRESSED', 'DISMISSED', name='gapstatus', create_type=False), nullable=False, server_default='OPEN'),
        sa.Column('resolution_note', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.text('now()')),
    )

    op.create_table(
        'investigation_actions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('case_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('cases.id'), nullable=False, index=True),
        sa.Column('gap_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('information_gaps.id'), nullable=True, index=True),
        sa.Column('lead_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('leads.id'), nullable=True, index=True),
        sa.Column('title', sa.String(300), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('proposed_step', sa.Text, nullable=True),
        sa.Column('expected_information', sa.Text, nullable=True),
        sa.Column('source_refs', postgresql.JSON, nullable=True),
        sa.Column('status', postgresql.ENUM('PROPOSED', 'IN_PROGRESS', 'COMPLETED', 'FAILED', name='actionstatus', create_type=False), nullable=False, server_default='PROPOSED'),
        sa.Column('outcome_notes', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.text('now()')),
    )

    op.add_column('evidence_files', sa.Column('extracted_text', sa.Text, nullable=True))
    op.add_column('evidence_files', sa.Column('extraction_error', sa.Text, nullable=True))
    op.add_column('evidence_files', sa.Column('retry_count', sa.Integer, nullable=False, server_default='0'))

    op.add_column('events', sa.Column('is_manual', sa.Boolean, nullable=False, server_default='false'))


def downgrade() -> None:
    op.drop_column('events', 'is_manual')
    op.drop_column('evidence_files', 'retry_count')
    op.drop_column('evidence_files', 'extraction_error')
    op.drop_column('evidence_files', 'extracted_text')

    op.drop_table('investigation_actions')
    op.drop_table('information_gaps')
    op.drop_table('lead_reviews')
    op.drop_table('leads')
    op.drop_table('contradiction_reviews')
    op.drop_table('contradictions')

    postgresql.ENUM('PROPOSED', 'IN_PROGRESS', 'COMPLETED', 'FAILED', name='actionstatus', create_type=False).drop(op.get_bind(), checkfirst=True)
    postgresql.ENUM('OPEN', 'ADDRESSED', 'DISMISSED', name='gapstatus', create_type=False).drop(op.get_bind(), checkfirst=True)
    postgresql.ENUM('OPEN', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED', name='leadstatus', create_type=False).drop(op.get_bind(), checkfirst=True)
    postgresql.ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL', name='leadpriority', create_type=False).drop(op.get_bind(), checkfirst=True)
    postgresql.ENUM('OPEN', 'NEEDS_CLARIFICATION', 'RESOLVED', 'DISMISSED', name='contradictionstatus', create_type=False).drop(op.get_bind(), checkfirst=True)