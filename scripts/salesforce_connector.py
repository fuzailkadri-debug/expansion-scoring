"""
Salesforce Connector

Pulls opportunity data directly from Salesforce via the REST API.
Requires the `simple-salesforce` package and a Connected App with API access.

Usage:
    from salesforce_connector import fetch_salesforce_data
    df = fetch_salesforce_data(username, password, security_token, domain)

Environment variables (alternative to passing credentials directly):
    SF_USERNAME
    SF_PASSWORD
    SF_SECURITY_TOKEN
    SF_DOMAIN          (default: "login" — use "test" for sandboxes)
"""

import os
import pandas as pd

try:
    from simple_salesforce import Salesforce, SalesforceAuthenticationFailed
    _SF_AVAILABLE = True
except ImportError:
    _SF_AVAILABLE = False


# Fields to pull from the Opportunity object.
# Adjust if your org uses different field API names.
OPPORTUNITY_FIELDS = [
    "Name",                          # Opportunity Name
    "Amount",                        # ARR proxy (or use a custom field)
    "CloseDate",                     # Renewal Date proxy
    "Customer_Usage_Health__c",      # Custom field — adjust name if different
    "License_Type__c",               # Custom field
    "Current_Seats_Available__c",    # Custom field
    "Seats_Filled__c",               # Custom field
    "Initial_Seats__c",              # Custom field
    "Seat_Activation_Rate__c",       # Custom field
    "Active_Users_Last_90_Days__c",  # Custom field
    "OwnerId",
]

# SOQL query template — filters to open renewal opportunities for the current user.
# Adjust the WHERE clause to match your org's stage/record type naming.
SOQL_TEMPLATE = """
SELECT {fields}
FROM Opportunity
WHERE IsClosed = false
  AND StageName LIKE '%Renewal%'
  AND Owner.Name = '{owner_name}'
ORDER BY CloseDate ASC
""".strip()


def is_available() -> bool:
    """Return True if simple-salesforce is installed."""
    return _SF_AVAILABLE


def fetch_salesforce_data(
    username: str = None,
    password: str = None,
    security_token: str = None,
    domain: str = None,
    owner_name: str = None,
) -> pd.DataFrame:
    """
    Connect to Salesforce and return opportunity data as a DataFrame
    with the same column names expected by generate_scoring.py.

    Falls back to environment variables if credentials are not passed directly.
    """
    if not _SF_AVAILABLE:
        raise ImportError(
            "simple-salesforce is not installed. Run: pip install simple-salesforce"
        )

    username = username or os.environ.get("SF_USERNAME")
    password = password or os.environ.get("SF_PASSWORD")
    security_token = security_token or os.environ.get("SF_SECURITY_TOKEN")
    domain = domain or os.environ.get("SF_DOMAIN", "login")

    if not all([username, password, security_token]):
        raise ValueError(
            "Salesforce credentials missing. Provide username, password, and "
            "security_token — or set SF_USERNAME / SF_PASSWORD / SF_SECURITY_TOKEN."
        )

    sf = Salesforce(
        username=username,
        password=password,
        security_token=security_token,
        domain=domain,
    )

    fields_str = ", ".join(OPPORTUNITY_FIELDS)
    if owner_name:
        query = SOQL_TEMPLATE.format(fields=fields_str, owner_name=owner_name)
    else:
        # Pull all open renewal opps if no owner filter
        query = f"""
            SELECT {fields_str}
            FROM Opportunity
            WHERE IsClosed = false AND StageName LIKE '%Renewal%'
            ORDER BY CloseDate ASC
        """.strip()

    records = sf.query_all(query)["records"]
    if not records:
        return pd.DataFrame()

    df = pd.DataFrame(records).drop(columns=["attributes"], errors="ignore")

    # Rename to match the column names generate_scoring.py expects
    df = df.rename(columns={
        "Name":                         "Opportunity Name",
        "Amount":                       "Renewal Target Amount",
        "CloseDate":                    "Renewal Date",
        "Customer_Usage_Health__c":     "Customer Usage Health",
        "License_Type__c":              "License Type",
        "Current_Seats_Available__c":   "Current Number of Seats Available",
        "Seats_Filled__c":              "Seats Filled",
        "Initial_Seats__c":             "Initial Number of Seats",
        "Seat_Activation_Rate__c":      "Seat Activation Rate",
        "Active_Users_Last_90_Days__c": "Active Users Last 90 Days",
    })

    return df


def test_connection(username: str, password: str, security_token: str, domain: str = "login") -> dict:
    """
    Test credentials without pulling data.
    Returns {"success": True/False, "message": str}.
    """
    if not _SF_AVAILABLE:
        return {"success": False, "message": "simple-salesforce not installed."}

    try:
        sf = Salesforce(
            username=username,
            password=password,
            security_token=security_token,
            domain=domain,
        )
        # Lightweight query to verify connection
        sf.query("SELECT Id FROM User LIMIT 1")
        return {"success": True, "message": "Connected successfully."}
    except SalesforceAuthenticationFailed as e:
        return {"success": False, "message": f"Authentication failed: {e}"}
    except Exception as e:
        return {"success": False, "message": str(e)}
