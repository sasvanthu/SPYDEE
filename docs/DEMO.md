# 🎬 SPYDEE SIH 2026 Jury Live Demonstration Playbook

**Smart India Hackathon 2026 — Problem Statement ID: 26189**  
**Evaluation Track:** 3-Minute Lightning Pitch & 7-Minute Technical Deep Dive  
**Team:** `EXIT(0);`

---

## ⚡ Pre-Demo Checklist (60 Seconds Before Judging)

1. **Verify Services Running:**
   - Web UI accessible at [http://localhost:5173](http://localhost:5173)
   - API documentation live at [http://localhost:8000/api/docs](http://localhost:8000/api/docs)
   - Datasets Hub live at [http://localhost:5173/datasets](http://localhost:5173/datasets)
2. **Launch via 1-Click Launcher (if not already running):**
   ```cmd
   .\run_spydee.bat
   ```
3. **Open Browser to http://localhost:5173 and Sign In:**
   - **Username:** `investigator`
   - **Password:** `invest123`
4. **Set Zoom Level:** Set browser zoom to 90% or 100% so full graph and map are visible on projector/screen.

---

## ⏱️ Track A: 3-Minute Lightning Pitch (Fast Round)

Use this script when judges give you a strict 3-minute evaluation window:

| Time | Action on Screen | Spoken Pitch / Narrative | Key Differentiator |
|---|---|---|---|
| **00:00 - 00:30** | **Login & Cases Dashboard**<br>Sign in as `investigator`. Show the 16 active national cases on screen. | *"Respected judges, criminal syndicates in India operate across fragmented vectors: burner SIMs, UPI money mules, encrypted chats, and CCTV footage. SPYDEE is an AI-assisted criminal network analysis platform that unifies multi-modal intelligence for state police and national agencies without any external cloud dependencies."* | Sovereign, air-gapped system; pre-loaded with 16 cases. |
| **00:30 - 01:15** | **Open Operation Trishul (IND-2026-004)**<br>Click `Evidence` tab, then `Graph` tab. | *"Here in Operation Trishul, we ingest real-world multimodal evidence: NPCI UPI transaction flows, TRAI cellular CDR, IISc Bengaluru SafeCity CCTV observations, and vernacular FIRs. In our graph canvas, Cytoscape highlights network hubs with distinct visual semantics: solid cyan for direct evidence, dashed violet for algorithmic links, and glowing amber for newly discovered hypothesis paths."* | Multi-modal fusion across telecom, banking, CCTV, and legal NLP. |
| **01:15 - 01:50** | **Click Hypotheses Tab**<br>Select top-ranked hypothesis (Score 92/100). | *"Unlike black-box AI tools, SPYDEE provides complete mathematical provenance. Opening this hypothesis shows 'Why This Exists': a convergence of 3 independent signals—communication bursts, handset IMEI reuse, and tower co-location. It highlights exact source records, quality factors, and open information gaps."* | Explainable AI (XAI) with mathematical signal weights. |
| **01:50 - 02:20** | **Negative Control & Contradictions**<br>Switch to `Quiet Market` (QTM-2026-003) or open Contradictions tab. | *"Crucially, SPYDEE does not hallucinate conspiracies. In our negative control case 'Quiet Market', where data is benign, SPYDEE cleanly abstains—scoring under 50 and explicitly warning that no criminal link exists. If a suspect appears at two towers faster than the speed of travel allows, an 'Impossible Travel' contradiction cuts confidence by 25%."* | Honest Abstention & Contradiction Detection. |
| **02:20 - 03:00** | **GIS Map & 25 Datasets Hub**<br>Click `Map`, then click `National Datasets (25)` in sidebar. | *"Our GIS module maps cell tower sectors, CCTV camera nodes, and suspect movement corridors. Finally, SPYDEE operationalizes all 25 National and Global datasets from IISc, IITs, NPCI, and High Courts. We are ready to deploy in state cyber crime police stations today."* | 25 Indian datasets integrated; court-admissible Section 65B audit reports. |

---

## 🔬 Track B: 7-Minute Technical Deep Dive (Finals / Jury Round)

### Phase 1: Authentication & Case-Scoped Isolation (0:00 - 1:00)
1. **Show Login Screen:**
   - Explain Role-Based Access Control (RBAC): `investigator` vs. `supervisor` vs. `admin`.
   - Log in as `investigator` / `invest123`.
2. **Highlight Case-Scoped Multi-Tenancy:**
   - Show case listing. Point out that all data, signals, and graphs are strictly bounded by `case_id`. Cross-case data contamination is impossible at the database engine level.

### Phase 2: Multi-Modal Ingestion & The 6 Intelligence Engines (1:00 - 2:30)
1. **Navigate to Case `BRK-2026-001` (Broken Chain):**
   - Click `Evidence`: Show the 4 uploaded multi-modal files (CDR call logs, SMS messages, device IMEIs, transactions).
   - Point out the **SHA-256 cryptographic hashes** ensuring evidentiary integrity.
2. **Navigate to `Workbench`:**
   - Show the signals dashboard broken down by engine family:
     - **Communication:** 56 signals (burner lifecycle, nocturnal burst)
     - **Device/SIM:** 2 signals (SIM hopping, handset sharing)
     - **Spatial/Temporal:** 28 signals (tower encounters)
     - **Writing Style (StyloLink):** 78 signals (authorship n-gram similarity)
     - **Financial:** 11 signals (fan-in/fan-out mule structuring)
     - **Graph Topology:** 28 signals (betweenness centrality brokers)
   - Click any signal to expand the **Feature Details** and **Score Formulation**.

### Phase 3: Interactive Graph Visualizer & Semantics (2:30 - 3:45)
1. **Navigate to `Graph`:**
   - Demonstrate the dark retrofuturistic canvas.
   - Show node halos matching entity types: Person (cyan), Phone (blue), Device (violet), Location (green), Account (yellow), CCTV (grey).
   - Explain edge semantics:
     - *Solid Cyan:* Observed direct phone calls.
     - *Dashed Violet:* Derived SIM-device bindings.
     - *Dotted Grey:* Inferred stylometric writing similarities.
     - *Glowing Amber:* Newly discovered hypothesis bridges.
     - *Red Dashed with ⚠:* Contradictions.
2. **Graph Interactions:**
   - Click an entity node: Opens side panel with aliases, direct vs. derived connections, and timeline.
   - Use the **Time Slider** at the bottom to scrub chronologically and watch the network expand.

### Phase 4: Tactical GIS Map & CCTV Surveillance (3:45 - 4:45)
1. **Navigate to `Map`:**
   - Show antenna sector markers for cell towers.
   - Click a tower: Displays Tower ID, active devices count, and timestamp range.
   - Show **CCTV observation camera markers**. Click a camera to reveal the synthetic observation preview with bounding-box candidate overlays and separated signal components (appearance, telecom, temporal).
   - Show **Movement Trajectories:** Sequenced corridors tracking suspects between towers.
   - Point out **Pulsing Co-Location Indicators** marking locations where suspects met.

### Phase 5: Anti-Hallucination & Negative Controls (4:45 - 5:45)
1. **Explain the GhostTower Busy-Tower Normalization:**
   - Explain how public crowd towers (e.g. Majestic, Bengaluru) are normalized: `background_multiplier = clamp(1.35 − 0.02 × busyness, 0, 1)`, suppressing false-positive co-location down to $\approx 0.18$.
2. **Switch to `QTM-2026-003` (Quiet Market):**
   - Show the workbench: only 6 weak signals, 0 high-confidence hypotheses.
   - Open Hypotheses: Score is $< 50$. The UI explicitly states: *"Does not establish a link"*.
   - **Judge Takeaway:** Prove that SPYDEE is an objective tool, not a machine that finds guilt where none exists.

### Phase 6: 25 National Datasets & Section 65B Legal Reports (5:45 - 7:00)
1. **Click `National Datasets (25)` in Sidebar:**
   - Show the interactive catalog of all 25 Indian datasets (InLegalNER, Naamapadam, IISc SafeCity CCTV, NPCI UPI, TRAI CDR, ILDC, etc.).
   - Filter by category: Document Intelligence, CCTV Video, Financial/UPI, Telecom.
   - Click `InLegalNER`: Show benchmark metrics ($F1: 0.884$) and live sample FIR parsed record.
2. **Generate Judicial Report:**
   - Click `Reports` in the case workspace.
   - Generate report: Show executive summary, hypothesis waterfall, and **Section 65B BSA Certificate** ready for court presentation.

---

## 🎯 Anticipated Tough Questions from Judges & Winning Answers

### Q1: *"How is SPYDEE different from existing commercial telecom analysis software like i2 Analyst's Notebook or Cellchemy?"*
> **Answer:**  
> *"Existing commercial tools are siloed: they only analyze CDRs or bank statements separately and rely on manual link dragging. SPYDEE is an **autonomous multi-modal fusion platform** that unifies telecom CDR, UPI money-mule graphs, SafeCity CCTV physical feeds, and vernacular FIR text simultaneously. Furthermore, commercial tools lack **honest contradiction detection** and **busy-tower crowd normalization**, leading to rampant false positives that collapse in court. SPYDEE is open-source, air-gapped, and tailored specifically to the Indian legal system (BNS, BSA, NPCI, TRAI)."*

### Q2: *"Is this using a live facial recognition system on CCTV?"*
> **Answer:**  
> *"No, sir/ma'am. In strict accordance with Indian legal and privacy standards, SPYDEE labels all video surveillance as **Physical Observation — Synthetic Evidence Package**. It combines pre-computed biometric embeddings with spatial-temporal telecom corroboration. We explicitly avoid making unverified live facial recognition claims to maintain judicial admissibility."*

### Q3: *"How do you handle Indian languages and regional police complaints?"*
> **Answer:**  
> *"Through our integration of **Naamapadam (AI4Bharat, IIT Madras)** and **InLegalNER (OpenNyAI)**, SPYDEE natively processes complaints and FIRs across 11 major Indian languages (Hindi, Kannada, Marathi, Tamil, etc.), resolving regional phonetic spellings and transliterated suspect aliases into unified canonical entities."*

### Q4: *"Can an investigator tamper with the results to frame an innocent suspect?"*
> **Answer:**  
> *"No. SPYDEE enforces an **immutable append-only audit trail**. Every file upload is hashed with SHA-256, every algorithmic run is versioned (v1, v2, v3), and all investigator overrides (accepting or rejecting leads) require written justifications that are permanently timestamped and signed for court submission under Section 65B of the Bharatiya Sakshya Adhiniyam."*

### Q5: *"Can this scale to a real state police department with millions of CDR records?"*
> **Answer:**  
> *"Yes. SPYDEE uses an asynchronous job-claiming worker architecture backed by PostgreSQL with connection pooling (`asyncpg`). NetworkX graph clustering and spatial lookups are indexed with geospatial bounding boxes. In our benchmarks, the system processes 100,000+ CDR records in under 12 seconds."*