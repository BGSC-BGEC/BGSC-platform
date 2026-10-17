import { api } from '../api/client';
import type { AuctionLiveState, AuctionLot, LotStatus } from '../api/types';

export class AuctionRepository {
  /**
   * GET /auction/events/:ref/live — the live block, timer and team purses.
   * Cached for ~750ms server side; there is no websocket, so poll about once a second.
   */
  live(eventRef: string): Promise<AuctionLiveState> {
    return api.get<AuctionLiveState>(`/auction/events/${encodeURIComponent(eventRef)}/live`);
  }

  /** GET /auction/events/:ref/lots — every lot in running order. */
  lots(eventRef: string, status?: LotStatus): Promise<AuctionLot[]> {
    return api.get<AuctionLot[]>(`/auction/events/${encodeURIComponent(eventRef)}/lots`, {
      params: status ? { status } : undefined,
    });
  }

  /** GET /auction/lots/:id — full lot including its complete bid history. */
  lot(lotId: string): Promise<AuctionLot> {
    return api.get<AuctionLot>(`/auction/lots/${lotId}`);
  }

  /**
   * POST /auction/lots/:id/bid — `version` must be the active lot's current version;
   * a stale version answers 409 conflict_concurrent_bid.
   */
  bid(lotId: string, amount: number, version: number): Promise<AuctionLot> {
    return api.post<AuctionLot>(`/auction/lots/${lotId}/bid`, { amount, version });
  }
}

export const auctionRepository = new AuctionRepository();

/** Smallest legal bid for the lot currently on the block. */
export function minimumBid(lot: NonNullable<AuctionLiveState['active_lot']>, increment: number): number {
  if (lot.current_bid == null || !lot.current_bidder) {
    return lot.oc_adjusted_price ?? lot.base_price;
  }
  return lot.current_bid + increment;
}
