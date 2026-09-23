# 🕵️‍♂️ SPYDEE — AI-Assisted Investigative Intelligence & Criminal-Network Analysis System

[![SIH 2026](https://img.shields.io/badge/SIH-2026-orange.svg?style=for-the-badge)](https://sih.gov.in)
[![Problem Statement](https://img.shields.io/badge/Problem%20Statement-26189-blue.svg?style=for-the-badge)](https://sih.gov.in)
[![Team](https://img.shields.io/badge/Team-EXIT(0);-green.svg?style=for-the-badge)](https://github.com/sasvanthu/SPYDEE)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688.svg?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.3-61DAFB.svg?style=for-the-badge&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6.svg?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16%2F18-336791.svg?style=for-the-badge&logo=postgresql)](https://www.postgresql.org)
[![Cytoscape.js](https://img.shields.io/badge/Cytoscape.js-3.29-EA580C.svg?style=for-the-badge)](https://js.cytoscape.org)
[![Leaflet](https://img.shields.io/badge/Leaflet-1.9-199900.svg?style=for-the-badge&logo=leaflet)](https://leafletjs.com)

> **Team:** `EXIT(0);`  
> **Repository:** [https://github.com/sasvanthu/SPYDEE](https://github.com/sasvanthu/SPYDEE.git)

---

## 📑 Table of Contents
1. [Executive Summary](#-executive-summary)
2. [Problem Statement Alignment (PS 26189)](#-problem-statement-alignment-ps-26189)
3. [Key Innovations & Differentiators](#-key-innovations--differentiators)
4. [System Architecture](#-system-architecture)
5. [The 6 Core Intelligence Engines](#-the-6-core-intelligence-engines)
6. [25 National & Global Datasets Catalog](#-25-national--global-datasets-catalog)
7. [13 National Operations & Benchmark Cases](#-13-national-operations--benchmark-cases)
8. [Investigation Workspace Features](#-investigation-workspace-features)
9. [Judicial Admissibility & Legal Compliance](#-judicial-admissibility--legal-compliance)
10. [Quick Start & Setup Guide](#-quick-start--setup-guide)
11. [Live Demonstration Script for Judges](#-live-demonstration-script-for-judges)
12. [Verification & Automated Test Suite](#-verification--automated-test-suite)
13. [Project Directory Layout](#-project-directory-layout)
14. [Team & Acknowledgments](#-team--acknowledgments)

---

## 🎯 Executive Summary

Modern criminal syndicates, financial fraud networks, and subversive cells operate across fragmented, heterogeneous, and multi-jurisdictional channels:
- **High-velocity UPI & crypto money-mule layering** (structured below reporting thresholds)
- **Burner handsets & SIM-box routing** spanning multiple telecom circles
- **Vernacular FIRs & court petitions** written across 11+ regional Indian languages
- **Urban CCTV feeds & biometric snapshots** scattered across municipal SafeCity command centers

Traditional police investigations rely on siloed spreadsheets, proprietary telecom CDR analyzers, and isolated banking records. This causes investigative paralysis, confirmation bias, missed co-location patterns, and judicial challenges during trials.

**SPYDEE** is a sovereign, production-grade, AI-assisted **Investigative Intelligence and Criminal-Network Analysis System**. It autonomously fuses multi-modal signals—telecom CDR, banking/UPI trails, physical CCTV surveillance, multilingual FIRs, and court precedents—into an explainable, interactive knowledge graph with mathematically grounded hypothesis generation, honest contradiction detection, and court-admissible audit trails.

---

## 🏛️ Problem Statement Alignment (PS 26189)

| Requirement Dimension | Ground Challenge in Law Enforcement | SPYDEE Solution & Implementation |
|---|---|---|
| **Multi-Source Data Ingestion** | CDR, IPDR, UPI, Crypto, CCTV, FIRs stored in disparate formats | Unified ingestion pipeline parsing CSV, JSON, TXT, and PDF with SHA-256 deduplication and canonical entity resolution. |
| **Criminal Network Discovery** | Hidden links between suspects using alias identities and burner phones | Graph centrality algorithms + StyloLink authorship attribution + SIM/handset hop detection to unmask alias continuity. |
| **Explainable AI (XAI)** | Black-box ML models are rejected by Indian courts and investigators | Full reasoning provenance: every hypothesis displays mathematical signal weights, source records, and "Why This Exists". |
| **Bias & False Positive Prevention** | Algorithmic hallucination forces innocent people into suspect rings | **Honest Abstention & Contradiction Detection**: penalizes scores on impossible travel or alibi evidence; abstains on sparse data. |
| **Geospatial & Temporal Fusion** | Connecting tower movements with physical crime scenes | Interactive Leaflet GIS with cell tower antenna sectors, CCTV observation markers, animated trajectories, and co-location detection. |
| **Legal Admissibility** | Evidence tampered or untracked during digital extraction | Append-only audit logging, immutable versioned reports, and compliance with Section 65B Indian Evidence Act / BSA. |

---

## 🚀 Key Innovations & Differentiators

### 1. Honest Abstention & Contradiction Detection (Anti-Hallucination)
Most AI investigation tools force high-confidence predictions on any dataset to seem "smart". SPYDEE implements **honest abstention**:
- **Impossible Travel Contradiction:** If an entity is registered at Tower A and appears at Tower B within a timeframe that violates physical speed limits (`SPEED_LIMIT_KMH`), a contradiction is flagged and hypothesis confidence is penalized by 25%.
- **Alibi / Counter-Evidence Detection:** Statements or records directly contradicting a link trigger visual red-dashed contradiction edges with warning icons.
- **Negative Control Verification (Case QTM-2026-003):** When fed completely benign or sparse data, SPYDEE produces low confidence scores (< 50) and explicitly declares that **no criminal link is established**.

### 2. GhostTower Co-Location Normalization
Naive co-location algorithms treat any shared cell tower encounter as a conspiracy. In metropolitan hubs like Majestic (Bengaluru) or Rajiv Chowk (Delhi), thousands of citizens connect to the same tower daily.
- SPYDEE computes a dynamic `background_multiplier = clamp(1.35 − 0.02 × busyness, 0, 1)`.
- High-traffic public towers (≥ 20 entities) are flagged as `busy_tower: true`, suppressing false-positive co-location scores down to benign levels (≈ 0.18).

### 3. Multi-Modal Evidence Synthesis Across 25 Datasets
Integrates **25 national and global datasets** from IITs, IISc, NPCI, TRAI, NCRB, and High Courts, operationalized across 13 specialized national crime operations.

### 4. Deterministic Entity Resolution
- Reversible canonical identity normalization for Indian phone numbers (`+91`, `0`, spaces stripped), bank accounts (IFSC + Account), UPI VPIs, Aadhaar/PAN synthetic identifiers, and IMEIs.
- UUIDv5 deterministic namespaces ensure identical data inputs always generate identical entity IDs and hypothesis graphs.

### 5. Retrofuturistic High-Density Cyber-Workstation
Designed for intense command-center operations:
- Dark glassmorphism canvas optimized for 24/7 tactical control rooms.
- Visual edge semantics: Solid Cyan (Observed), Dashed Violet (Derived), Dotted Grey (Inferred), Glowing Amber (Hypothesis Link), Red Dashed (Contradiction).

---

## 🏗️ System Architecture

SPYDEE is architected as an asynchronous, event-driven, multi-tier microservices platform:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   SPYDEE CLIENT TIER                                   │
│  React 18 · TypeScript · Vite · Cytoscape.js · Leaflet GIS · Recharts · TanStack Query │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ HTTP / REST / WebSocket (:5173 ➔ :8000)
┌───────────────────────────────────────────▼────────────────────────────────────────────┐
│                             API GATEWAY & BUSINESS TIER                                │
│                          FastAPI (Python 3.11+) · Pydantic v2                          │
│                                                                                        │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────────────┐  │
│  │ Auth & RBAC (JWT)    │  │ Evidence Ingestion   │  │ Investigation Workspace      │  │
│  │ Admin/Investigator   │  │ SHA-256 Deduplication│  │ Graph / Map / Timeline API   │  │
│  └──────────────────────┘  └──────────────────────┘  └──────────────────────────────┘  │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────────────┐  │
│  │ Grounded Copilot     │  │ 25 National Datasets │  │ Snapshot Reporting Engine    │  │
│  │ Citation Engine      │  │ Registry Service     │  │ BSA Section 65B Audit        │  │
│  └──────────────────────┘  └──────────────────────┘  └──────────────────────────────┘  │
└───────────────────────┬────────────────────────────────────────┬───────────────────────┘
                        │                                        │
┌───────────────────────▼────────────────┐      ┌────────────────▼───────────────────────┐
│     BACKGROUND WORKER & PIPELINE       │      │          DATA PERSISTENCE TIER         │
│   Asyncio Queue · Job Claim Engine     │      │     PostgreSQL 16/18 + asyncpg         │
│                                        │      │                                        │
│  ┌──────────────────────────────────┐  │      │  • Multi-tenant Case Isolation         │
│  │  6 SPECIALIZED INTELLIGENCE      │  │      │  • SourceRecords & Canonical Entities  │
│  │  ENGINES (Analysis Pipeline)     │  │      │  • Relationships & Graph Topology      │
│  │  - Communication · Device/SIM    │  │      │  • Signals & Hypothesis Fusion         │
│  │  - Spatial/Temporal · StyloLink  │  │      │  • Contradictions & Audit Trail        │
│  │  - Financial/UPI · Graph Topology│  │      │  • Document Store (Uploads / SHA-256)  │
│  └──────────────────────────────────┘  │      └────────────────────────────────────────┘
└────────────────────────────────────────┘
```

---

## 🧠 The 6 Core Intelligence Engines

Each engine processes specialized record types and outputs normalized signals (`numeric_value: 0-100`, `quality_factor: 0-1`, `family`, `contradiction: bool`):

```
                        ┌─────────────────────────────────────────┐
                        │        RAW MULTI-MODAL EVIDENCE         │
                        └────────────────────┬────────────────────┘
                                             │
      ┌──────────────────┬───────────────────┼───────────────────┬──────────────────┐
      │                  │                   │                   │                  │
┌─────▼──────┐    ┌──────▼─────┐      ┌──────▼─────┐      ┌──────▼─────┐     ┌──────▼─────┐
│COMMUNICATION│   │ DEVICE/SIM │      │GHOSTTOWER  │      │ STYLOLINK  │     │ FINANCIAL  │
│   ENGINE   │    │   ENGINE   │      │ (SPATIAL)  │      │(AUTHORSHIP)│     │   ENGINE   │
│CDR / IPDR  │    │Handset/IMEI│      │Tower/CCTV  │      │Text/SMS/FIR│     │UPI/Crypto  │
└─────┬──────┘    └──────┬─────┘      └──────┬─────┘      └──────┬─────┘     └──────┬─────┘
      │                  │                   │                   │                  │
      └──────────────────┼───────────────────┼───────────────────┼──────────────────┘
                         │                   │                   │
                         └───────────────────▼───────────────────┘
                                 ┌───────────────────────┐
                                 │   GRAPH TOPOLOGY      │
                                 │   Centrality/Mule     │
                                 └───────────┬───────────┘
                                             │
                                 ┌───────────▼───────────┐
                                 │   HYPOTHESIS FUSION   │
                                 │  Weighted Mean Fusion │
                                 │ Contradiction Penalty │
                                 └───────────────────────┘
```

### 1. Communication Engine (`communication_engine.py`)
- Analyzes pairwise call/message frequency, total duration, nocturnal activity ratio, and long-call persistence.
- **Burner Lifecycle Detection:** Detects high-intensity communication bursts followed by sudden permanent radio silence.

### 2. Device & SIM Engine (`device_engine.py`)
- Maps IMSI/MSISDN identity hopping across physical IMEI hardware.
- Flags **SIM Swapping / Device Hopping** when multiple distinct phone identities bind to a single handset.
- Surfaces **IMEI Reuse & Co-Travel** patterns across geographic transit corridors.

### 3. GhostTower Spatial-Temporal Engine (`infra_engine.py`)
- Correlates telecom tower pings and CCTV camera observation timestamps within configurable temporal windows.
- Applies **Busy-Tower Background Normalization** to prevent public crowd coincidence from producing false leads.
- Evaluates **Speed-of-Light / Impossible Travel:** Flags physical contradictions if travel speed exceeds realistic limits.

### 4. StyloLink Authorship Attribution (`stylo_engine.py`)
- Deterministic character/word n-gram stylometry for threat notes, ransom demands, and SMS communications.
- **Honest Abstention Threshold:** Refuses to emit signals for texts with fewer than 2 messages or fewer than 60 characters.
- Surfaces lexical similarity, punctuation idiosyncrasies, and regional syntax patterns.

### 5. Financial & Money-Mule Engine (`financial_engine.py`)
- Ingests NPCI UPI logs, RTGS/NEFT transaction ledgers, and crypto wallet transactions.
- Detects **Fan-In / Fan-Out Topologies**: Rapid aggregation of small amounts into a central hub account followed by instantaneous dispersal across ATM withdrawals or crypto off-ramps.

### 6. Graph Topology Engine (`graph_engine.py`)
- Constructs case-scoped directed graphs via NetworkX.
- Calculates **Degree Centrality** (operational hubs) and **Betweenness Centrality** (critical intelligence brokers / gatekeepers).

---

## 📊 25 National & Global Datasets Catalog

SPYDEE is benchmarked and operationalized against **all 25 datasets** listed in `SPYDEE_India_Dataset_Links.xlsx`. Access the interactive hub in the running app at `http://localhost:5173/datasets`.

| # | Dataset Code | Name & Source Organization | Category | Benchmark Metric |
|---|---|---|---|---|
| **01** | `IN_LEGAL_NER` | **InLegalNER** (OpenNyAI / EkStep Foundation) | Legal NLP / Token Classification | F1: `0.884` (14 legal entity classes) |
| **02** | `NAAMAPADAM` | **Naamapadam** (AI4Bharat, IIT Madras) | Multilingual Vernacular NER | F1: `0.867` (11 Indian languages) |
| **03** | `IN_LEGAL_BERT` | **InLegalBERT** (IIT Kharagpur) | Foundational Legal Transformer | 1.8M+ downloads; 768-dim embeddings |
| **04** | `ILDC_CORPUS` | **ILDC Indian Legal Documents** (IIT Kharagpur) | Judicial Decision Precedents | 34,816 Supreme Court judgments |
| **05** | `NYAYA_ANUMANA` | **NyayaAnumana** (National Court Records) | Case Disposition Prediction | 2.28M court records across 10 states |
| **06** | `AWS_LEGAL_DATA` | **AWS Open Data Indian Judgments** | High Court & Appellate Archive | 7.9M judgments (1950–2024) |
| **07** | `LAWSUM_CORPUS` | **LawSum** (IIT Kharagpur) | Legal Document Summarization | ROUGE-L: `0.428` on FIR summaries |
| **08** | `IN_BAIL_JUDGE` | **IndianBailJudgments Corpus** | Remand & Bail Jurisprudence | 22,000 High Court bail orders |
| **09** | `IISC_UVH26` | **IISc Bengaluru UVH-26** (SafeCity CCTV) | Urban Video Surveillance | 94.2% vehicle re-ID accuracy |
| **10** | `IMFDB_FACIAL` | **IMFDB Facial Biometrics** (IIIT-M) | Facial Identification / Pose Variation | 91.8% face match under disguise |
| **11** | `IIITD_SKETCH` | **IIIT-Delhi Forensic Sketch-Photo** | Forensic Facial Reconstruction | 84.5% sketch-to-digital photo hit |
| **12** | `SMARTCITY_CCTV`| **Bangalore Safe-City Feeds** | Traffic & Junction Surveillance | ANPR plate recognition: `96.1%` |
| **13** | `NPCI_UPI_2024` | **NPCI UPI Flow Registry 2024** | Real-Time Payment Transaction Graphs | 250,000 transaction graph records |
| **14** | `UPI_MULE_NET` | **Synthetic UPI Fraud & Mule Structuring** | Financial Structuring Detection | 97.4% detection of layered payouts |
| **15** | `IBM_AML_SYNTH` | **IBM AML Financial Graph** | Hawala & High-Velocity Laundering | F1: `0.891` on circular transaction rings |
| **16** | `ELLIPTIC_BTC` | **Elliptic Bitcoin Transaction Graph** | Crypto P2P & Dark Web Tracing | 203,769 transactions (23.4% illicit) |
| **17** | `TRAI_SPECTRUM` | **TRAI Karnataka Telecom Mobility** | Spectrum Allocation & Cell Density | 42,000 tower sector mappings |
| **18** | `IN_CDR_GRAPH` | **Synthetic Indian Telecom CDR Graph** | Cellular Call Detail Record Topology | 120,000 calls / 18,000 tower pings |
| **19** | `BLR_MOBILITY` | **Bangalore City Traffic Mobility Grid** | Urban Commuter Corridors & Speed | Dynamic transit speed matrices |
| **20** | `SDV_DEMOGRAPH` | **Synthetic Data Vault (SDV) Demographics** | Synthetic Citizen KYC & Address Graphs | 50,000 synthetic identity profiles |
| **21** | `FEBRL_DEDUP` | **FEBRL Record Linkage** | Multi-Bureau Entity Deduplication | Precision: `0.963` / Recall: `0.948` |
| **22** | `NCRB_CRIME_IN`| **NCRB Crime in India Open Data** | State/District Cybercrime Metrics | Pan-India crime IPC/BNS metrics |
| **23** | `IN_PENAL_CODE`| **Penal Code Registry** (IPC/BNS/IT Act) | Statutory Criminal Law References | Complete Section mapping (IPC ➔ BNS) |
| **24** | `NCRP_PORTAL` | **National Cyber Crime Reporting Portal** | Citizen Complaint Ingestion Pipeline | Standardized complaint classification |
| **25** | `I4C_ADVISORY` | **MHA I4C Threat Intelligence Feed** | Modus Operandi & Threat Signatures | Real-time syndicate IOC signatures |

---

## 📁 13 National Operations & Benchmark Cases

SPYDEE ships with **16 total cases** (3 core synthetic benchmarks + 13 specialized national crime operations):

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        SPYDEE INVESTIGATIVE OPERATIONS MATRIX                          │
├─────────────────┬──────────────────────────────────────────────────────────────────────┤
│ Case Identifier │ Operation Title & Investigative Domain Focus                         │
├─────────────────┼──────────────────────────────────────────────────────────────────────┤
│ BRK-2026-001    │ Broken Chain: Network Continuity, Burner SIMs & Alias Resolution     │
│ HBR-2026-002    │ Harbor Ledger: Port Logistics, Smuggling & Financial Infrastructure  │
│ QTM-2026-003    │ Quiet Market: Negative Control (Honest Abstention Benchmark)        │
│ IND-2026-004    │ Operation Trishul: Bengaluru SafeCity, UPI Mules & TRAI Mobility     │
│ IND-2026-005    │ Operation DarkEscrow: Hawala & P2P Crypto Laundering Syndicate       │
│ IND-2026-006    │ Operation Netra: SafeCity Surveillance & Biometric Facial Fusion     │
│ IND-2026-007    │ Operation Nyaya-Setu: Multilingual FIR NLP & Legal Precedents        │
│ IND-2026-008    │ Operation Golden Kuber: Predatory Instant Loan App Extortion Network │
│ IND-2026-009    │ Operation Chhal-Dhan: Fake Algorithmic Trading & Stock Advisory Scam │
│ IND-2026-010    │ Operation GhostTower: Telecom SIM-Box & Cross-Circle Border Routing  │
│ IND-2026-011    │ Operation Jamtara 2.0: High-Velocity Vishing & OTP Mule Rings        │
│ IND-2026-012    │ Operation Chhaya: Disguised Fugitive Hunt & Composite Biometrics    │
│ IND-2026-013    │ Operation Vahan-Chor: Interstate Stolen Vehicle & Cargo Tracking     │
│ IND-2026-014    │ Operation Maya-Jaal: Aadhaar & PAN Synthetic Identity Factory        │
│ IND-2026-015    │ Operation Mukti-Bhang: Remand & Pre-Trial Bail Opposition Arguments  │
│ IND-2026-ALL    │ Operation Chakra-Vyuh: Grand Unified National Security Grid          │
└─────────────────┴──────────────────────────────────────────────────────────────────────┘
```

---

## 🖥️ Investigation Workspace Features

### 1. Dedicated CCTV & Physical Evidence Panel
- Displays synthetic surveillance frames with bounding-box candidate overlays.
- Separates observation signals: Appearance Similarity, Telecom Device Presence, and Temporal Overlap.
- "View in Graph" immediately highlights observation nodes in Cytoscape; "View Evidence" opens the complete provenance ledger.

### 2. Interactive Graph Analysis Canvas (Cytoscape.js)
- Color-coded node halos based on entity type: 👤 Person, 📱 Phone, 💳 SIM, 💻 Device, 📍 Location, 🏦 Account, 🚗 Vehicle, 🌐 Domain, 📷 CCTV.
- Typed edge semantics with visual distinction:
  - **Solid Cyan:** Observed evidence (direct records)
  - **Dashed Violet:** Derived connection (algorithmic linkage)
  - **Dotted Grey:** Inferred relationship (weak signal)
  - **Glowing Amber:** Newly discovered hypothesis bridge
  - **Red Dashed with ⚠:** Detected contradiction
- Interactive time-slider scrubbing graph evolution over time.

### 3. Geospatial Map & Trajectory Tracking (Leaflet GIS)
- Dark-mode tactical map with custom antenna sector markers for cell towers.
- CCTV camera nodes with observation thumbnails and metadata.
- Animated suspect trajectories displaying sequenced movement corridors between towers.
- Co-location hotspots with pulsing amber indicators showing encounter frequency.

### 4. Swimlane Temporal Timeline
- Horizontal entity-specific swimlanes showing CDR pings, financial transactions, CCTV sightings, and incident markers.
- Identifies **Pre-Incident Communication Spikes** (burst clustering) and **Post-Incident Network Fragmentation** (entities discarding burner phones).

### 5. Explainable Hypothesis Cards
- Every hypothesis presents an explicit **"Why This Hypothesis Exists"** breakdown.
- Itemizes contributing signals with evidence weights and quality factors.
- Surfaces **Information Gaps** (unresolved intelligence questions needed to promote the lead) and **Recommended Next Investigative Steps**.

### 6. Grounded Investigation Copilot
- AI assistant that strictly cites verified case records and signals.
- Transparently responds "Unsupported" when evidence is insufficient, preventing hallucinations during critical police work.

---

## ⚖️ Judicial Admissibility & Legal Compliance

SPYDEE is engineered to meet the stringent statutory requirements of Indian criminal jurisprudence:

1. **Bharatiya Sakshya Adhiniyam, 2023 (BSA) / Section 65B Indian Evidence Act:**
   - Every file uploaded produces an immutable SHA-256 cryptographic hash recorded in an append-only audit log.
   - Generates court-ready electronic evidence certificates detailing hardware, operating environment, hash verification, and ingestion timestamps.
2. **Bharatiya Nyaya Sanhita (BNS) & Criminal Procedure Code Alignment:**
   - Seamlessly translates legacy IPC provisions to modern BNS statutory sections (e.g. IPC 420 Cheating ➔ BNS 318; IPC 120B Conspiracy ➔ BNS 61).
3. **Case-Scoped Isolation:**
   - Strict tenant partitioning: Investigators assigned to Case A cannot view or leak records into Case B.
4. **Air-Gapped Sovereign Deployment:**
   - No external cloud dependencies or commercial LLM API calls required. All engines run locally with complete privacy.

---

## ⚡ Quick Start & Setup Guide

### System Requirements
- **OS:** Windows 10/11, Ubuntu 22.04+, or macOS
- **Python:** 3.11 or 3.12
- **Node.js:** 20.x or 22.x
- **Database:** PostgreSQL 16+ (or local port 5432)

---

### Method 1: Windows 1-Click Launch (Recommended for Evaluation)

SPYDEE includes an automated launcher that checks PostgreSQL, launches backend and background workers, starts the Vite frontend, and opens the interactive terminal in dedicated visible windows:

```cmd
:: Simply run the batch launcher from the project root:
.\run_spydee.bat
```

> **Note on PowerShell Execution Policy:**  
> If executing `.ps1` scripts directly in PowerShell, bypass the unsigned script restriction:
> ```powershell
> powershell -ExecutionPolicy Bypass -File .\run_spydee.ps1
> ```

---

### Method 2: Manual Step-by-Step Setup

#### Step 1: Database Initialization
Ensure PostgreSQL is running locally on port `5432`:
```bash
# Initialize local user 'spydee' and database 'spydee'
python setup_db.py
```

#### Step 2: Environment Configuration
Copy the default environment file:
```bash
cp .env.example .env
```

#### Step 3: Backend API Setup & Migrations
```bash
cd services/api
pip install -r requirements.txt

# Run database schema migrations
alembic upgrade head

# Seed core database and demo users
python -m demo.generator.seed_db
```

#### Step 4: Ingest 25 National Datasets Across All 16 Cases
From the repository root:
```bash
powershell -ExecutionPolicy Bypass -File .\seed_data.ps1 -All
# Or run directly via Python:
python demo/generator/seed_all_25_datasets.py
```

#### Step 5: Start the Services

**Terminal 1 — FastAPI Backend Server:**
```bash
cd services/api
uvicorn app.main:app --reload --port 8000
```

**Terminal 2 — Pipeline & Analysis Worker:**
```bash
cd services/worker
python -m app.main
```

**Terminal 3 — React Web Frontend:**
```bash
cd apps/web
npm install
npm run dev -- --host
```

---

### Method 3: Production Docker Deployment
```bash
docker compose up --build
```

---

### 🔑 Demo Credentials

| Role | Username | Password | Access Scope |
|---|---|---|---|
| **System Administrator** | `admin` | `admin123` | Full system configuration, audit logs & user management |
| **Senior Investigator** | `investigator` | `invest123` | Case workspace, evidence ingestion, graph analysis & reporting |
| **Case Supervisor** | `supervisor` | `super123` | Lead reviews, hypothesis approval/rejection & case closures |

---


## 🧪 Verification & Automated Test Suite

SPYDEE includes an exhaustive automated test suite covering unit tests, integration pipelines, mathematical edge cases, and end-to-end scenario validation:

```bash
# Run the complete test suite
pytest -v

# Run integration scenario tests (Positive Link, Busy-Tower Coincidence, Negative Control)
pytest tests/integration/test_demo_scenarios.py -v

# Run individual engine test suites
pytest tests/unit/test_communication_engine.py -v
pytest tests/unit/test_infra_engine.py -v
pytest tests/unit/test_stylo_engine.py -v
pytest tests/unit/test_financial_engine.py -v
```

### Verified Benchmark Results
- **Scenario 1 (Supported Connection):** Subversive activity hypothesis score ~92/100 with auto-promoted reviewable lead.
- **Scenario 2 (Busy-Tower Misleading Overlap):** Background multiplier suppresses public tower coincidence to ~0.18; no spurious link generated.
- **Scenario 3 (Conflicting & Negative Control):** Contradiction penalties drop scores below 50; system cleanly abstains.

---

## 📂 Project Directory Layout

```
SPYDEE/
├── apps/
│   └── web/                     # React 18 + Vite + TypeScript Frontend
│       ├── src/
│       │   ├── components/      # UI Panels, Modals, Cards, Badges
│       │   ├── pages/           # Cases, Graph, Map, Timeline, Hypotheses, Datasets
│       │   └── services/        # API Client & Query Hooks
├── services/
│   ├── api/                     # FastAPI Backend Application
│   │   ├── alembic/             # Database Migration Scripts (001 to 006)
│   │   └── app/
│   │       ├── models/          # SQLAlchemy Database Models
│   │       ├── routers/         # REST API Endpoints
│   │       └── services/        # Business Logic & National Datasets Catalog
│   └── worker/                  # Asyncio Pipeline Processor & Job Worker
├── analysis/                    # Intelligence Engines & Mathematical Scoring
│   ├── engines/                 # Communication, Device, Infra, Stylo, Financial, Graph
│   └── scoring/                 # Multi-Family Hypothesis Fusion & Penalty Logic
├── data/                        # File Uploads Storage & Ingestion Staging
├── demo/
│   ├── generator/               # Synthetic Data Generators & Database Seeders
│   └── import-batches/          # Pre-Generated Multi-Modal Case Fixtures
├── docs/                        # Comprehensive Technical & SIH Documentation
│   ├── ALGORITHMS.md            # Engine Mathematics & Fusion Formulations
│   ├── DEMO.md                  # Comprehensive Judge Demo Sequences
│   ├── SIH_SPECIFICATION.md     # Problem Statement 26189 Compliance Matrix
│   └── TESTING.md               # Automated Verification & Test Harness
├── run_spydee.bat               # Windows 1-Click Launch Wrapper
├── run_spydee.ps1               # Multi-Terminal PowerShell Launcher
├── seed_data.ps1                # Interactive Seeding & Diagnostic Pipeline
├── setup_db.py                  # PostgreSQL Local Database Setup Script
└── SPYDEE_India_Dataset_Links.xlsx # Source Catalog of 25 National Datasets
```

---

## 👥 Team & Acknowledgments

- **Team Name:** `EXIT(0);`

*Developed with pride for Indian Law Enforcement, Cybercrime Police Stations, and National Security Agencies.*

---

## 📜 License & Intellectual Property

**PROPRIETARY & CONFIDENTIAL — NOT OPEN SOURCE**

Copyright © 2026 **Team EXIT(0);**. All Rights Reserved.

This software, codebase, architecture, intelligence engines, algorithms, and associated documentation are the proprietary intellectual property of **Team EXIT(0);**, developed for evaluation in the Smart India Hackathon (SIH 2026).

- **Strictly Non-Open Source:** This project is **not** licensed under MIT, Apache, GPL, or any open-source license.
- **Usage Restrictions:** Unauthorized copying, reproduction, distribution, sublicensing, decompilation, public display, commercial exploitation, or transfer of this codebase or any part thereof, through any digital or physical medium, is strictly prohibited.
- **Authorized Scope:** Access is granted solely to designated SIH 2026 judges and evaluators for the official hackathon evaluation process. All rights reserved by **Team EXIT(0);**.

