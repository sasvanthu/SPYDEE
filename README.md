# SPYDEE - Investigative Intelligence Workspace

AI-Assisted Investigative Intelligence and Criminal-Network Analysis System.

Built for Smart India Hackathon 2026, Problem Statement 26189. Team: EXIT(0);

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Python 3.12+
- Node.js 20+

### Option 1: Docker Compose (Recommended)

```bash
# Start all services
docker compose up --build

# Access:
# Web UI:  http://localhost:5173
# API:     http://localhost:8000
# Docs:    http://localhost:8000/api/docs
```

### Option 2: Local Development

```bash
# 1. Start PostgreSQL
# Create database: spydee
# User: spydee, Password: spydee_dev_pass

# 2. Generate demo data
python demo/generator/generate.py

# 3. Setup API
cd services/api
pip install -r requirements.txt
alembic upgrade head
python -m demo.generator.seed_db

# 4. Start API
uvicorn app.main:app --reload --port 8000

# 5. Start Worker
cd services/worker
pip install -r requirements.txt
python -m app.main

# 6. Setup Frontend
cd apps/web
npm install
npm run dev
```

### Demo Accounts
| Username      | Password   | Role             |
|---------------|------------|------------------|
| admin         | admin123   | Administrator    |
| investigator  | invest123  | Investigator     |
| supervisor    | super123   | Case Supervisor  |

## Demo Data

Three synthetic cases are pre-seeded:

- **BRK-2026-001 - Broken Chain**: Main demo case with alias continuity patterns
- **HBR-2026-002 - Harbor Ledger**: Financial and infrastructure analysis
- **QTM-2026-003 - Quiet Market**: Negative control (should not produce strong leads)

All data is fictional. No real personal data is used.

## Architecture

See [ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Algorithms

See [ALGORITHMS.md](docs/ALGORITHMS.md)

## Demo Sequence

See [DEMO.md](docs/DEMO.md)

## Testing

See [TESTING.md](docs/TESTING.md)

## License

Prototype for evaluation purposes only.
