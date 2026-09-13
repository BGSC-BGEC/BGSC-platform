export interface MockBid {
  id: string;
  bidder: string;
  amount: number;
  timeLabel: string;
}

export const MOCK_AUCTION = {
  eventId: 'bgec-esports',
  title: 'BGEC Esports Championship Draft',
  description: 'Use your points to back a team in this season\'s championship draft.',
  currentBid: 1800,
  minimumIncrement: 100,
  secondsRemaining: 4 * 60 + 32,
  bids: [
    { id: 'bid-1', bidder: 'Rohan S.', amount: 1800, timeLabel: 'Just now' },
    { id: 'bid-2', bidder: 'Maya K.', amount: 1700, timeLabel: '2m ago' },
    { id: 'bid-3', bidder: 'Arjun P.', amount: 1500, timeLabel: '4m ago' },
  ] satisfies MockBid[],
};