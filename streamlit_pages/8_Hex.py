"""
Hex Integration — Trigger project runs and pull free-user data automatically.
"""

import io
import sys
from pathlib import Path

import streamlit as st

sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))
from hex_connector import (
    is_available, test_connection, list_projects,
    run_project, wait_for_run, run_and_fetch, cancel_run,
    SETUP_MESSAGE, _get_key,
)
from generate_scoring import load_hex_data

st.set_page_config(page_title="Hex", page_icon="⬡", layout="wide")
st.title("⬡ Hex Integration")
st.caption("Trigger your free-user project directly from here — no manual CSV export needed.")

# ── Guard: not configured ─────────────────────────────────────────────────────

if not is_available():
    st.info(SETUP_MESSAGE)
    st.stop()

api_key = _get_key()

# ── Connection status ─────────────────────────────────────────────────────────

with st.expander("Connection", expanded=False):
    if st.button("Test Connection"):
        result = test_connection(api_key)
        if result["success"]:
            st.success(result["message"])
        else:
            st.error(result["message"])

# ── Run free-user project ─────────────────────────────────────────────────────

st.subheader("Run Free-User Project")
st.caption(
    "Enter the Project ID of your free-user Hex project. "
    "Find it in the project URL: `app.hex.tech/your-workspace/hex/**PROJECT-ID**/app`"
)

project_id = st.text_input("Project ID", placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx")

with st.expander("Optional: pass input parameters to the project", expanded=False):
    st.caption("Use this to filter results to your CSM name or a specific date range, if your Hex project supports input parameters.")
    param_key = st.text_input("Parameter name", placeholder="e.g. csm_name")
    param_val = st.text_input("Parameter value", placeholder="e.g. Fuzail Kadri")
    input_params = {param_key: param_val} if param_key and param_val else {}

timeout = st.slider("Timeout (seconds)", min_value=30, max_value=300, value=120, step=30)

if st.button("▶  Run Project", type="primary", disabled=not project_id):
    with st.spinner("Triggering Hex run…"):
        try:
            run_id = run_project(project_id, input_params or {}, api_key)
            st.session_state["hex_run_id"] = run_id
            st.session_state["hex_project_id"] = project_id
            st.info(f"Run started — ID: `{run_id}`")
        except Exception as e:
            st.error(f"Failed to start run: {e}")
            st.stop()

    with st.spinner("Waiting for run to complete…"):
        try:
            status = wait_for_run(project_id, run_id, timeout, api_key)
            st.success(f"Run completed in {status.get('elapsedTime', '?')}ms.")
        except TimeoutError:
            st.warning(f"Run timed out after {timeout}s. It may still be running in Hex.")
            if st.button("Cancel run"):
                cancel_run(project_id, run_id, api_key)
            st.stop()
        except RuntimeError as e:
            st.error(str(e))
            st.stop()

    with st.spinner("Fetching results…"):
        try:
            from hex_connector import get_run_results_url
            import requests
            import pandas as pd

            url = get_run_results_url(project_id, run_id, api_key)
            resp = requests.get(url, timeout=30)
            resp.raise_for_status()
            raw_df = pd.read_csv(io.StringIO(resp.text))
            st.session_state["hex_raw_df"] = raw_df
            st.success(f"Downloaded {len(raw_df)} rows from Hex.")
        except Exception as e:
            st.error(f"Could not fetch results: {e}")

# ── Preview + load into app ───────────────────────────────────────────────────

if "hex_raw_df" in st.session_state:
    raw_df = st.session_state["hex_raw_df"]

    st.divider()
    st.subheader("Preview")
    st.dataframe(raw_df.head(20), use_container_width=True, hide_index=True)

    col1, col2 = st.columns(2)

    with col1:
        if st.button("Load into app as Hex data", type="primary"):
            try:
                # Convert to the format generate_scoring expects
                csv_buf = io.StringIO()
                raw_df.to_csv(csv_buf, index=False)
                csv_buf.seek(0)
                hex_df = load_hex_data(io.BytesIO(csv_buf.getvalue().encode()))
                st.session_state["hex_df"] = hex_df
                st.session_state["has_hex"] = True

                # Re-score if main data is loaded
                if "data" in st.session_state:
                    from generate_scoring import merge_data, calculate_scores
                    from churn_scoring import calculate_churn_scores

                    sf_base = st.session_state["data"].drop(
                        columns=["Free Users", "Free User Pts", "Total Score", "Tier",
                                 "Churn Score", "Churn Risk", "Churn Health Pts",
                                 "Churn Activation Pts", "Churn Renewal Pts",
                                 "License Pts", "Health Pts", "Activation Pts",
                                 "ARR Pts", "Renewal Pts"],
                        errors="ignore"
                    )
                    merged = merge_data(sf_base, hex_df)
                    scored = calculate_scores(merged)
                    full = calculate_churn_scores(scored, None)
                    st.session_state["data"] = full
                    st.success("Hex data loaded and scores refreshed across all pages.")
                else:
                    st.success("Hex data saved. Go to Home to load your Salesforce data and run scoring.")
            except Exception as e:
                st.error(f"Failed to load into app: {e}")

    with col2:
        csv_out = raw_df.to_csv(index=False)
        st.download_button(
            "⬇️  Download CSV",
            data=csv_out,
            file_name="hex_free_users.csv",
            mime="text/csv",
        )

# ── Browse projects ───────────────────────────────────────────────────────────

st.divider()
st.subheader("Browse Your Hex Projects")
st.caption("Use this to find the Project ID for your free-user project.")

if st.button("List projects"):
    with st.spinner("Fetching…"):
        try:
            import pandas as pd
            projects = list_projects(api_key)
            if projects:
                st.dataframe(pd.DataFrame(projects), use_container_width=True, hide_index=True)
            else:
                st.info("No projects found.")
        except Exception as e:
            st.error(f"Failed: {e}")
