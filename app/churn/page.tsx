'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { fmt$, fmtPct, HEALTH_COLORS, RISK_COLORS } from '@/lib/utils';
import { buildAIContext } from '@/lib/utils';
import MetricCard from '@/components/MetricCard';
import DataTable, { Column } from '@/components/DataTable';
import NoData from '@/components/NoData';
import { Account } from '@/lib/types';
import { Loader2, ChevronDown, ChevronUp, FileText } from 'lucide-react';

function PlaybookPanel({
  account,
  accounts,
}: {
  account: Account;
  accounts: Account[];
}) {
  const [open, setOpen] = useState(false);
  const [playbook, setPlaybook] = useState('');
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);

  async function generate() {
    setLoading(true);
    setPlaybook('');
    setOpen(true);
    try {
      const context = buildAIContext(accounts);
      const prompt =
        `Generate a structured churn save playbook for: ${account.organization}\n\n` +
        `Risk signals:\n` +
        `- Health status: ${account.healthStatus || 'Unknown'} (${account.churnHealthPts}/40 pts)\n` +
        `- Activation: ${fmtPct(account.trueActivation)} (${account.churnActivationPts}/30 pts)\n` +
        `- Days to renewal: ${account.daysToRenewal} days (${account.churnRenewalPts}/20 pts)\n` +
        `- Total churn score: ${account.churnScore} (High Risk threshold: 55)\n` +
        `- ARR at risk: ${fmt$(account.renewalTargetAmount)}\n` +
        `- License type: ${account.licenseType}\n` +
        (account.supportTickets ? `- Support tickets: ${account.supportTickets}\n` : '') +
        `\nPlease provide:\n\n` +
        `**DIAGNOSIS**\nOne paragraph explaining the most likely reason for churn risk based on these specific signals.\n\n` +
        `**RECOMMENDED ACTIONS** (3-5 steps, ranked by urgency)\n\n` +
        `**CALL TALK TRACK**\nSpecific questions to ask on the next call to understand and address the risk.\n\n` +
        `**SUCCESS METRICS**\nHow to know the save is working — what should change in the next 30 days.`;

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          context,
        }),
      });

      if (!res.ok) {
        setPlaybook('Failed to generate playbook. Check your Gemini API key in .env.local.');
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let full = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setPlaybook(full);
      }
      setGenerated(true);
    } catch (e) {
      setPlaybook(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-1">
      <div className="flex items-center gap-2">
        <button
          onClick={generated ? () => setOpen(!open) : generate}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs bg-red-50 text-red-700 border border-red-200 px-2.5 py-1 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <FileText className="w-3 h-3" />
          )}
          {loading ? 'Generating...' : generated ? (open ? 'Hide' : 'Show') + ' Playbook' : 'Generate Save Playbook'}
          {generated && !loading && (open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
        </button>
      </div>

      {open && playbook && (
        <div className="mt-3 bg-red-50 border border-red-100 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-red-800 uppercase tracking-wide">
              Save Playbook — {account.organization}
            </p>
            <button onClick={() => { setGenerated(false); setPlaybook(''); setOpen(false); }}
              className="text-xs text-red-400 hover:text-red-600">Dismiss</button>
          </div>
          <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
            {playbook}
            {loading && <span className="animate-pulse">▋</span>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ChurnPage() {
  const { accounts, isLoaded } = useAppStore();
  const [riskFilter, setRiskFilter] = useState('All');

  if (!isLoaded) return <NoData />;

  const highRisk = accounts.filter((a) => a.churnRisk === 'High Risk');
  const medRisk = accounts.filter((a) => a.churnRisk === 'Medium Risk');
  const lowRisk = accounts.filter((a) => a.churnRisk === 'Low Risk');

  const highRiskArr = highRisk.reduce((s, a) => s + a.renewalTargetAmount, 0);
  const medRiskArr = medRisk.reduce((s, a) => s + a.renewalTargetAmount, 0);

  let view = accounts;
  if (riskFilter !== 'All') view = view.filter((a) => a.churnRisk === riskFilter);
  const sorted = [...view].sort((a, b) => b.churnScore - a.churnScore);

  const urgent = accounts
    .filter((a) => a.churnRisk === 'High Risk' && a.daysToRenewal <= 90)
    .sort((a, b) => a.daysToRenewal - b.daysToRenewal);

  const cols: Column<Account>[] = [
    { key: 'organization', label: 'Organization' },
    { key: 'licenseType', label: 'License Type' },
    {
      key: 'healthStatus',
      label: 'Health',
      render: (v) => (
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${HEALTH_COLORS[String(v ?? '')]}`}>
          {String(v) || 'N/A'}
        </span>
      ),
    },
    { key: 'trueActivation', label: 'Activation', render: (v) => fmtPct(Number(v)) },
    { key: 'renewalTargetAmount', label: 'ARR', render: (v) => fmt$(Number(v)) },
    { key: 'daysToRenewal', label: 'Days' },
    { key: 'churnScore', label: 'Score' },
    {
      key: 'churnRisk',
      label: 'Risk',
      render: (v) => (
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${RISK_COLORS[String(v)]}`}>
          {String(v)}
        </span>
      ),
    },
    {
      key: 'supportTickets',
      label: 'Tickets',
      render: (v) => (v != null ? String(v) : '—'),
    },
  ];

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Churn Risk</h1>
        <p className="text-gray-500 text-sm mt-1">Accounts flagged by health, activation, and renewal proximity.</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <MetricCard label="High Risk" value={highRisk.length} sub={fmt$(highRiskArr) + ' ARR at risk'} color="red" />
        <MetricCard label="Medium Risk" value={medRisk.length} sub={fmt$(medRiskArr) + ' ARR'} color="yellow" />
        <MetricCard label="Low Risk" value={lowRisk.length} color="green" />
      </div>

      {/* Filter + table */}
      <div className="space-y-3">
        <div className="flex items-center gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Risk Level</label>
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              {['All', 'High Risk', 'Medium Risk', 'Low Risk'].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end pb-1 text-sm text-gray-500">{sorted.length} accounts</div>
        </div>
        <DataTable
          columns={cols as unknown as Column<Record<string, unknown>>[]}
          data={sorted as unknown as Record<string, unknown>[]}
          maxHeight="380px"
        />
      </div>

      {/* Urgent — High Risk ≤90 days with playbooks */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
          Urgent: High Risk + Renewing Within 90 Days
        </h2>
        {urgent.length === 0 ? (
          <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">
            No high-risk accounts renewing within 90 days.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">
              {urgent.length} account(s) need immediate attention — click "Generate Save Playbook" for AI-powered diagnosis and talk track.
            </div>
            <div className="space-y-3">
              {urgent.map((account) => (
                <div key={account.opportunityName} className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${RISK_COLORS[account.churnRisk]}`}>
                          {account.churnRisk}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${HEALTH_COLORS[account.healthStatus ?? '']}`}>
                          {account.healthStatus || 'N/A'}
                        </span>
                      </div>
                      <p className="font-semibold text-gray-900">{account.organization}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {account.licenseType} · {fmt$(account.renewalTargetAmount)} · {fmtPct(account.trueActivation)} activation · {account.daysToRenewal}d to renewal · Score: {account.churnScore}
                      </p>
                    </div>
                  </div>
                  <PlaybookPanel account={account} accounts={accounts} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
