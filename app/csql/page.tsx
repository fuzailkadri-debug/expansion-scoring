'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { fmt$, fmtPct, HEALTH_COLORS } from '@/lib/utils';
import { buildAIContext } from '@/lib/utils';
import MetricCard from '@/components/MetricCard';
import NoData from '@/components/NoData';
import { Account } from '@/lib/types';
import { Loader2, Sparkles, ChevronDown, ChevronUp, Users } from 'lucide-react';

// A CSQL is an account where free/self-serve users from OTHER departments
// at the same institution signal a new license opportunity
function csqlScore(a: Account): number {
  const unmatched = a.freeUsersUnmatched + a.selfServeUnmatched;
  const userPts =
    unmatched >= 100 ? 40 :
    unmatched >= 50 ? 32 :
    unmatched >= 20 ? 24 :
    unmatched >= 10 ? 16 :
    unmatched >= 5 ? 8 : 0;

  const healthPts =
    a.healthStatus === 'Extra Green' ? 20 :
    a.healthStatus === 'Green' ? 20 :
    a.healthStatus === 'Yellow' ? 12 : 6;

  const activationPts = a.trueActivation >= 0.9 ? 20 : a.trueActivation >= 0.7 ? 12 : 6;
  const arrPts = a.renewalTargetAmount >= 15000 ? 20 : a.renewalTargetAmount >= 5000 ? 12 : 6;

  return userPts + healthPts + activationPts + arrPts;
}

function csqlPriority(score: number): 'High' | 'Medium' | 'Low' {
  return score >= 70 ? 'High' : score >= 45 ? 'Medium' : 'Low';
}

const PRIORITY_COLORS: Record<string, string> = {
  High: 'bg-purple-100 text-purple-800',
  Medium: 'bg-blue-100 text-blue-800',
  Low: 'bg-gray-100 text-gray-600',
};

function OutreachPanel({ account, accounts }: { account: Account & { csqlScore: number }; accounts: Account[] }) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);

  async function generate() {
    setLoading(true);
    setContent('');
    setOpen(true);
    try {
      const context = buildAIContext(accounts);
      const unmatched = account.freeUsersUnmatched + account.selfServeUnmatched;
      const prompt =
        `Generate a CSQL outreach strategy for: ${account.organization}\n\n` +
        `CSQL Signals:\n` +
        `- ${unmatched} users at this institution are in departments NOT covered by the current license\n` +
        `- Free users in other depts: ${account.freeUsersUnmatched}\n` +
        `- Self-serve users in other depts: ${account.selfServeUnmatched}\n` +
        `- Existing account health: ${account.healthStatus || 'Unknown'}\n` +
        `- Existing license: ${account.licenseType} — ${fmtPct(account.trueActivation)} activated\n` +
        `- Current ARR: ${fmt$(account.renewalTargetAmount)}\n` +
        `- Renews in: ${account.daysToRenewal} days\n\n` +
        `Please provide:\n\n` +
        `**WHY THIS IS A CSQL**\nOne paragraph explaining why these unmatched users represent a genuine new license opportunity.\n\n` +
        `**RECOMMENDED APPROACH** (3 steps)\nHow to identify the right contact in the other department(s) and initiate a conversation.\n\n` +
        `**OUTREACH EMAIL**\nA short, personalized email to the existing contact asking for an introduction to the other department — referencing their team's success with BioRender.\n\n` +
        `**EXPECTED ARR POTENTIAL**\nEstimate the potential new ARR based on user count and typical license size.`;

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          context,
        }),
      });

      if (!res.ok) {
        setContent('Failed to generate. Check your Gemini API key.');
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let full = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setContent(full);
      }
      setGenerated(true);
    } catch (e) {
      setContent(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-2">
      <button
        onClick={generated ? () => setOpen(!open) : generate}
        disabled={loading}
        className="flex items-center gap-1.5 text-xs bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-1 rounded-lg hover:bg-purple-100 transition-colors disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
        {loading ? 'Generating...' : generated ? (open ? 'Hide' : 'Show') + ' Strategy' : 'Generate CSQL Strategy'}
        {generated && !loading && (open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
      </button>

      {open && content && (
        <div className="mt-3 bg-purple-50 border border-purple-100 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-purple-900 uppercase tracking-wide">
              CSQL Strategy — {account.organization}
            </p>
            <button onClick={() => { setGenerated(false); setContent(''); setOpen(false); }}
              className="text-xs text-purple-400 hover:text-purple-600">Dismiss</button>
          </div>
          <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
            {content}
            {loading && <span className="animate-pulse">▋</span>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CSQLPage() {
  const { accounts, isLoaded, hasHexData } = useAppStore();
  const [priorityFilter, setPriorityFilter] = useState('All');

  if (!isLoaded) return <NoData />;

  // Only accounts with unmatched users are CSQLs
  const csqls = accounts
    .filter((a) => a.freeUsersUnmatched + a.selfServeUnmatched > 0)
    .map((a) => ({ ...a, csqlScore: csqlScore(a), csqlPriority: csqlPriority(csqlScore(a)) }))
    .sort((a, b) => b.csqlScore - a.csqlScore);

  const high = csqls.filter((a) => a.csqlPriority === 'High');
  const medium = csqls.filter((a) => a.csqlPriority === 'Medium');
  const totalUnmatched = csqls.reduce((s, a) => s + a.freeUsersUnmatched + a.selfServeUnmatched, 0);
  const potentialArr = csqls.reduce((s, a) => s + (a.freeUsersUnmatched + a.selfServeUnmatched) * 215, 0); // ~$215/seat est

  const view = priorityFilter === 'All' ? csqls : csqls.filter((a) => a.csqlPriority === priorityFilter);

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">CSQL Pipeline</h1>
        <p className="text-gray-500 text-sm mt-1">
          Customer Success Qualified Leads — other departments at your accounts with free/self-serve users who could be their own license.
        </p>
      </div>

      {!hasHexData && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg px-4 py-3">
          Upload your Hex dept-breakdown CSV on the home page to populate CSQL data. The file needs <code className="bg-amber-100 px-1 rounded">free_users_without_dept_match</code> and <code className="bg-amber-100 px-1 rounded">self_serve_without_dept_match</code> columns.
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="High Priority CSQLs" value={high.length} color="green" />
        <MetricCard label="Medium Priority" value={medium.length} color="yellow" />
        <MetricCard label="Total Unmatched Users" value={totalUnmatched} />
        <MetricCard label="Est. ARR Potential" value={fmt$(potentialArr)} sub="at ~$215/seat" />
      </div>

      {/* Filter */}
      <div className="flex items-center gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Priority</label>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
          >
            {['All', 'High', 'Medium', 'Low'].map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div className="text-sm text-gray-500 mt-5">{view.length} CSQLs</div>
      </div>

      {csqls.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-8 text-center text-gray-400 text-sm">
          No CSQL signals found. Upload your Hex dept-breakdown CSV to detect unmatched department users.
        </div>
      ) : (
        <div className="space-y-3">
          {view.map((account) => {
            const unmatched = account.freeUsersUnmatched + account.selfServeUnmatched;
            const priority = account.csqlPriority as string;
            return (
              <div key={account.opportunityName} className="bg-white border border-gray-200 rounded-xl p-4 hover:border-purple-300 transition-colors">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[priority]}`}>
                        {priority} Priority
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${HEALTH_COLORS[account.healthStatus ?? '']}`}>
                        {account.healthStatus || 'N/A'}
                      </span>
                      <span className="text-xs text-gray-400">{account.licenseType}</span>
                    </div>
                    <p className="font-semibold text-gray-900 truncate">{account.organization}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {account.licenseType} · {fmt$(account.renewalTargetAmount)} ARR · {fmtPct(account.trueActivation)} activation · renews in {account.daysToRenewal}d
                    </p>
                  </div>

                  {/* CSQL signal summary */}
                  <div className="flex gap-4 text-center shrink-0">
                    <div className="bg-purple-50 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-1 justify-center mb-0.5">
                        <Users className="w-3 h-3 text-purple-600" />
                        <span className="text-lg font-bold text-purple-700">{unmatched}</span>
                      </div>
                      <p className="text-[10px] text-purple-500 uppercase tracking-wide">Unmatched Users</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg px-3 py-2">
                      <div className="text-lg font-bold text-gray-700">{account.csqlScore}</div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide">CSQL Score</p>
                    </div>
                  </div>
                </div>

                {/* Breakdown */}
                <div className="mt-2 flex gap-4 text-xs text-gray-500">
                  <span>Free (other depts): <strong className="text-gray-700">{account.freeUsersUnmatched}</strong></span>
                  <span>Self-serve (other depts): <strong className="text-gray-700">{account.selfServeUnmatched}</strong></span>
                  <span>Est. new ARR: <strong className="text-purple-700">{fmt$((unmatched) * 215)}</strong></span>
                </div>

                <OutreachPanel account={account} accounts={accounts} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
