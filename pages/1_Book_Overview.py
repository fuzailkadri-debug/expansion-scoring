"""
Book Overview — Full-book KPI dashboard.
"""

import sys
from pathlib import Path

import pandas as pd
import streamlit as st

sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))

st.set_page_config(page_title="Book Overview", page_icon="📋", layout="wide")
st.title("📋 Book Overview")

if "data" not in st.session_state:
    st.warning("No data loaded. Go to the Home page and upload your Salesforce CSV.")
    st.stop()

df = st.session_state["data"]

# ── ARR at a glance ───────────────────────────────────────────────────────────

st.subheader("ARR Breakdown")

total_arr = df["Renewal Target Amount"].sum()
red_yellow = df[df["Customer Usage Health"].isin(["Red", "Yellow"])]["Renewal Target Amount"].sum()
tier1_arr = df[df["Tier"] == "Tier 1"]["Renewal Target Amount"].sum()
high_risk_arr = df[df["Churn Risk"] == "High Risk"]["Renewal Target Amount"].sum()

c1, c2, c3, c4 = st.columns(4)
c1.metric("Total ARR", f"${total_arr:,.0f}")
c2.metric("ARR — Unhealthy Accounts", f"${red_yellow:,.0f}",
          help="Accounts with Red or Yellow health status")
c3.metric("ARR — Expansion Tier 1", f"${tier1_arr:,.0f}")
c4.metric("ARR — High Churn Risk", f"${high_risk_arr:,.0f}")

# ── Health distribution ───────────────────────────────────────────────────────

st.divider()
st.subheader("Usage Health Distribution")

health_order = ["Extra Green", "Green", "Yellow", "Red", ""]
health_counts = df["Customer Usage Health"].value_counts().reindex(health_order).dropna()
health_pct = (health_counts / len(df) * 100).round(1)

col_health, col_tier = st.columns(2)

with col_health:
    health_df = pd.DataFrame({
        "Health": health_counts.index,
        "Accounts": health_counts.values,
        "Pct": health_pct.values,
    })
    st.dataframe(health_df, use_container_width=True, hide_index=True)

with col_tier:
    st.markdown("**Expansion Tiers**")
    tier_order = ["Tier 1", "Tier 2", "Tier 3", "Below Threshold", "Need Hex Data"]
    tier_counts = df["Tier"].value_counts().reindex(tier_order).dropna()
    tier_df = pd.DataFrame({"Tier": tier_counts.index, "Accounts": tier_counts.values})
    st.dataframe(tier_df, use_container_width=True, hide_index=True)

# ── Renewal timeline ──────────────────────────────────────────────────────────

st.divider()
st.subheader("Renewal Timeline — Next 12 Months")

df_future = df[df["Days to Renewal"].between(0, 365)].copy()
if "Renewal Date" in df_future.columns:
    df_future["Renewal Month"] = pd.to_datetime(df_future["Renewal Date"]).dt.to_period("M").astype(str)
    monthly = df_future.groupby("Renewal Month").agg(
        Accounts=("Organization", "count"),
        ARR=("Renewal Target Amount", "sum")
    ).reset_index()
    monthly["ARR"] = monthly["ARR"].map("${:,.0f}".format)
    st.dataframe(monthly, use_container_width=True, hide_index=True)
else:
    st.info("Renewal Date not available — cannot build timeline.")

# ── Top accounts ──────────────────────────────────────────────────────────────

st.divider()
st.subheader("Top 20 Accounts by ARR")

top = df.nlargest(20, "Renewal Target Amount")[
    ["Organization", "License Type", "Customer Usage Health",
     "Renewal Target Amount", "Days to Renewal", "Tier", "Churn Risk"]
].copy()
top["Renewal Target Amount"] = top["Renewal Target Amount"].map("${:,.0f}".format)
st.dataframe(top, use_container_width=True, hide_index=True)
