import { api, cleanParams } from '../api/client';
import type { Team } from '../api/types';

export interface Challenge {
  _id: string; slug: string; title: string; description: string | null;
  cover_media_url: string | null; brief_hidden_until_accept: boolean;
  domain: 'sports' | 'esports' | 'dev' | 'general'; kind: 'physical' | 'digital';
  difficulty: 'easy' | 'medium' | 'hard' | 'legend'; award_points: number;
  grants_hall_of_fame: boolean; status: 'draft' | 'active' | 'completed' | 'archived';
  window: { opens_at: string | null; closes_at: string | null; submissions_close_at: string | null; time_limit_minutes: number | null };
  teaming: { enabled: boolean; team_size_min: number | null; team_size_max: number | null };
  location: { name: string; details: string | null } | null;
  resources: Array<{ label: string; url: string }>;
  submission: { requires_proof: boolean; proof_types: string[]; max_files: number; auto_approve: boolean };
  counts: { accepted: number; submitted: number; approved: number };
}
export interface Participation {
  _id: string; challenge_id: string;
  challenge_snapshot: { title: string; difficulty: Challenge['difficulty']; award_points: number };
  participant: { type: 'user' | 'team'; id: string; display_name: string };
  status: 'accepted' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'expired' | 'withdrawn';
  accepted_at: string; deadline_at: string | null;
  progress: { percent: number; notes: string | null; steps: Array<{ key: string; label: string; done: boolean }> };
  submission: { proofs: Proof[]; notes: string | null; submitted_at: string; version: number } | null;
  review: { decision: 'approved' | 'rejected'; reason: string | null; reviewed_at: string } | null;
  reward: { points_awarded: number; hall_of_fame_entry_id: string | null } | null;
}
export interface Proof { type: 'url' | 'text'; value: string; name?: string | null }
export interface ChallengePage { challenges: Challenge[]; next_cursor: string | null }
export interface ParticipationPage { participations: Participation[]; next_cursor: string | null }
export interface ChallengeDetail { challenge: Challenge; my_participation: Participation | null }

export const challengesRepository = {
  list: (query: { cursor?: string; domain?: string; kind?: string; status?: string } = {}) => api.get<ChallengePage>('/challenges', { params: cleanParams({ limit: 20, status: 'active', ...query }) }),
  mine: (cursor?: string, limit = 50) => api.get<ParticipationPage>('/challenges/me/participations', { params: cleanParams({ limit, cursor }) }),
  get: (key: string) => api.get<ChallengeDetail>(`/challenges/${encodeURIComponent(key)}`),
  participation: (id: string) => api.get<Participation>(`/challenges/participations/${id}`),
  accept: (id: string, team_id?: string) => api.post<Participation>(`/challenges/${id}/accept`, team_id ? { team_id } : {}),
  progress: (id: string, progress: Partial<Participation['progress']>) => api.patch<Participation>(`/challenges/participations/${id}/progress`, progress),
  submit: (id: string, proofs: Proof[], notes: string) => api.post<Participation>(`/challenges/participations/${id}/submit`, { proofs, notes: notes.trim() || null }),
  teams: (id: string, offset = 0) => api.get<Team[]>('/teams', { params: { owner_id: id, limit: 20, offset } }),
  createTeam: (id: string, name: string) => api.post<Team>('/teams', { owner: { type: 'challenge', id }, name: name.trim(), join_policy: 'open' }),
};
