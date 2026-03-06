'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { fmt$, fmtPct, HEALTH_COLORS, RISK_COLORS } from '@/lib/utils';
import MetricCard from '@/components/MetricCard';
import DataTable, { Column } from '@/components/DataTable';
import NoData from '@/components/NoData';
import { Account } from '@/lib/types';

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
    { key: 'daysToRenewal', label: 'Days to Renewal' },
    { key: 'churnScore', label: 'Churn Score' },
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
      label: 'Support Tickets',
      render: (v) => (v != null ? String(v) : '—'),
    },
  ];

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Churn Risk</h1>
        <p className="text-gray-500 text-sm mt-1">Accounts flagged by health, activation, and renewal proximity.</p>
      </div>

      {/* Risk metrics */}
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
          maxHeight="420px"
        />
      </div>

      {/* Urgent */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
          Urgent: High Risk + Renewing Within 90 Days
        </h2>
        {urgent.length === 0 ? (
          <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">
            No high-risk accounts renewing within 90 days.
          </div>
        ) : (
          <>
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2 mb-3">
              {urgent.length} account(s) need immediate attention.
            </div>
            <DataTable
              columns={cols as unknown as Column<Record<string, unknown>>[]}
              data={urgent as unknown as Record<string, unknown>[]}
              maxHeight="300px"
            />
          </>
        )}
      </div>
    </div>
  );
}
