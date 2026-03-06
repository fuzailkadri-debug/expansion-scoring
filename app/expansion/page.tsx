'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { fmt$, fmtPct, TIER_COLORS, HEALTH_COLORS } from '@/lib/utils';
import { downloadCSV } from '@/lib/utils';
import MetricCard from '@/components/MetricCard';
import DataTable, { Column } from '@/components/DataTable';
import NoData from '@/components/NoData';
import { Account } from '@/lib/types';

const ANYTIME = ['Named User', 'Named User (Chargeback)', 'Right to Deploy'];
const RENEWAL_ONLY = ['Defined Group', 'Sitewide'];
const TIER_ORDER = ['All', 'Tier 1', 'Tier 2', 'Tier 3', 'Below Threshold', 'Need Hex Data'];

export default function ExpansionPage() {
  const { accounts, isLoaded, hasHexData } = useAppStore();
  const [tierFilter, setTierFilter] = useState('All');
  const [trackFilter, setTrackFilter] = useState('All');

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
    {
      key: 'trueActivation',
      label: 'Activation',
      render: (v) => fmtPct(Number(v)),
    },
    {
      key: 'renewalTargetAmount',
      label: 'ARR',
      render: (v) => fmt$(Number(v)),
    },
    { key: 'daysToRenewal', label: 'Days to Renewal' },
    { key: 'freeUsers', label: 'Free Users (Dept)' },
    { key: 'totalScore', label: 'Score' },
    {
      key: 'tier',
      label: 'Tier',
      render: (v) => (
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIER_COLORS[String(v)]}`}>
          {String(v)}
        </span>
      ),
    },
  ];

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expansion Opportunities</h1>
          <p className="text-gray-500 text-sm mt-1">
            Accounts scored by expansion potential. Tier 1 = 75+ points.
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
      <div className="flex gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Tier</label>
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            {TIER_ORDER.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Track</label>
          <select
            value={trackFilter}
            onChange={(e) => setTrackFilter(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            {['All', 'Anytime', 'Renewal-Only'].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end pb-1 text-sm text-gray-500">
          {sorted.length} accounts
        </div>
      </div>

      <DataTable
        columns={cols as unknown as Column<Record<string, unknown>>[]}
        data={sorted as unknown as Record<string, unknown>[]}
        maxHeight="520px"
      />
    </div>
  );
}
