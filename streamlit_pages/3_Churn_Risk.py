"""
Churn Risk — Accounts flagged by health, activation, and renewal proximity.
"""

import sys
from pathlib import Path

import streamlit as st

sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))

st.set_page_config(page_title="Churn Risk", page_icon="⚠️", layout="wide")
st.title("⚠️ Churn Risk")

if "data" not in st.session_state:
    st.warning("No data loaded. Go to the Home page and upload your Salesforce CSV.")
    st.stop()

df = st.session_state["data"]
has_zd = st.session_state.get("has_zendesk", False)

# ── Risk summary ──────────────────────────────────────────────────────────────

st.subheader("Risk Breakdown")

risk_counts = df["Churn Risk"].value_counts()
c1, c2, c3 = st.columns(3)
c1.metric("High Risk", risk_counts.get("High Risk", 0))
c2.metric("Medium Risk", risk_counts.get("Medium Risk", 0))
c3.metric("Low Risk", risk_counts.get("Low Risk", 0))

high_risk_arr = df[df["Churn Risk"] == "High Risk"]["Renewal Target Amount"].sum()
med_risk_arr = df[df["Churn Risk"] == "Medium Risk"]["Renewal Target Amount"].sum()
st.caption(f"ARR at high risk: **${high_risk_arr:,.0f}**  ·  ARR at medium risk: **${med_risk_arr:,.0f}**")

# ── Accounts table ────────────────────────────────────────────────────────────

st.divider()
st.subheader("Accounts by Risk")

risk_filter = st.selectbox("Filter by risk tier", ["All", "High Risk", "Medium Risk", "Low Risk"])

view = df.copy()
if risk_filter != "All":
    view = view[view["Churn Risk"] == risk_filter]

display_cols = [
    "Organization", "License Type", "Customer Usage Health",
    "True Activation", "Renewal Target Amount", "Days to Renewal",
    "Churn Score", "Churn Risk",
]
if has_zd and "Support Tickets" in df.columns:
    display_cols.append("Support Tickets")

available = [c for c in display_cols if c in view.columns]
show = view[available].copy().sort_values("Churn Score", ascending=False)

if "True Activation" in show.columns:
    show["True Activation"] = show["True Activation"].map("{:.0%}".format)
if "Renewal Target Amount" in show.columns:
    show["Renewal Target Amount"] = show["Renewal Target Amount"].map("${:,.0f}".format)

RISK_COLORS = {
    "High Risk": "background-color: #FFCDD2",
    "Medium Risk": "background-color: #FFF9C4",
    "Low Risk": "background-color: #C8E6C9",
}

st.dataframe(
    show.style.applymap(lambda v: RISK_COLORS.get(v, ""), subset=["Churn Risk"]),
    use_container_width=True, height=480,
)

# ── Urgent: High risk + renewing soon ────────────────────────────────────────

st.divider()
st.subheader("Urgent: High Risk + Renewing Within 90 Days")

urgent = df[
    (df["Churn Risk"] == "High Risk") & (df["Days to Renewal"] <= 90)
][["Organization", "License Type", "Customer Usage Health",
   "True Activation", "Renewal Target Amount", "Days to Renewal", "Churn Score"]].copy()

urgent = urgent.sort_values("Days to Renewal")
if "True Activation" in urgent.columns:
    urgent["True Activation"] = urgent["True Activation"].map("{:.0%}".format)
if "Renewal Target Amount" in urgent.columns:
    urgent["Renewal Target Amount"] = urgent["Renewal Target Amount"].map("${:,.0f}".format)

if urgent.empty:
    st.success("No high-risk accounts renewing within 90 days.")
else:
    st.warning(f"{len(urgent)} account(s) need immediate attention.")
    st.dataframe(urgent, use_container_width=True, hide_index=True)
