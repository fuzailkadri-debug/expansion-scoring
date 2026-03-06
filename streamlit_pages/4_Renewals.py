"""
Renewals — Pipeline by window, urgency flags, and renewal-only expansion.
"""

import sys
from pathlib import Path

import pandas as pd
import streamlit as st

sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))

st.set_page_config(page_title="Renewals", page_icon="🔄", layout="wide")
st.title("🔄 Renewal Pipeline")

if "data" not in st.session_state:
    st.warning("No data loaded. Go to the Home page and upload your Salesforce CSV.")
    st.stop()

df = st.session_state["data"]

RENEWAL_ONLY = ["Defined Group", "Sitewide"]

# ── Summary ───────────────────────────────────────────────────────────────────

st.subheader("Upcoming Renewals")

windows = [
    ("0–30 days",  0,  30),
    ("31–60 days", 31, 60),
    ("61–90 days", 61, 90),
    ("91–180 days",91,180),
]

cols = st.columns(4)
for col, (label, lo, hi) in zip(cols, windows):
    count = len(df[(df["Days to Renewal"] >= lo) & (df["Days to Renewal"] <= hi)])
    arr = df[(df["Days to Renewal"] >= lo) & (df["Days to Renewal"] <= hi)]["Renewal Target Amount"].sum()
    col.metric(label, count, f"${arr:,.0f} ARR")

# ── Renewal-only expansion flag ───────────────────────────────────────────────

st.divider()
st.subheader("Renewal-Only Expansion Opportunities (DG / Sitewide)")

dg_sw = df[df["License Type"].isin(RENEWAL_ONLY)].copy()
dg_sw_urgent = dg_sw[dg_sw["Days to Renewal"] <= 90].sort_values("Days to Renewal")

st.caption(
    f"**{len(dg_sw)}** Defined Group / Sitewide accounts — "
    f"**{len(dg_sw_urgent)}** renewing within 90 days. "
    "These can ONLY expand at renewal — missing the window means waiting a full year."
)

show_cols = ["Organization", "License Type", "Customer Usage Health",
             "True Activation", "Renewal Target Amount", "Days to Renewal", "Tier"]
available = [c for c in show_cols if c in dg_sw.columns]

window_filter = st.selectbox("Renewal window", ["All", "0–30 days", "31–60 days", "61–90 days", "91–180 days"])

window_map = {
    "0–30 days":  (0,  30),
    "31–60 days": (31, 60),
    "61–90 days": (61, 90),
    "91–180 days":(91,180),
}

view = dg_sw.copy()
if window_filter != "All":
    lo, hi = window_map[window_filter]
    view = view[(view["Days to Renewal"] >= lo) & (view["Days to Renewal"] <= hi)]

show = view[available].copy().sort_values("Days to Renewal")
if "True Activation" in show.columns:
    show["True Activation"] = show["True Activation"].map("{:.0%}".format)
if "Renewal Target Amount" in show.columns:
    show["Renewal Target Amount"] = show["Renewal Target Amount"].map("${:,.0f}".format)

st.dataframe(show, use_container_width=True, height=400, hide_index=True)

# ── All upcoming renewals ─────────────────────────────────────────────────────

st.divider()
st.subheader("All Upcoming Renewals (Next 180 Days)")

upcoming = df[df["Days to Renewal"] <= 180].sort_values("Days to Renewal")
show2_cols = ["Organization", "License Type", "Customer Usage Health",
              "Renewal Target Amount", "Days to Renewal", "Churn Risk", "Tier"]
available2 = [c for c in show2_cols if c in upcoming.columns]
show2 = upcoming[available2].copy()
if "Renewal Target Amount" in show2.columns:
    show2["Renewal Target Amount"] = show2["Renewal Target Amount"].map("${:,.0f}".format)

st.dataframe(show2, use_container_width=True, height=400, hide_index=True)
