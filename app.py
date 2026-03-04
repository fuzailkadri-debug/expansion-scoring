"""
CS Intelligence Tool — Home / Data Upload

Upload your data sources here. All pages share the processed data.
Salesforce API integration is built-in and ready to activate when you have credentials.
"""

import io
import sys
from pathlib import Path

import pandas as pd
import streamlit as st

sys.path.insert(0, str(Path(__file__).parent / "scripts"))
from generate_scoring import load_salesforce_data, load_hex_data, merge_data, calculate_scores
from churn_scoring import calculate_churn_scores
from salesforce_connector import is_available as sf_api_available, fetch_salesforce_data, test_connection

# ── Page config ───────────────────────────────────────────────────────────────

st.set_page_config(
    page_title="CS Intelligence",
    page_icon="🧠",
    layout="wide",
)

st.title("🧠 CS Intelligence Tool")
st.caption("Book-of-business intelligence: expansion, churn risk, adoption, and renewals.")
st.divider()

# ── Salesforce data source ────────────────────────────────────────────────────

st.subheader("1. Salesforce Data")

sf_source = st.radio(
    "How would you like to load Salesforce data?",
    ["Upload CSV (manual)", "Connect via Salesforce API"],
    horizontal=True,
    help="API connection pulls data automatically. Manual upload works today without credentials.",
)

sf_df = None

# ── Option A: Manual CSV upload ───────────────────────────────────────────────

if sf_source == "Upload CSV (manual)":
    sf_file = st.file_uploader(
        "Upload your Salesforce export CSV",
        type=["csv"],
        key="sf_upload",
        help="Export from Salesforce: Opportunity Name · ARR · Renewal Date · "
             "Health · License Type · Seat fields.",
    )
    if sf_file:
        with st.spinner("Loading Salesforce data…"):
            sf_df = load_salesforce_data(io.BytesIO(sf_file.read()))
        st.success(f"Loaded {len(sf_df)} opportunities from CSV.")

# ── Option B: Salesforce API ──────────────────────────────────────────────────

else:
    if not sf_api_available():
        st.warning(
            "`simple-salesforce` is not installed. Run `pip install simple-salesforce` "
            "then restart the app to enable API access."
        )
    else:
        with st.expander("Enter Salesforce credentials", expanded=True):
            st.caption(
                "Credentials are used only for this session and are never stored. "
                "You need a Salesforce Connected App with API access enabled."
            )
            col_a, col_b = st.columns(2)
            with col_a:
                sf_username = st.text_input("Username (email)", placeholder="you@company.com")
                sf_password = st.text_input("Password", type="password")
            with col_b:
                sf_token = st.text_input("Security Token", type="password",
                    help="Found in Salesforce → Settings → Reset My Security Token")
                sf_domain = st.selectbox("Environment", ["login", "test"],
                    help="Use 'test' for sandbox orgs")
                sf_owner = st.text_input("CSM Name (optional)",
                    placeholder="e.g. Fuzail Kadri",
                    help="Filter to your opportunities only. Leave blank to pull all renewal opps.")

            col_test, col_pull = st.columns([1, 2])
            with col_test:
                if st.button("Test Connection"):
                    if not all([sf_username, sf_password, sf_token]):
                        st.error("Fill in all credential fields first.")
                    else:
                        result = test_connection(sf_username, sf_password, sf_token, sf_domain)
                        if result["success"]:
                            st.success(result["message"])
                        else:
                            st.error(result["message"])

            with col_pull:
                if st.button("Pull Data from Salesforce", type="primary"):
                    if not all([sf_username, sf_password, sf_token]):
                        st.error("Fill in all credential fields first.")
                    else:
                        with st.spinner("Connecting to Salesforce…"):
                            try:
                                raw = fetch_salesforce_data(
                                    username=sf_username,
                                    password=sf_password,
                                    security_token=sf_token,
                                    domain=sf_domain,
                                    owner_name=sf_owner or None,
                                )
                                sf_df = load_salesforce_data(raw)
                                st.session_state["_sf_raw"] = raw
                                st.success(f"Pulled {len(sf_df)} opportunities from Salesforce.")
                            except Exception as e:
                                st.error(f"Failed to connect: {e}")

        # Restore previously pulled data across reruns
        if sf_df is None and "_sf_raw" in st.session_state:
            sf_df = load_salesforce_data(st.session_state["_sf_raw"])
            st.info(f"Using previously pulled data — {len(sf_df)} opportunities.")

# ── Hex upload (optional) ─────────────────────────────────────────────────────

st.divider()
st.subheader("2. Hex Free-User Export *(optional)*")
st.caption("Unlocks expansion scoring and free-user opportunity signals.")

hex_file = st.file_uploader("Upload Hex CSV", type=["csv"], key="hex_upload")

if hex_file:
    hex_df = load_hex_data(io.BytesIO(hex_file.read()))
    st.success(f"Loaded Hex data — {len(hex_df)} rows.")
else:
    hex_df = pd.DataFrame(columns=["opportunity_name", "total_free_users"])

# ── Zendesk upload (optional) ─────────────────────────────────────────────────

st.divider()
st.subheader("3. Zendesk Export *(optional)*")
st.caption("Adds support-ticket volume to churn risk analysis.")

zd_file = st.file_uploader("Upload Zendesk CSV", type=["csv"], key="zd_upload")
zd_df = pd.read_csv(zd_file) if zd_file else None

# ── Process ───────────────────────────────────────────────────────────────────

st.divider()

if sf_df is None:
    st.info("Load your Salesforce data above (CSV upload or API) to get started.")
    st.stop()

with st.spinner("Scoring accounts…"):
    merged = merge_data(sf_df, hex_df)
    scored = calculate_scores(merged)
    full = calculate_churn_scores(scored, zd_df)

    st.session_state["data"] = full
    st.session_state["has_hex"] = hex_file is not None
    st.session_state["has_zendesk"] = zd_file is not None

# ── Quick stats ───────────────────────────────────────────────────────────────

df = st.session_state["data"]

st.subheader("Book at a Glance")

total_arr = df["Renewal Target Amount"].sum()
c1, c2, c3, c4, c5 = st.columns(5)
c1.metric("Total Accounts", len(df))
c2.metric("Total ARR", f"${total_arr:,.0f}")
c3.metric("Expansion Tier 1", (df["Tier"] == "Tier 1").sum())
c4.metric("High Churn Risk", (df["Churn Risk"] == "High Risk").sum())
c5.metric("Renewing ≤ 90 days", (df["Days to Renewal"] <= 90).sum())

st.divider()
st.success("Data loaded. Use the sidebar to explore **Book Overview**, **Expansion**, **Churn Risk**, **Renewals**, and **Adoption**.")
