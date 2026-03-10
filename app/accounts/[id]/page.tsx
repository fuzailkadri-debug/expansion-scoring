'use client';

import { use, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, FileText, Loader2, Send, Trash2, Plus,
  TrendingUp, AlertTriangle, Clock, Users, DollarSign, Star,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { useAppStore } from '@/lib/store';
import { fmt$, fmtPct, TIER_COLORS, HEALTH_COLORS, RISK_COLORS } from '@/lib/utils';
import { buildAIContext } from '@/lib/utils';
import { Account } from '@/lib/types';
import NoData from '@/components/NoData';

const DG_SW = ['Defined Group', 'Sitewide'];

function scoreDimensions(a: Account) {
  const isDgSw = DG_SW.includes(a.licenseType);
  const dims = [
    { name: 'Free Users', pts: a.freeUserPts, max: 25 },
    { name: 'Health', pts: a.healthPts, max: 25 },
    { name: 'Activation', pts: a.activationPts, max: 18 },
    { name: 'Renewal', pts: a.renewalPts, max: isDgSw ? 20 : 15 },
    { name: 'ARR', pts: a.arrPts, max: 10 },
    { name: 'License', pts: a.licensePts, max: 7 },
  ];
  if (isDgSw && a.activeUsersPts > 0) {
    dims.push({ name: 'Active Users', pts: a.activeUsersPts, max: 5 });
  }
  return dims;
}

function arrPerSeat(a: Account): number {
  const seats = a.currentSeatsAvailable > 0 ? a.currentSeatsAvailable : a.initialSeats;
  return seats > 0 ? a.renewalTargetAmount / seats : 0;
}

export default function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const opportunityName = decodeURIComponent(id);
  const router = useRouter();
  const { accounts, isLoaded, notes, addNote, deleteNote } = useAppStore();

  const [noteText, setNoteText] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [brief, setBrief] = useState('');
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefError, setBriefError] = useState('');
  const briefRef = useRef<HTMLDivElement>(null);

  if (!isLoaded) return <NoData />;

  const account = accounts.find((a) => a.opportunityName === opportunityName);
  if (!account) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">Account not found.</p>
        <button onClick={() => router.back()} className="text-blue-500 text-sm mt-2 hover:underline">Go back</button>
      </div>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const safeAccount = account!;
  const dims = scoreDimensions(safeAccount);
  const accountNotes = notes[opportunityName] ?? [];
  const perSeat = arrPerSeat(safeAccount);
  const isDgSw = DG_SW.includes(safeAccount.licenseType);

  function handleAddNote() {
    if (!noteText.trim()) return;
    addNote(opportunityName, noteText.trim());
    setNoteText('');
    setShowNoteInput(false);
  }

  async function generateBrief() {
    setBriefLoading(true);
    setBriefError('');
    setBrief('');
    try {
      const context = buildAIContext(accounts);
      const prompt =
        `Generate a concise pre-call brief for: ${safeAccount.organization}\n\n` +
        `Account details:\n` +
        `- License: ${safeAccount.licenseType}\n` +
        `- ARR: ${fmt$(safeAccount.renewalTargetAmount)}\n` +
        `- Health: ${safeAccount.healthStatus || 'Unknown'}\n` +
        `- Activation: ${fmtPct(safeAccount.trueActivation)}\n` +
        `- Days to renewal: ${safeAccount.daysToRenewal}\n` +
        `- Expansion score: ${safeAccount.totalScore} (${safeAccount.tier})\n` +
        `- Dept-match free users: ${safeAccount.freeUsers}\n` +
        `- Churn risk: ${safeAccount.churnRisk}\n` +
        (safeAccount.activeUsersLast90Days ? `- Active users last 90d: ${safeAccount.activeUsersLast90Days}\n` : '') +
        (isDgSw ? `- Note: Defined Group/Sitewide — can only expand at renewal\n` : '') +
        `\nPlease provide:\n` +
        `1. One-paragraph account summary (health, usage, expansion potential)\n` +
        `2. Top 3 talking points for an expansion conversation\n` +
        `3. Key risks to address\n` +
        `4. Suggested expansion ask (how many seats and estimated ARR impact, if data supports it)`;

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          context,
        }),
      });

      if (!res.ok) {
        setBriefError('Failed to generate brief. Check your Gemini API key.');
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let full = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setBrief(full);
      }
      setTimeout(() => briefRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (e) {
      setBriefError(e instanceof Error ? e.message : String(e));
    } finally {
      setBriefLoading(false);
    }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIER_COLORS[account.tier]}`}>
                {account.tier}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${HEALTH_COLORS[account.healthStatus ?? '']}`}>
                {account.healthStatus || 'No Health Data'}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${RISK_COLORS[account.churnRisk]}`}>
                {account.churnRisk}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{account.organization}</h1>
            <p className="text-gray-500 text-sm mt-0.5">{account.licenseType} · {account.opportunityName}</p>
          </div>

          <button
            onClick={generateBrief}
            disabled={briefLoading}
            className="flex items-center gap-2 bg-brand text-white text-sm px-4 py-2.5 rounded-xl hover:bg-brand-light transition-colors disabled:opacity-50 shrink-0"
          >
            {briefLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileText className="w-4 h-4" />
            )}
            {briefLoading ? 'Generating...' : 'Pre-Call Brief'}
          </button>
        </div>
      </div>

      {/* Key Signals Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: DollarSign, label: 'ARR', value: fmt$(account.renewalTargetAmount), sub: perSeat > 0 ? `${fmt$(perSeat)}/seat` : '' },
          { icon: Clock, label: 'Days to Renewal', value: String(account.daysToRenewal), sub: account.renewalDate },
          { icon: TrendingUp, label: 'Activation', value: fmtPct(account.trueActivation), sub: `${account.seatsFilled} of ${isDgSw ? account.initialSeats : account.currentSeatsAvailable} seats` },
          { icon: Users, label: 'Free Users (Dept)', value: String(account.freeUsers), sub: account.activeUsersLast90Days ? `${account.activeUsersLast90Days} active last 90d` : 'Active data N/A' },
        ].map(({ icon: Icon, label, value, sub }) => (
          <div key={label} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon className="w-4 h-4 text-gray-400" />
              <span className="text-xs text-gray-500 font-medium">{label}</span>
            </div>
            <p className="text-xl font-bold text-gray-900">{value}</p>
            {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
          </div>
        ))}
      </div>

      {/* Score Breakdown + Expansion Calculator */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Score breakdown chart */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-800">Expansion Score Breakdown</h2>
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
              <span className="font-bold text-gray-900">{account.totalScore}</span>
              <span className="text-gray-400 text-sm">/ 103</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dims} layout="vertical" margin={{ left: 0, right: 20 }}>
              <XAxis type="number" domain={[0, 25]} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
              <Tooltip
                formatter={(value, _name, props) => [`${value} / ${props.payload.max}`, 'Score']}
              />
              <Bar dataKey="pts" radius={[0, 4, 4, 0]}>
                {dims.map((d) => (
                  <Cell
                    key={d.name}
                    fill={d.pts / d.max >= 0.7 ? '#22c55e' : d.pts / d.max >= 0.4 ? '#f59e0b' : '#ef4444'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Expansion Gap Calculator */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-brand" />
            Expansion Gap Calculator
          </h2>
          {perSeat > 0 ? (
            <>
              <p className="text-xs text-gray-500 mb-3">
                Current: {account.seatsFilled} seats filled · {fmt$(perSeat)}/seat · {fmtPct(account.trueActivation)} activation
              </p>
              {isDgSw && (
                <div className="bg-blue-50 text-blue-700 text-xs rounded-lg px-3 py-2 mb-3">
                  {account.licenseType} — expansion only at renewal ({account.daysToRenewal} days away)
                </div>
              )}
              <div className="space-y-2">
                {[5, 10, 15, 25].map((seats) => (
                  <div key={seats} className="flex items-center justify-between py-2 border-b border-gray-50">
                    <span className="text-sm text-gray-700">+{seats} seats</span>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-green-700">+{fmt$(seats * perSeat)}</span>
                      <span className="text-xs text-gray-400 ml-1">ARR</span>
                    </div>
                  </div>
                ))}
              </div>
              {account.freeUsers > 0 && (
                <p className="text-xs text-gray-500 mt-3">
                  {account.freeUsers} dept-match free users → potential ceiling: +{fmt$(account.freeUsers * perSeat)} ARR
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-400">No seat pricing data available (ARR or seat count missing).</p>
          )}
        </div>
      </div>

      {/* Pre-Call Brief */}
      {(brief || briefError) && (
        <div ref={briefRef} className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-800">Pre-Call Brief</h2>
            <button
              onClick={() => { setBrief(''); setBriefError(''); }}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Dismiss
            </button>
          </div>
          {briefError ? (
            <p className="text-sm text-red-500">{briefError}</p>
          ) : (
            <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {brief}
              {briefLoading && <span className="animate-pulse">▋</span>}
            </div>
          )}
        </div>
      )}

      {/* Notes */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-800">Notes & Action Log</h2>
          {!showNoteInput && (
            <button
              onClick={() => setShowNoteInput(true)}
              className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add note
            </button>
          )}
        </div>

        {showNoteInput && (
          <div className="mb-4">
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Log a call, email, or next step..."
              rows={3}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
              autoFocus
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={handleAddNote}
                className="flex items-center gap-1.5 text-xs bg-brand text-white px-3 py-1.5 rounded-lg hover:bg-brand-light transition-colors"
              >
                <Send className="w-3 h-3" />
                Save note
              </button>
              <button
                onClick={() => { setShowNoteInput(false); setNoteText(''); }}
                className="text-xs text-gray-400 hover:text-gray-600 px-3 py-1.5"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {accountNotes.length === 0 && !showNoteInput ? (
          <p className="text-sm text-gray-400 text-center py-4">
            No notes yet. Log calls, emails, and action items here.
          </p>
        ) : (
          <div className="space-y-3">
            {accountNotes.map((note) => (
              <div key={note.id} className="flex items-start gap-3 group">
                <div className="w-1.5 h-1.5 rounded-full bg-brand mt-2 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 leading-relaxed">{note.text}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(note.timestamp).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </div>
                <button
                  onClick={() => deleteNote(opportunityName, note.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-400 shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Churn Risk Detail */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className={`w-4 h-4 ${account.churnRisk === 'High Risk' ? 'text-red-500' : account.churnRisk === 'Medium Risk' ? 'text-yellow-500' : 'text-green-500'}`} />
          <h2 className="text-sm font-semibold text-gray-800">Churn Risk Breakdown</h2>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ml-auto ${RISK_COLORS[account.churnRisk]}`}>
            Score: {account.churnScore}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Health Signal', pts: account.churnHealthPts, max: 40 },
            { label: 'Activation Signal', pts: account.churnActivationPts, max: 30 },
            { label: 'Renewal Urgency', pts: account.churnRenewalPts, max: 20 },
          ].map(({ label, pts, max }) => (
            <div key={label} className="text-center bg-gray-50 rounded-lg py-3">
              <p className={`text-xl font-bold ${pts >= max * 0.6 ? 'text-red-600' : pts >= max * 0.3 ? 'text-yellow-600' : 'text-green-600'}`}>{pts}</p>
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
              <p className="text-xs text-gray-300">max {max}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
