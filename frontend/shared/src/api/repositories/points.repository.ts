/**
 * Points Repository
 * Handles all points-related API calls
 */

import { BaseRepository } from './base.repository';
import { PointsBalance, PointsTransaction, PaginatedResponse } from '../../types';
import ApiClient from '../client';

export class PointsRepository extends BaseRepository {
  constructor(apiClient: ApiClient) {
    super(apiClient, '/points');
  }

  async getBalance(): Promise<PointsBalance> {
    return this.get<PointsBalance>('/balance');
  }

  async getUserBalance(userId: string): Promise<PointsBalance> {
    return this.get<PointsBalance>(`/users/${userId}/balance`);
  }

  async getTransactionHistory(
    page: number = 1,
    limit: number = 20
  ): Promise<PaginatedResponse<PointsTransaction>> {
    return this.getPaginated('/transactions', page, limit);
  }

  async getUserTransactions(
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<PaginatedResponse<PointsTransaction>> {
    return this.getPaginated(`/users/${userId}/transactions`, page, limit);
  }

  async awardPoints(userId: string, amount: number, reason: string): Promise<void> {
    return this.post<void>('/award', { userId, amount, reason });
  }

  async deductPoints(userId: string, amount: number, reason: string): Promise<void> {
    return this.post<void>('/deduct', { userId, amount, reason });
  }

  async getTotalPointsLeaderboard(limit: number = 50): Promise<
    Array<{ rank: number; userId: string; userName: string; points: number }>
  > {
    return this.get('/leaderboard', { limit });
  }
}
