"""
Expansion — Scored accounts with download.
"""

import io
import sys
from pathlib import Path

import streamlit as st

sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))
from generate_scoring import create_excel, TIER_THRESHOLDS

st.set_page_config(page_title="Expansion", page_icon="🚀", layout="wide")
st.title("🚀 Expansion Opportunities")

if "data" not in st.session_state:
    st.warning("No data loaded. Go to the Home page and upload your Salesforce CSV.")
    st.stop()

df = st.session_state["data"]
has_hex = st.session_state.get("has_hex", False)

if not has_hex:
    st.info("Hex data not uploaded — Free User scores will be 0. Upload on the Home page for full scoring.")

# ── Tier summary ──────────────────────────────────────────────────────────────

st.subheader("Tier Breakdown")
tier_cols = st.columns(5)
labels = ["Tier 1", "Tier 2", "Tier 3", "Below Threshold", "Need Hex Data"]
tier_counts = df["Tier"].value_counts()
for col, label in zip(tier_cols, labels):
    col.metric(label, tier_counts.get(label, 0))

# ── Filtered table ────────────────────────────────────────────────────────────

st.divider()
st.subheader("Scored Accounts")

tier_options = ["All"] + [t for _, t in TIER_THRESHOLDS] + ["Need Hex Data"]
selected_tier = st.selectbox("Filter by tier", tier_options)

track = st.selectbox("Filter by track", ["All", "Anytime Expansion", "Renewal-Only"])

ANYTIME = ["Named User", "Named User (Chargeback)", "Right to Deploy"]
RENEWAL_ONLY = ["Defined Group", "Sitewide"]

view = df.copy()
if selected_tier != "All":
    view = view[view["Tier"] == selected_tier]
if track == "Anytime Expansion":
    view = view[view["License Type"].isin(ANYTIME)]
elif track == "Renewal-Only":
    view = view[view["License Type"].isin(RENEWAL_ONLY)]

display_cols = [
    "Organization", "License Type", "Customer Usage Health",
    "True Activation", "Renewal Target Amount", "Days to Renewal",
    "Free Users", "Total Score", "Tier",
]
available = [c for c in display_cols if c in view.columns]
show = view[available].copy()

if "True Activation" in show.columns:
    show["True Activation"] = show["True Activation"].map("{:.0%}".format)
if "Renewal Target Amount" in show.columns:
    show["Renewal Target Amount"] = show["Renewal Target Amount"].map("${:,.0f}".format)

TIER_COLORS = {
    "Tier 1": "background-color: #C8E6C9",
    "Tier 2": "background-color: #FFF9C4",
    "Tier 3": "background-color: #FFCCBC",
    "Below Threshold": "background-color: #F5F5F5",
    "Need Hex Data": "background-color: #F5F5F5",
}

st.dataframe(
    show.style.applymap(lambda v: TIER_COLORS.get(v, ""), subset=["Tier"]),
    use_container_width=True, height=460,
)

# ── Download ──────────────────────────────────────────────────────────────────

st.divider()
buf = io.BytesIO()
create_excel(df, buf)
buf.seek(0)
st.download_button(
    "⬇️  Download expansion-scoring.xlsx",
    data=buf,
    file_name="expansion-scoring.xlsx",
    mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
)
