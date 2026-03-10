export interface Account {
  opportunityName: string;
  organization: string;
  licenseType: string;
  healthStatus: string;
  renewalTargetAmount: number;
  renewalDate: string;
  daysToRenewal: number;
  seatsFilled: number;
  currentSeatsAvailable: number;
  initialSeats: number;
  trueActivation: number;
  freeUsers: number;              // free users with dept match (same dept as licensed)
  selfServeUsers: number;         // self-serve users with dept match (same dept as licensed)
  freeUsersUnmatched: number;     // free users in OTHER depts at same institution (CSQL signal)
  selfServeUnmatched: number;     // self-serve users in OTHER depts at same institution (CSQL signal)
  activeUsersLast90Days?: number;
  // Expansion scores
  licensePts: number;
  healthPts: number;
  activationPts: number;
  freeUserPts: number;
  arrPts: number;
  renewalPts: number;
  activeUsersPts: number;
  totalScore: number;
  tier: string;
  // Churn scores
  churnHealthPts: number;
  churnActivationPts: number;
  churnRenewalPts: number;
  churnScore: number;
  churnRisk: 'High Risk' | 'Medium Risk' | 'Low Risk';
  supportTickets?: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface Note {
  id: string;
  text: string;
  timestamp: number;
}
