import { apiClient } from './apiClient'
import type {
  CreateAlbumPayload,
  MediaAlbum,
  MediaCategory,
  MediaItem,
  MediaStatus,
  MediaType,
  UpdateMediaPayload,
  UploadMediaPayload,
} from '../types/media'
import { MEDIA_UPLOAD_LIMITS } from '../types/media'
import {
  DEFAULT_MEDIA_ALBUMS,
  DEFAULT_MEDIA_ITEMS,
} from '../data/mediaData'

const isMock = import.meta.env.VITE_USE_MOCK === 'true'

const API_BASE_URL: string = (
  (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:3000'
).replace(/\/+$/, '')

// In-memory working copies for local testing
const mockMediaItems: MediaItem[] = structuredClone(DEFAULT_MEDIA_ITEMS)
const mockAlbums: MediaAlbum[] = structuredClone(DEFAULT_MEDIA_ALBUMS)

export interface MediaFilters {
  category?: MediaCategory | 'all'
  media_type?: MediaType | 'all'
  status?: MediaStatus | 'all'
  album_id?: string
  search?: string
}

/* ------------------------------------------------------------------ *
 * Backend -> client shape
 * ------------------------------------------------------------------ */

type RawRecord = Record<string, unknown> & { _id?: string; id?: string }

/** The media service stores `/uploads/...` paths, served through the API gateway, not this app. */
function resolveAssetUrl(url: unknown): string {
  if (typeof url !== 'string' || !url) return ''
  return url.startsWith('/') ? `${API_BASE_URL}${url}` : url
}

/** Mongo documents come back with `_id`; the console keys everything on `id`. */
function mapMediaItem(raw: unknown): MediaItem {
  const r = (raw ?? {}) as RawRecord & Partial<MediaItem>
  const uploader = (r.uploader ?? {}) as Partial<MediaItem['uploader']> & {
    avatar_url?: string | null
  }
  return {
    ...(r as MediaItem),
    id: r._id || r.id || '',
    url: resolveAssetUrl(r.url),
    thumbnail_url: r.thumbnail_url ? resolveAssetUrl(r.thumbnail_url) : null,
    tags: Array.isArray(r.tags) ? r.tags : [],
    uploader: {
      user_id: uploader.user_id ?? '',
      username: uploader.username ?? '',
      display_name: uploader.display_name ?? 'Unknown',
      avatar_url: uploader.avatar_url ?? undefined,
    },
    views_count: r.views_count ?? 0,
    likes_count: r.likes_count ?? 0,
  }
}

function mapAlbum(raw: unknown): MediaAlbum {
  const r = (raw ?? {}) as RawRecord & Partial<MediaAlbum>
  return {
    ...(r as MediaAlbum),
    id: r._id || r.id || '',
    media_count: r.media_count ?? 0,
  }
}

interface Paged<T> {
  items?: T[]
  total_pages?: number
}

/* ------------------------------------------------------------------ *
 * Reads
 * ------------------------------------------------------------------ */

export async function getMedia(filters?: MediaFilters): Promise<MediaItem[]> {
  const buildQuery = () => {
    const params = new URLSearchParams()
    if (filters?.category && filters.category !== 'all') {
      params.append('category', filters.category)
    }
    if (filters?.media_type && filters.media_type !== 'all') {
      params.append('media_type', filters.media_type)
    }
    if (filters?.status && filters.status !== 'all') {
      params.append('status', filters.status)
    }
    if (filters?.album_id && filters.album_id !== 'all') {
      params.append('album_id', filters.album_id)
    }
    if (filters?.search && filters.search.trim()) {
      params.append('search', filters.search.trim())
    }
    return params.toString() ? `?${params.toString()}` : ''
  }

  const applyMockFilters = (): MediaItem[] => {
    let result = structuredClone(mockMediaItems)

    if (filters?.category && filters.category !== 'all') {
      result = result.filter((item) => item.category === filters.category)
    }
    if (filters?.media_type && filters.media_type !== 'all') {
      result = result.filter((item) => item.media_type === filters.media_type)
    }
    if (filters?.status && filters.status !== 'all') {
      result = result.filter((item) => item.status === filters.status)
    }
    if (filters?.album_id && filters.album_id !== 'all') {
      result = result.filter((item) => item.album_id === filters.album_id)
    }
    if (filters?.search && filters.search.trim()) {
      const term = filters.search.trim().toLowerCase()
      result = result.filter(
        (item) =>
          item.original_filename.toLowerCase().includes(term) ||
          (item.caption && item.caption.toLowerCase().includes(term)) ||
          item.tags.some((tag) => tag.toLowerCase().includes(term)) ||
          (item.uploader?.display_name &&
            item.uploader.display_name.toLowerCase().includes(term))
      )
    }

    result.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    return result
  }

  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 100))
    return applyMockFilters()
  }

  try {
    const queryString = buildQuery()
    const res = await apiClient.get<unknown[] | Paged<unknown>>(
      `/media${queryString}`
    )
    const items = Array.isArray(res) ? res : res?.items || []
    return items.map(mapMediaItem)
  } catch (error) {
    console.warn('[mediaService] Fetch media failed:', error)
    return []
  }
}

export async function getAlbums(): Promise<MediaAlbum[]> {
  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 80))
    return structuredClone(mockAlbums)
  }

  try {
    // The API pages (at most 50 per page). Album pickers need every album, so walk the pages.
    const all: unknown[] = []
    for (let page = 1; page <= 50; page++) {
      const res = await apiClient.get<unknown[] | Paged<unknown>>(
        `/media/albums?page=${page}&limit=50`
      )
      if (Array.isArray(res)) return res.map(mapAlbum)
      all.push(...(res?.items || []))
      if (!res?.total_pages || page >= res.total_pages) break
    }
    return all.map(mapAlbum)
  } catch (error) {
    console.warn('[mediaService] Fetch albums failed:', error)
    return []
  }
}

/* ------------------------------------------------------------------ *
 * Writes
 * ------------------------------------------------------------------ */

/** Tags as the backend validates them: trimmed, lower-case, 1-40 chars, at most 20, no commas. */
function cleanTags(tags: string[] | undefined): string[] {
  const out: string[] = []
  for (const tag of tags ?? []) {
    const t = tag
      .replace(/,/g, ' ')
      .trim()
      .toLowerCase()
      .slice(0, MEDIA_UPLOAD_LIMITS.tagMax)
      .trim()
    if (t && !out.includes(t)) out.push(t)
  }
  return out.slice(0, MEDIA_UPLOAD_LIMITS.tagsMax)
}

/**
 * POST /media/upload: the body is the file's raw bytes (apiClient sets Content-Type to the
 * file's MIME type for a Blob body); everything else rides in the query string.
 */
export async function uploadMedia(
  payload: UploadMediaPayload
): Promise<MediaItem> {
  const { file } = payload

  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 150))
    const now = new Date().toISOString()
    const url = URL.createObjectURL(file)
    const newItem: MediaItem = {
      id: `med-${Date.now()}`,
      url,
      thumbnail_url: url,
      original_filename: file.name,
      mime_type: file.type,
      media_type: file.type.startsWith('video') ? 'video' : 'image',
      size_bytes: file.size,
      category: payload.category,
      event_id: payload.event_id || null,
      album_id: payload.album_id || null,
      caption: payload.caption || null,
      tags: payload.tags || [],
      status: 'approved',
      approved_by: 'usr-admin',
      approved_at: now,
      uploader: {
        user_id: 'usr-admin',
        username: 'admin_desk',
        display_name: 'Media Admin',
      },
      views_count: 0,
      likes_count: 0,
      created_at: now,
      updated_at: now,
    }
    mockMediaItems.unshift(newItem)
    return structuredClone(newItem)
  }

  const params = new URLSearchParams()
  params.set('category', payload.category)
  if (payload.event_id) params.set('event_id', payload.event_id)
  if (payload.album_id) params.set('album_id', payload.album_id)
  const caption = payload.caption?.trim().slice(0, MEDIA_UPLOAD_LIMITS.captionMax)
  if (caption) params.set('caption', caption)
  const tags = cleanTags(payload.tags)
  if (tags.length > 0) params.set('tags', tags.join(','))
  const filename = file.name.trim().slice(0, MEDIA_UPLOAD_LIMITS.filenameMax)
  if (filename) params.set('filename', filename)

  const res = await apiClient.post<unknown>(`/media/upload?${params.toString()}`, file)
  return mapMediaItem(res)
}

/** PATCH /media/:id — the backend accepts caption and tags only. */
export async function updateMedia(
  id: string,
  payload: UpdateMediaPayload
): Promise<MediaItem> {
  const body: UpdateMediaPayload = {}
  if (payload.caption !== undefined) {
    body.caption = payload.caption.trim().slice(0, MEDIA_UPLOAD_LIMITS.captionMax)
  }
  if (payload.tags !== undefined) body.tags = cleanTags(payload.tags)

  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 100))
    const item = mockMediaItems.find((m) => m.id === id)
    if (!item) throw new Error(`Media item ${id} not found.`)
    if (body.caption !== undefined) item.caption = body.caption || null
    if (body.tags !== undefined) item.tags = body.tags
    item.updated_at = new Date().toISOString()
    return structuredClone(item)
  }

  const res = await apiClient.patch<unknown>(`/media/${id}`, body)
  return mapMediaItem(res)
}

/** POST /media/albums (core+; an event-linked album also needs the caller to admin that event). */
export async function createAlbum(payload: CreateAlbumPayload): Promise<MediaAlbum> {
  const body: CreateAlbumPayload = {
    title: payload.title.trim().slice(0, MEDIA_UPLOAD_LIMITS.albumTitleMax),
  }
  if (payload.event_id) body.event_id = payload.event_id

  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 100))
    const album: MediaAlbum = {
      id: `alb-${Date.now()}`,
      title: body.title,
      slug: body.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      category: 'general',
      event_id: body.event_id ?? null,
      media_count: 0,
      created_at: new Date().toISOString(),
    }
    mockAlbums.unshift(album)
    return structuredClone(album)
  }

  const res = await apiClient.post<unknown>('/media/albums', body)
  return mapAlbum(res)
}

export async function moderateMedia(
  id: string,
  status: MediaStatus,
  rejectionReason?: string
): Promise<MediaItem> {
  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 100))
    const item = mockMediaItems.find((m) => m.id === id)
    if (!item) throw new Error(`Media item ${id} not found.`)
    const now = new Date().toISOString()
    item.status = status
    item.rejection_reason = rejectionReason || null
    if (status === 'approved') {
      item.approved_by = 'usr-admin'
      item.approved_at = now
    } else {
      item.approved_by = null
      item.approved_at = null
    }
    item.updated_at = now
    return structuredClone(item)
  }

  const res = await apiClient.patch<unknown>(`/media/${id}/moderate`, {
    status,
    rejection_reason: rejectionReason,
  })
  return mapMediaItem(res)
}

export async function deleteMedia(id: string): Promise<{ success: boolean }> {
  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 80))
    const index = mockMediaItems.findIndex((m) => m.id === id)
    if (index !== -1) {
      mockMediaItems.splice(index, 1)
    }
    return { success: true }
  }

  await apiClient.delete(`/media/${id}`)
  return { success: true }
}

export function resetMockMedia(): void {
  mockMediaItems.length = 0
  mockMediaItems.push(...structuredClone(DEFAULT_MEDIA_ITEMS))
  mockAlbums.length = 0
  mockAlbums.push(...structuredClone(DEFAULT_MEDIA_ALBUMS))
}

export const mediaService = {
  getMedia,
  getAlbums,
  uploadMedia,
  updateMedia,
  createAlbum,
  moderateMedia,
  deleteMedia,
  resetMockMedia,
}

export default mediaService
