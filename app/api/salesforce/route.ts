import { Connection } from 'jsforce';

// Salesforce custom field names — adjust if your org uses different API names
const SF_FIELDS = [
  'Name',
  'Amount',
  'CloseDate',
  'Customer_Usage_Health__c',
  'License_Type__c',
  'Current_Seats_Available__c',
  'Seats_Filled__c',
  'Initial_Seats__c',
  'Seat_Activation_Rate__c',
  'Active_Users_Last_90_Days__c',
  'Owner.Name',
];

const FIELD_MAP: Record<string, string> = {
  Name:                         'Opportunity Name',
  Amount:                       'Renewal Target Amount',
  CloseDate:                    'Renewal Date',
  Customer_Usage_Health__c:     'Customer Usage Health',
  License_Type__c:              'License Type',
  Current_Seats_Available__c:   'Current Number of Seats Available',
  Seats_Filled__c:              'Seats Filled',
  Initial_Seats__c:             'Initial Number of Seats',
  Seat_Activation_Rate__c:      'Seat Activation Rate',
  Active_Users_Last_90_Days__c: 'Active Users Last 90 Days',
};

export async function POST(req: Request) {
  const { action, username, password, securityToken, domain = 'login', ownerName } = await req.json();

  const conn = new Connection({ loginUrl: `https://${domain}.salesforce.com` });

  try {
    await conn.login(username, password + securityToken);
  } catch (e) {
    return Response.json(
      { error: `Authentication failed: ${e instanceof Error ? e.message : String(e)}` },
      { status: 401 },
    );
  }

  // Test connection only
  if (action === 'test') {
    const identity = await conn.identity();
    return Response.json({ success: true, user: identity.display_name, org: identity.organization_id });
  }

  // Pull opportunity data
  const fields = SF_FIELDS.join(', ');
  const ownerFilter = ownerName ? `AND Owner.Name = '${ownerName.replace("'", "\\'")}'` : '';
  const soql = `
    SELECT ${fields}
    FROM Opportunity
    WHERE IsClosed = false
      AND StageName LIKE '%Renewal%'
      ${ownerFilter}
    ORDER BY CloseDate ASC
  `;

  try {
    const result = await conn.query<Record<string, unknown>>(soql);
    const records = result.records.map((r) => {
      const row: Record<string, unknown> = {};
      for (const [sfKey, displayKey] of Object.entries(FIELD_MAP)) {
        row[displayKey] = r[sfKey] ?? '';
      }
      // Handle nested Owner.Name
      const owner = r['Owner'] as Record<string, unknown> | undefined;
      if (owner) row['Owner Name'] = owner['Name'];
      return row;
    });

    return Response.json({ records, totalSize: result.totalSize });
  } catch (e) {
    return Response.json(
      { error: `Query failed: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    );
  }
}
