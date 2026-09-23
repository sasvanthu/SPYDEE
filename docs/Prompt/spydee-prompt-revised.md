ROLE: You are a senior full-stack engineer and UI/UX specialist 
updating an existing SPYDEE prototype — an AI-powered criminal 
network intelligence platform for SIH 2026.

This is NOT a rebuild from scratch.
This is a targeted enhancement pass across six specific problem 
areas. The retrofuturistic UI theme is ALREADY IMPLEMENTED in 
this codebase — do not redesign, replace, or restyle it. Your 
job is to extend the existing feature set while strictly 
reusing the design system, components, and styling patterns 
that already exist in the app.

Read every section completely before touching any code.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 0 — BEFORE YOU START
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
Step 1: Read the existing codebase structure completely, 
        including the current design system — CSS variables, 
        shared components (panels, cards, buttons, badges, 
        confidence bars, nav), fonts, and layout shell.
Step 2: Identify which components own each of the six 
        problem areas below.
Step 3: Confirm you understand the existing UI theme 
        (Section 7 below describes it as a REFERENCE, not a 
        task) so every new piece of UI you build matches it 
        exactly — same tokens, same components, same visual 
        language. Do not introduce new colors, fonts, or 
        component patterns that diverge from what's already there.
Step 4: Then apply each feature enhancement using only the 
        existing design system's building blocks.
Step 5: At every stage the application must remain 
        fully runnable — never break a working feature 
        while fixing another, and never regress the existing 
        visual design while adding new UI.
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 1 — CCTV & VIDEO EVIDENCE MODULE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PROBLEM:
No CCTV records, video evidence or physical 
observation data is visible anywhere in the 
application.

WHAT TO BUILD:

Create a dedicated CCTV & Physical Evidence 
panel inside the case workspace.

Evidence cards for each CCTV observation 
in the synthetic dataset showing:
```
┌────────────────────────────────────┐
│ CCTV-118                           │
│ Location: Tower X vicinity         │
│ Timestamp: 2026-03-14 · 22:11      │
│                                    │
│ [▶ OBSERVATION PREVIEW]            │
│ Grayscale placeholder frame with   │
│ bounding box overlay on candidate  │
│ region — do NOT claim live video   │
│                                    │
│ SIGNALS:                           │
│ Appearance similarity    0.72 ████ │
│ Telecom device presence  0.65 ███  │
│ Temporal overlap         0.91 ████ │
│                                    │
│ Identity confidence: MEDIUM        │
│ Contributing signals: 3            │
│ Status: inferred — not confirmed   │
│                                    │
│ [VIEW IN GRAPH] [VIEW EVIDENCE]    │
└────────────────────────────────────┘
```
Rules for CCTV module:
- Use precomputed synthetic re-identification 
  scores — never claim live facial recognition
- Every card must show the three signal 
  components separately, never summed naively
- Clicking "VIEW IN GRAPH" highlights the 
  related nodes in the graph page
- Clicking "VIEW EVIDENCE" opens full 
  provenance chain for that observation
- CCTV observations must appear on the 
  timeline page at correct timestamps
- CCTV observations must appear as 
  CCTVObservation nodes on the map 
  at their geographic coordinates

Label all CCTV content as:
"Physical Observation — Synthetic Evidence Package"
Never label as "Live Surveillance" or "Live Feed"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 2 — HYPOTHESIS & LEADS DEPTH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PROBLEM:
Hypothesis cards show conclusions but not 
the actual reasoning chain that produced them.
A reader cannot understand WHY the hypothesis exists.

WHAT TO BUILD:

Every hypothesis card must be completely 
rebuilt to show:
```
┌────────────────────────────────────────┐
│ ⚡ HYPOTHESIS                    H-014 │
│ Suspect A ↝ Suspect B                  │
│ Confidence: 67% ████████░░             │
│ Status: PENDING VERIFICATION           │
│                                        │
│ WHY THIS HYPOTHESIS EXISTS             │
│ ─────────────────────────────          │
│ SPYDEE identified this relationship    │
│ because no single record connects      │
│ these entities directly. Three         │
│ independent signal types converge      │
│ on the same conclusion:                │
│                                        │
│ SIGNAL BREAKDOWN                       │
│                                        │
│ 01 · GhostTower Co-location            │
│    Device D-021 and D-044 entered      │
│    identical tower sequence 6 times    │
│    within 9-minute windows             │
│    Weight: HIGH · Source: CDR+Tower    │
│    Type: ── observed                   │
│                                        │
│ 02 · SIM–Device Continuity             │
│    D-021 used by 5 SIM identities      │
│    across 19 days — unusual churn      │
│    Weight: MEDIUM · Source: UFDR       │
│    Type: - - derived                   │
│                                        │
│ 03 · StyloLink Authorship Signal       │
│    RAVEN_17 and P-1042 share 0.87      │
│    stylometric similarity across       │
│    11 text samples                     │
│    Weight: MEDIUM · Source: Documents  │
│    Type: ··· inferred                  │
│                                        │
│ CONTRADICTIONS          (see Section 3)│
│ ─────────────────────────────          │
│ ⚠ One location mismatch detected       │
│ D-021 observed at Tower-9 while        │
│ co-location event places it at Tower-X │
│ Confidence impact: −8%                 │
│                                        │
│ INFORMATION GAP                        │
│ ─────────────────────────────          │
│ Unknown: ownership of DEV-044          │
│ during critical 22:10–22:25 window     │
│ Information gain if resolved: HIGH     │
│                                        │
│ [ACCEPT] [REJECT] [NEEDS MORE EVIDENCE]│
│ [VIEW EVIDENCE CHAIN] [VIEW IN GRAPH]  │
└────────────────────────────────────────┘
```
Every signal must explain:
- What pattern was detected
- How many occurrences
- Which source records
- What evidence type (observed/derived/inferred)
- What weight it carries toward confidence

Confidence must be COMPUTED from signal weights
not hardcoded — so adding/removing evidence 
actually changes the score.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 3 — CONTRADICTION DETECTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PROBLEM:
No contradictions exist anywhere in the 
current hypothesis or evidence display.
This makes the system look like it forces 
every signal into a positive conclusion.

WHAT TO BUILD:

Contradiction detection must be active 
for every hypothesis.

A contradiction is any evidence that 
weakens or conflicts with a hypothesis 
signal — for example:

CONTRADICTION TYPES TO IMPLEMENT:

1. Location mismatch
   Entity appears at two locations 
   simultaneously — impossible

2. Temporal impossibility  
   Travel time between two 
   observed locations is physically 
   impossible given timestamps

3. Counter-evidence
   A record directly contradicts 
   an inferred relationship
   e.g. alibi witness statement 
   in an FIR

4. Weak signal contradiction
   A signal that should be present 
   given the hypothesis is absent

Contradictions must appear:
- Inside each hypothesis card (see Section 2)
- As a dedicated CONTRADICTIONS tab 
  inside the evidence panel
- Visually on the graph as 
  RED DASHED edges with a ⚠ icon
- In the confidence score formula — 
  each contradiction must reduce 
  the confidence score by a 
  defined weight

Case C from synthetic dataset must 
contain a tempting hypothesis where 
contradictions cause SPYDEE to 
produce:

LOW CONFIDENCE — CONTRADICTORY EVIDENCE

and explicitly NOT produce a 
high-confidence finding.

This is critical for demonstrating 
that SPYDEE does not force conclusions.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 4 — GRAPH PAGE OVERHAUL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PROBLEM:
Graph visualization lacks visual 
intelligence, meaningful layout, 
interaction depth and reasoning display.

UI IMPROVEMENTS:

Use the existing retrofuturistic theme 
already implemented in the app (see Section 7 
reference — do not modify it) for the graph canvas:
- Dark near-black canvas background
- Node glow effects matching entity type
- Edges with correct visual semantics:
  SOLID CYAN = observed
  DASHED VIOLET = derived
  DOTTED GREY = inferred
  GLOWING AMBER = newly discovered / 
                  hypothesis path
- Discovery path highlighted 
  with animated particle flow
```
NODE VISUAL DESIGN:
Each entity type gets a distinct icon 
and color, matching the existing theme's 
palette:
  👤 Person — cyan
  📱 Phone — blue
  💳 SIM — indigo
  💻 Device — violet
  📍 Location — green
  🏦 Account — yellow
  🚗 Vehicle — orange
  🌐 Domain — red
  📷 CCTV — grey
  ❓ Ghost Node — white pulsing
```
LAYOUT IMPROVEMENTS:
- Force-directed layout with 
  cluster separation by evidence type
- Communication cluster — top-left
- Financial cluster — bottom-left
- Physical/geospatial cluster — top-right
- Cyber/infrastructure cluster — 
  bottom-right
- Hypothesis paths bridge clusters 
  with glowing amber edges

INTERACTION IMPROVEMENTS:
- Click node → opens entity profile 
  side panel showing all connections, 
  evidence, timeline and behavioral 
  fingerprint
- Click edge → shows edge detail panel 
  with evidence type, timestamp, 
  source, confidence
- Hover node → tooltip with entity 
  summary and confidence
- Right-click → context menu: 
  Expand neighbors, Compare entities, 
  Focus path, Find hidden links
- Time slider at bottom — scrub through 
  time to watch graph build 
  chronologically
- Filter panel: 
  by entity type, evidence type, 
  confidence threshold, date range

REASONING PANEL:
Right-side panel when a node or 
edge is selected showing:
(consider this as an layout example)
```
ENTITY: Ravi Kumar / P-1042
──────────────────────────
Type: Person
Aliases: 3 detected
Confidence: HIGH identity resolution
Cases: CASE-2026-014

CONNECTIONS (12)
Direct: 7 | Derived: 3 | Inferred: 2

HYPOTHESIS INVOLVEMENT
Part of H-014 (Suspect A ↝ Suspect B)
Role: PRIMARY SUSPECT
Confidence contribution: MAJOR

EVIDENCE SUMMARY
Strongest signal: GhostTower ×6
Weakest signal: StyloLink 0.87

[VIEW FULL PROFILE]
[VIEW HYPOTHESIS]
[VIEW EVIDENCE CHAIN]
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 5 — MAP PAGE COMPLETION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
PROBLEM:
The map page has already been partially built — 
dark theme styling, base Leaflet setup, and some 
markers/features are already in place and look good. 
Do NOT rebuild, redesign, or replace what already 
exists. This is a completion pass, not a rewrite.

WHAT TO DO FIRST:
Before writing any code, inspect the current map 
implementation and identify exactly what already 
exists versus what is missing from the list below 
(e.g. CCTV markers and tower markers are known gaps — 
confirm the rest). Leave every working piece untouched.

WHAT TO ADD (only what's missing):

Cell Tower markers:
- Custom tower icon (antenna symbol)
- Color coded by activity level
- Click → shows tower detail:
  Tower ID, Active devices count,
  CDR events, Timestamp range,
  Connected entities list

CCTV observation markers:
- Camera icon
- Click → opens CCTV evidence card 
  (Section 1)

Person/Suspect location markers:
- Custom person icon per entity
- Color matches graph entity color
- Click → opens entity profile panel

Event markers:
- Diamond icon for case events
- Click → shows event detail and 
  connected entities

TRAJECTORY VISUALIZATION:
Show movement paths between towers:
- Animated dashed line following 
  the sequence of tower observations
- Different color per tracked entity
- Arrow direction showing movement

CO-LOCATION VISUALIZATION:
Where two entities share tower 
observations within time window:
- Pulsing amber circle at that location
- Label: CO-LOCATED · N×
- Click → shows co-location evidence 
  detail and hypothesis link

TIMELINE INTEGRATION:
Time slider at map bottom — 
scrubbing through time shows 
entity movement and 
co-location events appearing 
and disappearing on the map.

MAP SIDE PANEL:
Show active entities on map:
Entity name | Last seen location | 
Timestamp | Evidence type

Filter controls:
[ ] Towers  [ ] Persons  [ ] CCTV
[ ] Events  [ ] Co-locations
[ ] Show trajectories
Date range picker

RULES FOR THIS PASS:
- Only implement pieces from the list above that 
  are genuinely missing. Never touch, restyle, or 
  refactor a marker type, panel, or control that 
  already works correctly.
- Every new marker, icon, popup, panel, and control 
  you add must precisely match the existing map's 
  current visual language — same tile style, same 
  colors, same fonts, same panel/card/badge 
  components already used elsewhere on the map and 
  across the app. Do not invent new colors, icon 
  styles, fonts, or component patterns.
- If an existing element is close but slightly 
  inconsistent with the rest of the theme (e.g. 
  wrong font, wrong border, missing glow), you may 
  tighten it to match — but do not change its 
  behavior or layout while doing so.
- When in doubt about whether something already 
  exists or is a duplicate, check first rather than 
  adding a second version of it.
- End state: the map should read as one continuous, 
  precisely themed piece of work — no visible seam 
  between what was already there and what you added.
    ```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 6 — TIMELINE PAGE OVERHAUL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PROBLEM:
Timeline lacks visual depth, reasoning 
context and meaningful event display.

WHAT TO BUILD:

LAYOUT:
Horizontal swimlane timeline — 
one row per entity being tracked.

Columns = time (configurable range)
Rows = entities (filterable)

Example:

        T-30   T-7    T-1   INC   T+7
P-1042  ●──────●──────●─────⚡────░
D-021   ●────────────────●────░
RAVEN_  ────────●──────●────░
Tower X ════════════════●
CCTV118 ─────────────────────●

EVENT DOT TYPES:
● CDR event (cyan)
● Financial transaction (yellow)
● Tower observation (green)
● CCTV observation (grey)
● Document authored (violet)
⚡ Incident marker (amber)
⚠ Anomaly detected (red)
░ Evidence gap (translucent)
? Ghost Node event (white pulse)

Click any event dot → 
shows event detail card:

EVENT DETAIL
──────────────────
Type: CDR Event
Entity: P-1042
Timestamp: 22:10:34
Duration: 4m 12s
Counterparty: [UNKNOWN]
Tower: Tower-X
Evidence: EV-0042
Hypothesis: H-014
Signal: GhostTower co-location

COMMUNICATION BURST VISUALIZATION:
Between T-1 and INCIDENT show a 
visible spike in activity — 
more dots clustered, red highlight.

POST-INCIDENT visualization:
After INCIDENT marker show 
network fragmentation — 
entities going dark, 
gaps in activity rows.

REASONING STRIP:
Below timeline — horizontal 
annotation strip showing:

[T-30 to T-7: Normal activity baseline]
[T-7 to T-1: Elevated communication pattern]  
[T-1: Communication burst — 3 entities]
[INCIDENT: Event marker]
[T+1 to T+7: Rapid SIM churn detected]

FILTER CONTROLS:
Entity multiselect
Event type checkboxes
Date range picker
Hypothesis filter — show only 
events relevant to selected hypothesis
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 7 — EXISTING UI THEME
(REFERENCE ONLY — DO NOT REBUILD)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

IMPORTANT: The retrofuturistic UI theme described 
in this section is ALREADY IMPLEMENTED in the 
current codebase. Do not create a new design system, 
do not restyle existing components, and do not 
introduce alternative colors, fonts, or component 
patterns. This section exists purely as a REFERENCE 
so that every new panel, card, marker, or control 
you build for Sections 1–6 visually matches what is 
already there. Locate the existing CSS variables, 
shared components, and layout shell in the codebase 
first, and reuse them directly.

DESIGN LANGUAGE (already in place):
Retrofuturistic crime analysis console.
Think: intelligence operations center 
meets noir digital investigation room.
High information density.
Dark, precise, purposeful.
Every pixel justifies its presence.
```
================================================================================
SPYDEE UI & STYLING ARCHITECTURE SPECIFICATION
(TACTICAL GOVERNMENT INTELLIGENCE TERMINAL — AMBER PHOSPHOR CRT SYSTEM)
================================================================================

COLOUR SYSTEM (CSS variables & Tailwind tokens — locate and reuse):

/* Defined in /src/index.css (:root) */
--terminal-bg:           #090E09        /* Deep terminal canvas base */
--terminal-panel:        #0D140D        /* Panel container background */
--terminal-amber:        #F59E0B        /* Primary tactical amber phosphor */
--terminal-amber-bright: #FBBF24        /* High-contrast amber text & focus */
--terminal-amber-dim:    #92400E        /* Low-contrast amber text & muted borders */
--terminal-green:        #34D399        /* Verified status, active LEDs, nominal telemetry */
--terminal-red:          #EF4444        /* Critical alerts, evidentiary clashes, danger actions */

/* Tailwind 'terminal' Palette (tailwind.config.js): */
terminal.bg:             #080C08        /* Viewport base canvas */
terminal.surface:        #0A0F0A        /* Top Header, Sidebar, Bottom Status Bar */
terminal.panel:          #0B100B        /* Standard panel / container fill */
terminal.dark:           #070B07        /* Deep inset wells, data inputs, terminal consoles */
terminal.amber:          #F59E0B        /* Core brand & active UI fill */
terminal.amberBright:    #FBBF24        /* Prominent titles & highlight text */
terminal.amberDim:       #92400E        /* Muted captions & subtle dividers */

/* Container Surfaces & Wells: */
--bg-base:               #080C08        /* Body canvas */
--bg-surface:            #0A0F0A        /* Global bars & sidebar */
--bg-panel:              #0B100B        /* TerminalPanel backgrounds (with 90% opacity) */
--bg-elevated:           #121912        /* Tactical cards, active rows, hovered items */
--bg-inset:              #070B07        /* Inset monitors, terminal inputs, code blocks */

/* Borders: */
--border-subtle:         rgba(245, 158, 11, 0.15)  /* Inner line dividers */
--border-default:        rgba(245, 158, 11, 0.30)  /* Standard panels, card outlines */
--border-accent:         rgba(245, 158, 11, 0.50)  /* Highlighted panels, active controls */
--border-bright:         #F59E0B                   /* Solid amber focus border */
--border-verified:       rgba(52, 211, 153, 0.50)  /* Emerald verified borders */
--border-critical:       rgba(239, 68, 68, 0.60)   /* Crimson contradiction borders */

/* Text Hierarchy: */
--text-bright:           #FBBF24        /* High-contrast headings, active values */
--text-primary:          #F59E0B        /* Default phosphor body text */
--text-secondary:        #FCD34D        /* Readable secondary content (amber-300) */
--text-muted:            rgba(245, 158, 11, 0.70)  /* Meta labels, timestamps, keys */
--text-dim:              #92400E        /* De-emphasized notes (amber-dim) */
--text-inverse:          #080C08        /* Dark pitch text on solid amber buttons */

/* Functional Accents: */
--accent-amber:          #F59E0B        /* Primary network nodes (Persons, Phones) */
--accent-emerald:        #34D399        /* Financial nodes, verified intelligence */
--accent-orange:         #F97316        /* Inferred links, candidate leads, warnings */
--accent-red:            #EF4444        /* Contradictions, evidentiary clashes */
--accent-blue:           #38BDF8        /* Digital forensic nodes, cyber telemetry */

/* Terminal Phosphor Glows (/src/index.css): */
--glow-text-amber:       0 0 5px rgba(245,158,11,0.55), 0 0 10px rgba(245,158,11,0.35)
--glow-box-subtle:       0 0 8px rgba(245,158,11,0.20)
--glow-box-strong:       0 0 15px rgba(245,158,11,0.40)
--glow-button-active:    0 0 10px rgba(245,158,11,0.40)
--glow-nav-active:       0 0 12px rgba(245,158,11,0.50)
--glow-led-green:        0 0 5px #10B981
--glow-led-amber:        0 0 5px #F59E0B


TYPOGRAPHY (strictly monospace & military tactical display):

--font-mono:             'JetBrains Mono', 'Share Tech Mono', monospace
--font-display:          'Chakra Petch', sans-serif
/* Note: 'Inter' is NOT used anywhere in this application. */

Type Scaling & Rules:
Page titles:             --font-mono / --font-display, text-sm to text-base, font-black,
                         tracking-widest, uppercase, .amber-glow
Section headers:         --font-mono, text-xs, font-bold, text-amber-400, 
                         uppercase, prefixed with "▶ "
Body text:               --font-mono, text-xs (12px), text-amber-400/90, line-height 1.5
Labels & metadata keys:  --font-mono, text-[9px] to text-[10px], font-bold, 
                         text-amber-500/70, uppercase, tracking-wider
Data values:             --font-mono, text-xs to text-sm, font-bold, text-amber-300
Confidence scores:       --font-mono, text-xs, font-bold, color-coded by tier (green/amber/orange)


COMPONENT SYSTEM:

PANEL (TerminalPanel.tsx):
background:              #0B100B with 90% opacity (bg-[#0b100b]/90)
border:                  1px solid rgba(245, 158, 11, 0.35)
corner brackets:         Tactical 2px amber corner accents on top-left and bottom-right
                         (before:border-t-2 before:border-l-2 before:border-amber-400)
                         (after:border-b-2 after:border-r-2 after:border-amber-400)
border-radius:           0px (Strictly sharp 90-degree corners throughout)
header bar:              Terminal bar with "▶" glyph, text-amber-300 title, 
                         text-amber-500/70 subtitle, and action controls slot
box-shadow:              Optional .amber-box-glow

CARD (TerminalCard in TerminalComponents.tsx):
background:              #0E170E with 80% opacity or black/50
border:                  1px solid rgba(245, 158, 11, 0.30)
border-radius:           0px
hover:                   border-color: rgba(245, 158, 11, 0.60)
                         background: rgba(245, 158, 11, 0.05)

BUTTON PRIMARY (TerminalButton variant='primary'):
background:              #F59E0B (Solid tactical amber fill)
color:                   #080C08 (Deepest terminal black, font-black)
border:                  1px solid #F59E0B
font:                    --font-mono, text-xs, font-bold, uppercase, tracking-wider
border-radius:           0px
hover:                   background: #FBBF24
                         box-shadow: 0 0 10px rgba(245, 158, 11, 0.40)

BUTTON SECONDARY / OUTLINE (variant='secondary'):
background:              rgba(0, 0, 0, 0.60)
border:                  1px solid rgba(245, 158, 11, 0.40)
color:                   #FCD34D (text-amber-300)
font:                    --font-mono, text-xs, font-bold, uppercase
hover:                   border-color: #F59E0B, bg-amber-500/20, text-amber-200

BUTTON DANGER (variant='danger'):
background:              rgba(69, 10, 10, 0.20)
border:                  1px solid #EF4444
color:                   #F87171
hover:                   background: rgba(127, 29, 29, 0.40)

BUTTON SUCCESS (variant='success'):
background:              rgba(6, 78, 59, 0.20)
border:                  1px solid #10B981
color:                   #34D399
hover:                   background: rgba(6, 95, 70, 0.40)

BADGE / STATUS CHIP (StatusBadge.tsx):
format:                  Bracketed monospace string: "[{STATUS}]"
font:                    --font-mono, text-[9px] to text-[10px], font-bold, uppercase
border-radius:           0px (No rounded pills)
VERIFIED / ACTIVE:       bg-emerald-950/50 text-emerald-400 border border-emerald-500/50
CRITICAL / CLASH:        bg-red-950/50 text-red-400 border border-red-500/60
UNCONFIRMED / REVIEW:    bg-amber-950/60 text-amber-300 border border-amber-500/60
PENDING / LOW / ROOT:    bg-zinc-900/80 text-amber-400/80 border border-amber-500/30

CONFIDENCE METER (ConfidenceMeter.tsx):
structure:               Tactical 10-column segmented grid
track:                   grid grid-cols-10 gap-0.5 h-2 bg-black/60 border border-amber-500/30
filled blocks:
  >= 75%:                bg-emerald-400 (Tier badge: [HIGH])
  >= 50%:                bg-amber-400   (Tier badge: [MEDIUM])
  <  50%:                bg-amber-600   (Tier badge: [LOW])
shape:                   Sharp rectangular tick segments (No rounded pills)

INTELLIGENCE SIGNAL (IntelligenceSignal.tsx):
structure:               High-priority tactical signal banner with pulsing alert node
border:                  1px solid rgba(245, 158, 11, 0.40) (amber) or rgba(239, 68, 68, 0.50) (clash)
connector:               Tactical path "SOURCE (E-XXX) ──▶ TARGET (E-YYY)"
telemetry:               Confidence % meter bar + evidence count tag ([03]) + status badge


NAVIGATION & SIDEBAR (Layout.tsx):
Sidebar Width:           Fixed 256px (w-64 on desktop, slide-over drawer on mobile)
Background:              #0A0F0A (terminal.surface) with right border-amber-500/40
Brand Header:            SPYDEE (3-node tactical constellation glyph)
                         "UNSEEN LINKS. SAFER TOMORROWS."
Case Switcher:           Dedicated "◂ ALL CASES / SWITCH [ESC]" button directly below brand
Active Nav Item:         Solid Amber fill: bg-[#f59e0b] text-[#080c08] font-bold 
                         box-shadow: 0 0 12px rgba(245, 158, 11, 0.50) + count chip
Inactive Nav Item:       border border-transparent hover:border-amber-500/30 text-amber-400/80 
                         hover:bg-amber-950/20 hover:text-amber-300

Nav Sections & Routes:
// CASE CONSOLE
  - CASE OVERVIEW        (/cases/:id)
  - EVIDENCE & FILES     (/cases/:id/evidence)
  - ENTITIES             (/cases/:id/entities)
  - GRAPH                (/cases/:id/graph)
  - MAP                  (/cases/:id/map)
  - TIMELINE             (/cases/:id/timeline)
// INTELLIGENCE
  - WORKBENCH            (/cases/:id/workbench)
  - HYPOTHESES           (/cases/:id/hypotheses)
  - CONTRADICTIONS       (/cases/:id/contradictions)
  - INFORMATION GAPS     (/cases/:id/leads)
  - LEADS & ACTIONS      (/cases/:id/leads)
// TOOLS
  - AI INVESTIGATOR      (/cases/:id/copilot)
  - DATA INGESTION       (/cases/:id/evidence)
  - SYSTEM AUDIT         (/cases/:id/reports)


LAYOUT STRUCTURE:

┌──────────────────────────────────────────────────────────────────────────────────┐
│ GLOBAL TOP HEADER (h-14, bg-[#0a0f0a], border-b border-amber-500/40)             │
│ [CURRENT CASE #001 [ACTIVE]] │ CRIMINAL NETWORK ANALYSIS SYSTEM │ [LEDS][CLOCK]  │
├───────────────────┬──────────────────────────────────────────────────────────────┤
│ SIDEBAR (w-64)    │ MAIN WORKSPACE CANVAS (bg-[#080c08], p-3 md:p-4)             │
│ SPYDEE BRAND      │ ┌──────────────────────────────────────────────────────────┐ │
│ ◂ ALL CASES [ESC] │ │ TOP METRIC CARDS GRID (4 to 5 cols)                      │ │
│                   │ │ ENTITIES | ACTIVE HYPOTHESES | GAPS | CONFIDENCE 78%     │ │
│ // CASE CONSOLE   │ └──────────────────────────────────────────────────────────┘ │
│ Overview          │ ┌──────────────────────────┬───────────────────────────────┐ │
│ Evidence & Files  │ │ CASE SUMMARY PANEL       │ DYNAMIC NETWORK SNAPSHOT      │ │
│ Entities          │ │ Investigator ID / FIR    │ Interactive Radar & SVG Nodes │ │
│ Graph / Map       │ │ Telemetry / Jurisdiction │ Cluster Count & Edges         │ │
│ Timeline          │ ├──────────────────────────┼───────────────────────────────┤ │
│                   │ │ INTELLIGENCE SIGNALS     │ RECENT SYSTEM CORRELATION     │ │
│ // INTELLIGENCE   │ │ Unconfirmed Hidden Links │ Timeline Feed & Intake Logs   │ │
│ Workbench / Clashes│ │ Location Clashes         │ Investigation Telemetry       │ │
│ Leads & Gaps      │ └──────────────────────────┴───────────────────────────────┘ │
├───────────────────┴──────────────────────────────────────────────────────────────┤
│ GLOBAL BOTTOM STATUS BAR (h-6, bg-[#0a0f0a], border-t border-amber-500/40)       │
│ [● SYSTEM ONLINE] │ INTELLIGENCE ENGINE: READY │ GRAPH NODES: 27 // EDGES: 84    │
└──────────────────────────────────────────────────────────────────────────────────┘

TOP HEADER BREAKDOWN:
Left:               Aligned to sidebar width (w-64). Pulsing amber square,
                    CURRENT CASE label, truncated Case Code/Name, and [ACTIVE] badge.
Center:             CRIMINAL NETWORK ANALYSIS SYSTEM (.amber-glow)
                    MINISTRY OF HOME AFFAIRS // INTELLIGENCE & INVESTIGATION
Right:              
  - Hardware LEDs:  [● DISK] [● NET] [● PWR] with live animated green/amber blinks
  - Digital Clock:  Date (DD MMM YYYY) + Time (HH:MM:SS) in GMT/IST
  - Classification: [SECURE TERMINAL] v1.0.3 // CLASSIFIED
  - CRT Switch:     [CRT: ON] / [CRT: OFF] raster scanline toggle
  - Logout:         [DISCONNECT] exit action button

BOTTOM STATUS BAR BREAKDOWN:
Left:               [● SYSTEM ONLINE] (pulsing emerald LED)
Center-Left:        INTELLIGENCE ENGINE: READY
Center-Right:       GRAPH NODES: {count} // EDGES: {count}
Right:              🇮🇳 GOVT. OF INDIA // INVESTIGATIVE INTELLIGENCE


CRT SHADERS & SCROLLBARS (index.css):

Custom Scrollbar:
width:              5px (horizontal: 5px)
track:              #090E09 with border-left 1px solid rgba(245, 158, 11, 0.20)
thumb:              #78350F with border 1px solid #D97706
thumb-hover:        #B45309

CRT Shader Layers:
.scanlines:         Horizontal raster overlay via linear-gradient; toggled on/off
.crt-vignette:      Radial edge curvature: inset 0 0 100px rgba(0, 0, 0, 0.85)
.terminal-cursor:   Blinking solid amber block cursor (1s step-end infinite)
.animate-radar:     Rotational radar sweep overlay (4s linear infinite) for graph snapshots


ANIMATIONS:
- Node glow pulse:  2s ease-in-out infinite (.amber-glow-pulse)
- Radar sweep:      4s linear infinite (.animate-radar)
- LED Telemetry:    Periodic simulated disk/network blinking (emerald/amber)
- Alert pulse:      Pulsing amber square indicator for active dossiers
- CRT scanline:     CSS-rendered scanline raster with instant toggle state


STRICTLY PROHIBITED (Active Design Rules):
× NO rounded pill buttons or rounded badges (All border-radius is strictly 0px)
× NO purple-to-blue neon gradients or cyan-on-dark SaaS styling
× NO generic sans-serif fonts (e.g. Inter, Roboto, Geist) for body or UI text
× NO bright white or grey backgrounds (Terminal palette only: #080C08 to #0E170E)
× NO soft drop shadows (Use sharp 1px borders and amber phosphor box-glows only)
× NO card carousels or generic SaaS hero marketing blocks
× NO modal popups for primary data inspection (All views use panels or drawers)
× NO emojis in navigation, section headers, or data keys (Lucide terminal icons only)
× NO decorative non-functional animations
================================================================================
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 8 — IMPLEMENTATION ORDER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Execute in this order:

PHASE 1 — Design system audit
Locate the existing fonts, CSS variables, 
base components, and layout shell already 
implemented (see Section 7 reference). 
Do NOT modify them. Confirm every existing 
page still renders correctly with the current 
theme before Phase 2.

PHASE 2 — Graph overhaul
New node styles, edge semantics, 
interaction depth, reasoning panel — 
all built with the existing design system's 
components and tokens.

PHASE 3 — Map overhaul
Dark tiles, all marker types, 
trajectories, co-location circles, 
time slider — styled to match the 
existing theme.

PHASE 4 — Timeline overhaul
Swimlane layout, event dots, 
reasoning strip, filters — styled to 
match the existing theme.

PHASE 5 — Hypothesis depth
Rebuilt cards with signal breakdown, 
computed confidence, contradiction 
display, information gap display — 
using existing card/panel/badge components.

PHASE 6 — Contradiction detection
Active for all hypotheses, graph 
edge visualization, Case C demo.

PHASE 7 — CCTV module
Evidence cards, observation panel, 
graph + map + timeline integration — 
using existing card/panel components.

PHASE 8 — Polish and verification
Run the primary demo case end-to-end:
P-1042 → D-021 → SIM churn → 
Tower-17 → co-location → P-1097

Verify every section in this prompt 
is working and visually consistent with 
the existing theme.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 9 — ACCEPTANCE CRITERIA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Do not declare complete until:

UI
✓ Existing retrofuturistic theme left untouched
✓ All new UI reuses existing components/tokens
✓ No generic SaaS components introduced
✓ Monospace fonts consistent throughout (as before)
✓ All pages remain visually consistent with each other

GRAPH
✓ Entity type icons and colors active
✓ Edge line styles visually distinct
✓ Hypothesis path glowing amber
✓ Click interaction opens reasoning panel
✓ Time slider scrubs graph chronologically

MAP
✓ Dark tiles loaded
✓ Tower markers with click detail
✓ Person markers with click profile
✓ CCTV markers present
✓ Co-location circles visible
✓ At least one trajectory animated

TIMELINE
✓ Swimlane layout per entity
✓ Event dot types visually distinct
✓ Communication burst visible at T-1
✓ Reasoning strip below timeline
✓ Filter controls working

HYPOTHESIS
✓ Signal breakdown present on every card
✓ Each signal shows source + weight + type
✓ Contradictions visible per hypothesis
✓ Confidence computed from signals
✓ Information gap shown per hypothesis
✓ Action buttons functional

CONTRADICTIONS
✓ Case C produces LOW CONFIDENCE result
✓ Contradiction edges visible on graph
✓ Contradiction tab in evidence panel

CCTV
✓ Observation cards with three signals
✓ Labelled as synthetic evidence
✓ Appears on map at coordinates
✓ Appears on timeline at timestamp
✓ Graph link functional

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 10 — NON-NEGOTIABLE RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Never claim:
× Live surveillance
× Confirmed identity
× AI detected a criminal
× Proven authorship
× Real-time data (unless actually real)

Always label:
✓ Synthetic evidence package
✓ Inferred — not confirmed
✓ Authorship-continuity lead
✓ Requires investigator verification
✓ Human-in-the-loop


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION Final Debugging
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
I have found many errors in the web app's backend and on the react application
using the prompts below rectify all those errors
1:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BUG FIX — DUPLICATE NAV KEY + BACKEND 500s
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Two separate bugs are occurring together. Fix only these two 
issues. Do not refactor, redesign, or touch anything else in 
the app while doing this.

BUG 1 — Duplicate React key warning
────────────────────────────────────
Console shows, on every case, every render:
"Encountered two children with the same key, 
`/cases/{caseId}/leads`" 
originating from the nav list rendered in 
src/components/Layout.tsx (around line 46-68).

Find where the sidebar/nav items array is built in Layout.tsx.
There are two entries producing the same key/path 
(`/cases/{caseId}/leads`) — likely a duplicate nav item 
definition, or a route being added twice (e.g. once from a 
static nav config and once from a dynamic case-scoped list).

Fix by removing the duplicate entry, or if both are meant to 
exist but link to different things, give each a unique `key` 
that isn't just the raw path.

Verify: after the fix, the console must never log the 
"same key" warning for `/leads` (or any other route) on any 
case.

BUG 2 — 500 Internal Server Error on three endpoints, all cases
─────────────────────────────────────────────────────────────
Every single case (multiple different case IDs) 
consistently fails these calls on load:

GET /api/v1/workspace/{caseId}/summary
GET /api/v1/evidence/{caseId}/files
GET /api/v1/timeline/{caseId}?page_size=100
GET /api/v1/timeline/{caseId}?page_size=6

All return 500. Since this happens across every case ID 
without exception, the bug is in the backend handler logic 
itself (not bad data for one specific case) — likely an 
unhandled exception, a missing null-check, a broken query, 
or a misconfigured dependency (DB connection, missing table, 
bad serializer, etc.) shared by all three routes.

Steps to diagnose and fix:
1. Reproduce one of these calls directly against the backend 
   and capture the actual server-side stack trace / exception 
   message (not just the 500 status code the frontend sees).
2. Identify the root cause from that stack trace — do not 
   guess or paper over it with a try/catch that swallows the 
   error.
3. Fix the underlying cause in the backend handler for 
   /workspace/{id}/summary, /evidence/{id}/files, and 
   /timeline/{id}.
4. If the three endpoints fail for a shared reason (e.g. a 
   common service/repository/query they all call), fix it 
   once at that shared layer rather than patching each route 
   separately.
5. Confirm all three endpoints return 200 with valid data for 
   at least the case IDs seen in the logs above.

Do not change unrelated endpoints, routes, or components. 
Do not modify the UI/theme while fixing this — this is purely 
a data-loading and rendering-key bug fix.
```
2:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BUG FIX — MISSING DATABASE COLUMNS (SCHEMA DRIFT)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Root cause confirmed from server logs: the SQLAlchemy ORM 
models reference two columns that do not exist in the actual 
Postgres database. This is a migration drift issue, not a 
logic bug. Do not change any application logic, routers, or 
UI — fix only the schema.

CONFIRMED MISSING COLUMNS
──────────────────────────
1. evidence_files.extracted_text
   → causes 500s in:
     - GET /api/v1/evidence/{case_id}/files (evidence_router.py, list_files)
     - GET /api/v1/workspace/{case_id}/summary (workspace_router.py, 
       case_workspace_summary — queries evidence_files)

2. events.is_manual
   → causes 500s in:
     - GET /api/v1/timeline/{case_id} (timeline_router.py, get_timeline
       — both the page query and the count(*) subquery)

Both errors are asyncpg.exceptions.UndefinedColumnError, 
meaning the ORM model class defines these columns but the 
actual database table does not have them.

STEPS TO FIX
────────────
1. Locate the ORM model definitions for `EvidenceFile` and 
   `Event` (likely in services/api/app/models/ or similar) 
   and confirm the exact column names, types, nullability, 
   and defaults for:
   - EvidenceFile.extracted_text
   - Event.is_manual

2. Check the Alembic migration history 
   (services/api/alembic/versions/ or wherever migrations 
   live) for whether a migration adding these two columns 
   already exists but was never applied, or whether no 
   migration was ever created for them.

3. If a migration already exists but wasn't applied:
   Run it against the local database:
     alembic upgrade head
   (or the project's equivalent migration command — check 
   for a Makefile target or script first).

4. If no migration exists for these columns:
   Generate one with Alembic's autogenerate (after confirming 
   the models are correct):
     alembic revision --autogenerate -m "add extracted_text to evidence_files, is_manual to events"
   Then inspect the generated migration file carefully before 
   running it — autogenerate can sometimes produce unwanted 
   changes (e.g. dropping columns it thinks are extraneous). 
   Only keep the ADD COLUMN statements for these two columns 
   unless other legitimate drift is confirmed.
   Then apply it:
     alembic upgrade head

5. After migrating, verify directly against the database 
   (psql or a DB client) that both columns now exist:
     \d evidence_files
     \d events

6. Restart the API/worker service and re-test all three 
   previously failing endpoints for at least one known case ID:
   - GET /api/v1/workspace/{case_id}/summary       → expect 200
   - GET /api/v1/evidence/{case_id}/files           → expect 200
   - GET /api/v1/timeline/{case_id}?page_size=100   → expect 200

7. Because this is schema drift, also check whether OTHER 
   models have the same problem (i.e. other columns added to 
   ORM classes without a corresponding migration). Run a full 
   `alembic check` or manually diff all models against the 
   live schema if the tool supports it, so this class of bug 
   doesn't resurface on the next case load.

DO NOT:
- Modify router logic, remove columns from the SELECT, or 
  work around this by catching the exception and returning 
  partial data. The columns are expected to exist and must be 
  added to the database, not removed from the query.
- Touch the frontend, UI theme, or any unrelated code while 
  fixing this.
  ```