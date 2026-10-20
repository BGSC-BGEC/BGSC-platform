import { apiClient } from './apiClient'
import type {
  MediaAlbum,
  MediaCategory,
  MediaItem,
  MediaStatus,
  MediaType,
  UploadMediaPayload,
} from '../types/media'
import {
  DEFAULT_MEDIA_ALBUMS,
  DEFAULT_MEDIA_ITEMS,
} from '../data/mediaData'

const isMock = import.meta.env.VITE_USE_MOCK === 'true'

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
    const res = await apiClient.get<MediaItem[] | { items?: MediaItem[] }>(
      `/media${queryString}`
    )
    return Array.isArray(res) ? res : res?.items || []
  } catch (error) {
    console.warn('[mediaService] Fetch media failed:', error)
    return isMock ? applyMockFilters() : []
  }
}

export async function getAlbums(): Promise<MediaAlbum[]> {
  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 80))
    return structuredClone(mockAlbums)
  }

  try {
    const res = await apiClient.get<MediaAlbum[] | { items?: MediaAlbum[] }>(
      '/media/albums'
    )
    return Array.isArray(res) ? res : res?.items || []
  } catch (error) {
    console.warn('[mediaService] Fetch albums failed:', error)
    return isMock ? structuredClone(mockAlbums) : []
  }
}

export async function uploadMedia(
  payload: UploadMediaPayload
): Promise<MediaItem> {
  const applyMockUpload = (): MediaItem => {
    const now = new Date().toISOString()
    const newItem: MediaItem = {
      id: `med-${Date.now()}`,
      url: payload.url,
      thumbnail_url: payload.url,
      original_filename: payload.original_filename,
      mime_type: payload.media_type === 'video' ? 'video/mp4' : 'image/jpeg',
      media_type: payload.media_type,
      size_bytes: payload.size_bytes,
      category: payload.category,
      event_id: payload.event_id || null,
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

  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 150))
    return applyMockUpload()
  }

  try {
    const res = await apiClient.post<MediaItem>('/media/upload', payload)
    return res
  } catch (error) {
    if (!isMock) {
      throw error
    }
    console.warn('[mediaService] Upload failed, falling back to local state:', error)
    return applyMockUpload()
  }
}

export async function moderateMedia(
  id: string,
  status: MediaStatus,
  rejectionReason?: string
): Promise<MediaItem> {
  const applyMockModeration = (caughtError?: unknown): MediaItem => {
    const item = mockMediaItems.find((m) => m.id === id)
    if (!item) {
      if (caughtError) {
        throw new Error(`Media item ${id} not found.`, { cause: caughtError })
      }
      throw new Error(`Media item ${id} not found.`)
    }

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

  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 100))
    return applyMockModeration()
  }

  try {
    const res = await apiClient.patch<MediaItem>(`/media/${id}/moderate`, {
      status,
      rejection_reason: rejectionReason,
    })
    return res
  } catch (error) {
    if (!isMock) {
      throw error
    }
    console.warn(
      `[mediaService] Moderation for ${id} failed, updating local mock:`,
      error
    )
    return applyMockModeration(error)
  }
}

export async function deleteMedia(id: string): Promise<{ success: boolean }> {
  const applyMockDelete = (): { success: boolean } => {
    const index = mockMediaItems.findIndex((m) => m.id === id)
    if (index !== -1) {
      mockMediaItems.splice(index, 1)
    }
    return { success: true }
  }

  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 80))
    return applyMockDelete()
  }

  try {
    await apiClient.delete(`/media/${id}`)
    return { success: true }
  } catch (error) {
    if (!isMock) {
      throw error
    }
    console.warn(
      `[mediaService] Delete for ${id} failed, updating local mock:`,
      error
    )
    return applyMockDelete()
  }
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
  moderateMedia,
  deleteMedia,
  resetMockMedia,
}

export default mediaService
