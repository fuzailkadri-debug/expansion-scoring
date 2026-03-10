'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { fmt$, fmtPct, TIER_COLORS, HEALTH_COLORS } from '@/lib/utils';
import { downloadCSV } from '@/lib/utils';
import MetricCard from '@/components/MetricCard';
import NoData from '@/components/NoData';
import { Account } from '@/lib/types';

const ANYTIME = ['Named User', 'Named User (Chargeback)', 'Right to Deploy'];
const RENEWAL_ONLY = ['Defined Group', 'Sitewide'];
const TIER_ORDER = ['All', 'Tier 1', 'Tier 2', 'Tier 3', 'Below Threshold', 'Need Hex Data'];

export default function ExpansionPage() {
  const { accounts, isLoaded, hasHexData } = useAppStore();
  const [tierFilter, setTierFilter] = useState('All');
  const [trackFilter, setTrackFilter] = useState('All');
  const router = useRouter();

  if (!isLoaded) return <NoData />;

  const tierCounts: Record<string, number> = {};
  for (const a of accounts) {
    tierCounts[a.tier] = (tierCounts[a.tier] ?? 0) + 1;
  }

  let view = accounts;
  if (tierFilter !== 'All') view = view.filter((a) => a.tier === tierFilter);
  if (trackFilter === 'Anytime') view = view.filter((a) => ANYTIME.includes(a.licenseType));
  if (trackFilter === 'Renewal-Only') view = view.filter((a) => RENEWAL_ONLY.includes(a.licenseType));

  const sorted = [...view].sort((a, b) => b.totalScore - a.totalScore);

  function handleRowClick(account: Account) {
    router.push(`/accounts/${encodeURIComponent(account.opportunityName)}`);
  }

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expansion Opportunities</h1>
          <p className="text-gray-500 text-sm mt-1">
            Accounts scored by expansion potential. Click any row for full detail.
          </p>
        </div>
        <button
          onClick={() => downloadCSV(accounts)}
          className="flex items-center gap-2 bg-brand text-white text-sm px-4 py-2 rounded-lg hover:bg-brand-light transition-colors"
        >
          <Download className="w-4 h-4" />
          Download CSV
        </button>
      </div>

      {!hasHexData && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 text-sm rounded-lg px-4 py-3">
          Hex data not uploaded — Free User scores will be 0. Upload on the home page for full scoring.
        </div>
      )}

      {/* Tier metrics */}
      <div className="grid grid-cols-3 lg:grid-cols-5 gap-3">
        {['Tier 1', 'Tier 2', 'Tier 3', 'Below Threshold', 'Need Hex Data'].map((t) => (
          <MetricCard
            key={t}
            label={t}
            value={tierCounts[t] ?? 0}
            color={t === 'Tier 1' ? 'green' : t === 'Tier 2' ? 'yellow' : 'default'}
          />
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Tier</label>
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            {TIER_ORDER.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Track</label>
          <select
            value={trackFilter}
            onChange={(e) => setTrackFilter(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            {['All', 'Anytime', 'Renewal-Only'].map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="text-sm text-gray-500 pb-0.5">{sorted.length} accounts</div>
      </div>

      {/* Clickable account table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-auto" style={{ maxHeight: '520px' }}>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
              <tr>
                {['Organization', 'License Type', 'Health', 'Activation', 'ARR', 'Days', 'Free (Dept)', 'Self-Serve (Dept)', 'Score', 'Tier'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.map((a) => (
                <tr
                  key={a.opportunityName}
                  onClick={() => handleRowClick(a)}
                  className="hover:bg-blue-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-gray-900 max-w-[200px] truncate">{a.organization}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{a.licenseType}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${HEALTH_COLORS[a.healthStatus ?? '']}`}>
                      {a.healthStatus || 'N/A'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{fmtPct(a.trueActivation)}</td>
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{fmt$(a.renewalTargetAmount)}</td>
                  <td className="px-4 py-3 text-gray-700">{a.daysToRenewal}</td>
                  <td className="px-4 py-3 text-gray-700">{a.freeUsers || '—'}</td>
                  <td className="px-4 py-3 text-gray-700">{a.selfServeUsers || '—'}</td>
                  <td className="px-4 py-3 font-semibold text-gray-900">{a.totalScore}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIER_COLORS[a.tier]}`}>
                      {a.tier}
                    </span>
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-gray-400 text-sm">
                    No accounts match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
