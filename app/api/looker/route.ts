// Looker API connector — uses Looker REST API 4.0 with client credentials OAuth

interface LookerToken {
  access_token: string;
  token_type: string;
}

async function getLookerToken(baseUrl: string, clientId: string, clientSecret: string): Promise<string> {
  const res = await fetch(`${baseUrl}/api/4.0/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret }),
  });
  if (!res.ok) throw new Error(`Looker auth failed: ${res.statusText}`);
  const data = await res.json() as LookerToken;
  return data.access_token;
}

async function lookerGet(baseUrl: string, token: string, path: string) {
  const res = await fetch(`${baseUrl}/api/4.0${path}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`Looker request failed: ${res.status} ${res.statusText}`);
  return res.json();
}

async function lookerPost(baseUrl: string, token: string, path: string, body: unknown) {
  const res = await fetch(`${baseUrl}/api/4.0${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Looker request failed: ${res.status} - ${err}`);
  }
  return res.json();
}

export async function POST(req: Request) {
  const { action, baseUrl, clientId, clientSecret, lookId, query } = await req.json();

  if (!baseUrl || !clientId || !clientSecret) {
    return Response.json({ error: 'Missing Looker credentials' }, { status: 400 });
  }

  // Normalize base URL (strip trailing slash)
  const url = baseUrl.replace(/\/$/, '');

  let token: string;
  try {
    token = await getLookerToken(url, clientId, clientSecret);
  } catch (e) {
    return Response.json(
      { error: `Auth failed: ${e instanceof Error ? e.message : String(e)}` },
      { status: 401 },
    );
  }

  try {
    // Test connection
    if (action === 'test') {
      const me = await lookerGet(url, token, '/me');
      return Response.json({ success: true, user: (me as Record<string, unknown>)['display_name'] });
    }

    // Run a saved Look by ID
    if (action === 'run_look' && lookId) {
      const data = await lookerGet(url, token, `/looks/${lookId}/run/json`);
      return Response.json({ records: data });
    }

    // Run an inline query (most flexible — build your own explore query)
    if (action === 'run_query' && query) {
      // query should be a Looker query object: { model, view, fields, filters, limit }
      const created = await lookerPost(url, token, '/queries', query) as Record<string, unknown>;
      const queryId = created['id'];
      const data = await lookerGet(url, token, `/queries/${queryId}/run/json`);
      return Response.json({ records: data });
    }

    // List available models (useful for discovery)
    if (action === 'list_models') {
      const models = await lookerGet(url, token, '/lookml_models');
      return Response.json({ models });
    }

    // Get user-level activity data — who's active, last login, etc.
    if (action === 'user_activity') {
      const data = await lookerPost(url, token, '/queries/run/json', {
        model: query?.model ?? 'system__activity',
        view: query?.view ?? 'user',
        fields: query?.fields ?? [
          'user.id',
          'user.name',
          'user.email',
          'user.created_date',
          'user.last_login',
          'user.is_disabled',
        ],
        filters: query?.filters ?? {},
        limit: query?.limit ?? '5000',
      });
      return Response.json({ records: data });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
