export interface EventCompletedEvent {
  eventId: string;
  winners: Array<{ userId: string; sponsorId: string; fanAmount: number }>;
  timestamp: string;
}
