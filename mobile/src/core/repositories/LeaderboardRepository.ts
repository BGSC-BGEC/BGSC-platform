/**
 * Leaderboard-domain writes (leaderboard.md §4.4 Points Investment).
 *
 * Reads are already covered by existing repositories — reuse those instead:
 *   - EventRepository.getLeaderboard()          → GET /events/:id/leaderboard (event-service, Phase 1, live)
 *   - HallOfFameRepository.getSponsorChampions() → GET /hall-of-fame/sponsor-champions (sponsor standings)
 *   - UserRepository.getSponsorStats()          → GET /users/me/sponsor-stats (own affiliation)
 *   - PointsRepository.getBalance()             → GET /points/me/balance (sheet balance)
 *
 * Only the investment WRITE is new — and no backend endpoint exists for it yet.
 * points-service.md documents award/participation only; the master doc's
 * PointTransaction shape (type: 'spend', source: 'leaderboard') implies a
 * future POST /points/invest. Until then this is a local mock so the full
 * mechanic (sheet → confirm → optimistic re-rank) is exercised end to end.
 */
export interface InvestPointsResult {
  /** Simulated post-settlement rank for the investor. */
  newRank: number;
  /** Simulated post-settlement score. */
  newScore: number;
}

export const LeaderboardRepository = {
  /**
   * Invest points to boost an event standing (leaderboard.md §4.4).
   *
   * TODO(Phase 2): POST /points/invest { eventId, amount } once points-service
   * ships the endpoint (spec §4.4.3 dispatches a PointTransaction with
   * type 'spend', source 'leaderboard', referenceId = eventId). Today the
   * caller performs an optimistic local re-rank — no server state changes.
   */
  async investPoints(_eventId: string, _amount: number): Promise<InvestPointsResult> {
    await new Promise((resolve) => setTimeout(resolve, 600));
    // ponytail: naive simulation — the caller recomputes rank from the cached
    // standings; replace with the server response when the endpoint lands.
    return { newRank: 1, newScore: 0 };
  },
};
