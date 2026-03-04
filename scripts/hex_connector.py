"""
Hex Connector

Connects to Hex via the REST API to trigger project runs and pull results.
Replaces the manual CSV export step entirely.

Credentials:
    Add to .streamlit/secrets.toml (local) or Streamlit Cloud secrets:
        HEX_API_KEY = "your-hex-api-key"

    Or set environment variable:
        HEX_API_KEY = "your-hex-api-key"

How to get your Hex API key:
    Hex workspace → profile picture (bottom left) → Settings → API keys → Create key
"""

import io
import os
import time

import pandas as pd

try:
    import requests
    _REQUESTS_AVAILABLE = True
except ImportError:
    _REQUESTS_AVAILABLE = False

BASE_URL = "https://app.hex.tech/api/v1"

SETUP_MESSAGE = """
**Hex integration is not yet activated.**

To enable it:
1. In your Hex workspace → click your profile picture (bottom left) → **Settings**
2. Click **API keys** → **Create key** — copy it
3. Add to Streamlit Cloud → your app → **Settings** → **Secrets**:
```
HEX_API_KEY = "your-hex-api-key"
```
For local use, add to `expansion-scoring/.streamlit/secrets.toml`:
```toml
HEX_API_KEY = "your-hex-api-key"
```
"""


def is_available(api_key: str = None) -> bool:
    """Return True if requests is installed and a key is configured."""
    if not _REQUESTS_AVAILABLE:
        return False
    return bool(api_key or _get_key())


def _get_key() -> str:
    """Read API key from Streamlit secrets or environment."""
    try:
        import streamlit as st
        return st.secrets.get("HEX_API_KEY", "")
    except Exception:
        pass
    return os.environ.get("HEX_API_KEY", "")


def _headers(api_key: str = None) -> dict:
    key = api_key or _get_key()
    if not key:
        raise ValueError("Hex API key not configured.")
    return {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}


def test_connection(api_key: str = None) -> dict:
    """Test the API key by listing projects. Returns {"success": bool, "message": str}."""
    if not _REQUESTS_AVAILABLE:
        return {"success": False, "message": "requests package not available."}
    try:
        resp = requests.get(f"{BASE_URL}/project", headers=_headers(api_key), timeout=10)
        if resp.status_code == 200:
            count = len(resp.json().get("values", []))
            return {"success": True, "message": f"Connected successfully. {count} projects found."}
        elif resp.status_code == 401:
            return {"success": False, "message": "Invalid API key."}
        else:
            return {"success": False, "message": f"Error {resp.status_code}: {resp.text}"}
    except Exception as e:
        return {"success": False, "message": str(e)}


def list_projects(api_key: str = None) -> list:
    """Return a list of all Hex projects you have access to."""
    resp = requests.get(f"{BASE_URL}/project", headers=_headers(api_key), timeout=10)
    resp.raise_for_status()
    projects = resp.json().get("values", [])
    return [
        {
            "id": p.get("id"),
            "name": p.get("name"),
            "description": p.get("description", ""),
            "last_edited": p.get("lastEditedAt", ""),
        }
        for p in projects
    ]


def run_project(project_id: str, input_params: dict = None, api_key: str = None) -> str:
    """
    Trigger a Hex project run.

    Args:
        project_id:   The project ID (from the URL or list_projects())
        input_params: Optional dict of input parameter overrides
                      e.g. {"csm_name": "Fuzail Kadri"}

    Returns:
        run_id: The ID of the triggered run
    """
    payload = {"inputParams": input_params or {}}
    resp = requests.post(
        f"{BASE_URL}/project/{project_id}/run",
        headers=_headers(api_key),
        json=payload,
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json().get("runId") or resp.json().get("id")


def get_run_status(project_id: str, run_id: str, api_key: str = None) -> dict:
    """
    Check the status of a project run.

    Returns dict with keys: status, elapsedTime, traceId
    Status values: PENDING, RUNNING, COMPLETED, FAILED, KILLED
    """
    resp = requests.get(
        f"{BASE_URL}/project/{project_id}/run/{run_id}",
        headers=_headers(api_key),
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()


def wait_for_run(project_id: str, run_id: str, timeout_seconds: int = 120, api_key: str = None) -> dict:
    """
    Poll until the run completes or times out.

    Returns the final status dict.
    Raises TimeoutError if run doesn't complete within timeout_seconds.
    """
    start = time.time()
    while True:
        status = get_run_status(project_id, run_id, api_key)
        state = status.get("status", "UNKNOWN")

        if state == "COMPLETED":
            return status
        if state in ("FAILED", "KILLED"):
            raise RuntimeError(f"Hex run {state}: {status}")
        if time.time() - start > timeout_seconds:
            raise TimeoutError(f"Hex run did not complete within {timeout_seconds}s.")

        time.sleep(3)


def get_run_results_url(project_id: str, run_id: str, api_key: str = None) -> str:
    """Return the download URL for a completed run's output."""
    resp = requests.get(
        f"{BASE_URL}/project/{project_id}/run/{run_id}/export",
        headers=_headers(api_key),
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json().get("url")


def run_and_fetch(
    project_id: str,
    input_params: dict = None,
    timeout_seconds: int = 120,
    api_key: str = None,
) -> pd.DataFrame:
    """
    One-shot: trigger a run, wait for completion, and return results as a DataFrame.

    Args:
        project_id:      Hex project ID
        input_params:    Optional parameter overrides (e.g. CSM name filter)
        timeout_seconds: How long to wait before giving up

    Returns:
        DataFrame with the project's output data
    """
    run_id = run_project(project_id, input_params, api_key)
    wait_for_run(project_id, run_id, timeout_seconds, api_key)

    # Try export endpoint first
    try:
        url = get_run_results_url(project_id, run_id, api_key)
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        return pd.read_csv(io.StringIO(resp.text))
    except Exception:
        pass

    # Fallback: return status metadata as a minimal DataFrame
    return pd.DataFrame([{"run_id": run_id, "status": "COMPLETED", "note": "Export not available for this project."}])


def cancel_run(project_id: str, run_id: str, api_key: str = None) -> bool:
    """Cancel an in-progress run. Returns True if successful."""
    try:
        resp = requests.delete(
            f"{BASE_URL}/project/{project_id}/run/{run_id}",
            headers=_headers(api_key),
            timeout=10,
        )
        return resp.status_code in (200, 204)
    except Exception:
        return False
