export type MediaCategory =
  | 'event'
  | 'community'
  | 'memories'
  | 'sponsor'
  | 'hall_of_fame'
  | 'general'

export type MediaType = 'image' | 'video'

export type MediaStatus = 'pending' | 'approved' | 'rejected'

export interface MediaUploader {
  user_id: string
  username: string
  display_name: string
  avatar_url?: string
}

export interface MediaMetadata {
  width?: number
  height?: number
  duration_seconds?: number
}

export interface MediaItem {
  id: string
  url: string
  thumbnail_url?: string | null
  original_filename: string
  mime_type: string
  media_type: MediaType
  size_bytes: number
  category: MediaCategory
  event_id?: string | null
  event_title?: string | null
  album_id?: string | null
  album_title?: string | null
  caption?: string | null
  tags: string[]
  status: MediaStatus
  approved_by?: string | null
  approved_at?: string | null
  rejection_reason?: string | null
  uploader: MediaUploader
  metadata?: MediaMetadata | null
  views_count: number
  likes_count: number
  created_at: string
  updated_at: string
}

export interface MediaAlbum {
  id: string
  title: string
  slug: string
  description?: string | null
  category: MediaCategory
  cover_media_url?: string | null
  cover_media_id?: string | null
  /** The event this album is filed under, if any. */
  event_id?: string | null
  is_public?: boolean
  media_count: number
  created_at: string
}

/**
 * One file for POST /media/upload. The backend takes the raw bytes as the body and the rest as
 * query parameters (media-service media.schemas.ts UploadMediaQuerySchema).
 */
export interface UploadMediaPayload {
  file: File
  category: MediaCategory
  caption?: string
  tags?: string[]
  event_id?: string
  album_id?: string
}

/** PATCH /media/:id accepts only these two fields (UpdateMediaSchema). */
export interface UpdateMediaPayload {
  caption?: string
  tags?: string[]
}

/** POST /media/albums (CreateAlbumSchema); category and is_public default server-side. */
export interface CreateAlbumPayload {
  title: string
  event_id?: string
}

/**
 * Client mirror of the media-service upload limits (storage.ts, media.schemas.ts). The backend
 * re-checks everything against the sniffed bytes.
 */
export const MEDIA_UPLOAD_LIMITS = {
  acceptedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'],
  imageMaxBytes: 10 * 1024 * 1024,
  videoMaxBytes: 50 * 1024 * 1024,
  captionMax: 500,
  tagMax: 40,
  tagsMax: 20,
  filenameMax: 255,
  albumTitleMax: 120,
} as const

/** Why a file cannot be uploaded, or null if it passes the client-side checks. */
export function validateUploadFile(file: File): string | null {
  const accepted: readonly string[] = MEDIA_UPLOAD_LIMITS.acceptedMimeTypes
  if (!accepted.includes(file.type)) {
    return `Unsupported file type${file.type ? ` (${file.type})` : ''}. Use JPG, PNG, WEBP, MP4 or WEBM.`
  }
  if (file.size === 0) return 'File is empty.'
  const isVideo = file.type.startsWith('video/')
  const max = isVideo ? MEDIA_UPLOAD_LIMITS.videoMaxBytes : MEDIA_UPLOAD_LIMITS.imageMaxBytes
  if (file.size > max) {
    return `File is too large. Maximum size for ${isVideo ? 'videos is 50MB' : 'images is 10MB'}.`
  }
  return null
}

export interface ModerateMediaPayload {
  status: MediaStatus
  rejection_reason?: string
}
