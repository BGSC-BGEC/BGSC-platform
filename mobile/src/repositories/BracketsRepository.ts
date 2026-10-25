import { api } from '../api/client';

export interface Match {
  _id: string;
  event_id: string;
  round: number;
  slot: number;
  a: { id: string; display_name: string; seed: number } | null;
  b: { id: string; display_name: string; seed: number } | null;
  score_a: number | null;
  score_b: number | null;
  winner: 'a' | 'b' | 'draw' | null;
  status: 'scheduled' | 'ongoing' | 'completed' | 'bye' | 'cancelled';
  scheduled_at: string | null;
  venue: string | null;
  advances_to: { match_id: string; slot: 'a' | 'b' } | null;
  updated_at: string;
}

export interface Bracket {
  bracket: { _id: string; format: string; rounds: number; status: string };
  matches: Match[];
}

export interface BracketStandings {
  format: string;
  champion: { id: string; display_name: string } | null;
  rows: Array<{ id: string; display_name: string; played: number; won: number; drawn: number; lost: number; points: number; eliminated: boolean }>;
}

export const bracketsRepository = {
  get: (eventId: string) => api.get<Bracket>(`/brackets/${encodeURIComponent(eventId)}`),
  standings: (eventId: string) => api.get<BracketStandings>(`/brackets/${encodeURIComponent(eventId)}/standings`),
  match: (id: string) => api.get<Match>(`/matches/${encodeURIComponent(id)}`),
};
