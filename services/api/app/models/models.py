import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Text, Boolean, Integer, Float, DateTime, ForeignKey,
    Enum as SAEnum, Index, UniqueConstraint, JSON, LargeBinary
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base
import enum


def gen_uuid():
    return uuid.uuid4()


class UserRole(str, enum.Enum):
    INVESTIGATOR = "investigator"
    CASE_SUPERVISOR = "case_supervisor"
    ADMINISTRATOR = "administrator"


class CaseStatus(str, enum.Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    UNDER_REVIEW = "under_review"
    ARCHIVED = "archived"


class JobStatus(str, enum.Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class EntityType(str, enum.Enum):
    PERSON = "person"
    ALIAS = "alias"
    PHONE_SIM = "phone_sim"
    DEVICE = "device"
    ACCOUNT = "account"
    LOCATION = "location"
    ORGANIZATION = "organization"
    DOMAIN_IP = "domain_ip"
    EVENT = "event"
    DOCUMENT = "document"
    VEHICLE = "vehicle"


class ReviewState(str, enum.Enum):
    NEW = "new"
    NEEDS_VERIFICATION = "needs_verification"
    SUPPORTED = "supported_by_reviewer"
    REJECTED = "rejected"
    ARCHIVED = "archived"


class RelationshipDirection(str, enum.Enum):
    DIRECTED = "directed"
    UNDIRECTED = "undirected"


class HypothesisState(str, enum.Enum):
    CANDIDATE = "candidate"
    NEEDS_VERIFICATION = "needs_verification"
    SUPPORTED = "supported"
    REJECTED = "rejected"


class RecommendationType(str, enum.Enum):
    FLAG_SUBVERSIVE_ACTIVITY = "flag_subversive_activity"
    FLAG_TERROR_LINK = "flag_terror_link"
    FLAG_FORGED_DOCUMENTS = "flag_forged_documents"
    FLAG_SOCIAL_NETWORK = "flag_social_network"
    FLAG_CREDENTIAL_INCONSISTENCY = "flag_credential_inconsistency"
    FLAG_FINANCIAL_ANOMALY = "flag_financial_anomaly"
    BOOK_EXTERNAL_INT_DESK = "book_external_int_desk"
    COLLECT_HUMAN_INTEL = "collect_human_intel"


class RecommendationStatus(str, enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


# ─── Users & Auth ────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    username = Column(String(100), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    display_name = Column(String(200), nullable=False)
    role = Column(SAEnum(UserRole), nullable=False, default=UserRole.INVESTIGATOR)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    memberships = relationship("CaseMembership", back_populates="user", foreign_keys="CaseMembership.user_id")


class Session(Base):
    __tablename__ = "sessions"
    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    token_hash = Column(String(255), nullable=False, unique=True, index=True)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


# ─── Cases ───────────────────────────────────────────────────────────

class Case(Base):
    __tablename__ = "cases"
    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    title = Column(String(300), nullable=False)
    case_code = Column(String(50), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    status = Column(SAEnum(CaseStatus), nullable=False, default=CaseStatus.DRAFT)
    is_synthetic = Column(Boolean, nullable=False, default=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    memberships = relationship("CaseMembership", back_populates="case")
    evidence_files = relationship("EvidenceFile", back_populates="case")
    entities = relationship("Entity", back_populates="case")
    events = relationship("Event", back_populates="case")
    relationships = relationship("Relationship", back_populates="case")
    analysis_runs = relationship("AnalysisRun", back_populates="case")
    hypotheses = relationship("Hypothesis", back_populates="case")
    review_actions = relationship("ReviewAction", back_populates="case")
    saved_views = relationship("SavedView", back_populates="case")
    reports = relationship("Report", back_populates="case")
    audit_events = relationship("AuditEvent", back_populates="case")


class CaseMembership(Base):
    __tablename__ = "case_memberships"
    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    role = Column(SAEnum(UserRole), nullable=False)
    granted_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    granted_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    revoked_at = Column(DateTime, nullable=True)

    case = relationship("Case", back_populates="memberships")
    user = relationship("User", back_populates="memberships", foreign_keys=[user_id], primaryjoin="CaseMembership.user_id == User.id")

    __table_args__ = (
        UniqueConstraint("case_id", "user_id", name="uq_case_user_membership"),
    )


# ─── Evidence ────────────────────────────────────────────────────────

class EvidenceFile(Base):
    __tablename__ = "evidence_files"
    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=False, index=True)
    original_filename = Column(String(500), nullable=False)
    media_type = Column(String(100), nullable=False)
    byte_size = Column(Integer, nullable=False)
    sha256 = Column(String(64), nullable=False)
    storage_path = Column(String(1000), nullable=False)
    source_type = Column(String(50), nullable=False)
    source_description = Column(Text, nullable=True)
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    parser_version = Column(String(50), nullable=True)
    status = Column(String(30), nullable=False, default="pending")
    extracted_text = Column(Text, nullable=True)
    extraction_error = Column(Text, nullable=True)
    retry_count = Column(Integer, nullable=False, default=0)
    accepted_count = Column(Integer, nullable=False, default=0)
    rejected_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    case = relationship("Case", back_populates="evidence_files")
    imports = relationship("Import", back_populates="evidence_file")


class Import(Base):
    __tablename__ = "imports"
    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    evidence_file_id = Column(UUID(as_uuid=True), ForeignKey("evidence_files.id"), nullable=False, index=True)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=False, index=True)
    import_config = Column(JSON, nullable=True)
    status = Column(SAEnum(JobStatus), nullable=False, default=JobStatus.QUEUED)
    accepted_count = Column(Integer, nullable=False, default=0)
    rejected_count = Column(Integer, nullable=False, default=0)
    error_details = Column(JSON, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    evidence_file = relationship("EvidenceFile", back_populates="imports")
    source_records = relationship("SourceRecord", back_populates="import_obj")


class SourceRecord(Base):
    __tablename__ = "source_records"
    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=False, index=True)
    import_id = Column(UUID(as_uuid=True), ForeignKey("imports.id"), nullable=False, index=True)
    evidence_file_id = Column(UUID(as_uuid=True), ForeignKey("evidence_files.id"), nullable=False)
    row_locator = Column(String(100), nullable=True)
    original_content = Column(JSON, nullable=False)
    normalized_content = Column(JSON, nullable=False)
    normalized_hash = Column(String(64), nullable=False, index=True)
    parser_version = Column(String(50), nullable=True)
    validation_flags = Column(JSON, nullable=True)
    is_duplicate = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    import_obj = relationship("Import", back_populates="source_records")

    __table_args__ = (
        Index("ix_source_record_case_hash", "case_id", "normalized_hash"),
        Index("ix_source_record_case_created", "case_id", "created_at"),
    )


class DocumentChunk(Base):
    __tablename__ = "document_chunks"
    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=False, index=True)
    evidence_file_id = Column(UUID(as_uuid=True), ForeignKey("evidence_files.id"), nullable=False)
    page_number = Column(Integer, nullable=True)
    line_start = Column(Integer, nullable=True)
    line_end = Column(Integer, nullable=True)
    text_content = Column(Text, nullable=False)
    extracted_entities = Column(JSON, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


# ─── Entities ────────────────────────────────────────────────────────

class Entity(Base):
    __tablename__ = "entities"
    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=False, index=True)
    entity_type = Column(SAEnum(EntityType), nullable=False, index=True)
    label = Column(String(300), nullable=False)
    description = Column(Text, nullable=True)
    attributes = Column(JSON, nullable=True)
    review_state = Column(SAEnum(ReviewState), nullable=False, default=ReviewState.NEW)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    case = relationship("Case", back_populates="entities")
    identifiers = relationship("EntityIdentifierLink", back_populates="entity")


class Identifier(Base):
    __tablename__ = "identifiers"
    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=False, index=True)
    id_type = Column(String(50), nullable=False)
    id_value = Column(String(500), nullable=False)
    normalized_value = Column(String(500), nullable=False)
    source_record_id = Column(UUID(as_uuid=True), ForeignKey("source_records.id"), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_identifier_case_type_value", "case_id", "id_type", "normalized_value"),
        Index("ix_identifier_case_value", "case_id", "id_value"),
    )


class EntityIdentifierLink(Base):
    __tablename__ = "entity_identifier_links"
    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    entity_id = Column(UUID(as_uuid=True), ForeignKey("entities.id"), nullable=False, index=True)
    identifier_id = Column(UUID(as_uuid=True), ForeignKey("identifiers.id"), nullable=False, index=True)
    confidence = Column(Float, nullable=False, default=1.0)
    source_record_id = Column(UUID(as_uuid=True), ForeignKey("source_records.id"), nullable=True)
    review_state = Column(SAEnum(ReviewState), nullable=False, default=ReviewState.NEW)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    entity = relationship("Entity", back_populates="identifiers")
    identifier = relationship("Identifier")


class EntityReviewDecision(Base):
    __tablename__ = "entity_review_decisions"
    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    entity_id = Column(UUID(as_uuid=True), ForeignKey("entities.id"), nullable=False, index=True)
    reviewer_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    decision = Column(String(50), nullable=False)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class MergeSuggestion(Base):
    __tablename__ = "merge_suggestions"
    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=False, index=True)
    primary_entity_id = Column(UUID(as_uuid=True), ForeignKey("entities.id"), nullable=False, index=True)
    secondary_entity_id = Column(UUID(as_uuid=True), ForeignKey("entities.id"), nullable=False, index=True)
    basis = Column(String(100), nullable=False)
    confidence = Column(Float, nullable=False, default=0.0)
    evidence_record_ids = Column(JSON, nullable=True)
    reason = Column(Text, nullable=True)
    review_state = Column(SAEnum(ReviewState), nullable=False, default=ReviewState.NEW)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)
    merge_manifest = Column(JSON, nullable=True)

    __table_args__ = (
        Index("ix_merge_case_pair", "case_id", "primary_entity_id", "secondary_entity_id"),
    )


# ─── Events & Relationships ─────────────────────────────────────────

class Event(Base):
    __tablename__ = "events"
    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=False, index=True)
    event_type = Column(String(50), nullable=False, index=True)
    start_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True)
    original_timestamp = Column(String(100), nullable=True)
    source_timezone = Column(String(50), nullable=True)
    time_precision = Column(String(20), nullable=True)
    is_manual = Column(Boolean, nullable=False, default=False)
    location_id = Column(UUID(as_uuid=True), ForeignKey("entities.id"), nullable=True)
    location_precision = Column(String(30), nullable=True)
    source_record_id = Column(UUID(as_uuid=True), ForeignKey("source_records.id"), nullable=True)
    details = Column(JSON, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    case = relationship("Case", back_populates="events")

    __table_args__ = (
        Index("ix_event_case_type_time", "case_id", "event_type", "start_time"),
        Index("ix_event_case_start", "case_id", "start_time"),
    )


class EventParticipant(Base):
    __tablename__ = "event_participants"
    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    event_id = Column(UUID(as_uuid=True), ForeignKey("events.id"), nullable=False, index=True)
    entity_id = Column(UUID(as_uuid=True), ForeignKey("entities.id"), nullable=False, index=True)
    role = Column(String(30), nullable=True)


class Relationship(Base):
    __tablename__ = "relationships"
    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=False, index=True)
    source_entity_id = Column(UUID(as_uuid=True), ForeignKey("entities.id"), nullable=False, index=True)
    target_entity_id = Column(UUID(as_uuid=True), ForeignKey("entities.id"), nullable=False, index=True)
    relationship_type = Column(String(50), nullable=False, index=True)
    direction = Column(SAEnum(RelationshipDirection), nullable=False, default=RelationshipDirection.DIRECTED)
    classification = Column(String(20), nullable=False, default="observed")
    valid_from = Column(DateTime, nullable=True)
    valid_to = Column(DateTime, nullable=True)
    review_state = Column(SAEnum(ReviewState), nullable=False, default=ReviewState.NEW)
    evidence_count = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    case = relationship("Case", back_populates="relationships")
    evidence = relationship("RelationshipEvidence", back_populates="relationship")

    __table_args__ = (
        Index("ix_rel_case_type", "case_id", "relationship_type"),
        Index("ix_rel_source_target", "source_entity_id", "target_entity_id"),
    )


class RelationshipEvidence(Base):
    __tablename__ = "relationship_evidence"
    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    relationship_id = Column(UUID(as_uuid=True), ForeignKey("relationships.id"), nullable=False, index=True)
    source_record_id = Column(UUID(as_uuid=True), ForeignKey("source_records.id"), nullable=False)
    event_id = Column(UUID(as_uuid=True), ForeignKey("events.id"), nullable=True)
    weight = Column(Float, nullable=False, default=1.0)

    relationship = relationship("Relationship", back_populates="evidence")


# ─── Analysis ────────────────────────────────────────────────────────

class AnalysisRun(Base):
    __tablename__ = "analysis_runs"
    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=False, index=True)
    version = Column(Integer, nullable=False, default=1)
    input_hash = Column(String(64), nullable=False)
    configuration = Column(JSON, nullable=True)
    engine_versions = Column(JSON, nullable=True)
    status = Column(SAEnum(JobStatus), nullable=False, default=JobStatus.QUEUED)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    failure_details = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    case = relationship("Case", back_populates="analysis_runs")
    signals = relationship("Signal", back_populates="analysis_run")


class Signal(Base):
    __tablename__ = "signals"
    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=False, index=True)
    analysis_run_id = Column(UUID(as_uuid=True), ForeignKey("analysis_runs.id"), nullable=False, index=True)
    engine_name = Column(String(100), nullable=False)
    engine_version = Column(String(50), nullable=True)
    entity_pair = Column(JSON, nullable=False)
    family = Column(String(50), nullable=False, index=True)
    contributing_record_ids = Column(JSON, nullable=True)
    time_window_start = Column(DateTime, nullable=True)
    time_window_end = Column(DateTime, nullable=True)
    numeric_value = Column(Float, nullable=False)
    quality_factor = Column(Float, nullable=False, default=1.0)
    feature_details = Column(JSON, nullable=True)
    explanation = Column(Text, nullable=True)
    contradiction = Column(Boolean, nullable=False, default=False)
    contradiction_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    analysis_run = relationship("AnalysisRun", back_populates="signals")

    __table_args__ = (
        Index("ix_signal_case_family", "case_id", "family"),
    )


class Hypothesis(Base):
    __tablename__ = "hypotheses"
    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=False, index=True)
    analysis_run_id = Column(UUID(as_uuid=True), ForeignKey("analysis_runs.id"), nullable=False, index=True)
    stable_key = Column(String(200), nullable=False)
    entity_pair = Column(JSON, nullable=False)
    notes = Column(Text, nullable=True)
    timestamp_hypothesis_generated = Column(DateTime, nullable=True)
    contributing_signal_highlights = Column(JSON, nullable=True)
    state = Column(SAEnum(HypothesisState), nullable=False, default=HypothesisState.CANDIDATE)
    review_state = Column(SAEnum(ReviewState), nullable=False, default=ReviewState.NEW)
    numeric_value = Column(Float, nullable=False, default=0)
    quality_factor = Column(Float, nullable=False, default=1.0)
    engine_version = Column(String(50), nullable=True)
    hypothesis_type = Column(String(50), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    case = relationship("Case", back_populates="hypotheses")
    hypothesis_signals = relationship("HypothesisSignal", back_populates="hypothesis")
    recommendations = relationship(
        "HypothesisRecommendation", back_populates="hypothesis", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_hypothesis_case_key", "case_id", "stable_key"),
    )


class HypothesisSignal(Base):
    __tablename__ = "hypothesis_signals"
    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    hypothesis_id = Column(UUID(as_uuid=True), ForeignKey("hypotheses.id"), nullable=False, index=True)
    signal_id = Column(UUID(as_uuid=True), ForeignKey("signals.id"), nullable=True, index=True)
    family = Column(String(50), nullable=False)
    entity_pair = Column(JSON, nullable=False)
    weight = Column(Float, nullable=False)
    contribution = Column(Float, nullable=False)
    quality_factor = Column(Float, nullable=False, default=1.0)
    feature_details = Column(JSON, nullable=True)
    contradiction = Column(Boolean, nullable=False, default=False)

    hypothesis = relationship("Hypothesis", back_populates="hypothesis_signals")
    signal = relationship("Signal")


class HypothesisRecommendation(Base):
    __tablename__ = "hypothesis_recommendations"
    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    hypothesis_id = Column(UUID(as_uuid=True), ForeignKey("hypotheses.id"), nullable=False, index=True)
    type = Column(SAEnum(RecommendationType), nullable=False)
    status = Column(SAEnum(RecommendationStatus), nullable=False, default=RecommendationStatus.PENDING)
    estimated_completion_days = Column(Integer, nullable=True)
    rationale = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    hypothesis = relationship("Hypothesis", back_populates="recommendations")


# ─── Review & Workflow ──────────────────────────────────────────────

class ReviewAction(Base):
    __tablename__ = "review_actions"
    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=False, index=True)
    entity_id = Column(UUID(as_uuid=True), ForeignKey("entities.id"), nullable=True)
    hypothesis_id = Column(UUID(as_uuid=True), ForeignKey("hypotheses.id"), nullable=True)
    reviewer_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    action = Column(String(50), nullable=False)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    case = relationship("Case", back_populates="review_actions")


# ─── Saved Views, Copilot, Reports, Audit ──────────────────────────

class SavedView(Base):
    __tablename__ = "saved_views"
    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    view_config = Column(JSON, nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    case = relationship("Case", back_populates="saved_views")


class CopilotMessage(Base):
    __tablename__ = "copilot_messages"
    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    query = Column(Text, nullable=False)
    response = Column(Text, nullable=False)
    citations = Column(JSON, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class Report(Base):
    __tablename__ = "reports"
    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=False, index=True)
    title = Column(String(300), nullable=False)
    content = Column(JSON, nullable=False)
    format = Column(String(20), nullable=False, default="html")
    analysis_run_id = Column(UUID(as_uuid=True), ForeignKey("analysis_runs.id"), nullable=True)
    generated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    file_path = Column(String(1000), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    case = relationship("Case", back_populates="reports")


class AuditEvent(Base):
    __tablename__ = "audit_events"
    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=True, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    action = Column(String(100), nullable=False)
    resource_type = Column(String(50), nullable=True)
    resource_id = Column(UUID(as_uuid=True), nullable=True)
    details = Column(JSON, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    case = relationship("Case", back_populates="audit_events")


class Job(Base):
    __tablename__ = "jobs"
    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=False, index=True)
    job_type = Column(String(50), nullable=False)
    status = Column(SAEnum(JobStatus), nullable=False, default=JobStatus.QUEUED)
    payload = Column(JSON, nullable=True)
    result = Column(JSON, nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    claimed_by = Column(String(100), nullable=True)
    claim_expires_at = Column(DateTime, nullable=True)
    retry_count = Column(Integer, nullable=False, default=0)
    max_retries = Column(Integer, nullable=False, default=3)


# ─── Investigation Workspace ────────────────────────────────────────

class ContradictionStatus(str, enum.Enum):
    OPEN = "open"
    NEEDS_CLARIFICATION = "needs_clarification"
    RESOLVED = "resolved"
    DISMISSED = "dismissed"


class LeadPriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class LeadStatus(str, enum.Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    DISMISSED = "dismissed"


class GapStatus(str, enum.Enum):
    OPEN = "open"
    ADDRESSED = "addressed"
    DISMISSED = "dismissed"


class ActionStatus(str, enum.Enum):
    PROPOSED = "proposed"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"


class Contradiction(Base):
    __tablename__ = "contradictions"
    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=False, index=True)
    title = Column(String(300), nullable=False)
    statements = Column(JSON, nullable=False, default=list)
    entity_ids = Column(JSON, nullable=True, default=list)
    time_context = Column(Text, nullable=True)
    detection_method = Column(String(100), nullable=True)
    explanation = Column(Text, nullable=True)
    status = Column(SAEnum(ContradictionStatus), nullable=False, default=ContradictionStatus.OPEN)
    resolution_note = Column(Text, nullable=True)
    resolved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    analysis_run_id = Column(UUID(as_uuid=True), ForeignKey("analysis_runs.id"), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    case = relationship("Case")
    review_history = relationship("ContradictionReview", back_populates="contradiction", cascade="all, delete-orphan")


class ContradictionReview(Base):
    __tablename__ = "contradiction_reviews"
    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    contradiction_id = Column(UUID(as_uuid=True), ForeignKey("contradictions.id"), nullable=False, index=True)
    reviewer_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    decision = Column(String(50), nullable=False)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    contradiction = relationship("Contradiction", back_populates="review_history")


class Lead(Base):
    __tablename__ = "leads"
    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=False, index=True)
    title = Column(String(300), nullable=False)
    description = Column(Text, nullable=True)
    origin_type = Column(String(50), nullable=True)
    origin_id = Column(UUID(as_uuid=True), nullable=True)
    entity_ids = Column(JSON, nullable=True, default=list)
    supporting_evidence_refs = Column(JSON, nullable=True, default=list)
    conflicting_evidence_refs = Column(JSON, nullable=True, default=list)
    priority = Column(SAEnum(LeadPriority), nullable=False, default=LeadPriority.MEDIUM)
    priority_rationale = Column(Text, nullable=True)
    status = Column(SAEnum(LeadStatus), nullable=False, default=LeadStatus.OPEN)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    case = relationship("Case")
    gaps = relationship("InformationGap", back_populates="lead", cascade="all, delete-orphan")
    actions = relationship("InvestigationAction", back_populates="lead")
    review_history = relationship("LeadReview", back_populates="lead", cascade="all, delete-orphan")


class LeadReview(Base):
    __tablename__ = "lead_reviews"
    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    lead_id = Column(UUID(as_uuid=True), ForeignKey("leads.id"), nullable=False, index=True)
    reviewer_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    decision = Column(String(50), nullable=False)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    lead = relationship("Lead", back_populates="review_history")


class InformationGap(Base):
    __tablename__ = "information_gaps"
    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=False, index=True)
    lead_id = Column(UUID(as_uuid=True), ForeignKey("leads.id"), nullable=True, index=True)
    title = Column(String(300), nullable=False)
    description = Column(Text, nullable=True)
    related_entity_ids = Column(JSON, nullable=True, default=list)
    related_evidence_refs = Column(JSON, nullable=True, default=list)
    status = Column(SAEnum(GapStatus), nullable=False, default=GapStatus.OPEN)
    resolution_note = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    case = relationship("Case")
    lead = relationship("Lead", back_populates="gaps")
    actions = relationship("InvestigationAction", back_populates="gap")


class InvestigationAction(Base):
    __tablename__ = "investigation_actions"
    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=False, index=True)
    gap_id = Column(UUID(as_uuid=True), ForeignKey("information_gaps.id"), nullable=True, index=True)
    lead_id = Column(UUID(as_uuid=True), ForeignKey("leads.id"), nullable=True, index=True)
    title = Column(String(300), nullable=False)
    description = Column(Text, nullable=True)
    proposed_step = Column(Text, nullable=True)
    expected_information = Column(Text, nullable=True)
    source_refs = Column(JSON, nullable=True, default=list)
    status = Column(SAEnum(ActionStatus), nullable=False, default=ActionStatus.PROPOSED)
    outcome_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    case = relationship("Case")
    gap = relationship("InformationGap", back_populates="actions")
    lead = relationship("Lead", back_populates="actions")
