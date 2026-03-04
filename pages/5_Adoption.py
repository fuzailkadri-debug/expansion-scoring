"""
Adoption — Seat utilisation and product engagement across the book.
"""

import sys
from pathlib import Path

import pandas as pd
import streamlit as st

sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))

st.set_page_config(page_title="Adoption", page_icon="📱", layout="wide")
st.title("📱 Adoption & Seat Utilisation")

if "data" not in st.session_state:
    st.warning("No data loaded. Go to the Home page and upload your Salesforce CSV.")
    st.stop()

df = st.session_state["data"]

# ── Adoption buckets ──────────────────────────────────────────────────────────

st.subheader("Seat Activation Rate Distribution")

bins = [0, 0.5, 0.7, 0.8, 0.9, 1.0, float("inf")]
labels = ["<50%", "50–70%", "70–80%", "80–90%", "90–100%", ">100% (over-filled)"]

df["Activation Bucket"] = pd.cut(df["True Activation"], bins=bins, labels=labels, right=False)
bucket_counts = df["Activation Bucket"].value_counts().reindex(labels).dropna()

cols = st.columns(len(labels))
for col, (label, count) in zip(cols, bucket_counts.items()):
    col.metric(label, int(count))

# ── Book-wide averages ────────────────────────────────────────────────────────

st.divider()
st.subheader("Adoption by License Type")

avg_by_lt = df.groupby("License Type").agg(
    Accounts=("Organization", "count"),
    Avg_Activation=("True Activation", "mean"),
    Avg_ARR=("Renewal Target Amount", "mean"),
).reset_index()
avg_by_lt["Avg_Activation"] = avg_by_lt["Avg_Activation"].map("{:.0%}".format)
avg_by_lt["Avg_ARR"] = avg_by_lt["Avg_ARR"].map("${:,.0f}".format)
avg_by_lt.columns = ["License Type", "Accounts", "Avg Activation", "Avg ARR"]

st.dataframe(avg_by_lt, use_container_width=True, hide_index=True)

# ── Low adoption accounts ─────────────────────────────────────────────────────

st.divider()
st.subheader("Low Adoption Accounts (< 70% activation)")

low_adoption = df[df["True Activation"] < 0.70].sort_values("True Activation")

show_cols = ["Organization", "License Type", "Customer Usage Health",
             "True Activation", "Renewal Target Amount", "Days to Renewal", "Churn Risk"]
available = [c for c in show_cols if c in low_adoption.columns]
show = low_adoption[available].copy()
if "True Activation" in show.columns:
    show["True Activation"] = show["True Activation"].map("{:.0%}".format)
if "Renewal Target Amount" in show.columns:
    show["Renewal Target Amount"] = show["Renewal Target Amount"].map("${:,.0f}".format)

st.caption(f"{len(low_adoption)} accounts with < 70% seat activation.")
st.dataframe(show, use_container_width=True, height=400, hide_index=True)

# ── Health vs Activation overview ─────────────────────────────────────────────

st.divider()
st.subheader("Health vs. Activation — Full Book")

cross = df.groupby(["Customer Usage Health", "Activation Bucket"]).size().reset_index(name="Count")
cross_pivot = cross.pivot(index="Customer Usage Health", columns="Activation Bucket", values="Count").fillna(0).astype(int)

health_order = ["Extra Green", "Green", "Yellow", "Red", ""]
cross_pivot = cross_pivot.reindex([h for h in health_order if h in cross_pivot.index])

st.dataframe(cross_pivot, use_container_width=True)
st.caption("Rows = health status · Columns = seat activation bucket · Values = account count")
