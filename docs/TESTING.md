# SPYDEE Testing

## Tests Run

### Database Setup
- [x] Migration creates all tables without errors
- [x] Seed script populates users, cases, evidence, entities, events

### Authentication
- [x] Login with valid credentials returns JWT token
- [x] Login with invalid credentials returns 401
- [x] Accessing protected routes without token returns 401
- [x] Token expiration returns 401

### Case Management
- [x] Create case with unique code
- [x] List cases filtered by membership
- [x] Case detail shows correct counts
- [x] Non-member cannot access case data

### Evidence Ingestion
- [x] Upload CSV/JSON file
- [x] Duplicate detection by SHA-256
- [x] Import processes all records
- [x] Source records stored with provenance
- [x] Re-import of same file does not multiply records

### Entity Resolution
- [x] Identifiers normalized deterministically
- [x] Entities created from imported records
- [x] Phone normalization strips formatting
- [x] Entity review decisions persist

### Graph Construction
- [x] Nodes represent entities
- [x] Edges represent relationships
- [x] Graph filters by entity type
- [x] Bounded expansion prevents hairball
- [x] Path finding works between connected entities

### Analysis
- [x] Communication signals computed
- [x] Graph structural signals computed
- [x] Hypotheses generated with score breakdown
- [x] Missing information identified
- [x] Same input produces same output

### Copilot
- [x] Query returns cited response
- [x] Follow-up suggestions provided
- [x] Refuses unsupported claims
- [x] Citations link to real records

### Reports
- [x] Report generation creates JSON content
- [x] Report preview shows hypotheses and limitations
- [x] Reports preserve analysis version

### Audit
- [x] All state changes logged
- [x] Audit events scoped to case

## Known Limitations
- StyloLink engine not yet implemented
- GhostTower engine not yet implemented
- Device/SIM Continuity engine not yet implemented
- PDF text extraction requires extractable text
- No real OCR for scanned documents
- Graph visualization uses external CDN for Cytoscape.js
