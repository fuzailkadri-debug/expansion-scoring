# Expansion Scoring Model - Claude Code Setup

## Overview

This project contains an expansion scoring model for identifying and prioritizing accounts for seat expansion opportunities. The model is designed for a CSM at BioRender managing 130+ accounts with a quarterly expansion target of 17% of renewal amount.

## Project Structure

```
expansion-scoring/
├── CLAUDE.md                    # This file - main instructions
├── README.md                    # Project overview
├── data/
│   ├── salesforce_export.csv    # Your Salesforce data (upload here)
│   └── hex_free_users.csv       # Free/self-serve user data from Hex
├── output/
│   └── expansion-scoring.xlsx   # Generated scoring calculator
├── queries/
│   └── hex_queries.md           # SQL queries for Hex
└── scripts/
    └── generate_scoring.py      # Python script to regenerate calculator
```

## Quick Start

### Step 1: Export Salesforce Data

Export a report from Salesforce with these fields:
- Opportunity Name
- Renewal Target Amount
- Renewal Date
- Customer Usage Health
- License Type
- Current Number of Seats Available
- Seats Filled
- Seat Activation Rate
- Active Users Last 90 Days
- Initial Number of Seats

Save as `data/salesforce_export.csv`

### Step 2: Run Hex Queries

Copy queries from `queries/hex_queries.md` into Hex to get free/self-serve user counts.
Save results as `data/hex_free_users.csv`

### Step 3: Generate Scoring Calculator

```bash
python scripts/generate_scoring.py
```

This creates `output/expansion-scoring.xlsx` with your scored accounts.

### Step 4: Manual Entry (if needed)

If you can't automate the Hex data merge, manually enter free user counts into the yellow "FREE/SS USERS" column in the Excel file.

---

## Scoring Model Logic

### Two Expansion Types

| Type | License Types | When Can Expand | Activation Formula |
|------|---------------|-----------------|---------------------|
| **Anytime** | Named User, Chargeback, RTD | Off-cycle or renewal | Seats Filled ÷ Current Seats |
| **Renewal-Only** | Defined Group, Sitewide | **Only at renewal** | Seats Filled ÷ Initial Seats |

### Scoring Components (100-103 points max)

| Factor | Max Points | Why It Matters |
|--------|------------|----------------|
| Free/Self-Serve Users (Dept Match) | 25 | Primary expansion signal - uses department-matched users only |
| Usage Health | 25 | Satisfaction indicator |
| Activation Rate | 18 | Capacity utilization |
| Renewal Proximity | 15-20 | Timing (higher for DG/SW) |
| Current ARR | 10 | Deal size potential |
| License Type | 7 | Expansion model fit |

### Department Matching Logic

The Free/Self-Serve Users scoring now uses **department-matched users only** - users whose department name matches the licensed department. This provides higher-quality expansion signals because these users are in the SAME department as the existing license.

| Column | Description |
|--------|-------------|
| **Free (Dept Match)** | Free users in departments that match the licensed department |
| **Self-Serve (Dept Match)** | Self-serve users in departments that match the licensed department |
| **Total Dept Match** | Combined count of department-matched free + self-serve users (used for scoring) |

**Why department matching matters:**
- Department-matched users represent the highest expansion potential because they are colleagues of existing licensed users
- These users are more likely to convert to paid seats since their department already has budget approval and familiarity with the product
- Total free users are still tracked but department-matched users are prioritized for scoring

### Tier Definitions

| Tier | Score | Priority | Action |
|------|-------|----------|--------|
| Tier 1 | 75-100+ | Highest | Immediate personalized outreach |
| Tier 2 | 55-74 | Medium | Standard sequences |
| Tier 3 | 35-54 | Lower | Nurture campaigns |

---

## Common Commands

### Regenerate the calculator with new data
```bash
python scripts/generate_scoring.py --salesforce data/salesforce_export.csv --hex data/hex_free_users.csv
```

### View account summary
```bash
python scripts/generate_scoring.py --summary
```

### Filter by renewal window (next 90 days)
```bash
python scripts/generate_scoring.py --renewal-window 90
```

### Export Tier 1 accounts for Outreach.io
```bash
python scripts/generate_scoring.py --export-tier 1 --format csv
```

---

## Key Metrics

- **Q1 Renewal Target**: $318,000
- **Minimum Expansion (17%)**: $54,060
- **Target with 15% Buffer**: $62,169
- **Total Book ARR**: $1,250,000+

---

## Important Notes

1. **DG/Sitewide accounts** - Must expand at renewal. Check the "Renewal-Only Expansion" tab and prioritize by renewal date.

2. **Free user matching** - Match Hex data to Salesforce accounts by opportunity name. The Hex query automatically matches domains from full-serve users and expands to top-level domains.

3. **Undergraduate exclusion** - ⚠️ **CRITICAL**: Free/self-serve users with `role_category = 'undergraduate'` are **excluded** from all counts. This exclusion is applied in the Hex query, NOT in the Python script. Ensure your Hex query includes: "Exclude the undergraduate role category".

4. **Personal email exclusion** - Personal email domains (Gmail, Yahoo, etc.) are excluded in the Hex query.

5. **180-day activity window** - Only users who signed up OR logged in within the last 180 days are included.

6. **Monthly refresh** - Re-export Salesforce data and re-run Hex queries monthly to keep scores current.

## Hex Query Template

Use this prompt in Hex to generate the free/self-serve user data:

```
Find all open renewals on Salesforce under CSM owner [YOUR NAME]

Identify email domains from those accounts by:
1. Starting with domains from full-serve users
2. Expanding to the top-level domain
3. Finding all users who share either the specific domain OR the top-level domain
4. Exclude personal email domains like Gmail.com

Find free users signed up OR logged in within the last 180 days and self-serve
(individual/team paid) users matching those domains.

Flag users whose department matches any full-serve user's department at the same institution.

**IMPORTANT: Exclude the undergraduate role category**

Aggregate the numbers for each opportunity.

Output a downloadable CSV with:
- account name
- opportunity name
- department name
- number of free users (num_free_users)
- number of self-serve users (num_self_serve_users)
- how many match department names (num_users_with_dept_match)
```

Save the output as `csv_export_-_users_by_opportunity_&_department_[DATE].csv`

---

## Troubleshooting

### "Need Hex Data" showing for all accounts
The FREE/SS USERS column is empty. Either:
- Run Hex queries and import the data
- Manually enter counts based on your knowledge

### Activation rate showing >100%
For DG/Sitewide, this means they've added more users than initially purchased (good expansion signal!)

### Scores seem too low
Check that:
- Health status is populated
- Renewal dates are correct
- License types match exactly (case-sensitive)
