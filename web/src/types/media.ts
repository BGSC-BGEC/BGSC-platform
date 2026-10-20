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
  media_count: number
  created_at: string
}

export interface UploadMediaPayload {
  original_filename: string
  category: MediaCategory
  caption?: string
  tags?: string[]
  event_id?: string
  media_type: MediaType
  size_bytes: number
  url: string
}

export interface ModerateMediaPayload {
  status: MediaStatus
  rejection_reason?: string
}
