# BioRender Expansion Scoring Model

A systematic approach to identifying and prioritizing expansion opportunities across your customer book.

## The Problem

With 130+ accounts and a quarterly expansion target of 17% of renewal amount ($54K+), you need a data-driven way to:
1. Identify which accounts have the highest expansion potential
2. Prioritize outreach based on timing constraints
3. Track pipeline against targets

## The Solution

This scoring model combines Salesforce license data with Hex usage analytics to score and tier accounts for expansion.

### Two Expansion Tracks

**Track 1: Anytime Expansion (95 accounts)**
- Named User, Named User (Chargeback), Right to Deploy
- Can expand off-cycle or at renewal
- More flexibility in timing

**Track 2: Renewal-Only Expansion (39 accounts)**
- Defined Group, Sitewide
- Can ONLY expand at renewal
- Time-sensitive - miss the window, wait a year

## Quick Start

1. Clone/download this project
2. Place your Salesforce export in `data/salesforce_export.csv`
3. Run Hex queries from `queries/hex_queries.md`
4. Place Hex results in `data/hex_free_users.csv`
5. Run `python scripts/generate_scoring.py`
6. Open `output/expansion-scoring.xlsx`

## File Structure

```
├── CLAUDE.md           # Detailed instructions for Claude Code
├── README.md           # This file
├── data/               # Input data files
├── output/             # Generated Excel files
├── queries/            # Hex SQL queries
└── scripts/            # Python automation scripts
```

## Scoring Factors

| Factor | Weight | Description |
|--------|--------|-------------|
| Free/Self-Serve Users | 25 pts | Users in same org not on the license |
| Usage Health | 25 pts | Green/Extra Green = high engagement |
| Activation Rate | 18 pts | How full is the current license |
| Renewal Proximity | 15-20 pts | Urgency of expansion conversation |
| Current ARR | 10 pts | Larger accounts = larger deals |
| License Type | 7 pts | Fit for seat-based expansion |

## Output Tiers

- **Tier 1 (75+)**: Immediate personalized outreach
- **Tier 2 (55-74)**: Standard outreach sequences
- **Tier 3 (35-54)**: Nurture campaigns
- **Below Threshold (<35)**: Monitor for changes

## Author

Built for BioRender Customer Success team.
