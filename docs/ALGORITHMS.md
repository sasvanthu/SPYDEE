# 🔬 SPYDEE Algorithmic Formulation & Intelligence Fusion Specification

**Smart India Hackathon 2026 — Problem Statement ID: 26189**  
**Component:** Multi-Modal Signal Extraction, Mathematical Scoring & Hypothesis Fusion  
**Team:** `EXIT(0);`

---

## 1. Overview of Multi-Family Intelligence Fusion

SPYDEE transforms disparate raw evidence into structured intelligence using a two-stage pipeline:
1. **Specialized Signal Extraction:** Independent domain engines evaluate pairwise entity interactions and produce a normalized `Signal`.
2. **Multi-Family Weighted Fusion:** The `HypothesisEngine` evaluates the convergence of applicable signal families, applies contradiction penalties, and generates a composite **Evidence-Strength Index (0–100)**.

> **CRITICAL JUDICIAL NOTICE:**  
> In compliance with forensic evidence standards, SPYDEE's output is an **Evidence-Strength Index**, NOT a mathematical probability of criminal guilt. A score of 85 signifies that multiple independent evidence families strongly align; it is not a declaration of 85% guilt. Judicial verification by an authorized investigating officer is mandatory.

---

## 2. Base Signal Family Weights & Applicability Matrix

### Family Weight Definitions

| Signal Family | Default Weight ($w_f$) | Responsible Engine | Input Data Modality |
|---|---|---|---|
| **Communication** | $0.20$ | `communication_engine.py` | CDR, IPDR, SMS, Call logs |
| **Device / SIM** | $0.20$ | `device_engine.py` | Handset IMEIs, IMSI swaps, SIM bindings |
| **Spatial / Temporal** | $0.15$ | `infra_engine.py` | Cell tower pings, SafeCity CCTV observations |
| **Writing Style** | $0.15$ | `stylo_engine.py` | Extortion notes, threat SMS, chat transcripts |
| **Financial / Mule** | $0.10$ | `financial_engine.py` | NPCI UPI logs, Bank transfers, P2P Crypto |
| **Infrastructure** | $0.10$ | `infra_engine.py` | Shared IP subnets, BGP routes, VPN gateways |
| **Network Topology** | $0.10$ | `graph_engine.py` | Graph degree centrality, Betweenness, Triads |

### Hypothesis Type Applicability Mask
Different criminal allegations require different evidentiary modalities. The fusion engine restricts evaluation to applicable families:

$$\mathcal{F}_{\text{applicable}} = \begin{cases}
\{\text{comm}, \text{topo}, \text{device}\}, & \text{for } \texttt{subversive\_activity} \\
\{\text{comm}, \text{topo}, \text{spatial}\}, & \text{for } \texttt{terror\_link} \\
\{\text{comm}, \text{topo}, \text{writing}\}, & \text{for } \texttt{social\_network} \\
\{\text{comm}, \text{device}, \text{financial}, \text{topo}\}, & \text{for } \texttt{financial\_fraud\_syndicate}
\end{cases}$$

---

## 3. Mathematical Fusion Formulation

For an entity pair $(A, B)$ under hypothesis type $H$:

1. For each applicable family $f \in \mathcal{F}_{\text{applicable}}$, extract the highest-scoring signal:
   $$s_f = \text{numeric\_value} \in [0, 100], \quad q_f = \text{quality\_factor} \in (0, 1]$$

2. Calculate the base weighted evidence strength:
   $$\text{Strength}_{\text{base}} = \frac{\sum_{f \in \mathcal{F}_{\text{applicable}}} w_f \cdot s_f \cdot q_f}{\sum_{f \in \mathcal{F}_{\text{applicable}}} w_f}$$

3. **Contradiction Penalty Application:**  
   If any applicable family signal has the contradiction flag triggered ($\text{contradiction} = \text{True}$):
   $$\text{Strength}_{\text{final}} = \max\left(0, \; \text{Strength}_{\text{base}} \times (1 - \mathcal{P}_{\text{contra}})\right), \quad \text{where } \mathcal{P}_{\text{contra}} = 0.25$$

4. **Plausibility Strength Bands:**
   - **High Plausibility:** $\ge 80.0$ (Triggers automated Lead creation for investigator review)
   - **Medium Plausibility:** $50.0 - 79.9$ (Active hypothesis requiring supplemental evidence)
   - **Low Plausibility / Unproven:** $< 50.0$ (System explicitly states: *"Does not establish a credible link"* - Honest Abstention)

---

## 4. Individual Engine Algorithms

### A. Communication Engine (`communication_engine.py`)
Computes interaction intensity, temporal regularity, and clandestine operational patterns between phone entities.

$$\text{Score}_{\text{comm}} = 0.35 \cdot \min\left(\frac{N_{\text{events}}}{20}, 1\right) + 0.20 \cdot \min\left(\frac{T_{\text{duration}}}{3600}, 1\right) + 0.20 \cdot \mathcal{B} + 0.15 \cdot \mathcal{R}_{\text{night}} + 0.10 \cdot \mathcal{R}_{\text{long}}$$

Where:
- $\mathcal{B} = \frac{\text{Max events in any 2-hour sliding window}}{6}$ (Communication burst score)
- $\mathcal{R}_{\text{night}} = \frac{\text{Calls between 23:00 and 05:00}}{\text{Total calls}}$
- $\mathcal{R}_{\text{long}} = \frac{\text{Calls exceeding 15 minutes}}{\text{Total calls}}$
- **Burner SIM Lifecycle Bonus:** If communication spans $\le 3$ days followed by $\ge 2$ days permanent silence with $\ge 8$ events, add $+0.15$.

---

### B. GhostTower Spatial-Temporal & CCTV Engine (`infra_engine.py`)
Evaluates physical encounters at cell towers and SafeCity CCTV cameras while correcting for urban crowd density.

#### 1. Busy-Tower Background Normalization
Metropolitan transit hubs connect thousands of innocent citizens. Co-location at busy towers must not imply a conspiracy:
$$\mathcal{M}_{\text{background}} = \text{clamp}(1.35 - 0.02 \cdot \mathcal{C}_{\text{tower}}, \; 0, \; 1)$$
Where $\mathcal{C}_{\text{tower}}$ is the count of distinct entities connected to the tower during the observation window. If $\mathcal{C}_{\text{tower}} \ge 20$, the tower is marked as `busy_tower: true`, suppressing false-positive scores down to benign values ($\approx 0.18$).

#### 2. Impossible Travel (Speed-of-Light Contradiction)
Let $d(T_1, T_2)$ be the Euclidean/Haversine distance between two towers, and $\Delta t = |t_2 - t_1|$ be the elapsed time:
$$\text{Speed} = \frac{d(T_1, T_2)}{\Delta t}$$
If $\text{Speed} > v_{\text{limit}}$ ($150\text{ km/h}$ for ground transit, $900\text{ km/h}$ for flight corridor):
- Flag: $\text{contradiction} = \text{True}$
- Pattern: $\texttt{impossible\_travel}$
- Score: $0.0$
- Propagates to all dependent co-location signals and penalizes composite hypothesis.

---

### C. StyloLink Authorship Attribution (`stylo_engine.py`)
Deterministic linguistic feature extraction comparing anonymous threats, extortion SMS, and court depositions:

#### Honest Abstention Threshold:
To prevent spurious authorship claims on single text fragments:
$$\text{If } (N_{\text{messages}} < 2) \lor (\text{Total Characters} < 60) \implies \text{\textbf{ABSTAIN (No Signal Emitted)}}$$

#### Feature Vector Formulation:
- Average word length & sentence length variance
- Punctuation frequency distribution (excessive commas, exclamation marks, ellipses)
- Case-folding and character 3-gram term frequency hashing
- Cosine similarity between normalized feature vectors:
  $$\text{Sim}(v_A, v_B) = \frac{v_A \cdot v_B}{\|v_A\|_2 \|v_B\|_2}$$

---

### D. Financial & Money-Mule Structuring Engine (`financial_engine.py`)
Detects Hawala, illegal loan app extortion, and UPI mule ring patterns:

#### Fan-In / Fan-Out Topology Score:
1. **Fan-In (Aggregation):** Rapid deposits from $\ge 5$ distinct accounts within $< 30$ minutes.
2. **Fan-Out (Dispersal):** Immediate split payouts to multiple beneficiary accounts or ATM withdrawals below mandatory reporting thresholds ($< ₹50,000$).
$$\text{Score}_{\text{mule}} = 0.50 \cdot \min\left(\frac{N_{\text{in}} + N_{\text{out}}}{10}, 1\right) + 0.30 \cdot \text{VelocityRatio} + 0.20 \cdot \text{RoundAmountRatio}$$

---

### E. Device & SIM Continuity Engine (`device_engine.py`)
Tracks physical handset hopping and IMEI recycling:
- **Device Hopping:** If 2 or more distinct phone numbers register on the same physical IMEI within 30 days:
  $$\text{Score}_{\text{hop}} = \min\left(1.0, \; 0.40 + 0.15 \cdot N_{\text{SIMs}}\right)$$
- **Co-Travel Corroboration:** Two SIMs whose events are consistently registered on the same handset hardware in moving transit corridors.

---

### F. Graph Structure & Topology Engine (`graph_engine.py`)
Computes network metrics across the case-scoped directed graph $\mathcal{G} = (\mathcal{V}, \mathcal{E})$ using NetworkX:
- **Degree Centrality:** $C_D(v) = \frac{\text{deg}(v)}{|\mathcal{V}| - 1}$
- **Betweenness Centrality:** $C_B(v) = \sum_{s \neq v \neq t} \frac{\sigma_{st}(v)}{\sigma_{st}}$
- **Composite Topology Score:**
  $$\text{Score}_{\text{topo}} = 0.30 \cdot \min(C_D \cdot 2, 1) + 0.70 \cdot \min(C_B \cdot 5, 1)$$
  Entities with high betweenness centrality are highlighted as **Critical Gatekeepers / Syndicate Brokers**.