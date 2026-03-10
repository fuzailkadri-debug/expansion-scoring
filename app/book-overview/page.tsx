'use client';

import { useAppStore } from '@/lib/store';
import { fmt$, TIER_COLORS, HEALTH_COLORS, RISK_COLORS } from '@/lib/utils';
import MetricCard from '@/components/MetricCard';
import DataTable, { Column } from '@/components/DataTable';
import NoData from '@/components/NoData';
import { Account } from '@/lib/types';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';

const HEALTH_CHART_COLORS: Record<string, string> = {
  'Extra Green': '#10b981',
  'Green': '#22c55e',
  'Yellow': '#f59e0b',
  'Red': '#ef4444',
  '(Unknown)': '#9ca3af',
};

const TIER_CHART_COLORS: Record<string, string> = {
  'Tier 1': '#22c55e',
  'Tier 2': '#f59e0b',
  'Tier 3': '#f97316',
  'Below Threshold': '#9ca3af',
  'Need Hex Data': '#d1d5db',
};

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
  const healthCounts = healthOrder
    .map((h) => ({
      health: h || '(Unknown)',
      accounts: accounts.filter((a) => a.healthStatus === h).length,
      pct: ((accounts.filter((a) => a.healthStatus === h).length / accounts.length) * 100).toFixed(1) + '%',
    }))
    .filter((h) => h.accounts > 0);

  const healthChartData = healthCounts.map((h) => ({
    name: h.health,
    value: h.accounts,
  }));

  // Tier distribution
  const tierOrder = ['Tier 1', 'Tier 2', 'Tier 3', 'Below Threshold', 'Need Hex Data'];
  const tierCounts = tierOrder
    .map((t) => ({
      tier: t,
      accounts: accounts.filter((a) => a.tier === t).length,
    }))
    .filter((t) => t.accounts > 0);

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
    .map(([month, { count, arr }]) => ({
      month: month.slice(5), // just MM
      label: month,
      accounts: count,
      arr,
      arrLabel: fmt$(arr),
    }));

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

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Health Donut */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Health Distribution</h2>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="50%" height={180}>
              <PieChart>
                <Pie
                  data={healthChartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                >
                  {healthChartData.map((entry) => (
                    <Cell key={entry.name} fill={HEALTH_CHART_COLORS[entry.name] ?? '#9ca3af'} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => [`${v} accounts`, '']} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              {healthCounts.map((h) => (
                <div key={h.health} className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: HEALTH_CHART_COLORS[h.health] ?? '#9ca3af' }}
                  />
                  <span className="text-xs text-gray-600">{h.health}</span>
                  <span className="text-xs font-semibold text-gray-800 ml-auto">{h.accounts}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tier Distribution */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Expansion Tiers</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={tierCounts} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey="tier" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => [`${v} accounts`, '']} />
              <Bar dataKey="accounts" radius={[4, 4, 0, 0]}>
                {tierCounts.map((t) => (
                  <Cell key={t.tier} fill={TIER_CHART_COLORS[t.tier] ?? '#9ca3af'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Renewal Timeline Bar Chart */}
      {monthly.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">
            Renewal ARR — Next 12 Months
          </h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthly} margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => [fmt$(Number(v)), 'ARR']} />
              <Bar dataKey="arr" fill="#1E3A5F" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
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
