import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Account } from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fmt$(n: number): string {
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

export function fmtPct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

export const TIER_COLORS: Record<string, string> = {
  'Tier 1': 'bg-green-100 text-green-800',
  'Tier 2': 'bg-yellow-100 text-yellow-800',
  'Tier 3': 'bg-orange-100 text-orange-800',
  'Below Threshold': 'bg-gray-100 text-gray-600',
  'Need Hex Data': 'bg-gray-100 text-gray-500',
};

export const HEALTH_COLORS: Record<string, string> = {
  'Extra Green': 'bg-emerald-100 text-emerald-800',
  'Green': 'bg-green-100 text-green-700',
  'Yellow': 'bg-yellow-100 text-yellow-800',
  'Red': 'bg-red-100 text-red-700',
  '': 'bg-gray-100 text-gray-500',
};

export const RISK_COLORS: Record<string, string> = {
  'High Risk': 'bg-red-100 text-red-700',
  'Medium Risk': 'bg-yellow-100 text-yellow-800',
  'Low Risk': 'bg-green-100 text-green-700',
};

export function buildAIContext(accounts: Account[]): string {
  if (!accounts.length) return 'No account data loaded.';

  const totalArr = accounts.reduce((s, a) => s + a.renewalTargetAmount, 0);
  const tier1 = accounts.filter((a) => a.tier === 'Tier 1');
  const highRisk = accounts.filter((a) => a.churnRisk === 'High Risk');
  const renewing30 = accounts.filter((a) => a.daysToRenewal <= 30);
  const renewing90 = accounts.filter((a) => a.daysToRenewal <= 90);

  const tier2 = accounts.filter((a) => a.tier === 'Tier 2');
  const expansionPool = tier1.length > 0 ? tier1 : tier2;
  const expansionLabel = tier1.length > 0 ? 'Tier 1' : 'Tier 2 (highest scored accounts)';
  const top10Expansion = [...expansionPool]
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 10)
    .map(
      (a) =>
        `  - ${a.organization}: Score ${a.totalScore} (${a.tier}), ${a.licenseType}, ` +
        `${a.healthStatus || 'unknown'} health, ${fmtPct(a.trueActivation)} activation, ` +
        `${a.freeUsers} dept-match users, renews in ${a.daysToRenewal}d (${fmt$(a.renewalTargetAmount)})`,
    )
    .join('\n');

  const top10Churn = [...highRisk]
    .sort((a, b) => b.churnScore - a.churnScore)
    .slice(0, 10)
    .map(
      (a) =>
        `  - ${a.organization}: Churn ${a.churnScore}, ${a.healthStatus || 'unknown'} health, ` +
        `${fmtPct(a.trueActivation)} activation, renews in ${a.daysToRenewal}d (${fmt$(a.renewalTargetAmount)})`,
    )
    .join('\n');

  const urgent30 = renewing30
    .sort((a, b) => a.daysToRenewal - b.daysToRenewal)
    .map(
      (a) =>
        `  - ${a.organization}: ${a.daysToRenewal}d, ${a.licenseType}, ` +
        `${a.churnRisk}, ${a.tier} (${fmt$(a.renewalTargetAmount)})`,
    )
    .join('\n');

  return `BOOK OF BUSINESS SUMMARY:
- Total accounts: ${accounts.length}
- Total ARR: ${fmt$(totalArr)}
- Expansion Tier 1: ${tier1.length} accounts (${fmt$(tier1.reduce((s, a) => s + a.renewalTargetAmount, 0))} ARR)
- High churn risk: ${highRisk.length} accounts (${fmt$(highRisk.reduce((s, a) => s + a.renewalTargetAmount, 0))} ARR at risk)
- Renewing ≤ 30 days: ${renewing30.length} accounts
- Renewing ≤ 90 days: ${renewing90.length} accounts

TOP EXPANSION OPPORTUNITIES (${expansionLabel}):
${top10Expansion || '  No accounts loaded yet'}

HIGH CHURN RISK ACCOUNTS:
${top10Churn || '  None flagged as high risk'}

RENEWING IN NEXT 30 DAYS:
${urgent30 || '  None'}

ALL ACCOUNTS (name | license | health | activation | ARR | days-to-renewal | tier | churn-risk):
${accounts
  .sort((a, b) => b.totalScore - a.totalScore)
  .map(
    (a) =>
      `  ${a.organization} | ${a.licenseType} | ${a.healthStatus || 'N/A'} | ` +
      `${fmtPct(a.trueActivation)} | ${fmt$(a.renewalTargetAmount)} | ` +
      `${a.daysToRenewal}d | ${a.tier} | ${a.churnRisk}`,
  )
  .join('\n')}`;
}

export function downloadCSV(accounts: Account[], filename = 'expansion-scoring.csv') {
  const headers = [
    'Organization', 'License Type', 'Health', 'Activation', 'ARR',
    'Days to Renewal', 'Free Users', 'Total Score', 'Tier', 'Churn Score', 'Churn Risk',
  ];
  const rows = accounts.map((a) => [
    `"${a.organization}"`,
    `"${a.licenseType}"`,
    `"${a.healthStatus}"`,
    fmtPct(a.trueActivation),
    a.renewalTargetAmount,
    a.daysToRenewal,
    a.freeUsers,
    a.totalScore,
    `"${a.tier}"`,
    a.churnScore,
    `"${a.churnRisk}"`,
  ]);

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
