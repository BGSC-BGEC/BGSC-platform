export type LotStatus = 'queued' | 'on_block' | 'settling' | 'sold' | 'unsold'
export type AuctionStatus = 'draft' | 'live' | 'paused' | 'finished'

export interface AuctionPlayer {
  user_id: string
  username: string
  display_name: string
  avatar_url?: string
  role_or_title?: string
}

export interface BidRecord {
  bid_id: string
  bidder_user_id: string
  team_id: string
  team_name: string
  amount: number
  placed_at: string
}

export interface AuctionLot {
  id: string
  event_id: string
  order: number
  player: AuctionPlayer
  registration_id: string
  base_price: number
  oc_adjusted_price?: number | null
  status: LotStatus
  current_bid: number | null
  current_bidder: { user_id: string; team_id: string; team_name: string } | null
  timer_ends_at: string | null
  seconds_remaining?: number | null
  version: number
  recent_bids: BidRecord[]
  sold_to_team_id?: string | null
  sold_to_team_name?: string | null
  sold_amount?: number | null
}

export interface TeamPurse {
  team_id: string
  name: string
  captain_user_id: string
  captain_name?: string
  logo_url?: string
  purse_total: number
  purse_spent: number
  purse_remaining: number
  members_count: number
  size_max: number
}

export interface LiveAuctionState {
  event_id: string
  slug: string
  title: string
  status: AuctionStatus
  config: {
    min_bid_increment: number
    bid_timer_seconds: number
    purse_per_team?: number
  }
  active_lot: AuctionLot | null
  teams: TeamPurse[]
}
