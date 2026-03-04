"""
AI Insights — Chat with your CS data using Claude.
"""

import sys
from pathlib import Path

import streamlit as st

sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))
from ai_insights import is_available, ask, SETUP_MESSAGE

st.set_page_config(page_title="AI Insights", page_icon="🤖", layout="wide")
st.title("🤖 AI Insights")
st.caption("Ask questions about your book of business. Claude reads your data and responds with analysis.")

# ── Guard: no data loaded ─────────────────────────────────────────────────────

if "data" not in st.session_state:
    st.warning("No data loaded. Go to the Home page and upload your Salesforce CSV.")
    st.stop()

df = st.session_state["data"]

# ── Guard: API not configured ─────────────────────────────────────────────────

if not is_available():
    st.info(SETUP_MESSAGE)

    st.divider()
    st.subheader("Questions you'll be able to ask once activated")
    example_qs = [
        "Which accounts should I prioritise this week?",
        "What's my total ARR at risk from churn?",
        "Which Tier 1 accounts are also high churn risk?",
        "Summarise my renewal exposure for the next 60 days.",
        "Which accounts have the most free users but low expansion scores?",
        "Write a QBR summary of my book.",
        "Which accounts should I focus on for expansion this quarter?",
        "What patterns do you see in my Red health accounts?",
    ]
    for q in example_qs:
        st.markdown(f"- *{q}*")
    st.stop()

# ── Chat interface ────────────────────────────────────────────────────────────

# Initialise session state for chat history
if "chat_history" not in st.session_state:
    st.session_state["chat_history"] = []
if "display_history" not in st.session_state:
    st.session_state["display_history"] = []

# Suggested starter questions
if not st.session_state["display_history"]:
    st.subheader("Suggested questions")
    starters = [
        "Which accounts should I prioritise this week?",
        "What's my total ARR at churn risk?",
        "Which Tier 1 accounts are also high churn risk?",
        "Summarise my renewal exposure for the next 60 days.",
        "Write a QBR summary of my book.",
    ]
    cols = st.columns(len(starters))
    for col, q in zip(cols, starters):
        if col.button(q, use_container_width=True):
            st.session_state["_prefill"] = q
            st.rerun()

st.divider()

# Render chat history
for msg in st.session_state["display_history"]:
    with st.chat_message(msg["role"]):
        st.markdown(msg["content"])

# Chat input
prefill = st.session_state.pop("_prefill", "")
question = st.chat_input("Ask anything about your book of business…", key="chat_input")

if prefill and not question:
    question = prefill

if question:
    # Show user message
    with st.chat_message("user"):
        st.markdown(question)

    # Get Claude response
    with st.chat_message("assistant"):
        with st.spinner("Analysing your data…"):
            response = ask(
                question=question,
                df=df,
                history=st.session_state["chat_history"],
            )
        st.markdown(response)

    # Update histories
    st.session_state["display_history"].append({"role": "user", "content": question})
    st.session_state["display_history"].append({"role": "assistant", "content": response})
    st.session_state["chat_history"].append({"role": "user", "content": question})
    st.session_state["chat_history"].append({"role": "assistant", "content": response})

# Clear chat button
if st.session_state["display_history"]:
    if st.button("Clear conversation"):
        st.session_state["chat_history"] = []
        st.session_state["display_history"] = []
        st.rerun()
