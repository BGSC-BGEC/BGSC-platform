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

function normalizeLot(raw: Record<string, unknown>): AuctionLot {
  const playerObj = (raw.player as Record<string, unknown>) || {}
  const settlementObj = (raw.settlement as Record<string, unknown>) || {}
  const currentBidder =
    (raw.current_bidder as AuctionLot['current_bidder']) || null

  return {
    id: String(raw.id || raw.lot_id || raw._id || ''),
    event_id: String(raw.event_id || ''),
    order: Number(raw.order ?? 1),
    player: {
      user_id: String(playerObj.user_id || ''),
      username: String(playerObj.username || 'player'),
      display_name: String(
        playerObj.display_name || playerObj.username || 'Player'
      ),
      avatar_url: playerObj.avatar_url ? String(playerObj.avatar_url) : undefined,
      role_or_title: playerObj.role_or_title
        ? String(playerObj.role_or_title)
        : undefined,
    },
    registration_id: String(raw.registration_id || ''),
    base_price: Number(raw.base_price ?? 100),
    oc_adjusted_price:
      raw.oc_adjusted_price !== undefined && raw.oc_adjusted_price !== null
        ? Number(raw.oc_adjusted_price)
        : null,
    status: (raw.status as LotStatus) || 'queued',
    current_bid:
      raw.current_bid !== undefined && raw.current_bid !== null
        ? Number(raw.current_bid)
        : null,
    current_bidder: currentBidder,
    timer_ends_at: raw.timer_ends_at ? String(raw.timer_ends_at) : null,
    seconds_remaining:
      raw.seconds_remaining !== undefined && raw.seconds_remaining !== null
        ? Number(raw.seconds_remaining)
        : null,
    version: Number(raw.version ?? 0),
    recent_bids: Array.isArray(raw.recent_bids)
      ? (raw.recent_bids as BidRecord[])
      : [],
    sold_to_team_id: String(
      raw.sold_to_team_id || settlementObj.winning_team_id || ''
    ) || null,
    sold_to_team_name: String(
      raw.sold_to_team_name || settlementObj.winning_team_name || ''
    ) || null,
    sold_amount:
      raw.sold_amount !== undefined && raw.sold_amount !== null
        ? Number(raw.sold_amount)
        : settlementObj.final_price !== undefined &&
            settlementObj.final_price !== null
          ? Number(settlementObj.final_price)
          : null,
  }
}

function normalizeLiveState(raw: Record<string, unknown>): LiveAuctionState {
  const activeLotRaw = raw.active_lot as Record<string, unknown> | null | undefined
  const configRaw = (raw.config as Record<string, unknown>) || {}

  return {
    event_id: String(raw.event_id || ''),
    slug: String(raw.slug || ''),
    title: String(raw.title || 'Live Tournament Auction'),
    status: (raw.status as LiveAuctionState['status']) || 'not_started',
    config: {
      min_bid_increment: Number(configRaw.min_bid_increment ?? 100),
      bid_timer_seconds: Number(configRaw.bid_timer_seconds ?? 15),
      purse_per_team:
        configRaw.purse_per_team !== undefined && configRaw.purse_per_team !== null
          ? Number(configRaw.purse_per_team)
          : undefined,
    },
    active_lot: activeLotRaw ? normalizeLot(activeLotRaw) : null,
    teams: Array.isArray(raw.teams)
      ? (raw.teams as LiveAuctionState['teams'])
      : [],
  }
}

export async function getLiveAuction(
  eventId: string
): Promise<LiveAuctionState> {
  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 100))
    return structuredClone(mockAuctionState)
  }

  // No mock fallback outside mock mode: a silent fallback showed fake lots whose ids the
  // backend then rejected (lot_not_found). Let the page show the real error instead.
  const res = await apiClient.get<Record<string, unknown>>(
    `/events/${eventId}/auction/live`
  )
  return normalizeLiveState(res)
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

  // No mock fallback outside mock mode (see getLiveAuction).
  const query = status ? `?status=${status}` : ''
  const res = await apiClient.get<
    Record<string, unknown>[] | { lots?: Record<string, unknown>[] }
  >(`/events/${eventId}/auction/lots${query}`)
  const list = Array.isArray(res) ? res : res?.lots || []
  return list.map(normalizeLot)
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

    const lotInMockList = mockLots.find((l) => l.id === lotId)
    if (lotInMockList) {
      Object.assign(lotInMockList, lot)
    }

    return structuredClone(mockAuctionState)
  }

  // The backend answers with the updated lot, not the live state, so reload the live state.
  const lot = await apiClient.post<Record<string, unknown>>(
    `/auction/lots/${lotId}/bid`,
    {
      amount,
      version,
    }
  )
  return getLiveAuction(String(lot.event_id))
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

    if (currentActive.current_bidder && currentActive.current_bid) {
      currentActive.status = 'sold'
      currentActive.sold_to_team_id = currentActive.current_bidder.team_id
      currentActive.sold_to_team_name = currentActive.current_bidder.team_name
      currentActive.sold_amount = currentActive.current_bid

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

    const lotInMockList = mockLots.find((l) => l.id === currentActive.id)
    if (lotInMockList) {
      Object.assign(lotInMockList, currentActive)
    }

    const settledLot = structuredClone(currentActive)

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

  // Backend shape: { settled_lot, next_lot } (snake_case, no live state).
  const res = await apiClient.post<{
    settled_lot?: Record<string, unknown>
    next_lot?: Record<string, unknown> | null
  }>(`/auction/lots/${lotId}/advance`)

  const settledLot = normalizeLot(res.settled_lot || {})
  return {
    settledLot,
    nextLot: res.next_lot ? normalizeLot(res.next_lot) : null,
    state: await getLiveAuction(settledLot.event_id),
  }
}

export async function startAuction(eventId: string): Promise<LiveAuctionState> {
  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 100))
    mockAuctionState.status = 'live'
    return structuredClone(mockAuctionState)
  }

  const res = await apiClient.post<Record<string, unknown>>(
    `/auction/events/${eventId}/start`
  )
  return normalizeLiveState(res)
}

export async function closeAuction(eventId: string): Promise<LiveAuctionState> {
  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 100))
    mockAuctionState.status = 'finished'
    mockAuctionState.active_lot = null
    return structuredClone(mockAuctionState)
  }

  const res = await apiClient.post<Record<string, unknown>>(
    `/auction/events/${eventId}/close`
  )
  return normalizeLiveState(res)
}

export async function pauseAuction(
  eventId: string
): Promise<LiveAuctionState> {
  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 100))
    mockAuctionState.status = 'paused'
    return structuredClone(mockAuctionState)
  }

  const res = await apiClient.post<Record<string, unknown>>(
    `/auction/events/${eventId}/pause`
  )
  return normalizeLiveState(res)
}

export async function resumeAuction(
  eventId: string
): Promise<LiveAuctionState> {
  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 100))
    mockAuctionState.status = 'live'
    return structuredClone(mockAuctionState)
  }

  const res = await apiClient.post<Record<string, unknown>>(
    `/auction/events/${eventId}/resume`
  )
  return normalizeLiveState(res)
}

export async function updateConfig(
  eventId: string,
  config: {
    min_bid_increment?: number
    bid_timer_seconds?: number
    purse_per_team?: number | null
  }
): Promise<boolean> {
  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 100))
    if (config.min_bid_increment !== undefined) {
      mockAuctionState.config.min_bid_increment = config.min_bid_increment
    }
    if (config.bid_timer_seconds !== undefined) {
      mockAuctionState.config.bid_timer_seconds = config.bid_timer_seconds
    }
    if (config.purse_per_team !== undefined && config.purse_per_team !== null) {
      mockAuctionState.config.purse_per_team = config.purse_per_team
    }
    return true
  }

  await apiClient.patch(`/auction/events/${eventId}/config`, config)
  return true
}

export async function createLots(
  eventId: string,
  lots: {
    registration_id: string
    user_id: string
    base_price: number
    order: number
    username?: string
    display_name?: string
  }[]
): Promise<AuctionLot[]> {
  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 150))
    const created = lots.map((item, idx) => {
      const lot: AuctionLot = {
        id: `lot-${Date.now()}-${idx}`,
        event_id: eventId,
        order: item.order,
        player: {
          user_id: item.user_id,
          username: item.username || 'player',
          display_name: item.display_name || 'New Auction Player',
        },
        registration_id: item.registration_id,
        base_price: item.base_price,
        status: 'queued',
        current_bid: null,
        current_bidder: null,
        timer_ends_at: null,
        seconds_remaining: null,
        version: 1,
        recent_bids: [],
      }
      mockLots.push(lot)
      return lot
    })
    return created
  }

  const res = await apiClient.post<
    Record<string, unknown>[] | { lots?: Record<string, unknown>[] }
  >(`/auction/events/${eventId}/lots`, { lots })
  const list = Array.isArray(res) ? res : res?.lots || []
  return list.map(normalizeLot)
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
  startAuction,
  closeAuction,
  pauseAuction,
  resumeAuction,
  updateConfig,
  createLots,
  resetMockAuction,
}

export default auctionService
