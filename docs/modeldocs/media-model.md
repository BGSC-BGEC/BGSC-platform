# Media Model

**Owner service:** Media Service, :3009 (plan Week 4 Saturday, BE-1)
**Collections:** `media`, `media_albums`
**Spec refs:** §2.1 Media Service (`:3009`), §2.3 File Storage (`/uploads/` -> S3/R2), §5.11 F: Media Page (Event Albums, Community Uploads, Memories, Sponsor Galleries, Moderation, Permissions), §15.1 Media Uploads (JPEG, PNG, WebP, max 10MB images; MP4, WebM max 50MB videos/clips).
**MVP plan refs:** Week 4 Saturday BE-1 — Media upload, media gallery management, categorization, approval workflow, static file delivery, metadata/tagging.

---

## 1. Purpose & Architecture

The Media Service owns the intake, validation, storage, categorization, metadata extraction, approval moderation, and delivery of binary media assets across the BGSC platform.

Prior to Week 4, individual services (`user-service`, `event-service`, `registration-service`) wrote uploads to local disk subdirectories and mounted their own static handlers. In Week 4, the Media Service unifies file storage under a partitioned, S3/R2-ready architecture and becomes the single canonical gateway target for `/media` and `/uploads` routes.

### Storage Layout & Partitioning
```
uploads/
  avatars/          # User avatars (managed via user-service / media-service)
  events/           # Event banners, logos, posters
  registrations/    # Form submission attachments
  media/            # Platform media gallery (albums, community clips)
    2026/
      09/
```
All static delivery (`GET /uploads/*`) is served by `media-service` with strict HTTP headers (`X-Content-Type-Options: nosniff`, `Cache-Control: public, max-age=604800, immutable`, directory browsing denied, dotfiles denied).

---

## 2. `media` Collection

```jsonc
{
  _id: uuid,                          // string UUID v4
  uploader: {
    user_id: string,
    display_name: string,
    avatar_url: string | null
  },
  url: string,                        // e.g. "/uploads/media/2026/09/uuid.webp"
  thumbnail_url: string | null,
  original_filename: string,
  mime_type: string,                  // "image/jpeg" | "image/png" | "image/webp" | "video/mp4" | "video/webm"
  media_type: 'image' | 'video',
  size_bytes: number,
  category: 'event' | 'community' | 'memories' | 'sponsor' | 'hall_of_fame' | 'general',
  event_id: string | null,            // indexed
  album_id: string | null,            // indexed
  caption: string | null,
  tags: string[],                     // indexed
  status: 'pending' | 'approved' | 'rejected',
  approved_by: string | null,
  approved_at: Date | null,
  rejection_reason: string | null,
  metadata: {
    width?: number,
    height?: number,
    duration_seconds?: number
  },
  views_count: number,                // default: 0
  likes_count: number,                // default: 0
  created_at: Date,
  updated_at: Date
}
```

### 2.1 Invariants & Validation
1. **Magic-Byte Sniffing:** MIME type is derived from the first 12–24 bytes of the binary payload, not the client-supplied `Content-Type` header or file extension:
   - JPEG: `FF D8 FF`
   - PNG: `89 50 4E 47 0D 0A 1A 0A`
   - WebP: `RIFF .... WEBP`
   - MP4: `ftyp` box marker at offset 4–8 (`isom`, `mp42`, etc.)
   - WebM: `1A 45 DF A3` (EBML ID)
2. **Payload Ceilings:** Max 10MB for images (`IMAGE_MAX_BYTES = 10 * 1024 * 1024`), Max 50MB for video clips (`VIDEO_MAX_BYTES = 50 * 1024 * 1024`).
3. **Approval Status Invariant:**
   - Uploads by `CORE`, `COORDINATOR`, `FOUNDER` default to `status: 'approved'`.
   - Uploads by `USER`, `MEMBER` default to `status: 'pending'` (must be reviewed via `/media/moderation/pending`).
4. **Path Sanitization:** Refuses any path traversal (`..` or absolute path injection).

---

## 3. `media_albums` Collection

```jsonc
{
  _id: uuid,                          // string UUID v4
  title: string,                      // e.g. "Offside Football 2026 Finals"
  slug: string,                       // unique
  description: string | null,
  category: 'event' | 'community' | 'memories' | 'sponsor' | 'hall_of_fame' | 'general',
  cover_media_id: string | null,
  event_id: string | null,            // indexed
  created_by: string,                 // user_id
  media_count: number,                // default: 0
  is_public: boolean,                 // default: true
  created_at: Date,
  updated_at: Date
}
```

---

## 4. Lifecycle & Domain Events

- **Emits:**
  - `MediaUploaded`: `{ media_id, uploader_user_id, category, event_id, status }`
  - `MediaApproved`: `{ media_id, approved_by }`
  - `MediaRejected`: `{ media_id, reason, rejected_by }`
  - `MediaDeleted`: `{ media_id, url }`
- **Consumes:**
  - `UserProfileUpdated`: Refreshes uploader snapshot (`display_name`, `avatar_url`) in `media`.
  - `UserDeleted`: Anonymizes uploader snapshots per GDPR (`display_name = 'Deleted User'`, `avatar_url = null`).
  - `EventCompleted`: Auto-initializes an official Event Album in `media_albums` if not already present.
