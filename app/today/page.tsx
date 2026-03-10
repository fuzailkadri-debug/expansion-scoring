'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, TrendingUp, Clock, ArrowRight, Target, DollarSign } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { fmt$, fmtPct, TIER_COLORS, HEALTH_COLORS } from '@/lib/utils';
import { loadProfile } from '@/lib/store';
import NoData from '@/components/NoData';
import { Account } from '@/lib/types';

const DG_SW = ['Defined Group', 'Sitewide'];

function AccountCard({ account, reason }: { account: Account; reason: string }) {
  const id = encodeURIComponent(account.opportunityName);
  return (
    <Link
      href={`/accounts/${id}`}
      className="block bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-400 hover:shadow-sm transition-all group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIER_COLORS[account.tier]}`}>
              {account.tier}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${HEALTH_COLORS[account.healthStatus ?? '']}`}>
              {account.healthStatus || 'N/A'}
            </span>
          </div>
          <h3 className="font-semibold text-gray-900 text-sm truncate">{account.organization}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{account.licenseType} · {fmt$(account.renewalTargetAmount)}</p>
          <p className="text-xs text-blue-600 mt-1.5 font-medium">{reason}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-bold text-gray-900">{account.daysToRenewal}d</p>
          <p className="text-xs text-gray-400">to renewal</p>
          <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 mt-2 ml-auto transition-colors" />
        </div>
      </div>
    </Link>
  );
}

function QuotaBar({ target, won }: { target: number; won: number }) {
  const pct = Math.min((won / target) * 100, 100);
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-brand" />
          <span className="text-sm font-semibold text-gray-800">Q1 Expansion Quota</span>
        </div>
        <Link href="/expansion" className="text-xs text-blue-500 hover:underline">Manage</Link>
      </div>
      <div className="flex items-end gap-3 mb-3">
        <span className="text-2xl font-bold text-gray-900">{fmt$(won)}</span>
        <span className="text-sm text-gray-400 mb-0.5">of {fmt$(target)}</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2">
        <div
          className="bg-green-500 h-2 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-gray-400 mt-1.5">
        {fmt$(Math.max(target - won, 0))} remaining · {pct.toFixed(0)}% attained
      </p>
    </div>
  );
}

export default function TodayPage() {
  const { accounts, isLoaded, quotaTarget, quotaWon, addQuotaWon } = useAppStore();
  const [csmName, setCsmName] = useState('');
  const [wonInput, setWonInput] = useState('');
  const [showWonInput, setShowWonInput] = useState(false);

  useEffect(() => {
    setCsmName(loadProfile().name);
  }, []);

  if (!isLoaded) return <NoData />;

  const now = new Date();
  const greeting =
    now.getHours() < 12 ? 'Good morning' :
    now.getHours() < 17 ? 'Good afternoon' : 'Good evening';

  // Priority 1: DG/SW entering ≤45 day window — most urgent (missing = wait a year)
  const dgSwUrgent = accounts
    .filter((a) => DG_SW.includes(a.licenseType) && a.daysToRenewal >= 0 && a.daysToRenewal <= 45)
    .sort((a, b) => a.daysToRenewal - b.daysToRenewal);

  // Priority 2: Tier 1 with high churn (at risk of losing expansion)
  const tier1AtRisk = accounts
    .filter((a) => a.tier === 'Tier 1' && a.churnRisk === 'High Risk')
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 3);

  // Priority 3: Top Tier 1 by score not in above lists
  const urgentIds = new Set([
    ...dgSwUrgent.map((a) => a.opportunityName),
    ...tier1AtRisk.map((a) => a.opportunityName),
  ]);
  const topTier1 = accounts
    .filter((a) => a.tier === 'Tier 1' && !urgentIds.has(a.opportunityName))
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 4);

  // Stats
  const renewing30 = accounts.filter((a) => a.daysToRenewal >= 0 && a.daysToRenewal <= 30);
  const tier1Count = accounts.filter((a) => a.tier === 'Tier 1').length;
  const highRisk = accounts.filter((a) => a.churnRisk === 'High Risk').length;

  function handleMarkWon() {
    const amount = parseFloat(wonInput.replace(/[$,]/g, ''));
    if (!isNaN(amount) && amount > 0) {
      addQuotaWon(amount);
      setWonInput('');
      setShowWonInput(false);
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {greeting}{csmName ? `, ${csmName.split(' ')[0]}` : ''}.
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          {' · '}
          {tier1Count} Tier 1 accounts · {renewing30.length} renewing in 30 days · {highRisk} high churn risk
        </p>
      </div>

      {/* Quota + DG Alert side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <QuotaBar target={quotaTarget} won={quotaWon} />

        {/* Quick stats */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-brand" />
            Pipeline Snapshot
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Tier 1 Accounts', value: tier1Count, color: 'text-green-600' },
              { label: 'Renewing ≤30d', value: renewing30.length, color: renewing30.length > 0 ? 'text-orange-600' : 'text-gray-600' },
              { label: 'High Churn Risk', value: highRisk, color: highRisk > 0 ? 'text-red-600' : 'text-gray-600' },
              { label: 'DG/SW ≤45d', value: dgSwUrgent.length, color: dgSwUrgent.length > 0 ? 'text-red-600' : 'text-gray-600' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-gray-50 rounded-lg px-3 py-2">
                <p className={`text-xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-gray-500">{label}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            {!showWonInput ? (
              <button
                onClick={() => setShowWonInput(true)}
                className="text-xs text-blue-600 hover:underline"
              >
                + Mark expansion won
              </button>
            ) : (
              <div className="flex items-center gap-2 w-full">
                <input
                  type="text"
                  value={wonInput}
                  onChange={(e) => setWonInput(e.target.value)}
                  placeholder="$5,000"
                  className="flex-1 text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  onKeyDown={(e) => e.key === 'Enter' && handleMarkWon()}
                  autoFocus
                />
                <button onClick={handleMarkWon} className="text-xs bg-brand text-white px-2 py-1.5 rounded-lg">Add</button>
                <button onClick={() => setShowWonInput(false)} className="text-xs text-gray-400">Cancel</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* DG/SW Urgent Alert */}
      {dgSwUrgent.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <h2 className="text-sm font-semibold text-red-700 uppercase tracking-wide">
              Critical: DG/Sitewide Renewal Window ≤45 Days
            </h2>
          </div>
          <p className="text-xs text-red-600 mb-3">
            Missing the renewal window for Defined Group or Sitewide accounts means waiting a full year to expand.
          </p>
          <div className="space-y-2">
            {dgSwUrgent.map((a) => (
              <AccountCard
                key={a.opportunityName}
                account={a}
                reason={`${a.licenseType} — renewal window closes in ${a.daysToRenewal} days · ${fmtPct(a.trueActivation)} activation`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Tier 1 at risk */}
      {tier1AtRisk.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-orange-500" />
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Tier 1 — High Churn Risk (act before losing the expansion)
            </h2>
          </div>
          <div className="space-y-2">
            {tier1AtRisk.map((a) => (
              <AccountCard
                key={a.opportunityName}
                account={a}
                reason={`Score ${a.totalScore} · ${a.freeUsers} dept-match users · ${a.churnRisk} — address health before pitching expansion`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Top Tier 1 */}
      {topTier1.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-brand" />
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Top Tier 1 Expansion Opportunities
            </h2>
          </div>
          <div className="space-y-2">
            {topTier1.map((a) => (
              <AccountCard
                key={a.opportunityName}
                account={a}
                reason={`Score ${a.totalScore} · ${a.freeUsers} dept-match users · ${fmtPct(a.trueActivation)} activation`}
              />
            ))}
          </div>
        </div>
      )}

      {tier1Count === 0 && dgSwUrgent.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No Tier 1 accounts yet. Upload Hex data to unlock full scoring.</p>
          <Link href="/" className="text-blue-500 text-sm hover:underline mt-2 block">Go to Data Upload</Link>
        </div>
      )}
    </div>
  );
}
