"""initial schema

Revision ID: 001
Revises: 
Create Date: 2026-09-13
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    user_role = postgresql.ENUM('investigator', 'case_supervisor', 'administrator', name='userrole', create_type=False)
    user_role.create(op.get_bind(), checkfirst=True)

    case_status = postgresql.ENUM('draft', 'active', 'under_review', 'archived', name='casestatus', create_type=False)
    case_status.create(op.get_bind(), checkfirst=True)

    job_status = postgresql.ENUM('queued', 'running', 'completed', 'failed', 'cancelled', name='jobstatus', create_type=False)
    job_status.create(op.get_bind(), checkfirst=True)

    entity_type = postgresql.ENUM('person', 'alias', 'phone_sim', 'device', 'account', 'location', 'organization', 'domain_ip', 'event', 'document', name='entitytype', create_type=False)
    entity_type.create(op.get_bind(), checkfirst=True)

    review_state = postgresql.ENUM('new', 'needs_verification', 'supported_by_reviewer', 'rejected', 'archived', name='reviewstate', create_type=False)
    review_state.create(op.get_bind(), checkfirst=True)

    rel_direction = postgresql.ENUM('directed', 'undirected', name='relationshipdirection', create_type=False)
    rel_direction.create(op.get_bind(), checkfirst=True)

    op.create_table('users',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('username', sa.String(100), unique=True, nullable=False, index=True),
        sa.Column('email', sa.String(255), unique=True, nullable=False),
        sa.Column('hashed_password', sa.String(255), nullable=False),
        sa.Column('display_name', sa.String(200), nullable=False),
        sa.Column('role', sa.Enum('investigator', 'case_supervisor', 'administrator', name='userrole', create_type=False), nullable=False),
        sa.Column('is_active', sa.Boolean, nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
    )

    op.create_table('sessions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False, index=True),
        sa.Column('token_hash', sa.String(255), unique=True, nullable=False),
        sa.Column('expires_at', sa.DateTime, nullable=False),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
    )

    op.create_table('cases',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('title', sa.String(300), nullable=False),
        sa.Column('case_code', sa.String(50), unique=True, nullable=False, index=True),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('status', sa.Enum('draft', 'active', 'under_review', 'archived', name='casestatus', create_type=False), nullable=False, server_default='draft'),
        sa.Column('is_synthetic', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
    )

    op.create_table('case_memberships',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('case_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('cases.id'), nullable=False, index=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False, index=True),
        sa.Column('role', sa.Enum('investigator', 'case_supervisor', 'administrator', name='userrole', create_type=False), nullable=False),
        sa.Column('granted_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('granted_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column('revoked_at', sa.DateTime, nullable=True),
    )

    op.create_table('evidence_files',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('case_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('cases.id'), nullable=False, index=True),
        sa.Column('original_filename', sa.String(500), nullable=False),
        sa.Column('media_type', sa.String(100), nullable=False),
        sa.Column('byte_size', sa.Integer, nullable=False),
        sa.Column('sha256', sa.String(64), nullable=False),
        sa.Column('storage_path', sa.String(1000), nullable=False),
        sa.Column('source_type', sa.String(50), nullable=False),
        sa.Column('source_description', sa.Text, nullable=True),
        sa.Column('uploaded_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('parser_version', sa.String(50), nullable=True),
        sa.Column('status', sa.String(30), nullable=False, server_default='pending'),
        sa.Column('accepted_count', sa.Integer, nullable=False, server_default='0'),
        sa.Column('rejected_count', sa.Integer, nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
    )

    op.create_table('imports',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('evidence_file_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('evidence_files.id'), nullable=False, index=True),
        sa.Column('case_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('cases.id'), nullable=False, index=True),
        sa.Column('import_config', postgresql.JSON, nullable=True),
        sa.Column('status', sa.Enum('queued', 'running', 'completed', 'failed', 'cancelled', name='jobstatus', create_type=False), nullable=False),
        sa.Column('accepted_count', sa.Integer, nullable=False, server_default='0'),
        sa.Column('rejected_count', sa.Integer, nullable=False, server_default='0'),
        sa.Column('error_details', postgresql.JSON, nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column('completed_at', sa.DateTime, nullable=True),
    )

    op.create_table('source_records',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('case_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('cases.id'), nullable=False, index=True),
        sa.Column('import_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('imports.id'), nullable=False, index=True),
        sa.Column('evidence_file_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('evidence_files.id'), nullable=False),
        sa.Column('row_locator', sa.String(100), nullable=True),
        sa.Column('original_content', postgresql.JSON, nullable=False),
        sa.Column('normalized_content', postgresql.JSON, nullable=False),
        sa.Column('normalized_hash', sa.String(64), nullable=False, index=True),
        sa.Column('parser_version', sa.String(50), nullable=True),
        sa.Column('validation_flags', postgresql.JSON, nullable=True),
        sa.Column('is_duplicate', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_source_record_case_hash', 'source_records', ['case_id', 'normalized_hash'])

    op.create_table('document_chunks',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('case_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('cases.id'), nullable=False, index=True),
        sa.Column('evidence_file_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('evidence_files.id'), nullable=False),
        sa.Column('page_number', sa.Integer, nullable=True),
        sa.Column('line_start', sa.Integer, nullable=True),
        sa.Column('line_end', sa.Integer, nullable=True),
        sa.Column('text_content', sa.Text, nullable=False),
        sa.Column('extracted_entities', postgresql.JSON, nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
    )

    op.create_table('entities',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('case_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('cases.id'), nullable=False, index=True),
        sa.Column('entity_type', sa.Enum('person', 'alias', 'phone_sim', 'device', 'account', 'location', 'organization', 'domain_ip', 'event', 'document', name='entitytype', create_type=False), nullable=False, index=True),
        sa.Column('label', sa.String(300), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('review_state', sa.Enum('new', 'needs_verification', 'supported_by_reviewer', 'rejected', 'archived', name='reviewstate', create_type=False), nullable=False, server_default='new'),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
    )

    op.create_table('identifiers',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('case_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('cases.id'), nullable=False, index=True),
        sa.Column('id_type', sa.String(50), nullable=False),
        sa.Column('id_value', sa.String(500), nullable=False),
        sa.Column('normalized_value', sa.String(500), nullable=False),
        sa.Column('source_record_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('source_records.id'), nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_identifier_case_type_value', 'identifiers', ['case_id', 'id_type', 'normalized_value'])

    op.create_table('entity_identifier_links',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('entity_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('entities.id'), nullable=False, index=True),
        sa.Column('identifier_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('identifiers.id'), nullable=False, index=True),
        sa.Column('confidence', sa.Float, nullable=False, server_default='1.0'),
        sa.Column('source_record_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('source_records.id'), nullable=True),
        sa.Column('review_state', sa.Enum('new', 'needs_verification', 'supported_by_reviewer', 'rejected', 'archived', name='reviewstate', create_type=False), nullable=False, server_default='new'),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
    )

    op.create_table('entity_review_decisions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('entity_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('entities.id'), nullable=False, index=True),
        sa.Column('reviewer_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('decision', sa.String(50), nullable=False),
        sa.Column('note', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
    )

    op.create_table('events',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('case_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('cases.id'), nullable=False, index=True),
        sa.Column('event_type', sa.String(50), nullable=False, index=True),
        sa.Column('start_time', sa.DateTime, nullable=True),
        sa.Column('end_time', sa.DateTime, nullable=True),
        sa.Column('original_timestamp', sa.String(100), nullable=True),
        sa.Column('source_timezone', sa.String(50), nullable=True),
        sa.Column('time_precision', sa.String(20), nullable=True),
        sa.Column('location_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('entities.id'), nullable=True),
        sa.Column('location_precision', sa.String(30), nullable=True),
        sa.Column('source_record_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('source_records.id'), nullable=True),
        sa.Column('details', postgresql.JSON, nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_event_case_type_time', 'events', ['case_id', 'event_type', 'start_time'])

    op.create_table('event_participants',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('event_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('events.id'), nullable=False, index=True),
        sa.Column('entity_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('entities.id'), nullable=False, index=True),
        sa.Column('role', sa.String(30), nullable=True),
    )

    op.create_table('relationships',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('case_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('cases.id'), nullable=False, index=True),
        sa.Column('source_entity_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('entities.id'), nullable=False, index=True),
        sa.Column('target_entity_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('entities.id'), nullable=False, index=True),
        sa.Column('relationship_type', sa.String(50), nullable=False, index=True),
        sa.Column('direction', sa.Enum('directed', 'undirected', name='relationshipdirection', create_type=False), nullable=False, server_default='directed'),
        sa.Column('classification', sa.String(20), nullable=False, server_default='observed'),
        sa.Column('valid_from', sa.DateTime, nullable=True),
        sa.Column('valid_to', sa.DateTime, nullable=True),
        sa.Column('review_state', sa.Enum('new', 'needs_verification', 'supported_by_reviewer', 'rejected', 'archived', name='reviewstate', create_type=False), nullable=False, server_default='new'),
        sa.Column('evidence_count', sa.Integer, nullable=False, server_default='1'),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_rel_case_type', 'relationships', ['case_id', 'relationship_type'])
    op.create_index('ix_rel_source_target', 'relationships', ['source_entity_id', 'target_entity_id'])

    op.create_table('relationship_evidence',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('relationship_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('relationships.id'), nullable=False, index=True),
        sa.Column('source_record_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('source_records.id'), nullable=False),
        sa.Column('event_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('events.id'), nullable=True),
        sa.Column('weight', sa.Float, nullable=False, server_default='1.0'),
    )

    op.create_table('analysis_runs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('case_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('cases.id'), nullable=False, index=True),
        sa.Column('version', sa.Integer, nullable=False, server_default='1'),
        sa.Column('input_hash', sa.String(64), nullable=False),
        sa.Column('configuration', postgresql.JSON, nullable=True),
        sa.Column('engine_versions', postgresql.JSON, nullable=True),
        sa.Column('status', sa.Enum('queued', 'running', 'completed', 'failed', 'cancelled', name='jobstatus', create_type=False), nullable=False),
        sa.Column('started_at', sa.DateTime, nullable=True),
        sa.Column('completed_at', sa.DateTime, nullable=True),
        sa.Column('failure_details', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
    )

    op.create_table('signals',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('case_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('cases.id'), nullable=False, index=True),
        sa.Column('analysis_run_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('analysis_runs.id'), nullable=False, index=True),
        sa.Column('engine_name', sa.String(100), nullable=False),
        sa.Column('engine_version', sa.String(50), nullable=True),
        sa.Column('entity_pair', postgresql.JSON, nullable=False),
        sa.Column('family', sa.String(50), nullable=False, index=True),
        sa.Column('contributing_record_ids', postgresql.JSON, nullable=True),
        sa.Column('time_window_start', sa.DateTime, nullable=True),
        sa.Column('time_window_end', sa.DateTime, nullable=True),
        sa.Column('numeric_value', sa.Float, nullable=False),
        sa.Column('quality_factor', sa.Float, nullable=False, server_default='1.0'),
        sa.Column('feature_details', postgresql.JSON, nullable=True),
        sa.Column('explanation', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_signal_case_family', 'signals', ['case_id', 'family'])

    op.create_table('hypotheses',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('case_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('cases.id'), nullable=False, index=True),
        sa.Column('analysis_run_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('analysis_runs.id'), nullable=False, index=True),
        sa.Column('stable_key', sa.String(200), nullable=False),
        sa.Column('statement', sa.Text, nullable=False),
        sa.Column('target_relationship_type', sa.String(50), nullable=True),
        sa.Column('source_entity_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('entities.id'), nullable=True),
        sa.Column('target_entity_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('entities.id'), nullable=True),
        sa.Column('strength_index', sa.Integer, nullable=False, server_default='0'),
        sa.Column('supporting_records', postgresql.JSON, nullable=True),
        sa.Column('contradicting_records', postgresql.JSON, nullable=True),
        sa.Column('missing_information', postgresql.JSON, nullable=True),
        sa.Column('proposed_action', sa.Text, nullable=True),
        sa.Column('score_breakdown', postgresql.JSON, nullable=True),
        sa.Column('data_coverage', postgresql.JSON, nullable=True),
        sa.Column('review_state', sa.Enum('new', 'needs_verification', 'supported_by_reviewer', 'rejected', 'archived', name='reviewstate', create_type=False), nullable=False, server_default='new'),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
    )

    op.create_table('hypothesis_signals',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('hypothesis_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('hypotheses.id'), nullable=False, index=True),
        sa.Column('signal_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('signals.id'), nullable=False),
        sa.Column('weight', sa.Float, nullable=False),
        sa.Column('contribution', sa.Float, nullable=False),
    )

    op.create_table('review_actions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('case_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('cases.id'), nullable=False, index=True),
        sa.Column('entity_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('entities.id'), nullable=True),
        sa.Column('hypothesis_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('hypotheses.id'), nullable=True),
        sa.Column('reviewer_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('action', sa.String(50), nullable=False),
        sa.Column('note', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
    )

    op.create_table('saved_views',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('case_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('cases.id'), nullable=False, index=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('view_config', postgresql.JSON, nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
    )

    op.create_table('copilot_messages',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('case_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('cases.id'), nullable=False, index=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('query', sa.Text, nullable=False),
        sa.Column('response', sa.Text, nullable=False),
        sa.Column('citations', postgresql.JSON, nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
    )

    op.create_table('reports',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('case_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('cases.id'), nullable=False, index=True),
        sa.Column('title', sa.String(300), nullable=False),
        sa.Column('content', postgresql.JSON, nullable=False),
        sa.Column('format', sa.String(20), nullable=False, server_default='json'),
        sa.Column('analysis_run_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('analysis_runs.id'), nullable=True),
        sa.Column('generated_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('file_path', sa.String(1000), nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
    )

    op.create_table('audit_events',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('case_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('cases.id'), nullable=True, index=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('action', sa.String(100), nullable=False),
        sa.Column('resource_type', sa.String(50), nullable=True),
        sa.Column('resource_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('details', postgresql.JSON, nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
    )

    op.create_table('jobs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('case_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('cases.id'), nullable=False, index=True),
        sa.Column('job_type', sa.String(50), nullable=False),
        sa.Column('status', sa.Enum('queued', 'running', 'completed', 'failed', 'cancelled', name='jobstatus', create_type=False), nullable=False),
        sa.Column('payload', postgresql.JSON, nullable=True),
        sa.Column('result', postgresql.JSON, nullable=True),
        sa.Column('error_message', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column('started_at', sa.DateTime, nullable=True),
        sa.Column('completed_at', sa.DateTime, nullable=True),
        sa.Column('claimed_by', sa.String(100), nullable=True),
        sa.Column('claim_expires_at', sa.DateTime, nullable=True),
        sa.Column('retry_count', sa.Integer, nullable=False, server_default='0'),
        sa.Column('max_retries', sa.Integer, nullable=False, server_default='3'),
    )


def downgrade() -> None:
    tables = [
        'jobs', 'audit_events', 'reports', 'copilot_messages', 'saved_views',
        'review_actions', 'hypothesis_signals', 'hypotheses', 'signals',
        'analysis_runs', 'relationship_evidence', 'relationships',
        'event_participants', 'events', 'entity_review_decisions',
        'entity_identifier_links', 'identifiers', 'entities',
        'document_chunks', 'source_records', 'imports', 'evidence_files',
        'case_memberships', 'cases', 'sessions', 'users',
    ]
    for t in tables:
        op.drop_table(t)

    for e in ['relationshipdirection', 'reviewstate', 'entitytype', 'jobstatus', 'casestatus', 'userrole']:
        op.execute(f"DROP TYPE IF EXISTS {e}")

