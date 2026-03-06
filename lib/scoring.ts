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
  'Yellow': 8,
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

export const TIER_THRESHOLDS: [number, string][] = [
  [75, 'Tier 1'], [55, 'Tier 2'], [35, 'Tier 3'], [0, 'Below Threshold'],
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
    };
  });
}

export function parseHexRows(rows: Record<string, unknown>[]): Map<string, number> {
  const lookup = new Map<string, number>();
  if (!rows.length) return lookup;

  const firstRow = rows[0];
  const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

  if ('num_free_users' in firstRow) {
    // Format A: aggregate by opportunity_name, use dept_match as primary
    const agg = new Map<string, number>();
    for (const row of rows) {
      const key = normalize(String(row['opportunity_name'] ?? ''));
      const match = parseNumber(row['num_users_with_dept_match']);
      agg.set(key, (agg.get(key) ?? 0) + match);
    }
    agg.forEach((v, k) => lookup.set(k, v));
  } else if ('free_users_with_dept_match' in firstRow) {
    // Format B
    const agg = new Map<string, number>();
    for (const row of rows) {
      const key = normalize(String(row['opportunity_name'] ?? ''));
      const match =
        parseNumber(row['free_users_with_dept_match']) +
        parseNumber(row['self_serve_with_dept_match']);
      agg.set(key, (agg.get(key) ?? 0) + match);
    }
    agg.forEach((v, k) => lookup.set(k, v));
  }

  return lookup;
}

export function mergeAndScore(
  sfRows: Record<string, unknown>[],
  hexRows: Record<string, unknown>[],
  zdRows: Record<string, unknown>[] | null,
): Account[] {
  const accounts = parseSalesforceRows(sfRows);
  const hexLookup = parseHexRows(hexRows);

  const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

  // Merge hex data
  for (const acct of accounts) {
    if (acct.opportunityName) {
      const key = normalize(acct.opportunityName);
      acct.freeUsers = hexLookup.get(key) ?? 0;
    }
  }

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
  return accounts.map((acct) => scoreAccount(acct, zdLookup));
}

function scoreAccount(acct: Partial<Account>, zdLookup: Map<string, number>): Account {
  const lt = acct.licenseType ?? '';
  const isDgSw = DG_SW_TYPES.includes(lt);
  const freeUsers = acct.freeUsers ?? 0;

  const licensePts = LICENSE_PTS[lt] ?? 0;
  const healthPts = HEALTH_PTS[acct.healthStatus ?? ''] ?? 0;
  const activationPts = getScore(acct.trueActivation ?? 0, ACTIVATION_BRACKETS);
  const freeUserPts = getScore(freeUsers, FREE_USER_BRACKETS);
  const arrPts = getScore(acct.renewalTargetAmount ?? 0, ARR_BRACKETS);
  const renewalPts = getRenewalScore(
    acct.daysToRenewal ?? 365,
    isDgSw ? RENEWAL_DG_SW : RENEWAL_ANYTIME,
  );

  let totalScore = 0;
  let tier = 'Need Hex Data';

  if (freeUsers > 0) {
    totalScore = licensePts + healthPts + activationPts + freeUserPts + arrPts + renewalPts;
    tier = 'Below Threshold';
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
    licensePts,
    healthPts,
    activationPts,
    freeUserPts,
    arrPts,
    renewalPts,
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
