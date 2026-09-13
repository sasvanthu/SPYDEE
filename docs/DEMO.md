# SPYDEE Demo Sequence (3 minutes)

## Setup
1. Open http://localhost:5173
2. Sign in as `investigator` / `invest123`

## Step 1: Open Broken Chain Case (15s)
1. Click on "Broken Chain - Network Continuity Analysis" (BRK-2026-001)
2. Observe the case overview with entity, evidence, and hypothesis counts

## Step 2: Inspect Evidence (30s)
1. Click "Evidence" in the sidebar
2. Show uploaded files with accepted/rejected counts
3. Click "Import" on one file to show the import process
4. Show import history with status

## Step 3: Run Analysis (30s)
1. Click "Workbench" in the sidebar
2. Click "Run Analysis"
3. Wait for analysis to complete (shows status)
4. Click "Graph" to open the investigation graph
5. Pan and zoom the graph; click a node to see connections

## Step 4: Inspect Hypothesis (30s)
1. Click "Hypotheses" in the sidebar
2. Select the highest-strength hypothesis
3. Show the strength index, contributing signals, and missing information
4. Show the signal breakdown by family

## Step 5: Add Contradictory Evidence (30s)
1. Click "Evidence" in the sidebar
2. Upload `case_a_batch5_contradiction.json` (from demo/import-batches/)
3. Import the file
4. Return to "Hypotheses" to show how support changes

## Step 6: Use Copilot (30s)
1. Click "Copilot" in the sidebar
2. Ask: "What contradicts this lead?"
3. Show the cited answer with follow-up suggestions
4. Ask: "What evidence is missing?"

## Step 7: Record Decision (15s)
1. On the hypothesis detail, click "Verify"
2. Add a reviewer note
3. Show the review state changed to "Needs Verification"

## Step 8: Export Report (30s)
1. Click "Reports" in the sidebar
2. Enter a title and click "Generate Report"
3. Show the report preview with hypotheses, limitations, and decisions

## Key Points to Highlight
- All processing is real, not mocked
- Same input produces same output (deterministic)
- Evidence-strength index is not a guilt probability
- Missing information drives next investigation steps
- Synthetic demo marker is visible throughout
