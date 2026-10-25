import { api, cleanParams, http } from '../api/client';
import type { MediaCategory, MediaItem, PageResult } from '../api/types';

export type GalleryMedia = MediaItem & { liked_by_me?: boolean };
export interface MediaAlbum { _id: string; title: string; media_count: number; category: MediaCategory }

export interface MediaQuery {
  status?: 'approved' | 'pending' | 'rejected';
  mine?: boolean;
  album_id?: string;
  category?: MediaCategory;
  media_type?: 'image' | 'video';
  event_id?: string;
  page?: number;
  limit?: number;
}

export class MediaRepository {
  /** GET /media — approved items, newest first, page pagination. */
  list(query: MediaQuery = {}): Promise<PageResult<GalleryMedia>> {
    return api.get<PageResult<GalleryMedia>>('/media', { params: cleanParams({ limit: 30, page: 1, status: 'approved', ...query }) });
  }

  get(id: string): Promise<GalleryMedia> { return api.get(`/media/${encodeURIComponent(id)}`); }

  albums(query: { category?: MediaCategory; page?: number } = {}): Promise<PageResult<MediaAlbum>> {
    return api.get('/media/albums', { params: cleanParams({ limit: 20, ...query }) });
  }

  /** POST /media/:id/like — toggles the like for the signed-in member. */
  toggleLike(mediaId: string): Promise<{ media_id: string; liked: boolean; likes_count: number }> {
    return api.post(`/media/${mediaId}/like`);
  }

  /**
   * POST /media/upload — the request body is the raw file bytes.
   * Uploads from regular members start as `pending` until a moderator approves them.
   */
  async upload(params: {
    uri: string;
    mimeType: string;
    filename: string;
    category?: MediaCategory;
    caption?: string;
    album_id?: string;
  }): Promise<MediaItem> {
    const file = await fetch(params.uri);
    const blob = await file.blob();
    const res = await http.post<MediaItem>('/media/upload', blob, {
      params: cleanParams({
        category: params.category ?? 'community',
        caption: params.caption,
        filename: params.filename,
        album_id: params.album_id,
      }),
      headers: { 'Content-Type': params.mimeType },
      timeout: 120000,
      transformRequest: [(data) => data],
    });
    return res.data;
  }
}

export const mediaRepository = new MediaRepository();
