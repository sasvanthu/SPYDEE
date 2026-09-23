from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime
from uuid import UUID


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"


class ImportRequest(BaseModel):
    field_mapping: Optional[dict[str, str]] = Field(default_factory=dict)


class UserResponse(BaseModel):
    id: UUID
    username: str
    email: str
    display_name: str
    role: str
    is_active: bool

    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: str = Field(..., max_length=120)
    display_name: str = Field(..., max_length=120)
    password: str = Field(..., min_length=8, max_length=128)
    role: str = "investigator"


class UserUpdate(BaseModel):
    display_name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None


class CaseCreate(BaseModel):
    title: str = Field(..., max_length=300)
    case_code: str = Field(..., max_length=50)
    description: Optional[str] = None


class CaseResponse(BaseModel):
    id: UUID
    title: str
    case_code: str
    description: Optional[str]
    status: str
    is_synthetic: bool
    created_by: UUID
    created_at: datetime
    updated_at: datetime
    entity_count: int = 0
    event_count: int = 0
    evidence_count: int = 0
    hypothesis_count: int = 0
    relationship_count: int = 0

    class Config:
        from_attributes = True


class CaseUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None


class MembershipGrant(BaseModel):
    user_id: UUID
    role: str


class EntityCreate(BaseModel):
    entity_type: str
    label: str
    description: Optional[str] = None


class EntityResponse(BaseModel):
    id: UUID
    case_id: UUID
    entity_type: str
    label: str
    description: Optional[str]
    review_state: str
    created_at: datetime
    attributes: Optional[dict] = None
    identifiers: List["IdentifierResponse"] = []

    class Config:
        from_attributes = True


class IdentifierResponse(BaseModel):
    id: UUID
    id_type: str
    id_value: str
    normalized_value: str
    review_state: str = "new"

    class Config:
        from_attributes = True


class EntityReviewRequest(BaseModel):
    decision: str
    note: Optional[str] = None


class EvidenceUploadResponse(BaseModel):
    id: UUID
    original_filename: str
    media_type: str
    byte_size: int
    status: str
    created_at: datetime
    source_type: Optional[str] = None
    source_description: Optional[str] = None
    sha256: Optional[str] = None
    accepted_count: Optional[int] = 0

    class Config:
        from_attributes = True


class ImportResponse(BaseModel):
    id: UUID
    evidence_file_id: UUID
    status: str
    accepted_count: int
    rejected_count: int
    created_at: datetime

    class Config:
        from_attributes = True


class SourceRecordResponse(BaseModel):
    id: UUID
    row_locator: Optional[str]
    original_content: dict
    normalized_content: dict
    validation_flags: Optional[dict]
    is_duplicate: bool

    class Config:
        from_attributes = True


class GraphNode(BaseModel):
    id: str
    label: str
    entity_type: str
    review_state: str
    properties: dict = {}


class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    relationship_type: str
    classification: str
    label: str
    properties: dict = {}


class GraphResponse(BaseModel):
    nodes: List[GraphNode]
    edges: List[GraphEdge]
    truncated: bool = False
    total_nodes: int = 0
    total_edges: int = 0


class GraphFilter(BaseModel):
    entity_types: Optional[List[str]] = None
    relationship_types: Optional[List[str]] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    review_states: Optional[List[str]] = None
    include_inferred: bool = True
    max_nodes: int = 500
    max_edges: int = 2000


class TimelineEvent(BaseModel):
    id: UUID
    event_type: str
    start_time: Optional[datetime]
    end_time: Optional[datetime]
    participants: List[str] = []
    location: Optional[str] = None
    details: Optional[dict] = None
    source_record_id: Optional[UUID] = None

    class Config:
        from_attributes = True


class HypothesisResponse(BaseModel):
    id: UUID
    case_id: UUID
    analysis_run_id: Optional[UUID] = None
    stable_key: str
    hypothesis_type: Optional[str]
    entity_pair: Optional[dict]
    notes: Optional[str]
    timestamp_hypothesis_generated: Optional[datetime]
    contributing_signal_highlights: Optional[List]
    state: str
    review_state: str
    numeric_value: float
    quality_factor: Optional[float]
    engine_version: Optional[str]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class HypothesisSignalResponse(BaseModel):
    id: UUID
    hypothesis_id: UUID
    family: str
    entity_pair: Optional[dict]
    weight: float
    contribution: float
    quality_factor: float
    contradiction: bool
    feature_details: Optional[dict]

    class Config:
        from_attributes = True


class HypothesisReviewRequest(BaseModel):
    decision: str
    note: Optional[str] = None


class SignalResponse(BaseModel):
    id: UUID
    engine_name: str
    engine_version: Optional[str] = None
    family: str
    entity_pair: dict
    numeric_value: float
    quality_factor: float
    explanation: Optional[str]
    contributing_record_ids: Optional[List]
    feature_details: Optional[dict] = None
    contradiction: bool = False
    contradiction_reason: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SignalLite(BaseModel):
    id: UUID
    engine_name: str
    engine_version: Optional[str] = None
    family: str
    entity_pair: dict
    numeric_value: float
    quality_factor: float
    explanation: Optional[str]
    contributing_record_count: int = 0
    feature_details: Optional[dict] = None
    contradiction: bool = False
    contradiction_reason: Optional[str] = None


class SignalsResponse(BaseModel):
    run_id: UUID
    run_version: int
    status: str
    counts_by_family: dict[str, int]
    signals: List[SignalLite]


class AnalysisRunResponse(BaseModel):
    id: UUID
    case_id: UUID
    version: int
    status: str
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    configuration: Optional[dict]
    created_at: datetime
    signal_count: int = 0
    hypothesis_count: int = 0
    contradiction_count: int = 0
    engine_error_count: int = 0

    class Config:
        from_attributes = True


class CopilotQuery(BaseModel):
    query: str


class CopilotResponse(BaseModel):
    answer: str
    citations: List[dict] = []
    follow_ups: List[str] = []
    links: List[dict] = []


class ReportRequest(BaseModel):
    title: str
    include_hypotheses: List[UUID] = []
    include_unresolved: bool = True
    include_65b_certificate: bool = False
    analysis_run_id: Optional[UUID] = None


class ReportResponse(BaseModel):
    id: UUID
    title: str
    content: dict
    format: str
    created_at: datetime

    class Config:
        from_attributes = True


class AuditEventResponse(BaseModel):
    id: UUID
    action: str
    resource_type: Optional[str]
    resource_id: Optional[UUID]
    details: Optional[dict]
    user_id: UUID
    created_at: datetime

    class Config:
        from_attributes = True


class SavedViewCreate(BaseModel):
    name: str
    view_config: dict


class SavedViewResponse(BaseModel):
    id: UUID
    name: str
    view_config: dict
    created_by: UUID
    created_at: datetime

    class Config:
        from_attributes = True


class JobResponse(BaseModel):
    id: UUID
    job_type: str
    status: str
    result: Optional[dict]
    error_message: Optional[str]
    created_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True


class PaginatedResponse(BaseModel):
    items: List[Any]
    total: int
    page: int
    page_size: int


class SourceRef(BaseModel):
    case_id: Optional[str] = None
    evidence_id: Optional[str] = None
    record_id: Optional[str] = None
    locator: Optional[str] = None
    excerpt: Optional[str] = None
    extraction_method: Optional[str] = None
    analysis_run_id: Optional[str] = None
    finding_id: Optional[str] = None
    source_type: Optional[str] = None


# ─── Investigation workspace schemas ────────────────────────────────

class ContradictionStatement(BaseModel):
    text: str
    source_ref: Optional[SourceRef] = None
    entity_id: Optional[str] = None


class ContradictionCreate(BaseModel):
    title: str
    statements: List[ContradictionStatement]
    entity_ids: Optional[List[str]] = None
    time_context: Optional[str] = None
    detection_method: Optional[str] = None
    explanation: Optional[str] = None
    analysis_run_id: Optional[str] = None


class ContradictionResponse(BaseModel):
    id: str
    case_id: str
    title: str
    statements: List[dict]
    entity_ids: Optional[List]
    time_context: Optional[str]
    detection_method: Optional[str]
    explanation: Optional[str]
    status: str
    resolution_note: Optional[str]
    resolved_by: Optional[str]
    analysis_run_id: Optional[str]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class ContradictionReview(BaseModel):
    decision: str
    note: Optional[str] = None


class ContradictionReviewHistory(BaseModel):
    id: str
    reviewer_id: str
    decision: str
    note: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class ContradictionDetail(BaseModel):
    contradiction: ContradictionResponse
    review_history: List[ContradictionReviewHistory] = []


class LeadCreate(BaseModel):
    title: str
    description: Optional[str] = None
    origin_type: Optional[str] = None
    origin_id: Optional[str] = None
    entity_ids: Optional[List[str]] = None
    supporting_evidence_refs: Optional[List[SourceRef]] = None
    conflicting_evidence_refs: Optional[List[SourceRef]] = None
    priority: str = "medium"
    priority_rationale: Optional[str] = None


class LeadUpdate(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None
    priority_rationale: Optional[str] = None
    description: Optional[str] = None


class LeadResponse(BaseModel):
    id: str
    case_id: str
    title: str
    description: Optional[str]
    origin_type: Optional[str]
    origin_id: Optional[str]
    entity_ids: Optional[List]
    supporting_evidence_refs: Optional[List]
    conflicting_evidence_refs: Optional[List]
    priority: str
    priority_rationale: Optional[str]
    status: str
    created_by: Optional[str]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class LeadReview(BaseModel):
    decision: str
    note: Optional[str] = None


class LeadDetail(BaseModel):
    lead: LeadResponse
    gaps: List["GapResponse"] = []
    actions: List["ActionResponse"] = []
    review_history: List[dict] = []


class GapCreate(BaseModel):
    lead_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    related_entity_ids: Optional[List[str]] = None
    related_evidence_refs: Optional[List[SourceRef]] = None


class GapUpdate(BaseModel):
    status: Optional[str] = None
    resolution_note: Optional[str] = None


class GapResponse(BaseModel):
    id: str
    case_id: str
    lead_id: Optional[str]
    title: str
    description: Optional[str]
    related_entity_ids: Optional[List]
    related_evidence_refs: Optional[List]
    status: str
    resolution_note: Optional[str]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class GapDetail(BaseModel):
    gap: GapResponse
    actions: List["ActionResponse"] = []


class ActionCreate(BaseModel):
    gap_id: Optional[str] = None
    lead_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    proposed_step: Optional[str] = None
    expected_information: Optional[str] = None
    source_refs: Optional[List[SourceRef]] = None


class ActionUpdate(BaseModel):
    status: Optional[str] = None
    outcome_notes: Optional[str] = None


class ActionResponse(BaseModel):
    id: str
    case_id: str
    gap_id: Optional[str]
    lead_id: Optional[str]
    title: str
    description: Optional[str]
    proposed_step: Optional[str]
    expected_information: Optional[str]
    source_refs: Optional[List]
    status: str
    outcome_notes: Optional[str]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class ManualEventCreate(BaseModel):
    event_type: str
    label: str
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    time_precision: Optional[str] = None
    details: Optional[dict] = None
    participant_entity_ids: Optional[List[str]] = None


class CaseWorkspaceSummary(BaseModel):
    case: CaseResponse
    evidence_processing: dict = {}
    entity_count: int = 0
    relationship_count: int = 0
    event_count: int = 0
    signal_count: int = 0
    hypothesis_count: int = 0
    open_contradictions: int = 0
    open_leads: int = 0
    open_gaps: int = 0
    open_actions: int = 0
    findings_awaiting_review: int = 0
    recent_evidence: List[dict] = []
    recent_activity: List[dict] = []
    latest_run: Optional[dict] = None
    analysis_stale: bool = False
    analysis_stale_reason: Optional[str] = None


class CCTVObservationResponse(BaseModel):
    id: str
    case_id: str
    camera_id: str
    location: str
    lat: float
    lon: float
    timestamp: str
    frame_reference: Optional[str] = None
    signals: dict
    confidence: str
    status: str
    contributing_signals: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CCTVObservationListResponse(BaseModel):
    observations: List[CCTVObservationResponse]


class EvidenceDetailResponse(BaseModel):
    id: str
    case_id: str
    original_filename: str
    media_type: str
    byte_size: int
    sha256: str
    source_type: str
    source_description: Optional[str]
    uploaded_by: str
    parser_version: Optional[str]
    status: str
    extracted_text: Optional[str]
    extraction_error: Optional[str]
    retry_count: int
    accepted_count: int
    rejected_count: int
    created_at: datetime
    record_count: int = 0
    import_history: List[dict] = []
    derived_links: dict = {}

    class Config:
        from_attributes = True


LeadDetail.model_rebuild()
TokenResponse.model_rebuild()
