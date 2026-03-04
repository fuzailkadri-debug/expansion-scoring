# Claude Code Quick Start Guide

## What This Is

This folder contains everything you need to run and maintain the **Expansion Scoring Model** for your BioRender CSM book of business.

---

## Folder Structure

```
expansion-scoring/
├── CLAUDE.md              ← Main instructions (Claude reads this automatically)
├── README.md              ← Project overview
├── QUICKSTART.md          ← You are here
├── data/
│   ├── salesforce_export.csv    ← Your Salesforce data
│   └── hex_free_users.csv       ← Free user data from Hex (create this)
├── output/
│   └── expansion-scoring-final.xlsx  ← Your scoring calculator
├── queries/
│   └── hex_queries.md     ← SQL queries to run in Hex
└── scripts/
    └── generate_scoring.py  ← Python script to regenerate
```

---

## How to Use with Claude Code

### Option 1: Just Chat (Recommended)

Open Claude Code in this folder and ask questions like:

```
"Show me accounts renewing in the next 60 days"

"Which Defined Group accounts have high activation?"

"What's my pipeline looking like for Q1?"

"Help me update the scoring with new Salesforce data"

"Generate a list of Tier 1 accounts for Outreach"
```

Claude will read the CLAUDE.md file and understand the context.

### Option 2: Run Commands

```bash
# View summary
python scripts/generate_scoring.py --summary

# Regenerate Excel with new data
python scripts/generate_scoring.py

# Export Tier 1 accounts
python scripts/generate_scoring.py --export-tier 1
```

---

## Monthly Workflow

### Week 1: Data Refresh

1. **Export from Salesforce**
   - Run your opportunities report
   - Save as `data/salesforce_export.csv`

2. **Run Hex Queries**
   - Copy queries from `queries/hex_queries.md`
   - Run in Hex
   - Export results to `data/hex_free_users.csv`

3. **Regenerate Scores**
   ```bash
   python scripts/generate_scoring.py
   ```

### Week 2-4: Execute

- Work through Tier 1 accounts first
- Focus on DG/Sitewide accounts approaching renewal
- Update Outreach.io sequences

---

## Key Things to Remember

1. **DG/Sitewide = Renewal Only**
   - These accounts can ONLY expand at renewal
   - Check "Renewal-Only Expansion" tab
   - Prioritize by days to renewal

2. **Free Users Drive Scores**
   - Without Hex data, accounts show "Need Hex Data"
   - This is the #1 expansion signal

3. **Activation Calculation**
   - Named User: `Seats Filled ÷ Current Seats`
   - DG/Sitewide: `Seats Filled ÷ Initial Seats` (more accurate)

---

## Your Q1 Targets

| Metric | Amount |
|--------|--------|
| Renewal Target | $318,000 |
| Expansion Goal (17%) | $54,060 |
| With 15% Buffer | $62,169 |

---

## Getting Help

Just ask Claude in the terminal:

```
"Explain the scoring model"
"Why is this account scored low?"
"How do I add new accounts?"
"What should I focus on this week?"
```
