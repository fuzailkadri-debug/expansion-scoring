import { Account } from './types';

// ── Scoring tables (mirroring Python generate_scoring.py) ────────────────────

const LICENSE_PTS: Record<string, number> = {
  'Named User': 7,
  'Defined Group': 5,
  'Named User (Chargeback)': 4,
  'Sitewide': 4,
  'Right to Deploy': 3,
};

const HEALTH_PTS: Record<string, number> = {
  'Extra Green': 25,
  'Green': 20,
  'Yellow': 14,  // Fixed: was 8, should be midpoint between Green (20) and Red (3)
  'Red': 3,
};

const FREE_USER_BRACKETS: [number, number][] = [
  [50, 25], [30, 22], [20, 18], [10, 14], [5, 10], [1, 5], [0, 0],
];

const ACTIVATION_BRACKETS: [number, number][] = [
  [1.0, 18], [0.95, 16], [0.90, 14], [0.80, 10], [0.70, 6], [0, 2],
];

const ARR_BRACKETS: [number, number][] = [
  [25000, 10], [15000, 8], [10000, 6], [5000, 4], [0, 2],
];

const RENEWAL_ANYTIME: [number, number][] = [
  [30, 15], [60, 13], [90, 11], [120, 9], [180, 6], [999, 3],
];

const RENEWAL_DG_SW: [number, number][] = [
  [30, 20], [60, 17], [90, 14], [120, 10], [180, 5], [999, 2],
];

// Active users scoring — DG/Sitewide only (max 5 pts)
// Measures engagement ratio: active users last 90d / seats filled
const ACTIVE_USER_BRACKETS: [number, number][] = [
  [0.9, 5], [0.7, 4], [0.5, 3], [0.3, 2], [0.01, 1], [0, 0],
];

export const TIER_THRESHOLDS: [number, string][] = [
  [70, 'Tier 1'], [50, 'Tier 2'], [35, 'Tier 3'], [0, 'Below Threshold'],
];

const DG_SW_TYPES = ['Defined Group', 'Sitewide'];

// ── Helper functions ──────────────────────────────────────────────────────────

function getScore(value: number, brackets: [number, number][]): number {
  for (const [threshold, pts] of brackets) {
    if (value >= threshold) return pts;
  }
  return 0;
}

function getRenewalScore(days: number, brackets: [number, number][]): number {
  for (const [threshold, pts] of brackets) {
    if (days <= threshold) return pts;
  }
  return 0;
}

function parseNumber(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0;
  const str = String(val).replace(/[$,%]/g, '').trim();
  const n = parseFloat(str);
  return isNaN(n) ? 0 : n;
}

function standardizeHealth(val: unknown): string {
  if (!val) return '';
  const v = String(val).toLowerCase().trim();
  if (v.includes('extra') && v.includes('green')) return 'Extra Green';
  if (v === 'green') return 'Green';
  if (v === 'yellow') return 'Yellow';
  if (v === 'red' || v === 'orange') return 'Red';
  return '';
}

function extractOrg(name: string): string {
  const cleaned = name.replace(/^CS FY\d{2} (Pilot )?Renewal:\s*/i, '');
  return cleaned.split('//')[0].trim();
}

function calcActivation(
  licenseType: string,
  seatsFilled: number,
  currentSeats: number,
  initialSeats: number,
): number {
  if (DG_SW_TYPES.includes(licenseType)) {
    return initialSeats > 0 ? seatsFilled / initialSeats : 0;
  }
  return currentSeats > 0 ? seatsFilled / currentSeats : 0;
}

function daysUntil(dateStr: string): number {
  if (!dateStr) return 365;
  // Try MM/DD/YYYY first, then ISO
  let d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      d = new Date(`${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`);
    }
  }
  if (isNaN(d.getTime())) return 365;
  const diff = Math.round((d.getTime() - Date.now()) / 86400000);
  return diff;
}

// ── Data loading ──────────────────────────────────────────────────────────────

export function parseSalesforceRows(rows: Record<string, unknown>[]): Partial<Account>[] {
  return rows.map((row) => {
    const oppName = String(row['Opportunity Name'] ?? '');
    const licenseType = String(row['License Type'] ?? '');
    const renewalDate = String(row['Renewal Date'] ?? '');
    const seatsFilled = parseNumber(row['Seats Filled']);
    const currentSeats = parseNumber(row['Current Number of Seats Available']);
    const initialSeats = parseNumber(row['Initial Number of Seats']);

    return {
      opportunityName: oppName,
      organization: extractOrg(oppName),
      licenseType,
      healthStatus: standardizeHealth(row['Customer Usage Health']),
      renewalTargetAmount: parseNumber(row['Renewal Target Amount']),
      renewalDate,
      daysToRenewal: daysUntil(renewalDate),
      seatsFilled,
      currentSeatsAvailable: currentSeats,
      initialSeats,
      trueActivation: calcActivation(licenseType, seatsFilled, currentSeats, initialSeats),
      freeUsers: 0,
      selfServeUsers: 0,
      freeUsersUnmatched: 0,
      selfServeUnmatched: 0,
      activeUsersLast90Days: parseNumber(row['Active Users Last 90 Days']) || undefined,
    };
  });
}

export interface HexLookup {
  free: Map<string, number>;
  selfServe: Map<string, number>;
  freeUnmatched: Map<string, number>;
  selfServeUnmatched: Map<string, number>;
}

export function parseHexRows(rows: Record<string, unknown>[]): HexLookup {
  const empty = { free: new Map<string, number>(), selfServe: new Map<string, number>(), freeUnmatched: new Map<string, number>(), selfServeUnmatched: new Map<string, number>() };
  if (!rows.length) return empty;

  const normalizeKey = (s: string) =>
    s.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  const normalizeStr = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

  const normalized = rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) out[normalizeKey(k)] = v;
    return out;
  });

  const keys = Object.keys(normalized[0]);

  const oppCol =
    keys.find((k) => k === 'opportunity_name') ??
    keys.find((k) => k.includes('opportunity')) ??
    'opportunity_name';

  // Dept-matched columns (same dept as licensed account)
  const freeDeptCol = keys.find((k) => k.startsWith('free') && k.includes('with_dept_match'));
  const ssDeptCol = keys.find((k) => (k.startsWith('self') || k.startsWith('ss')) && k.includes('with_dept_match'));

  // Unmatched columns (other depts at same institution = CSQL signal)
  const freeUnmatchedCol = keys.find((k) => k.startsWith('free') && k.includes('without_dept_match'));
  const ssUnmatchedCol = keys.find((k) => (k.startsWith('self') || k.startsWith('ss')) && k.includes('without_dept_match'));

  // Combined fallback
  const combinedDeptCol = !freeDeptCol && !ssDeptCol
    ? keys.find((k) => k.includes('with_dept_match') || k === 'num_users_with_dept_match')
    : null;

  // Total fallback
  const freeFallbackCol = keys.find((k) => k === 'num_free_users' || k === 'total_free_users');
  const ssFallbackCol = keys.find((k) => k === 'total_self_serve_users' || k.includes('total_self_serve'));

  console.log('[Hex] ALL column keys:', keys);
  console.log('[Hex] free-dept:', freeDeptCol, '| ss-dept:', ssDeptCol, '| free-unmatched:', freeUnmatchedCol, '| ss-unmatched:', ssUnmatchedCol);

  const freeAgg = new Map<string, number>();
  const ssAgg = new Map<string, number>();
  const freeUnmatchedAgg = new Map<string, number>();
  const ssUnmatchedAgg = new Map<string, number>();

  for (const row of normalized) {
    const key = normalizeStr(String(row[oppCol] ?? ''));
    if (!key) continue;

    const freeVal = freeDeptCol
      ? parseNumber(row[freeDeptCol])
      : combinedDeptCol ? parseNumber(row[combinedDeptCol])
      : freeFallbackCol ? parseNumber(row[freeFallbackCol]) : 0;

    const ssVal = ssDeptCol
      ? parseNumber(row[ssDeptCol])
      : ssFallbackCol ? parseNumber(row[ssFallbackCol]) : 0;

    const freeUnmatched = freeUnmatchedCol ? parseNumber(row[freeUnmatchedCol]) : 0;
    const ssUnmatched = ssUnmatchedCol ? parseNumber(row[ssUnmatchedCol]) : 0;

    freeAgg.set(key, (freeAgg.get(key) ?? 0) + freeVal);
    ssAgg.set(key, (ssAgg.get(key) ?? 0) + ssVal);
    freeUnmatchedAgg.set(key, (freeUnmatchedAgg.get(key) ?? 0) + freeUnmatched);
    ssUnmatchedAgg.set(key, (ssUnmatchedAgg.get(key) ?? 0) + ssUnmatched);
  }

  console.log('[Hex] Parsed', rows.length, 'rows →', freeAgg.size, 'unique opportunities');
  console.log('[Hex] Top 5 by free dept-match:', [...freeAgg.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5));

  return { free: freeAgg, selfServe: ssAgg, freeUnmatched: freeUnmatchedAgg, selfServeUnmatched: ssUnmatchedAgg };
}

export function mergeAndScore(
  sfRows: Record<string, unknown>[],
  hexRows: Record<string, unknown>[],
  zdRows: Record<string, unknown>[] | null,
): Account[] {
  const accounts = parseSalesforceRows(sfRows);
  const hexLookup = parseHexRows(hexRows);
  const hexWasUploaded = hexRows.length > 0;

  const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

  // Merge hex data — store free, self-serve, and unmatched (CSQL) separately
  let hexMatched = 0;
  for (const acct of accounts) {
    if (acct.opportunityName) {
      const key = normalize(acct.opportunityName);
      const freeVal = hexLookup.free.get(key);
      const ssVal = hexLookup.selfServe.get(key);
      acct.freeUsers = freeVal ?? 0;
      acct.selfServeUsers = ssVal ?? 0;
      acct.freeUsersUnmatched = hexLookup.freeUnmatched.get(key) ?? 0;
      acct.selfServeUnmatched = hexLookup.selfServeUnmatched.get(key) ?? 0;
      if (freeVal !== undefined || ssVal !== undefined) hexMatched++;
    }
  }
  console.log('[Merge] Hex matched', hexMatched, 'of', accounts.length, 'SF accounts');

  // Build Zendesk lookup
  const zdLookup = new Map<string, number>();
  if (zdRows) {
    const orgCol = Object.keys(zdRows[0] ?? {}).find(
      (k) => k.toLowerCase().includes('organization') || k.toLowerCase().includes('company'),
    );
    const ticketCol = Object.keys(zdRows[0] ?? {}).find(
      (k) => k.toLowerCase().includes('count') || k.toLowerCase().includes('ticket'),
    );
    if (orgCol && ticketCol) {
      for (const row of zdRows) {
        const key = normalize(String(row[orgCol] ?? ''));
        zdLookup.set(key, (zdLookup.get(key) ?? 0) + parseNumber(row[ticketCol]));
      }
    }
  }

  // Score each account
  return accounts.map((acct) => scoreAccount(acct, zdLookup, hexWasUploaded));
}

function scoreAccount(
  acct: Partial<Account>,
  zdLookup: Map<string, number>,
  hexWasUploaded: boolean,
): Account {
  const lt = acct.licenseType ?? '';
  const isDgSw = DG_SW_TYPES.includes(lt);
  const freeUsers = acct.freeUsers ?? 0;
  const selfServeUsers = acct.selfServeUsers ?? 0;
  const totalDeptMatchUsers = freeUsers + selfServeUsers;

  const licensePts = LICENSE_PTS[lt] ?? 0;
  const healthPts = HEALTH_PTS[acct.healthStatus ?? ''] ?? 0;
  const activationPts = getScore(acct.trueActivation ?? 0, ACTIVATION_BRACKETS);
  const freeUserPts = getScore(totalDeptMatchUsers, FREE_USER_BRACKETS);
  const arrPts = getScore(acct.renewalTargetAmount ?? 0, ARR_BRACKETS);
  const renewalPts = getRenewalScore(
    acct.daysToRenewal ?? 365,
    isDgSw ? RENEWAL_DG_SW : RENEWAL_ANYTIME,
  );

  // Active Users Last 90 Days — DG/Sitewide only
  let activeUsersPts = 0;
  if (isDgSw && acct.activeUsersLast90Days !== undefined && acct.activeUsersLast90Days > 0) {
    const seatsFilled = acct.seatsFilled ?? 0;
    const ratio = seatsFilled > 0
      ? acct.activeUsersLast90Days / seatsFilled
      : 1; // if no seats filled but active users exist, treat as 100%
    activeUsersPts = getScore(ratio, ACTIVE_USER_BRACKETS);
  }

  // Always score on available signals — only mark 'Need Hex Data' if hex not uploaded
  const totalScore = licensePts + healthPts + activationPts + freeUserPts + arrPts + renewalPts + activeUsersPts;

  let tier = 'Below Threshold';
  if (!hexWasUploaded && freeUsers === 0) {
    tier = 'Need Hex Data';
  } else {
    for (const [threshold, tierName] of TIER_THRESHOLDS) {
      if (totalScore >= threshold) {
        tier = tierName;
        break;
      }
    }
  }

  // Churn scoring
  const health = acct.healthStatus ?? '';
  const churnHealthPts =
    health === 'Red' ? 40 :
    health === 'Yellow' ? 20 :
    health === 'Green' ? 0 :
    health === 'Extra Green' ? -5 : 15;

  const activation = acct.trueActivation ?? 0;
  const churnActivationPts =
    activation < 0.5 ? 30 :
    activation < 0.7 ? 20 :
    activation < 0.8 ? 10 :
    activation < 0.9 ? 5 : 0;

  const days = acct.daysToRenewal ?? 365;
  const badHealth = ['Red', 'Yellow', ''].includes(health);
  const churnRenewalPts = badHealth
    ? days <= 30 ? 20 : days <= 60 ? 15 : days <= 90 ? 10 : 0
    : 0;

  const churnScore = churnHealthPts + churnActivationPts + churnRenewalPts;
  const churnRisk: 'High Risk' | 'Medium Risk' | 'Low Risk' =
    churnScore >= 55 ? 'High Risk' :
    churnScore >= 25 ? 'Medium Risk' : 'Low Risk';

  const orgKey = (acct.organization ?? '').toLowerCase().trim();

  return {
    opportunityName: acct.opportunityName ?? '',
    organization: acct.organization ?? '',
    licenseType: lt,
    healthStatus: health,
    renewalTargetAmount: acct.renewalTargetAmount ?? 0,
    renewalDate: acct.renewalDate ?? '',
    daysToRenewal: acct.daysToRenewal ?? 365,
    seatsFilled: acct.seatsFilled ?? 0,
    currentSeatsAvailable: acct.currentSeatsAvailable ?? 0,
    initialSeats: acct.initialSeats ?? 0,
    trueActivation: acct.trueActivation ?? 0,
    freeUsers,
    selfServeUsers,
    freeUsersUnmatched: acct.freeUsersUnmatched ?? 0,
    selfServeUnmatched: acct.selfServeUnmatched ?? 0,
    activeUsersLast90Days: acct.activeUsersLast90Days,
    licensePts,
    healthPts,
    activationPts,
    freeUserPts,
    arrPts,
    renewalPts,
    activeUsersPts,
    totalScore,
    tier,
    churnHealthPts,
    churnActivationPts,
    churnRenewalPts,
    churnScore,
    churnRisk,
    supportTickets: zdLookup.get(orgKey),
  };
}
