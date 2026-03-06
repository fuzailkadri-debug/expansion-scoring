'use client';

import { useAppStore } from '@/lib/store';
import { fmt$, TIER_COLORS, HEALTH_COLORS, RISK_COLORS } from '@/lib/utils';
import MetricCard from '@/components/MetricCard';
import DataTable, { Column } from '@/components/DataTable';
import NoData from '@/components/NoData';
import { Account } from '@/lib/types';

export default function BookOverviewPage() {
  const { accounts, isLoaded } = useAppStore();
  if (!isLoaded) return <NoData />;

  const totalArr = accounts.reduce((s, a) => s + a.renewalTargetAmount, 0);
  const unhealthyArr = accounts
    .filter((a) => ['Red', 'Yellow'].includes(a.healthStatus))
    .reduce((s, a) => s + a.renewalTargetAmount, 0);
  const tier1Arr = accounts
    .filter((a) => a.tier === 'Tier 1')
    .reduce((s, a) => s + a.renewalTargetAmount, 0);
  const highRiskArr = accounts
    .filter((a) => a.churnRisk === 'High Risk')
    .reduce((s, a) => s + a.renewalTargetAmount, 0);

  // Health distribution
  const healthOrder = ['Extra Green', 'Green', 'Yellow', 'Red', ''];
  const healthCounts = healthOrder.map((h) => ({
    health: h || '(Unknown)',
    accounts: accounts.filter((a) => a.healthStatus === h).length,
    pct: ((accounts.filter((a) => a.healthStatus === h).length / accounts.length) * 100).toFixed(1) + '%',
  }));

  // Tier distribution
  const tierOrder = ['Tier 1', 'Tier 2', 'Tier 3', 'Below Threshold', 'Need Hex Data'];
  const tierCounts = tierOrder.map((t) => ({
    tier: t,
    accounts: accounts.filter((a) => a.tier === t).length,
  }));

  // Monthly renewal timeline
  const future = accounts.filter((a) => a.daysToRenewal >= 0 && a.daysToRenewal <= 365);
  const monthMap = new Map<string, { count: number; arr: number }>();
  for (const a of future) {
    if (!a.renewalDate) continue;
    const d = new Date(a.renewalDate);
    if (isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const cur = monthMap.get(key) ?? { count: 0, arr: 0 };
    monthMap.set(key, { count: cur.count + 1, arr: cur.arr + a.renewalTargetAmount });
  }
  const monthly = [...monthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, { count, arr }]) => ({ month, accounts: count, arr: fmt$(arr) }));

  // Top 20 by ARR
  const top20 = [...accounts]
    .sort((a, b) => b.renewalTargetAmount - a.renewalTargetAmount)
    .slice(0, 20);

  const topCols: Column<Account>[] = [
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
        <h1 className="text-2xl font-bold text-gray-900">Book Overview</h1>
        <p className="text-gray-500 text-sm mt-1">ARR breakdown, health distribution, and renewal timeline.</p>
      </div>

      {/* ARR Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Total ARR" value={fmt$(totalArr)} />
        <MetricCard label="ARR — Unhealthy" value={fmt$(unhealthyArr)} sub="Red + Yellow accounts" color="yellow" />
        <MetricCard label="ARR — Tier 1 Expansion" value={fmt$(tier1Arr)} color="green" />
        <MetricCard label="ARR — High Churn Risk" value={fmt$(highRiskArr)} color="red" />
      </div>

      {/* Health + Tier side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Usage Health Distribution</h2>
          <DataTable
            columns={[
              {
                key: 'health',
                label: 'Health',
                render: (v) => (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${HEALTH_COLORS[v === '(Unknown)' ? '' : String(v)]}`}>
                    {String(v)}
                  </span>
                ),
              },
              { key: 'accounts', label: 'Accounts' },
              { key: 'pct', label: '%' },
            ]}
            data={healthCounts.filter((h) => h.accounts > 0) as unknown as Record<string, unknown>[]}
            maxHeight="260px"
          />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Expansion Tiers</h2>
          <DataTable
            columns={[
              {
                key: 'tier',
                label: 'Tier',
                render: (v) => (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIER_COLORS[String(v)]}`}>
                    {String(v)}
                  </span>
                ),
              },
              { key: 'accounts', label: 'Accounts' },
            ]}
            data={tierCounts.filter((t) => t.accounts > 0) as unknown as Record<string, unknown>[]}
            maxHeight="260px"
          />
        </div>
      </div>

      {/* Renewal timeline */}
      {monthly.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
            Renewal Timeline — Next 12 Months
          </h2>
          <DataTable
            columns={[
              { key: 'month', label: 'Month' },
              { key: 'accounts', label: 'Accounts' },
              { key: 'arr', label: 'ARR' },
            ]}
            data={monthly as unknown as Record<string, unknown>[]}
            maxHeight="300px"
          />
        </div>
      )}

      {/* Top 20 */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Top 20 Accounts by ARR</h2>
        <DataTable
          columns={topCols as unknown as Column<Record<string, unknown>>[]}
          data={top20 as unknown as Record<string, unknown>[]}
          maxHeight="480px"
        />
      </div>
    </div>
  );
}
