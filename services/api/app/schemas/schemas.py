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
    analysis_run_id: UUID
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
    note: str


class SignalResponse(BaseModel):
    id: UUID
    engine_name: str
    family: str
    entity_pair: dict
    numeric_value: float
    quality_factor: float
    explanation: Optional[str]
    contributing_record_ids: Optional[List]
    contradiction: bool = False
    contradiction_reason: Optional[str] = None

    class Config:
        from_attributes = True


class AnalysisRunResponse(BaseModel):
    id: UUID
    case_id: UUID
    version: int
    status: str
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    configuration: Optional[dict]
    created_at: datetime

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


TokenResponse.model_rebuild()
