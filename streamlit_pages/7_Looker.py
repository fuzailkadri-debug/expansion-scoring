"""
Looker — Connect to Looker to pull data directly into the app.
"""

import sys
from pathlib import Path

import streamlit as st

sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))
from looker_connector import is_available, test_connection, get_all_looks, run_look

st.set_page_config(page_title="Looker", page_icon="📡", layout="wide")
st.title("📡 Looker Integration")
st.caption("Connect to Looker to pull data directly — no CSV export needed.")

if not is_available():
    st.info("""
**`looker-sdk` is not installed yet.**

To enable Looker integration:
1. Uncomment `looker-sdk` in `requirements.txt`
2. Push to GitHub — Streamlit will redeploy with it installed
3. Add your credentials in Streamlit Cloud → Settings → Secrets:
```
LOOKER_BASE_URL = "https://your-company.looker.com"
LOOKER_CLIENT_ID = "your-client-id"
LOOKER_CLIENT_SECRET = "your-client-secret"
```
""")
    st.stop()

# ── Credentials form ──────────────────────────────────────────────────────────

st.subheader("Credentials")
st.caption("Stored only for this session. Add to Streamlit secrets to skip this step.")

with st.expander("Enter Looker credentials", expanded=True):
    col1, col2 = st.columns(2)
    with col1:
        base_url = st.text_input("Looker URL", placeholder="https://your-company.looker.com")
        client_id = st.text_input("Client ID")
    with col2:
        client_secret = st.text_input("Client Secret", type="password")

    col_test, _ = st.columns([1, 3])
    with col_test:
        if st.button("Test Connection"):
            if not all([base_url, client_id, client_secret]):
                st.error("Fill in all fields first.")
            else:
                result = test_connection(base_url, client_id, client_secret)
                if result["success"]:
                    st.success(result["message"])
                    st.session_state["looker_creds"] = {
                        "base_url": base_url,
                        "client_id": client_id,
                        "client_secret": client_secret,
                    }
                else:
                    st.error(result["message"])

# ── Pull a Look ───────────────────────────────────────────────────────────────

if "looker_creds" not in st.session_state:
    st.info("Test your connection above to continue.")
    st.stop()

creds = st.session_state["looker_creds"]

st.divider()
st.subheader("Pull Data from a Saved Look")
st.caption("Find the Look ID in the URL when you open a Look in Looker (e.g. looker.com/looks/**123**)")

look_id = st.number_input("Look ID", min_value=1, step=1)

if st.button("Load Look", type="primary"):
    with st.spinner("Fetching from Looker…"):
        try:
            df = run_look(int(look_id), **creds)
            st.session_state["looker_data"] = df
            st.success(f"Loaded {len(df)} rows.")
        except Exception as e:
            st.error(f"Failed: {e}")

if "looker_data" in st.session_state:
    st.dataframe(st.session_state["looker_data"], use_container_width=True)

    csv = st.session_state["looker_data"].to_csv(index=False)
    st.download_button("⬇️ Download as CSV", data=csv, file_name="looker_export.csv", mime="text/csv")

# ── Browse available Looks ────────────────────────────────────────────────────

st.divider()
st.subheader("Browse Your Saved Looks")

if st.button("List all Looks"):
    with st.spinner("Fetching…"):
        try:
            looks = get_all_looks(**creds)
            import pandas as pd
            st.dataframe(pd.DataFrame(looks), use_container_width=True, hide_index=True)
        except Exception as e:
            st.error(f"Failed: {e}")
