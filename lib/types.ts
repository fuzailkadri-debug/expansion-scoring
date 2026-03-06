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
  freeUsers: number;
  // Expansion scores
  licensePts: number;
  healthPts: number;
  activationPts: number;
  freeUserPts: number;
  arrPts: number;
  renewalPts: number;
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
