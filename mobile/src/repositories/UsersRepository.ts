import { api, http } from '../api/client';
import type { ApiUser } from '../api/types';

export interface UserSettings {
  theme: 'light' | 'dark' | 'system';
  privacy: { is_profile_public: boolean };
  notifications: { email: boolean; whatsapp: boolean };
}
export type SelfProfile = ApiUser & { settings: UserSettings };
export interface PlayerCard {
  user_id: string; username: string; avatar_url: string | null; bio: string; interests: string[];
  card_tier: string; rating: number; social_links: Record<string, string | null>;
  stats: { inputs?: { participations: number; podiums: number; challenges: number; points_balance: number } };
}
export interface ProfilePatch {
  full_name?: string; bio?: string; phone_number?: string | null; interests?: string[];
  social_links?: { instagram?: string | null; linkedin?: string | null; steam_id?: string | null };
}
export interface DeletionPreview {
  version: string; restore_window_days: number; hidden_immediately: string[]; retained_indefinitely: string[]; notes: string[];
}

export const usersRepository = {
  me: () => api.get<SelfProfile>('/users/me'),
  get: (ref: string) => api.get<ApiUser>(`/users/${encodeURIComponent(ref)}`),
  card: (ref: string) => api.get<PlayerCard>(`/users/${encodeURIComponent(ref)}/player-card`),
  update: (body: ProfilePatch) => api.patch<SelfProfile>('/users/me', body),
  settings: (body: Partial<{ theme: UserSettings['theme']; privacy: Partial<UserSettings['privacy']>; notifications: Partial<UserSettings['notifications']> }>) => api.patch<SelfProfile>('/users/me/settings', body),
  deletionPreview: () => api.get<DeletionPreview>('/users/me/deletion-preview'),
  delete: (body: { confirm: 'DELETE'; reason?: string; research_consent: boolean }) => api.delete<{ restorable_until: string }>('/users/me', { data: body }),
  async avatar(uri: string, mime: string) {
    const response = await fetch(uri);
    if (!response.ok) throw new Error('Could not read that photo. Please pick it again.');
    const blob = await response.blob();
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) throw new Error('Choose a JPG, PNG or WEBP photo.');
    if (blob.size > 10 * 1024 * 1024) throw new Error('Choose a photo smaller than 10 MB.');
    return (await http.post<{ avatar_url: string }>('/users/me/avatar', blob, { headers: { 'Content-Type': mime }, transformRequest: [(data) => data], timeout: 60000 })).data;
  },
  removeAvatar: () => api.delete('/users/me/avatar'),
  sendPhoneOtp: (phone_number: string) => api.post<{ expires_in: number }>('/auth/phone/send-otp', { phone_number }),
  verifyPhoneOtp: (phone_number: string, otp: string) => api.post('/auth/phone/verify-otp', { phone_number, otp }),
};
