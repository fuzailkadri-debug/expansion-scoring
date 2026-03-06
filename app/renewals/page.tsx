'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { fmt$, fmtPct, TIER_COLORS, HEALTH_COLORS, RISK_COLORS } from '@/lib/utils';
import MetricCard from '@/components/MetricCard';
import DataTable, { Column } from '@/components/DataTable';
import NoData from '@/components/NoData';
import { Account } from '@/lib/types';

const RENEWAL_ONLY = ['Defined Group', 'Sitewide'];

const WINDOWS = [
  { label: 'All', lo: 0, hi: Infinity },
  { label: '0–30 days', lo: 0, hi: 30 },
  { label: '31–60 days', lo: 31, hi: 60 },
  { label: '61–90 days', lo: 61, hi: 90 },
  { label: '91–180 days', lo: 91, hi: 180 },
];

export default function RenewalsPage() {
  const { accounts, isLoaded } = useAppStore();
  const [windowFilter, setWindowFilter] = useState('All');

  if (!isLoaded) return <NoData />;

  const inWindow = (lo: number, hi: number) =>
    accounts.filter((a) => a.daysToRenewal >= lo && a.daysToRenewal <= hi);

  const dgSw = accounts.filter((a) => RENEWAL_ONLY.includes(a.licenseType));
  const windowEntry = WINDOWS.find((w) => w.label === windowFilter) ?? WINDOWS[0];
  const dgSwFiltered = [...dgSw]
    .filter((a) => a.daysToRenewal >= windowEntry.lo && a.daysToRenewal <= windowEntry.hi)
    .sort((a, b) => a.daysToRenewal - b.daysToRenewal);

  const upcoming180 = [...accounts]
    .filter((a) => a.daysToRenewal >= 0 && a.daysToRenewal <= 180)
    .sort((a, b) => a.daysToRenewal - b.daysToRenewal);

  const baseCols: Column<Account>[] = [
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
    { key: 'daysToRenewal', label: 'Days to Renewal' },
    {
      key: 'tier',
      label: 'Tier',
      render: (v) => (
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIER_COLORS[String(v)]}`}>
          {String(v)}
        </span>
      ),
    },
    {
      key: 'churnRisk',
      label: 'Churn Risk',
      render: (v) => (
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${RISK_COLORS[String(v)]}`}>
          {String(v)}
        </span>
      ),
    },
  ];

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Renewal Pipeline</h1>
        <p className="text-gray-500 text-sm mt-1">Pipeline by window, urgency flags, and renewal-only expansion.</p>
      </div>

      {/* Window metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: '0–30 days', lo: 0, hi: 30 },
          { label: '31–60 days', lo: 31, hi: 60 },
          { label: '61–90 days', lo: 61, hi: 90 },
          { label: '91–180 days', lo: 91, hi: 180 },
        ].map(({ label, lo, hi }) => {
          const w = inWindow(lo, hi);
          return (
            <MetricCard
              key={label}
              label={label}
              value={w.length}
              sub={fmt$(w.reduce((s, a) => s + a.renewalTargetAmount, 0)) + ' ARR'}
              color={lo === 0 ? 'red' : lo <= 60 ? 'yellow' : 'default'}
            />
          );
        })}
      </div>

      {/* DG / Sitewide */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-1 uppercase tracking-wide">
          Renewal-Only Expansion (Defined Group / Sitewide)
        </h2>
        <p className="text-xs text-gray-500 mb-3">
          {dgSw.length} DG/Sitewide accounts — these can ONLY expand at renewal. Missing the window means waiting a full year.
        </p>
        <div className="mb-3">
          <select
            value={windowFilter}
            onChange={(e) => setWindowFilter(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            {WINDOWS.map((w) => (
              <option key={w.label}>{w.label}</option>
            ))}
          </select>
        </div>
        <DataTable
          columns={baseCols as unknown as Column<Record<string, unknown>>[]}
          data={dgSwFiltered as unknown as Record<string, unknown>[]}
          maxHeight="360px"
          emptyMessage="No DG/Sitewide accounts in this window"
        />
      </div>

      {/* All upcoming */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
          All Upcoming Renewals (Next 180 Days) — {upcoming180.length} accounts
        </h2>
        <DataTable
          columns={baseCols as unknown as Column<Record<string, unknown>>[]}
          data={upcoming180 as unknown as Record<string, unknown>[]}
          maxHeight="480px"
          emptyMessage="No renewals in the next 180 days"
        />
      </div>
    </div>
  );
}
