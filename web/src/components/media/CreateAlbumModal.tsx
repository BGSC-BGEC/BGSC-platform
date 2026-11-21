import React, { useState, useEffect } from 'react'
import { X, FolderPlus, Loader2, AlertCircle } from 'lucide-react'
import type { CreateAlbumPayload } from '../../types/media'
import { MEDIA_UPLOAD_LIMITS } from '../../types/media'
import type { MediaEventOption } from './UploadMediaModal'

export interface CreateAlbumModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (payload: CreateAlbumPayload) => Promise<void>
  events?: MediaEventOption[]
}

interface CreateAlbumModalContentProps {
  onClose: () => void
  onCreate: (payload: CreateAlbumPayload) => Promise<void>
  events?: MediaEventOption[]
}

const CreateAlbumModalContent: React.FC<CreateAlbumModalContentProps> = ({
  onClose,
  onCreate,
  events,
}) => {
  const [title, setTitle] = useState('')
  const [eventId, setEventId] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const requestClose = () => {
    if (!isSubmitting) onClose()
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, isSubmitting])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) {
      setError('Please enter an album title.')
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      await onCreate({ title: trimmed, event_id: eventId || undefined })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create album.')
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={requestClose}
    >
      <div
        className="bg-card rounded-lg shadow-2xl border border-border w-full max-w-md overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between gap-3 bg-muted/30">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
              New Album
            </h2>
            <p className="text-[11px] text-muted-foreground">
              Group assets into a collection, optionally linked to an event.
            </p>
          </div>

          <button
            type="button"
            onClick={requestClose}
            disabled={isSubmitting}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {error && (
            <div className="p-3 rounded bg-destructive/10 border border-destructive/40 text-xs text-destructive flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-wider text-foreground">
                Album Title *
              </label>
              <span className="text-[10px] text-muted-foreground font-mono">
                {title.length}/{MEDIA_UPLOAD_LIMITS.albumTitleMax}
              </span>
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) =>
                setTitle(e.target.value.slice(0, MEDIA_UPLOAD_LIMITS.albumTitleMax))
              }
              placeholder="e.g. Valorant Spring Finals 2026"
              autoFocus
              className="w-full px-3 py-2 text-xs border border-border rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            />
            <p className="text-[10px] text-muted-foreground">
              Use at least one latin letter or digit; the album link is derived from the title.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-foreground">
              Linked Event (Optional)
            </label>
            <select
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-border rounded text-foreground bg-card focus:outline-none focus:border-primary"
            >
              <option value="">No Event</option>
              {events?.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.title}
                </option>
              ))}
            </select>
          </div>

          <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={requestClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded text-xs font-semibold border border-border text-foreground hover:bg-muted transition-colors disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <FolderPlus className="w-3.5 h-3.5" />
                  <span>Create Album</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export const CreateAlbumModal: React.FC<CreateAlbumModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  events,
}) => {
  if (!isOpen) return null
  return <CreateAlbumModalContent onClose={onClose} onCreate={onCreate} events={events} />
}

export default CreateAlbumModal
