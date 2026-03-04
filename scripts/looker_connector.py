"""
Looker Connector

Pulls data directly from Looker using the Looker Python SDK.
Requires `looker-sdk` package and API credentials.

Credentials can be passed directly or set via environment variables:
    LOOKER_BASE_URL      e.g. https://your-company.looker.com
    LOOKER_CLIENT_ID
    LOOKER_CLIENT_SECRET

Or stored in .streamlit/secrets.toml:
    LOOKER_BASE_URL = "https://..."
    LOOKER_CLIENT_ID = "..."
    LOOKER_CLIENT_SECRET = "..."
"""

import os
import pandas as pd

try:
    import looker_sdk
    from looker_sdk import models40 as models
    _LOOKER_AVAILABLE = True
except ImportError:
    _LOOKER_AVAILABLE = False


def is_available() -> bool:
    return _LOOKER_AVAILABLE


def _get_credentials() -> dict:
    """Read Looker credentials from Streamlit secrets or environment variables."""
    creds = {}
    try:
        import streamlit as st
        creds["base_url"] = st.secrets.get("LOOKER_BASE_URL", "")
        creds["client_id"] = st.secrets.get("LOOKER_CLIENT_ID", "")
        creds["client_secret"] = st.secrets.get("LOOKER_CLIENT_SECRET", "")
    except Exception:
        pass

    # Fall back to environment variables
    creds["base_url"] = creds.get("base_url") or os.environ.get("LOOKER_BASE_URL", "")
    creds["client_id"] = creds.get("client_id") or os.environ.get("LOOKER_CLIENT_ID", "")
    creds["client_secret"] = creds.get("client_secret") or os.environ.get("LOOKER_CLIENT_SECRET", "")

    return creds


def _init_sdk(base_url: str = None, client_id: str = None, client_secret: str = None):
    """Initialise and return the Looker SDK client."""
    if not _LOOKER_AVAILABLE:
        raise ImportError("looker-sdk is not installed. Run: pip install looker-sdk")

    creds = _get_credentials()
    base_url = base_url or creds["base_url"]
    client_id = client_id or creds["client_id"]
    client_secret = client_secret or creds["client_secret"]

    if not all([base_url, client_id, client_secret]):
        raise ValueError(
            "Looker credentials missing. Set LOOKER_BASE_URL, LOOKER_CLIENT_ID, "
            "and LOOKER_CLIENT_SECRET in Streamlit secrets or environment variables."
        )

    # Configure SDK via environment (looker-sdk reads these automatically)
    os.environ["LOOKERSDK_BASE_URL"] = base_url
    os.environ["LOOKERSDK_CLIENT_ID"] = client_id
    os.environ["LOOKERSDK_CLIENT_SECRET"] = client_secret

    return looker_sdk.init40()


def test_connection(base_url: str = None, client_id: str = None, client_secret: str = None) -> dict:
    """Test Looker credentials. Returns {"success": bool, "message": str}."""
    if not _LOOKER_AVAILABLE:
        return {"success": False, "message": "looker-sdk not installed."}
    try:
        sdk = _init_sdk(base_url, client_id, client_secret)
        me = sdk.me()
        return {"success": True, "message": f"Connected as {me.display_name} ({me.email})"}
    except Exception as e:
        return {"success": False, "message": str(e)}


def run_look(look_id: int, base_url: str = None, client_id: str = None, client_secret: str = None) -> pd.DataFrame:
    """
    Run a saved Look by ID and return results as a DataFrame.

    Args:
        look_id: The numeric ID of the Look (found in the Look's URL)
    """
    sdk = _init_sdk(base_url, client_id, client_secret)
    result = sdk.run_look(look_id=look_id, result_format="csv")
    import io
    return pd.read_csv(io.StringIO(result))


def run_explore_query(
    model: str,
    explore: str,
    fields: list,
    filters: dict = None,
    limit: int = 5000,
    base_url: str = None,
    client_id: str = None,
    client_secret: str = None,
) -> pd.DataFrame:
    """
    Run an ad-hoc Looker explore query and return results as a DataFrame.

    Args:
        model:   Looker model name (e.g. "salesforce")
        explore: Explore name (e.g. "opportunity")
        fields:  List of field names (e.g. ["opportunity.name", "opportunity.arr"])
        filters: Dict of filter conditions (e.g. {"opportunity.stage": "Open"})
        limit:   Max rows to return
    """
    sdk = _init_sdk(base_url, client_id, client_secret)

    query = sdk.create_query(
        body=models.WriteQuery(
            model=model,
            view=explore,
            fields=fields,
            filters=filters or {},
            limit=str(limit),
        )
    )

    result = sdk.run_query(query_id=query.id, result_format="csv")
    import io
    return pd.read_csv(io.StringIO(result))


def get_all_looks(base_url: str = None, client_id: str = None, client_secret: str = None) -> list:
    """Return a list of all saved Looks the user has access to."""
    sdk = _init_sdk(base_url, client_id, client_secret)
    looks = sdk.all_looks()
    return [{"id": l.id, "title": l.title, "folder": l.folder.name if l.folder else ""} for l in looks]
