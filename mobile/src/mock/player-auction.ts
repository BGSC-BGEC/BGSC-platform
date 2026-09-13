export type AuctionLotStatus = 'queued' | 'on_block' | 'sold' | 'unsold';

export interface AuctionPlayer {
  id: string;
  name: string;
  role: string;
  basePrice: number;
  status: AuctionLotStatus;
}

export interface AuctionBid {
  id: string;
  captain: string;
  team: string;
  amount: number;
  timeLabel: string;
}

export const MOCK_PLAYER_AUCTION = {
  eventId: 'bgsc-cricket-auction',
  title: 'BGSC Cricket League Player Auction',
  currentPlayerId: 'player-aman',
  secondsRemaining: 5,
  players: [
    { id: 'player-aman', name: 'Aman Verma', role: 'All-rounder', basePrice: 100, status: 'on_block' },
    { id: 'player-rishabh', name: 'Rishabh Nair', role: 'Opening batter', basePrice: 100, status: 'queued' },
    { id: 'player-sahil', name: 'Sahil Shah', role: 'Fast bowler', basePrice: 100, status: 'queued' },
  ] satisfies AuctionPlayer[],
  bids: [
    { id: 'bid-1', captain: 'Maya K.', team: 'Campus United', amount: 300, timeLabel: 'Just now' },
    { id: 'bid-2', captain: 'Rohan S.', team: 'North Stars', amount: 200, timeLabel: '2s ago' },
  ] satisfies AuctionBid[],
  captains: [
    { name: 'Maya K.', team: 'Campus United', purse: 1200, spent: 300 },
    { name: 'Rohan S.', team: 'North Stars', purse: 1200, spent: 200 },
    { name: 'Arjun P.', team: 'Orange Eleven', purse: 1200, spent: 0 },
  ],
};