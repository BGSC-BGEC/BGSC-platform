import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { api } from '../api/client';
import { investmentRequestId, validInvestment } from './investmentRules';

export interface InvestmentRequest { amount: number; request_id: string }
export interface Projection { amount: number; current_rank: number | null; projected_rank: number | null; projected_score: number }

const keyOf = (userId: string, eventId: string) => `bgsc.investment.${userId}.${eventId}`;

export const investmentRepository = {
  project: (ref: string, amount: number) => api.get<Projection>(`/leaderboards/events/${encodeURIComponent(ref)}/project`, { params: { amount } }),
  async pending(userId: string, eventId: string): Promise<InvestmentRequest | null> {
    const key = keyOf(userId, eventId);
    const raw = Platform.OS === 'web' ? globalThis.localStorage.getItem(key) : await SecureStore.getItemAsync(key);
    if (!raw) return null;
    const request: unknown = JSON.parse(raw);
    if (!request || typeof request !== 'object' || !('amount' in request) || !('request_id' in request) ||
        typeof request.amount !== 'number' || !validInvestment(String(request.amount), 100_000) ||
        typeof request.request_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(request.request_id)) {
      throw new Error('Your saved investment could not be read. Contact support before trying again.');
    }
    return { amount: request.amount, request_id: request.request_id };
  },
  async prepare(userId: string, eventId: string, amount: number): Promise<InvestmentRequest> {
    if (!validInvestment(String(amount), 100_000)) throw new Error('Enter a whole number from 10 to 100000.');
    const existing = await this.pending(userId, eventId);
    if (existing) return existing;
    const request = { amount, request_id: investmentRequestId() };
    const key = keyOf(userId, eventId);
    if (Platform.OS === 'web') globalThis.localStorage.setItem(key, JSON.stringify(request));
    else await SecureStore.setItemAsync(key, JSON.stringify(request));
    return request;
  },
  invest: (ref: string, request: InvestmentRequest) => api.post(`/leaderboards/events/${encodeURIComponent(ref)}/invest`, request),
  async clear(userId: string, eventId: string) {
    const key = keyOf(userId, eventId);
    if (Platform.OS === 'web') globalThis.localStorage.removeItem(key);
    else await SecureStore.deleteItemAsync(key);
  },
};
