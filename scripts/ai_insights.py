"""
AI Insights — Claude-powered analysis of your CS data.

Requires the `anthropic` package and an API key.
When no key is configured the module returns a clear setup message.
"""

import os
import pandas as pd

try:
    import anthropic
    _ANTHROPIC_AVAILABLE = True
except ImportError:
    _ANTHROPIC_AVAILABLE = False


MODEL = "claude-sonnet-4-6"

SETUP_MESSAGE = """
**AI Insights is not yet activated.**

To enable it:
1. Get an Anthropic API key at [console.anthropic.com](https://console.anthropic.com)
2. In Streamlit Cloud → your app → **Settings** → **Secrets**, add:
```
ANTHROPIC_API_KEY = "sk-ant-..."
```
3. Redeploy — the AI chat will activate automatically.

For local use, create a file `expansion-scoring/.streamlit/secrets.toml` with:
```toml
ANTHROPIC_API_KEY = "sk-ant-..."
```
"""


def is_available(api_key: str = None) -> bool:
    """Return True if anthropic is installed and a key is configured."""
    if not _ANTHROPIC_AVAILABLE:
        return False
    key = api_key or _get_key()
    return bool(key)


def _get_key() -> str:
    """Retrieve API key from Streamlit secrets or environment."""
    # Try Streamlit secrets first
    try:
        import streamlit as st
        return st.secrets.get("ANTHROPIC_API_KEY", "")
    except Exception:
        pass
    # Fall back to environment variable
    return os.environ.get("ANTHROPIC_API_KEY", "")


def build_data_context(df: pd.DataFrame) -> str:
    """
    Convert the scored dataframe into a concise text summary for Claude.
    Keeps token usage low while giving Claude enough to answer intelligently.
    """
    lines = []

    # Book-level summary
    total_arr = df["Renewal Target Amount"].sum()
    lines.append(f"BOOK SUMMARY")
    lines.append(f"Total accounts: {len(df)}")
    lines.append(f"Total ARR: ${total_arr:,.0f}")
    lines.append("")

    # Expansion tiers
    lines.append("EXPANSION TIERS")
    for tier in ["Tier 1", "Tier 2", "Tier 3", "Below Threshold", "Need Hex Data"]:
        count = (df["Tier"] == tier).sum()
        arr = df[df["Tier"] == tier]["Renewal Target Amount"].sum()
        lines.append(f"  {tier}: {count} accounts (${arr:,.0f} ARR)")
    lines.append("")

    # Churn risk
    lines.append("CHURN RISK")
    for risk in ["High Risk", "Medium Risk", "Low Risk"]:
        count = (df["Churn Risk"] == risk).sum()
        arr = df[df["Churn Risk"] == risk]["Renewal Target Amount"].sum()
        lines.append(f"  {risk}: {count} accounts (${arr:,.0f} ARR)")
    lines.append("")

    # Health distribution
    lines.append("HEALTH DISTRIBUTION")
    for h in ["Extra Green", "Green", "Yellow", "Red"]:
        count = (df["Customer Usage Health"] == h).sum()
        lines.append(f"  {h}: {count} accounts")
    lines.append("")

    # Renewal urgency
    lines.append("RENEWAL URGENCY")
    for lo, hi, label in [(0, 30, "0-30 days"), (31, 60, "31-60 days"), (61, 90, "61-90 days")]:
        subset = df[(df["Days to Renewal"] >= lo) & (df["Days to Renewal"] <= hi)]
        arr = subset["Renewal Target Amount"].sum()
        lines.append(f"  {label}: {len(subset)} accounts (${arr:,.0f} ARR)")
    lines.append("")

    # Urgent: high risk + renewing soon
    urgent = df[(df["Churn Risk"] == "High Risk") & (df["Days to Renewal"] <= 90)]
    if not urgent.empty:
        lines.append("URGENT — HIGH CHURN RISK + RENEWING WITHIN 90 DAYS")
        for _, row in urgent.iterrows():
            lines.append(
                f"  {row.get('Organization', 'Unknown')} | "
                f"{row.get('Customer Usage Health', '')} health | "
                f"{int(row.get('Days to Renewal', 0))} days to renewal | "
                f"${row.get('Renewal Target Amount', 0):,.0f} ARR"
            )
        lines.append("")

    # Top Tier 1 expansion accounts
    tier1 = df[df["Tier"] == "Tier 1"].nlargest(10, "Total Score")
    if not tier1.empty:
        lines.append("TOP TIER 1 EXPANSION ACCOUNTS")
        for _, row in tier1.iterrows():
            lines.append(
                f"  {row.get('Organization', 'Unknown')} | "
                f"Score: {int(row.get('Total Score', 0))} | "
                f"{row.get('License Type', '')} | "
                f"{int(row.get('Free Users', 0))} free users | "
                f"${row.get('Renewal Target Amount', 0):,.0f} ARR"
            )
        lines.append("")

    # All accounts (compact)
    lines.append("ALL ACCOUNTS")
    lines.append("Organization | License Type | Health | Activation | ARR | Days to Renewal | Free Users | Expansion Score | Tier | Churn Risk")
    for _, row in df.iterrows():
        activation = row.get("True Activation", 0) or 0
        lines.append(
            f"  {row.get('Organization', '')} | "
            f"{row.get('License Type', '')} | "
            f"{row.get('Customer Usage Health', '')} | "
            f"{activation:.0%} | "
            f"${row.get('Renewal Target Amount', 0):,.0f} | "
            f"{int(row.get('Days to Renewal', 0))} days | "
            f"{int(row.get('Free Users', 0))} free | "
            f"Score {int(row.get('Total Score', 0))} | "
            f"{row.get('Tier', '')} | "
            f"{row.get('Churn Risk', '')}"
        )

    return "\n".join(lines)


SYSTEM_PROMPT = """You are a Customer Success Intelligence analyst. You have been given a
complete snapshot of a CSM's book of business including expansion scores, churn risk,
seat activation rates, usage health, and renewal timelines.

Your job is to:
- Answer questions about the book clearly and concisely
- Surface patterns, risks, and opportunities the CSM might miss
- Prioritise accounts by urgency and impact
- Give specific, actionable recommendations — not generic advice
- When asked for a list, be specific with account names and numbers
- Think like a strategic CSM who knows this data inside out

Keep responses focused and practical. Use bullet points and short paragraphs."""


def ask(question: str, df: pd.DataFrame, history: list, api_key: str = None) -> str:
    """
    Send a question to Claude with the full data context.

    Args:
        question: The user's question
        df: Scored dataframe
        history: List of {"role": ..., "content": ...} dicts for conversation memory
        api_key: Optional override — otherwise reads from secrets/env

    Returns:
        Claude's response as a string, or an error message.
    """
    key = api_key or _get_key()
    if not key:
        return SETUP_MESSAGE

    if not _ANTHROPIC_AVAILABLE:
        return "The `anthropic` package is not installed. Add it to requirements.txt and redeploy."

    client = anthropic.Anthropic(api_key=key)

    data_context = build_data_context(df)

    # Build messages: inject data context as first user turn if history is empty
    messages = []
    if not history:
        messages.append({
            "role": "user",
            "content": f"Here is my current book of business data:\n\n{data_context}\n\nI'll now ask you questions about it."
        })
        messages.append({
            "role": "assistant",
            "content": "Got it — I've reviewed your full book of business. I can see your expansion tiers, churn risks, renewal timeline, and account-level details. What would you like to know?"
        })
    else:
        # Prepend data context reminder to first message in history
        messages = history.copy()

    messages.append({"role": "user", "content": question})

    response = client.messages.create(
        model=MODEL,
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        messages=messages,
    )

    return response.content[0].text
