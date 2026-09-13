# SPYDEE Architecture

## System Overview

SPYDEE is a full-stack investigative intelligence platform with three core services:

```
[Browser] ──HTTP──> [FastAPI] ──SQL──> [PostgreSQL]
                        │
                   [Worker Process]
                        │
              [Analysis Engines]
```

## Services

### Frontend (apps/web)
- React 18 + TypeScript + Vite
- Tailwind CSS for styling
- Cytoscape.js for graph visualization
- Recharts for charts
- TanStack Query for data fetching

### API (services/api)
- FastAPI with async SQLAlchemy
- Alembic for migrations
- JWT authentication with bcrypt password hashing
- Pydantic schemas for validation
- CORS configured for localhost development

### Worker (services/worker)
- Asyncio-based background processor
- Transactional job claims with stale-job recovery
- Supports import, analysis, and report jobs
- Configurable retry limits

### Database (PostgreSQL)
- UUID primary keys on all tables
- Foreign key constraints with case-scoped ownership
- JSON columns for flexible metadata
- Indexed for query performance

## Data Flow

1. **Evidence Upload**: File stored in protected volume, metadata in PostgreSQL
2. **Import**: Worker parses CSV/JSON, normalizes records, deduplicates by SHA-256
3. **Entity Resolution**: Identifiers linked to entities, deterministic normalization
4. **Graph Construction**: NetworkX builds case-scoped directed graph
5. **Signal Computation**: Communication, graph structure, and other engines compute signals
6. **Hypothesis Generation**: Weighted fusion of signal families produces strength indices
7. **Review**: Investigators record decisions with audit trail
8. **Reporting**: Snapshot-based reports preserve analysis version

## Key Design Decisions

- **Case-scoped isolation**: Every record has case_id; cross-case access is forbidden
- **Append-only audit**: All state changes logged; reports are versioned snapshots
- **Deterministic analysis**: Same input + config = same output; no random factors at runtime
- **Prototype boundaries**: No live telecom feeds, no real OSINT, no external API dependencies
- **Evidence-strength index**: Scores are not probability claims; they are relative signal strength

## Module Structure

```
spydee/
├── apps/web/              # React frontend
├── services/api/          # FastAPI backend
│   ├── app/
│   │   ├── models/        # SQLAlchemy models
│   │   ├── schemas/       # Pydantic schemas
│   │   ├── routers/       # API endpoints
│   │   ├── services/      # Business logic
│   │   └── auth/          # Authentication
│   └── alembic/           # Database migrations
├── services/worker/       # Background processor
├── analysis/
│   ├── engines/           # Communication, graph engines
│   ├── scoring/           # Hypothesis generation
│   └── graph/             # Graph utilities
├── demo/
│   ├── generator/         # Synthetic data + DB seed
│   ├── import-batches/    # Generated fixture files
│   └── ground-truth/      # Ground truth (not used by app)
└── tests/                 # Unit, integration, e2e
```
