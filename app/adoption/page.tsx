'use client';

import { useAppStore } from '@/lib/store';
import { fmt$, fmtPct, HEALTH_COLORS, RISK_COLORS } from '@/lib/utils';
import MetricCard from '@/components/MetricCard';
import DataTable, { Column } from '@/components/DataTable';
import NoData from '@/components/NoData';
import { Account } from '@/lib/types';

const BUCKETS = [
  { label: '<50%', lo: 0, hi: 0.5 },
  { label: '50–70%', lo: 0.5, hi: 0.7 },
  { label: '70–80%', lo: 0.7, hi: 0.8 },
  { label: '80–90%', lo: 0.8, hi: 0.9 },
  { label: '90–100%', lo: 0.9, hi: 1.0 },
  { label: '>100% (over-filled)', lo: 1.0, hi: Infinity },
];

export default function AdoptionPage() {
  const { accounts, isLoaded } = useAppStore();
  if (!isLoaded) return <NoData />;

  // Adoption buckets
  const bucketCounts = BUCKETS.map((b) => ({
    label: b.label,
    count: accounts.filter((a) => a.trueActivation >= b.lo && a.trueActivation < b.hi).length,
  }));

  // By license type
  const licenseTypes = Array.from(new Set(accounts.map((a) => a.licenseType))).filter(Boolean);
  const byLicense = licenseTypes.map((lt) => {
    const group = accounts.filter((a) => a.licenseType === lt);
    const avgActivation = group.reduce((s, a) => s + a.trueActivation, 0) / group.length;
    const avgArr = group.reduce((s, a) => s + a.renewalTargetAmount, 0) / group.length;
    return { licenseType: lt, accounts: group.length, avgActivation, avgArr };
  });

  // Low adoption
  const lowAdoption = [...accounts]
    .filter((a) => a.trueActivation < 0.7)
    .sort((a, b) => a.trueActivation - b.trueActivation);

  // Health vs activation cross-tab
  const healthOrder = ['Extra Green', 'Green', 'Yellow', 'Red', ''];
  const bucketLabels = BUCKETS.map((b) => b.label);

  const crossTab = healthOrder
    .filter((h) => accounts.some((a) => a.healthStatus === h))
    .map((h) => {
      const row: Record<string, unknown> = { health: h || '(Unknown)' };
      for (const b of BUCKETS) {
        row[b.label] = accounts.filter(
          (a) => a.healthStatus === h && a.trueActivation >= b.lo && a.trueActivation < b.hi,
        ).length;
      }
      return row;
    });

  const lowAdoptionCols: Column<Account>[] = [
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
      render: (v) => (
        <span className={`font-medium ${Number(v) < 0.5 ? 'text-red-600' : 'text-yellow-700'}`}>
          {fmtPct(Number(v))}
        </span>
      ),
    },
    { key: 'renewalTargetAmount', label: 'ARR', render: (v) => fmt$(Number(v)) },
    { key: 'daysToRenewal', label: 'Days to Renewal' },
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
        <h1 className="text-2xl font-bold text-gray-900">Adoption & Seat Utilisation</h1>
        <p className="text-gray-500 text-sm mt-1">Seat activation distribution across your book.</p>
      </div>

      {/* Activation buckets */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
          Seat Activation Distribution
        </h2>
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
          {bucketCounts.map(({ label, count }) => (
            <MetricCard
              key={label}
              label={label}
              value={count}
              color={label === '<50%' ? 'red' : label.startsWith('50') ? 'yellow' : 'default'}
            />
          ))}
        </div>
      </div>

      {/* By license type */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
          Adoption by License Type
        </h2>
        <DataTable
          columns={[
            { key: 'licenseType', label: 'License Type' },
            { key: 'accounts', label: 'Accounts' },
            { key: 'avgActivation', label: 'Avg Activation', render: (v) => fmtPct(Number(v)) },
            { key: 'avgArr', label: 'Avg ARR', render: (v) => fmt$(Number(v)) },
          ]}
          data={byLicense as unknown as Record<string, unknown>[]}
          maxHeight="280px"
        />
      </div>

      {/* Low adoption */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-1 uppercase tracking-wide">
          Low Adoption Accounts (&lt;70% activation)
        </h2>
        <p className="text-xs text-gray-500 mb-3">{lowAdoption.length} accounts</p>
        <DataTable
          columns={lowAdoptionCols as unknown as Column<Record<string, unknown>>[]}
          data={lowAdoption as unknown as Record<string, unknown>[]}
          maxHeight="400px"
          emptyMessage="No accounts with < 70% activation"
        />
      </div>

      {/* Health vs Activation cross-tab */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-1 uppercase tracking-wide">
          Health vs. Activation Matrix
        </h2>
        <p className="text-xs text-gray-500 mb-3">Rows = health · Columns = activation bucket · Values = account count</p>
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
            ...bucketLabels.map((b) => ({ key: b, label: b, sortable: false as const })),
          ]}
          data={crossTab}
          maxHeight="280px"
        />
      </div>
    </div>
  );
}
