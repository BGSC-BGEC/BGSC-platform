import React, { useState, useRef, useEffect } from 'react'
import {
  X,
  UploadCloud,
  Film,
  Plus,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
} from 'lucide-react'
import type { MediaAlbum, MediaCategory, UploadMediaPayload } from '../../types/media'
import { MEDIA_UPLOAD_LIMITS, validateUploadFile } from '../../types/media'
import { Modal } from '../ui/modal'

/** Minimal event shape for the optional event link. */
export interface MediaEventOption {
  id: string
  title: string
}

export interface UploadMediaModalProps {
  isOpen: boolean
  onClose: () => void
  /** Uploads ONE file; rejects with an Error whose message is shown on that file's row. */
  onUpload: (payload: UploadMediaPayload) => Promise<void>
  albums?: MediaAlbum[]
  events?: MediaEventOption[]
}

interface UploadMediaModalContentProps {
  onClose: () => void
  onUpload: (payload: UploadMediaPayload) => Promise<void>
  albums?: MediaAlbum[]
  events?: MediaEventOption[]
}

type UploadStatus = 'queued' | 'uploading' | 'done' | 'failed'

interface UploadEntry {
  key: string
  file: File
  previewUrl: string | null
  status: UploadStatus
  error?: string
  /** Failed the client-side checks: never sent, never retried. */
  invalid?: boolean
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

let entrySeq = 0

const UploadMediaModalContent: React.FC<UploadMediaModalContentProps> = ({
  onClose,
  onUpload,
  albums,
  events,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const objectUrlsRef = useRef<string[]>([])

  const [entries, setEntries] = useState<UploadEntry[]>([])
  const [isDragging, setIsDragging] = useState(false)

  const [category, setCategory] = useState<MediaCategory>('event')
  const [caption, setCaption] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [selectedAlbumId, setSelectedAlbumId] = useState<string>('')
  const [selectedEventId, setSelectedEventId] = useState<string>('')

  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const requestClose = () => {
    if (!isUploading) onClose()
  }

  // Escape key listener (ignored while a batch is in flight)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isUploading) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, isUploading])

  // Revoke every preview URL on unmount
  useEffect(() => {
    const urls = objectUrlsRef.current
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [])

  const handleFilesSelect = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    setError(null)

    const added: UploadEntry[] = Array.from(fileList).map((file) => {
      const problem = validateUploadFile(file)
      let previewUrl: string | null = null
      if (!problem && file.type.startsWith('image/')) {
        previewUrl = URL.createObjectURL(file)
        objectUrlsRef.current.push(previewUrl)
      }
      entrySeq += 1
      return {
        key: `upl-${entrySeq}`,
        file,
        previewUrl,
        status: problem ? 'failed' : 'queued',
        error: problem ?? undefined,
        invalid: !!problem,
      }
    })

    setEntries((prev) => [...prev, ...added])
  }

  const handleRemoveEntry = (key: string) => {
    setEntries((prev) => prev.filter((e) => e.key !== key))
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (!isUploading) handleFilesSelect(e.dataTransfer.files)
  }

  const handleAddTag = () => {
    const trimmed = tagInput
      .trim()
      .replace(/^#/, '')
      .replace(/,/g, '')
      .toLowerCase()
      .slice(0, MEDIA_UPLOAD_LIMITS.tagMax)
    if (!trimmed) return
    if (tags.length >= MEDIA_UPLOAD_LIMITS.tagsMax) {
      setError(`At most ${MEDIA_UPLOAD_LIMITS.tagsMax} tags.`)
      return
    }
    if (!tags.includes(trimmed)) {
      setTags([...tags, trimmed])
    }
    setTagInput('')
  }

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddTag()
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove))
  }

  const setEntryState = (key: string, patch: Partial<UploadEntry>) => {
    setEntries((prev) => prev.map((e) => (e.key === key ? { ...e, ...patch } : e)))
  }

  // Queued files, plus failed ones that passed the client checks (a retry)
  const pending = entries.filter(
    (e) => e.status === 'queued' || (e.status === 'failed' && !e.invalid)
  )
  const doneCount = entries.filter((e) => e.status === 'done').length

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pending.length === 0) {
      setError('Please select at least one valid image or video file to upload.')
      return
    }

    setIsUploading(true)
    setError(null)

    // The backend takes one file per request: send them one after another.
    const batch = pending.map((entry) => ({ key: entry.key, file: entry.file }))
    let failures = 0
    for (const { key, file } of batch) {
      setEntryState(key, { status: 'uploading', error: undefined })
      try {
        await onUpload({
          file,
          category,
          caption: caption.trim() || undefined,
          tags,
          album_id: selectedAlbumId || undefined,
          event_id: selectedEventId || undefined,
        })
        setEntryState(key, { status: 'done' })
      } catch (err) {
        failures += 1
        setEntryState(key, {
          status: 'failed',
          error: err instanceof Error ? err.message : 'Upload failed.',
        })
      }
    }

    setIsUploading(false)
    const invalidLeft = entries.some((entry) => entry.invalid)
    if (failures === 0 && !invalidLeft) {
      onClose()
    } else if (failures > 0) {
      setError(
        `${failures} of ${batch.length} file${batch.length === 1 ? '' : 's'} failed. Fix or remove them and upload again.`
      )
    }
  }

  const selectedAlbum = albums?.find((a) => a.id === selectedAlbumId)
  const albumEventTitle = selectedAlbum?.event_id
    ? events?.find((ev) => ev.id === selectedAlbum.event_id)?.title
    : undefined

  const renderStatus = (entry: UploadEntry) => {
    switch (entry.status) {
      case 'queued':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-border bg-muted/50 text-muted-foreground">
            <Clock className="w-3 h-3" />
            Queued
          </span>
        )
      case 'uploading':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-border bg-card text-foreground">
            <Loader2 className="w-3 h-3 animate-spin" />
            Uploading
          </span>
        )
      case 'done':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-3 h-3" />
            Done
          </span>
        )
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-destructive/30 bg-destructive/10 text-destructive">
            <AlertCircle className="w-3 h-3" />
            Failed
          </span>
        )
    }
  }

  return (
    <>
      {/* 1. Modal Header */}
      <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between gap-3 bg-muted/40">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
            Upload Media Assets
          </h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Add high-resolution tournament banners, game clips, or sponsor logos. Select
            several files to upload them in one batch.
          </p>
        </div>

        <button
          type="button"
          onClick={requestClose}
          disabled={isUploading}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer disabled:opacity-50"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* 2. Modal Body & Form */}
      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-xs text-destructive flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Dropzone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !isUploading && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl ${
            entries.length > 0 ? 'p-4' : 'p-6'
          } text-center cursor-pointer transition-colors ${
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50 bg-muted/20'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={MEDIA_UPLOAD_LIMITS.acceptedMimeTypes.join(',')}
            className="hidden"
            onChange={(e) => {
              handleFilesSelect(e.target.files)
              // Allow re-selecting the same file after removing it
              e.target.value = ''
            }}
          />

          <div className="space-y-2">
            <UploadCloud
              className={`${
                entries.length > 0 ? 'w-6 h-6' : 'w-10 h-10'
              } text-muted-foreground mx-auto`}
            />
            <div>
              <span className="text-xs font-bold text-foreground block">
                {entries.length > 0
                  ? 'Click or drop to add more files'
                  : 'Click to browse or drag and drop assets'}
              </span>
              <span className="text-[11px] text-muted-foreground">
                Images up to 10MB, Videos up to 50MB (JPG, PNG, WEBP, MP4, WEBM)
              </span>
            </div>
            {entries.length === 0 && (
              <span className="inline-block mt-2 px-3 py-1 text-xs font-semibold rounded-lg border border-border bg-card text-foreground hover:border-primary/40">
                Select Files
              </span>
            )}
          </div>
        </div>

        {/* Selected files with per-file status */}
        {entries.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Selected Files
              </label>
              <span className="text-[10px] text-muted-foreground font-mono">
                {doneCount}/{entries.length} uploaded
              </span>
            </div>
            <ul className="border border-border rounded-xl divide-y divide-border max-h-56 overflow-y-auto">
              {entries.map((entry) => (
                <li key={entry.key} className="flex items-center gap-3 p-2">
                  <div className="w-10 h-10 rounded-lg overflow-hidden border border-border bg-muted flex items-center justify-center flex-shrink-0">
                    {entry.previewUrl ? (
                      <img
                        src={entry.previewUrl}
                        alt={entry.file.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Film className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-foreground font-mono truncate">
                      {entry.file.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground font-mono truncate">
                      {formatBytes(entry.file.size)} &bull; {entry.file.type || 'unknown type'}
                    </p>
                    {entry.error && (
                      <p className="text-[11px] text-destructive truncate" title={entry.error}>
                        {entry.error}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {renderStatus(entry)}
                    {!isUploading && entry.status !== 'done' && (
                      <button
                        type="button"
                        onClick={() => handleRemoveEntry(entry.key)}
                        className="text-muted-foreground hover:text-foreground cursor-pointer"
                        title="Remove file"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Category & Album Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Asset Category *
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as MediaCategory)}
              disabled={isUploading}
              className="w-full px-3 py-2 text-xs border border-border rounded-lg text-foreground bg-card focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all disabled:opacity-50"
            >
              <option value="event">Tournament / Event</option>
              <option value="community">Community & Campus</option>
              <option value="memories">Memories & Gala</option>
              <option value="sponsor">Official Sponsor & Partner</option>
              <option value="hall_of_fame">Hall of Fame</option>
              <option value="general">General Asset</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Album Collection (Optional)
            </label>
            <select
              value={selectedAlbumId}
              onChange={(e) => setSelectedAlbumId(e.target.value)}
              disabled={isUploading}
              className="w-full px-3 py-2 text-xs border border-border rounded-lg text-foreground bg-card focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all disabled:opacity-50"
            >
              <option value="">No Album (Standalone)</option>
              {albums?.map((alb) => (
                <option key={alb.id} value={alb.id}>
                  {alb.title} ({alb.media_count} items)
                </option>
              ))}
            </select>
            {albumEventTitle && (
              <p className="text-[10px] text-muted-foreground">
                Album is linked to event: {albumEventTitle}
              </p>
            )}
          </div>
        </div>

        {/* Event link */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Linked Event (Optional)
          </label>
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            disabled={isUploading}
            className="w-full px-3 py-2 text-xs border border-border rounded-lg text-foreground bg-card focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all disabled:opacity-50"
          >
            <option value="">No Event</option>
            {events?.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.title}
              </option>
            ))}
          </select>
        </div>

        {/* Caption */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Caption / Context
            </label>
            <span className="text-[10px] text-muted-foreground font-mono">
              {caption.length}/{MEDIA_UPLOAD_LIMITS.captionMax}
            </span>
          </div>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value.slice(0, MEDIA_UPLOAD_LIMITS.captionMax))}
            disabled={isUploading}
            rows={2}
            placeholder="Brief caption or description for public galleries (applied to every file)..."
            className="w-full px-3 py-2 text-xs border border-border rounded-lg text-foreground bg-card placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary resize-none transition-all disabled:opacity-50"
          />
        </div>

        {/* Tags Chip Input */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Tags & Keywords
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              disabled={isUploading}
              maxLength={MEDIA_UPLOAD_LIMITS.tagMax + 1}
              placeholder="Add tag and press Enter (e.g. valorant, finals, crowd)..."
              className="flex-1 px-3 py-1.5 text-xs border border-border rounded-lg text-foreground bg-card placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all disabled:opacity-50"
            />
            <button
              type="button"
              onClick={handleAddTag}
              disabled={isUploading}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-border bg-card text-foreground hover:bg-muted cursor-pointer inline-flex items-center gap-1 disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </div>

          {tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-md bg-muted border border-border text-foreground"
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    disabled={isUploading}
                    className="text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-50"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer / Actions */}
        <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={requestClose}
            disabled={isUploading}
            className="px-4 py-2 rounded-lg text-xs font-semibold border border-border text-foreground hover:bg-muted transition-colors disabled:opacity-50 cursor-pointer"
          >
            {doneCount > 0 ? 'Close' : 'Cancel'}
          </button>

          <button
            type="submit"
            disabled={isUploading || pending.length === 0}
            className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer shadow-sm"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Uploading Assets...</span>
              </>
            ) : (
              <>
                <UploadCloud className="w-3.5 h-3.5" />
                <span>
                  {pending.length > 1 ? `Upload ${pending.length} Assets` : 'Upload Asset'}
                </span>
              </>
            )}
          </button>
        </div>
      </form>
    </>
  )
}

export const UploadMediaModal: React.FC<UploadMediaModalProps> = ({
  isOpen,
  onClose,
  onUpload,
  albums,
  events,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-2xl max-h-[92vh]">
      <UploadMediaModalContent
        onClose={onClose}
        onUpload={onUpload}
        albums={albums}
        events={events}
      />
    </Modal>
  )
}

export default UploadMediaModal
