import { apiClient } from '../api/ApiClient';
import type { Announcement, AnnouncementTag } from '../types';

const PALETTE = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899'];
// ponytail: deterministic avatar colour — component-level CATEGORY_COLORS is the upgrade path once avatars are real images
function colorFromId(id: string): string {
  const n = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return PALETTE[n % PALETTE.length];
}

function toAnnouncement(dto: Record<string, unknown>): Announcement {
  const id: string = String(dto.createdBy ?? '');
  return {
    id: String(dto.id),
    title: String(dto.title ?? ''),
    body: String(dto.body ?? ''),
    tags: (dto.tags ?? []) as AnnouncementTag[],
    author: {
      id,
      name: String(dto.authorUsername ?? 'Staff'),
      role: 'Coordinator',
      avatarInitial: String(String(dto.authorUsername ?? '')[0] ?? id[0] ?? 'S').toUpperCase(),
      avatarColor: colorFromId(id),
    },
    createdAt: typeof dto.createdAt === 'string' ? dto.createdAt : new Date(String(dto.createdAt)).toISOString(),
  };
}

const TAG_TO_TYPE: Record<string, string> = {
  BGEC: 'BGEC',
  FitSoc: 'FITSOC',
  Airball: 'AIRBALL',
  Offside: 'OFFSIDE',
  PowerPlay: 'POWERPLAY',
  'Around The Net': 'AROUND_THE_NET',
  Deuce: 'DEUCE',
  'Highlight Events': 'HIGHLIGHT',
  Teams: 'TEAMS',
};

export const AnnouncementRepository = {
  async list(params?: { page?: number; limit?: number }): Promise<Announcement[]> {
    const qs = new URLSearchParams();
    if (params?.page != null) qs.set('page', String(params.page));
    if (params?.limit != null) qs.set('limit', String(params.limit));
    const query = qs.toString();
    const dtos = await apiClient.get<Record<string, unknown>[]>(`/announcements${query ? '?' + query : ''}`);
    return dtos.map(toAnnouncement);
  },

  async create(title: string, body: string, tags: AnnouncementTag[]): Promise<Announcement> {
    const type = TAG_TO_TYPE[tags[0]] ?? 'BGEC';
    const dto = await apiClient.post<Record<string, unknown>>('/announcements', { title, body, type, tags });
    return toAnnouncement(dto);
  },
};
