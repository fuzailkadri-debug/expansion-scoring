// Hex API connector — runs Hex projects and returns result data
// Requires a Hex API key (workspace admin can generate one at app.hex.tech/settings/api)

const HEX_BASE = 'https://app.hex.tech/api/v1';
const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 60; // 2 min timeout

interface HexRunStatus {
  runId: string;
  status: 'PENDING' | 'RUNNING' | 'ERRORED' | 'COMPLETED' | 'KILLED';
  traceId?: string;
}

async function hexRequest(path: string, apiKey: string, method = 'GET', body?: unknown) {
  const res = await fetch(`${HEX_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Hex API error ${res.status}: ${err}`);
  }
  return res.json();
}

async function pollRunUntilComplete(
  projectId: string,
  runId: string,
  apiKey: string,
): Promise<HexRunStatus> {
  for (let i = 0; i < MAX_POLLS; i++) {
    const status = await hexRequest(`/project/${projectId}/run/${runId}`, apiKey) as HexRunStatus;
    if (status.status === 'COMPLETED' || status.status === 'ERRORED' || status.status === 'KILLED') {
      return status;
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error('Hex run timed out after 2 minutes');
}

export async function POST(req: Request) {
  const { action, apiKey, projectId, inputParams } = await req.json();

  if (!apiKey) return Response.json({ error: 'Hex API key required' }, { status: 400 });

  try {
    // Test connection — list projects
    if (action === 'test') {
      await hexRequest('/me', apiKey);
      return Response.json({ success: true });
    }

    // List accessible projects
    if (action === 'list_projects') {
      const data = await hexRequest('/project', apiKey);
      return Response.json({ projects: data });
    }

    // Run a project and wait for results
    if (action === 'run_project') {
      if (!projectId) return Response.json({ error: 'projectId required' }, { status: 400 });

      // Trigger the run
      const run = await hexRequest(
        `/project/${projectId}/run`,
        apiKey,
        'POST',
        { inputParams: inputParams ?? {} },
      ) as HexRunStatus;

      // Poll until done
      const finalStatus = await pollRunUntilComplete(projectId, run.runId, apiKey);

      if (finalStatus.status !== 'COMPLETED') {
        return Response.json({ error: `Run ended with status: ${finalStatus.status}` }, { status: 500 });
      }

      // Get the run results (exported data cells)
      const results = await hexRequest(`/project/${projectId}/run/${run.runId}/results`, apiKey);
      return Response.json({ success: true, runId: run.runId, results });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
