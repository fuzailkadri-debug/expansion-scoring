"""
Churn Risk Scoring Module

Calculates a churn risk score for each account based on:
- Usage health (primary signal)
- Seat activation rate (low utilisation = risk)
- Renewal proximity + low health (urgency amplifier)
- Zendesk support volume (optional)
"""

import pandas as pd

# ── Scoring tables ────────────────────────────────────────────────────────────

CHURN_HEALTH = {
    'Red': 40,
    'Yellow': 20,
    'Green': 0,
    'Extra Green': -5,
    '': 15,  # unknown health treated as mild risk
}

# Activation: lower = higher risk
CHURN_ACTIVATION = [
    (0.0, 30),   # <50%
    (0.5, 20),   # 50-70%
    (0.7, 10),   # 70-80%
    (0.8, 5),    # 80-90%
    (0.9, 0),    # >=90%
]

# Renewal proximity ONLY matters when health is already bad
CHURN_RENEWAL_URGENCY = [
    (30,  20),
    (60,  15),
    (90,  10),
    (999,  0),
]

CHURN_TIERS = [
    (55, 'High Risk'),
    (25, 'Medium Risk'),
    (0,  'Low Risk'),
]


# ── Scoring function ──────────────────────────────────────────────────────────

def calculate_churn_scores(df: pd.DataFrame, zendesk_df: pd.DataFrame = None) -> pd.DataFrame:
    """Append churn risk score and tier to df."""

    def _activation_pts(activation):
        for threshold, pts in CHURN_ACTIVATION:
            if activation >= threshold:
                return pts
        return 30

    def _renewal_pts(days):
        for threshold, pts in CHURN_RENEWAL_URGENCY:
            if days <= threshold:
                return pts
        return 0

    def score_row(row):
        health = str(row.get('Customer Usage Health', ''))
        health_pts = CHURN_HEALTH.get(health, 15)

        activation = float(row.get('True Activation', 0) or 0)
        act_pts = _activation_pts(activation)

        days = int(row.get('Days to Renewal', 365) or 365)
        # Renewal urgency only amplifies risk when health is already bad
        renewal_pts = _renewal_pts(days) if health in ('Red', 'Yellow', '') else 0

        total = health_pts + act_pts + renewal_pts

        tier = 'Low Risk'
        for threshold, name in CHURN_TIERS:
            if total >= threshold:
                tier = name
                break

        return pd.Series({
            'Churn Health Pts': health_pts,
            'Churn Activation Pts': act_pts,
            'Churn Renewal Pts': renewal_pts,
            'Churn Score': total,
            'Churn Risk': tier,
        })

    scores = df.apply(score_row, axis=1)
    result = pd.concat([df, scores], axis=1)

    # Merge Zendesk ticket data if provided
    if zendesk_df is not None and not zendesk_df.empty:
        result = _merge_zendesk(result, zendesk_df)

    return result


def _merge_zendesk(df: pd.DataFrame, zd: pd.DataFrame) -> pd.DataFrame:
    """Merge Zendesk support ticket counts onto scored df."""
    # Accept common Zendesk export column names
    org_col = next((c for c in zd.columns if 'organization' in c.lower() or 'company' in c.lower()), None)
    ticket_col = next((c for c in zd.columns if 'count' in c.lower() or 'ticket' in c.lower()), None)

    if not org_col or not ticket_col:
        return df  # can't match — skip silently

    zd_agg = zd.groupby(org_col)[ticket_col].sum().reset_index()
    zd_agg.columns = ['_zd_org', 'Support Tickets']
    zd_agg['_zd_org_norm'] = zd_agg['_zd_org'].str.lower().str.strip()

    df['_org_norm'] = df['Organization'].str.lower().str.strip()
    df = df.merge(zd_agg[['_zd_org_norm', 'Support Tickets']], left_on='_org_norm', right_on='_zd_org_norm', how='left')
    df['Support Tickets'] = df['Support Tickets'].fillna(0).astype(int)
    df = df.drop(columns=['_org_norm', '_zd_org_norm'], errors='ignore')

    return df
