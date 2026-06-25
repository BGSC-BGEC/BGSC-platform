export interface PointsEarnedEvent {
  transactionId: string;
  userId: string;
  amount: number;
  source: string;
  referenceId?: string | null;
  timestamp: string;
}
