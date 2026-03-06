'use client';

import { useState } from 'react';
import { CheckCircle, AlertCircle, Loader2, Plug, Database, BarChart2, Zap } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { mergeAndScore } from '@/lib/scoring';
import { useRouter } from 'next/navigation';

type Status = 'idle' | 'testing' | 'connected' | 'error' | 'loading' | 'done';

function StatusBadge({ status, message }: { status: Status; message?: string }) {
  if (status === 'idle') return null;
  const map: Record<Status, { icon: React.ReactNode; color: string; label: string }> = {
    idle: { icon: null, color: '', label: '' },
    testing: { icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />, color: 'text-blue-600', label: 'Testing...' },
    loading: { icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />, color: 'text-blue-600', label: 'Loading data...' },
    connected: { icon: <CheckCircle className="w-3.5 h-3.5" />, color: 'text-green-600', label: message ?? 'Connected' },
    done: { icon: <CheckCircle className="w-3.5 h-3.5" />, color: 'text-green-600', label: message ?? 'Done' },
    error: { icon: <AlertCircle className="w-3.5 h-3.5" />, color: 'text-red-600', label: message ?? 'Error' },
  };
  const { icon, color, label } = map[status];
  return (
    <span className={`flex items-center gap-1.5 text-sm font-medium ${color}`}>
      {icon}{label}
    </span>
  );
}

// ── Salesforce Section ────────────────────────────────────────────────────────

function SalesforceConnector() {
  const router = useRouter();
  const { setAccounts, setHasHexData } = useAppStore();
  const [creds, setCreds] = useState({ username: '', password: '', token: '', domain: 'login', owner: '' });
  const [testStatus, setTestStatus] = useState<Status>('idle');
  const [pullStatus, setPullStatus] = useState<Status>('idle');
  const [testMsg, setTestMsg] = useState('');
  const [pullMsg, setPullMsg] = useState('');

  async function handleTest() {
    setTestStatus('testing');
    const res = await fetch('/api/salesforce', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'test', username: creds.username, password: creds.password, securityToken: creds.token, domain: creds.domain }),
    });
    const data = await res.json();
    if (data.error) { setTestStatus('error'); setTestMsg(data.error); }
    else { setTestStatus('connected'); setTestMsg(`Connected as ${data.user}`); }
  }

  async function handlePull() {
    setPullStatus('loading');
    const res = await fetch('/api/salesforce', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'fetch', username: creds.username, password: creds.password, securityToken: creds.token, domain: creds.domain, ownerName: creds.owner }),
    });
    const data = await res.json();
    if (data.error) { setPullStatus('error'); setPullMsg(data.error); return; }
    const scored = mergeAndScore(data.records, [], null);
    setAccounts(scored);
    setHasHexData(false);
    setPullStatus('done');
    setPullMsg(`Loaded ${scored.length} accounts`);
    setTimeout(() => router.push('/book-overview'), 1000);
  }

  const field = (label: string, key: keyof typeof creds, type = 'text', placeholder = '') => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input type={type} placeholder={placeholder} value={creds[key]}
        onChange={(e) => setCreds({ ...creds, [key]: e.target.value })}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
    </div>
  );

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Database className="w-5 h-5 text-blue-600" />
        <h2 className="font-semibold text-gray-900">Salesforce</h2>
        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">REST API</span>
      </div>
      <p className="text-xs text-gray-500">Pulls open renewal opportunities directly. Requires a Connected App with API access in your Salesforce org.</p>

      <div className="grid grid-cols-2 gap-3">
        {field('Username (email)', 'username', 'email', 'you@biorender.com')}
        {field('Password', 'password', 'password')}
        {field('Security Token', 'token', 'password', 'Found in SF → Settings → Reset Security Token')}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Environment</label>
          <select value={creds.domain} onChange={(e) => setCreds({ ...creds, domain: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
            <option value="login">Production</option>
            <option value="test">Sandbox</option>
          </select>
        </div>
      </div>
      {field('CSM Owner Name (optional)', 'owner', 'text', 'e.g. Fuzail Kadri — filters to your opps only')}

      <div className="flex items-center gap-3 pt-1">
        <button onClick={handleTest} disabled={!creds.username || !creds.password || !creds.token || testStatus === 'testing'}
          className="border border-gray-300 text-gray-700 text-sm px-4 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors">
          Test Connection
        </button>
        <button onClick={handlePull} disabled={testStatus !== 'connected' || pullStatus === 'loading'}
          className="bg-brand text-white text-sm px-4 py-2 rounded-lg hover:bg-brand-light disabled:opacity-50 transition-colors">
          Pull My Opportunities
        </button>
        <StatusBadge status={testStatus} message={testMsg} />
        <StatusBadge status={pullStatus} message={pullMsg} />
      </div>
    </div>
  );
}

// ── Looker Section ────────────────────────────────────────────────────────────

function LookerConnector() {
  const [creds, setCreds] = useState({ baseUrl: '', clientId: '', clientSecret: '' });
  const [testStatus, setTestStatus] = useState<Status>('idle');
  const [testMsg, setTestMsg] = useState('');
  const [queryStatus, setQueryStatus] = useState<Status>('idle');
  const [queryMsg, setQueryMsg] = useState('');
  const [results, setResults] = useState<Record<string, unknown>[] | null>(null);
  const [activeQuery, setActiveQuery] = useState<'user_activity' | 'custom'>('user_activity');
  const [customQuery, setCustomQuery] = useState('{\n  "model": "your_model",\n  "view": "your_view",\n  "fields": ["field1", "field2"],\n  "filters": {},\n  "limit": "500"\n}');

  async function handleTest() {
    setTestStatus('testing');
    const res = await fetch('/api/looker', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'test', baseUrl: creds.baseUrl, clientId: creds.clientId, clientSecret: creds.clientSecret }),
    });
    const data = await res.json();
    if (data.error) { setTestStatus('error'); setTestMsg(data.error); }
    else { setTestStatus('connected'); setTestMsg(`Connected as ${data.user}`); }
  }

  async function handleQuery() {
    setQueryStatus('loading');
    setResults(null);
    let body: Record<string, unknown> = { baseUrl: creds.baseUrl, clientId: creds.clientId, clientSecret: creds.clientSecret };
    if (activeQuery === 'user_activity') {
      body = { ...body, action: 'user_activity' };
    } else {
      try {
        body = { ...body, action: 'run_query', query: JSON.parse(customQuery) };
      } catch {
        setQueryStatus('error'); setQueryMsg('Invalid JSON in query'); return;
      }
    }
    const res = await fetch('/api/looker', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (data.error) { setQueryStatus('error'); setQueryMsg(data.error); }
    else { setQueryStatus('done'); setQueryMsg(`${(data.records as unknown[]).length} rows returned`); setResults(data.records); }
  }

  const field = (label: string, key: keyof typeof creds, type = 'text', placeholder = '') => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input type={type} placeholder={placeholder} value={creds[key]}
        onChange={(e) => setCreds({ ...creds, [key]: e.target.value })}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
    </div>
  );

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <BarChart2 className="w-5 h-5 text-purple-600" />
        <h2 className="font-semibold text-gray-900">Looker</h2>
        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">REST API 4.0</span>
      </div>
      <p className="text-xs text-gray-500">Pull user-level activity data and run Looker Explore queries. Requires API credentials from your Looker admin.</p>

      <div className="grid grid-cols-1 gap-3">
        {field('Looker Instance URL', 'baseUrl', 'text', 'https://biorender.looker.com')}
        <div className="grid grid-cols-2 gap-3">
          {field('Client ID', 'clientId', 'text', 'Your Looker API3 Client ID')}
          {field('Client Secret', 'clientSecret', 'password', 'Your Looker API3 Client Secret')}
        </div>
      </div>
      <p className="text-xs text-gray-400">Get credentials: Looker → Admin → Users → your user → Edit → API3 Keys</p>

      <div className="flex items-center gap-3">
        <button onClick={handleTest} disabled={!creds.baseUrl || !creds.clientId || !creds.clientSecret || testStatus === 'testing'}
          className="border border-gray-300 text-gray-700 text-sm px-4 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors">
          Test Connection
        </button>
        <StatusBadge status={testStatus} message={testMsg} />
      </div>

      {testStatus === 'connected' && (
        <div className="space-y-3 pt-1 border-t border-gray-100">
          <div className="flex gap-2">
            {(['user_activity', 'custom'] as const).map((q) => (
              <button key={q} onClick={() => setActiveQuery(q)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${activeQuery === q ? 'bg-purple-600 text-white' : 'border border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                {q === 'user_activity' ? 'User Activity' : 'Custom Query'}
              </button>
            ))}
          </div>

          {activeQuery === 'custom' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Query (JSON)</label>
              <textarea rows={6} value={customQuery} onChange={(e) => setCustomQuery(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-purple-400" />
            </div>
          )}

          <div className="flex items-center gap-3">
            <button onClick={handleQuery} disabled={queryStatus === 'loading'}
              className="bg-purple-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors">
              Run Query
            </button>
            <StatusBadge status={queryStatus} message={queryMsg} />
          </div>

          {results && results.length > 0 && (
            <div className="overflow-auto max-h-72 border border-gray-200 rounded-lg">
              <table className="text-xs w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>{Object.keys(results[0]).map((k) => <th key={k} className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">{k}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {results.slice(0, 100).map((row, i) => (
                    <tr key={i}>{Object.values(row).map((v, j) => <td key={j} className="px-3 py-1.5 text-gray-700 whitespace-nowrap">{String(v ?? '')}</td>)}</tr>
                  ))}
                </tbody>
              </table>
              {results.length > 100 && <p className="text-xs text-gray-400 px-3 py-2">Showing 100 of {results.length} rows</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Hex Section ───────────────────────────────────────────────────────────────

function HexConnector() {
  const [apiKey, setApiKey] = useState('');
  const [projectId, setProjectId] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [testStatus, setTestStatus] = useState<Status>('idle');
  const [runStatus, setRunStatus] = useState<Status>('idle');
  const [runMsg, setRunMsg] = useState('');

  async function handleTest() {
    setTestStatus('testing');
    const res = await fetch('/api/hex', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'test', apiKey }) });
    const data = await res.json();
    setTestStatus(data.error ? 'error' : 'connected');
  }

  async function handleRun() {
    setRunStatus('loading');
    const res = await fetch('/api/hex', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'run_project', apiKey, projectId, inputParams: ownerName ? { csm_owner: ownerName } : {} }),
    });
    const data = await res.json();
    if (data.error) { setRunStatus('error'); setRunMsg(data.error); }
    else { setRunStatus('done'); setRunMsg('Run complete — download results from Hex and upload on the Data Upload page'); }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Zap className="w-5 h-5 text-yellow-500" />
        <h2 className="font-semibold text-gray-900">Hex</h2>
        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">API Key Required</span>
      </div>
      <p className="text-xs text-gray-500">Trigger your free-user query project to run on demand. Requires a workspace API key from your Hex admin (Settings → API).</p>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Hex API Key</label>
          <input type="password" placeholder="hex_api_..." value={apiKey} onChange={(e) => setApiKey(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Project ID</label>
          <input type="text" placeholder="e.g. 01983315-13ee-7004-9533-..." value={projectId} onChange={(e) => setProjectId(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
          <p className="text-xs text-gray-400 mt-1">Found in the Hex project URL: app.hex.tech/.../hex/PROJECT_ID/...</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">CSM Owner Name (optional input param)</label>
          <input type="text" placeholder="e.g. Fuzail Kadri" value={ownerName} onChange={(e) => setOwnerName(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={handleTest} disabled={!apiKey || testStatus === 'testing'}
          className="border border-gray-300 text-gray-700 text-sm px-4 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors">
          Test Key
        </button>
        <button onClick={handleRun} disabled={!apiKey || !projectId || runStatus === 'loading'}
          className="bg-yellow-500 text-white text-sm px-4 py-2 rounded-lg hover:bg-yellow-600 disabled:opacity-50 transition-colors">
          Trigger Run
        </button>
        <StatusBadge status={testStatus} />
        <StatusBadge status={runStatus} message={runMsg} />
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ConnectorsPage() {
  return (
    <div className="p-8 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-brand rounded-lg flex items-center justify-center">
          <Plug className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Data Connectors</h1>
          <p className="text-gray-500 text-sm">Connect directly to Salesforce, Looker, and Hex for live data.</p>
        </div>
      </div>

      <SalesforceConnector />
      <LookerConnector />
      <HexConnector />
    </div>
  );
}
