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

## Demo Data & National Datasets

### Synthetic Benchmark Cases:
- **BRK-2026-001 - Broken Chain**: Main demo case with alias continuity patterns
- **HBR-2026-002 - Harbor Ledger**: Financial and infrastructure analysis
- **QTM-2026-003 - Quiet Market**: Negative control (should not produce strong leads)

### National & Cross-Validation Cases (25 Datasets):
- **IND-2026-004 - Operation Trishul**: Multi-modal fusion with IISc UVH-26 SafeCity CCTV, NPCI UPI 2024 Mule structuring, InLegalNER FIR filings, and Karnataka TRAI CDR mobility.
- **IND-2026-005 - Hawala & P2P Crypto Laundering**: Financial intelligence benchmarked on IBM AML, Elliptic Bitcoin Graph, and NPCI UPI fraud datasets.
- **IND-2026-006 - Bengaluru SafeCity Biometrics**: Urban video surveillance powered by IISc UVH-26 SafeCity CCTV, IIIT-Delhi forensic sketch-photo matching, and IMFDB/IIITM facial biometrics.
- **IND-2026-007 - National Cybercrime FIR Registry**: Legal document intelligence processing FIRs with InLegalNER, Naamapadam multilingual NER, ILDC SC precedents, NyayaAnumana (2.28M cases), AWS Open Data judgments, LawSum, IndianBailJudgments, and NCRB crime statistics.
- **IND-2026-ALL - Operation Chakra-Vyuh**: Grand Unified National Security Grid interconnecting all 25 National & Global datasets.

To populate or refresh all 25 datasets across all cases:
```bash
python demo/generator/seed_all_25_datasets.py
```
View the interactive Registry in the web app at `http://localhost:5173/datasets` or via the sidebar: **NATIONAL DATASETS (25)**.

## Architecture

See [ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Algorithms

See [ALGORITHMS.md](docs/ALGORITHMS.md)

## Demo Sequence

See [DEMO.md](docs/DEMO.md)

## Production Deployment

See [DEPLOYMENT.md](docs/DEPLOYMENT.md)

## Testing

See [TESTING.md](docs/TESTING.md)

## License

Prototype for evaluation purposes only.
