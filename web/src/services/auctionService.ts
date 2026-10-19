import { apiClient } from './apiClient'
import type {
  AuctionLot,
  BidRecord,
  LiveAuctionState,
  LotStatus,
} from '../types/auction'
import {
  DEFAULT_AUCTION_LOTS,
  DEFAULT_AUCTION_STATE,
} from '../data/auctionData'

const isMock = import.meta.env.VITE_USE_MOCK === 'true'

// In-memory working copies for local testing
const mockAuctionState: LiveAuctionState = structuredClone(DEFAULT_AUCTION_STATE)
const mockLots: AuctionLot[] = structuredClone(DEFAULT_AUCTION_LOTS)

export async function getLiveAuction(
  eventId: string
): Promise<LiveAuctionState> {
  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 100))
    return structuredClone(mockAuctionState)
  }

  try {
    const res = await apiClient.get<LiveAuctionState>(
      `/events/${eventId}/auction/live`
    )
    return res
  } catch (error) {
    console.warn(`[auctionService] Live state fetch failed for ${eventId}, using mock:`, error)
    return structuredClone(mockAuctionState)
  }
}

export async function getLots(
  eventId: string,
  status?: LotStatus
): Promise<AuctionLot[]> {
  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 100))
    let result = structuredClone(mockLots)
    if (status) {
      result = result.filter((lot) => lot.status === status)
    }
    return result
  }

  try {
    const query = status ? `?status=${status}` : ''
    const res = await apiClient.get<AuctionLot[]>(
      `/events/${eventId}/auction/lots${query}`
    )
    return res
  } catch (error) {
    console.warn(`[auctionService] Lots fetch failed for ${eventId}, using mock:`, error)
    let result = structuredClone(mockLots)
    if (status) {
      result = result.filter((lot) => lot.status === status)
    }
    return result
  }
}

export async function placeBid(
  lotId: string,
  teamId: string,
  amount: number,
  version: number
): Promise<LiveAuctionState> {
  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 100))

    if (mockAuctionState.status === 'paused') {
      throw new Error('Auction is currently paused.')
    }
    if (mockAuctionState.status === 'finished') {
      throw new Error('Auction has already finished.')
    }
    if (!mockAuctionState.active_lot || mockAuctionState.active_lot.id !== lotId) {
      throw new Error('This lot is not currently on the auction block.')
    }

    const team = mockAuctionState.teams.find((t) => t.team_id === teamId)
    if (!team) {
      throw new Error('Franchise team not found.')
    }

    const minRequired = mockAuctionState.active_lot.current_bid
      ? mockAuctionState.active_lot.current_bid +
        (mockAuctionState.config.min_bid_increment || 1000)
      : mockAuctionState.active_lot.base_price

    if (amount < minRequired) {
      throw new Error(
        `Bid must be at least ${minRequired.toLocaleString()} pts.`
      )
    }

    if (team.purse_remaining < amount) {
      throw new Error(
        `Insufficient purse remaining. ${team.name} only has ${team.purse_remaining.toLocaleString()} pts.`
      )
    }

    if (team.members_count >= team.size_max) {
      throw new Error(
        `${team.name} squad roster is full (${team.size_max} players).`
      )
    }

    const lot = mockAuctionState.active_lot
    lot.current_bid = amount
    lot.current_bidder = {
      user_id: team.captain_user_id || 'usr-admin',
      team_id: team.team_id,
      team_name: team.name,
    }
    lot.version = (version || lot.version || 0) + 1
    lot.seconds_remaining = mockAuctionState.config.bid_timer_seconds || 30
    lot.timer_ends_at = new Date(
      Date.now() + lot.seconds_remaining * 1000
    ).toISOString()

    const newBid: BidRecord = {
      bid_id: `bid-${Date.now()}`,
      bidder_user_id: team.captain_user_id || 'usr-admin',
      team_id: team.team_id,
      team_name: team.name,
      amount,
      placed_at: new Date().toISOString(),
    }
    lot.recent_bids.unshift(newBid)

    // Update matching lot in mock lots collection
    const lotInMockList = mockLots.find((l) => l.id === lotId)
    if (lotInMockList) {
      Object.assign(lotInMockList, lot)
    }

    return structuredClone(mockAuctionState)
  }

  const res = await apiClient.post<LiveAuctionState>(`/lots/${lotId}/bid`, {
    amount,
    version,
  })
  return res
}

export async function advanceLot(
  lotId: string
): Promise<{
  settledLot: AuctionLot
  nextLot: AuctionLot | null
  state: LiveAuctionState
}> {
  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 150))

    if (!mockAuctionState.active_lot) {
      throw new Error('No active lot currently on the auction block.')
    }

    const currentActive = mockAuctionState.active_lot

    // Settle active lot (Sold or Unsold)
    if (currentActive.current_bidder && currentActive.current_bid) {
      currentActive.status = 'sold'
      currentActive.sold_to_team_id = currentActive.current_bidder.team_id
      currentActive.sold_to_team_name = currentActive.current_bidder.team_name
      currentActive.sold_amount = currentActive.current_bid

      // Deduct from winning team's purse
      const winningTeam = mockAuctionState.teams.find(
        (t) => t.team_id === currentActive.current_bidder!.team_id
      )
      if (winningTeam) {
        winningTeam.purse_spent += currentActive.sold_amount
        winningTeam.purse_remaining = Math.max(
          0,
          winningTeam.purse_total - winningTeam.purse_spent
        )
        winningTeam.members_count += 1
      }
    } else {
      currentActive.status = 'unsold'
      currentActive.sold_to_team_id = null
      currentActive.sold_to_team_name = null
      currentActive.sold_amount = null
    }

    currentActive.seconds_remaining = 0
    currentActive.timer_ends_at = null

    // Sync in mockLots
    const lotInMockList = mockLots.find((l) => l.id === currentActive.id)
    if (lotInMockList) {
      Object.assign(lotInMockList, currentActive)
    }

    const settledLot = structuredClone(currentActive)

    // Find next queued lot
    const queuedLots = mockLots
      .filter((l) => l.status === 'queued')
      .sort((a, b) => a.order - b.order)

    let nextLot: AuctionLot | null = null
    if (queuedLots.length > 0) {
      const next = queuedLots[0]
      next.status = 'on_block'
      next.seconds_remaining = mockAuctionState.config.bid_timer_seconds || 30
      next.timer_ends_at = new Date(
        Date.now() + next.seconds_remaining * 1000
      ).toISOString()
      mockAuctionState.active_lot = next
      nextLot = structuredClone(next)
    } else {
      mockAuctionState.active_lot = null
      mockAuctionState.status = 'finished'
    }

    return {
      settledLot,
      nextLot,
      state: structuredClone(mockAuctionState),
    }
  }

  const res = await apiClient.post<{
    settledLot: AuctionLot
    nextLot: AuctionLot | null
    state: LiveAuctionState
  }>(`/lots/${lotId}/advance`)
  return res
}

export async function pauseAuction(
  eventId: string
): Promise<LiveAuctionState> {
  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 100))
    mockAuctionState.status = 'paused'
    return structuredClone(mockAuctionState)
  }

  const res = await apiClient.post<LiveAuctionState>(
    `/events/${eventId}/pause`
  )
  return res
}

export async function resumeAuction(
  eventId: string
): Promise<LiveAuctionState> {
  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 100))
    mockAuctionState.status = 'live'
    return structuredClone(mockAuctionState)
  }

  const res = await apiClient.post<LiveAuctionState>(
    `/events/${eventId}/resume`
  )
  return res
}

export function resetMockAuction(): void {
  Object.assign(mockAuctionState, structuredClone(DEFAULT_AUCTION_STATE))
  mockLots.length = 0
  mockLots.push(...structuredClone(DEFAULT_AUCTION_LOTS))
}

export const auctionService = {
  getLiveAuction,
  getLots,
  placeBid,
  advanceLot,
  pauseAuction,
  resumeAuction,
  resetMockAuction,
}

export default auctionService
