import React, { useState, useEffect } from 'react'
import {
  X,
  Copy,
  Check,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Shield,
  Loader2,
  Trophy,
} from 'lucide-react'
import type { MediaItem, MediaStatus } from '../../types/media'
import { Modal } from '../ui/modal'

export interface MediaPreviewModalProps {
  item: MediaItem | null
  isOpen: boolean
  onClose: () => void
  onModerate: (
    id: string,
    status: MediaStatus,
    rejectionReason?: string
  ) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

interface MediaPreviewModalContentProps {
  item: MediaItem
  onClose: () => void
  onModerate: (
    id: string,
    status: MediaStatus,
    rejectionReason?: string
  ) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function formatDate(dateString: string): string {
  try {
    const d = new Date(dateString)
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateString
  }
}

const MediaPreviewModalContent: React.FC<MediaPreviewModalContentProps> = ({
  item,
  onClose,
  onModerate,
  onDelete,
}) => {
  const [copied, setCopied] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Listen for Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(item.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
    }
  }

  const handleApprove = async () => {
    setIsSubmitting(true)
    setError(null)
    try {
      await onModerate(item.id, 'approved')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve asset.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rejectionReason.trim()) {
      setError('Please provide a reason for rejecting this media.')
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      await onModerate(item.id, 'rejected', rejectionReason.trim())
      setRejecting(false)
      setRejectionReason('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject asset.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (
      !confirm(
        `Are you sure you want to delete "${item.original_filename}"? This action cannot be undone.`
      )
    ) {
      return
    }

    setIsSubmitting(true)
    try {
      await onDelete(item.id)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete asset.')
      setIsSubmitting(false)
    }
  }

  return (
    <>
      {/* 1. Modal Header */}
      <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between gap-3 bg-muted/40">
        <div className="flex items-center gap-2.5 truncate">
          <span className="font-mono text-xs font-bold text-foreground px-2.5 py-0.5 rounded-md bg-muted border border-border truncate">
            {item.original_filename}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border border-border bg-muted/60 text-muted-foreground flex-shrink-0">
            {item.category.replace('_', ' ')}
          </span>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer flex-shrink-0"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* 2. Modal Body: Split Stage & Metadata */}
      <div className="flex-1 overflow-y-auto p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left / Main Stage (Asset Showcase) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="rounded-xl bg-black/40 border border-border overflow-hidden flex items-center justify-center min-h-[300px] max-h-[60vh]">
            {item.media_type === 'video' ? (
              <video
                controls
                src={item.url}
                className="w-full max-h-[60vh] object-contain bg-black rounded-lg"
              />
            ) : (
              <img
                src={item.url}
                alt={item.original_filename}
                className="w-full max-h-[60vh] object-contain rounded-lg"
              />
            )}
          </div>

          {/* Caption & Event */}
          {item.caption && (
            <div className="bg-muted/30 border border-border rounded-xl p-3 text-xs text-foreground leading-relaxed">
              <strong className="text-foreground block mb-0.5">Caption:</strong>
              {item.caption}
            </div>
          )}

          {/* Tournament context & Tags */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            {item.event_title && (
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground bg-muted border border-border px-2.5 py-1 rounded-md">
                <Trophy className="w-3.5 h-3.5 text-primary" />
                <span>{item.event_title}</span>
              </div>
            )}

            {item.tags && item.tags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 ml-auto">
                {item.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="text-[10px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded-md border border-border"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (Metadata & Moderation) */}
        <div className="lg:col-span-4 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-xs text-destructive flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Technical Specs Box */}
          <div className="border border-border rounded-xl p-4 bg-muted/20 space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-foreground block border-b border-border pb-2">
              Technical Specifications
            </span>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">MIME Format:</span>
                <span className="font-mono font-bold text-foreground">
                  {item.mime_type}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">File Size:</span>
                <span className="font-mono font-bold text-foreground">
                  {formatBytes(item.size_bytes)}
                </span>
              </div>

              {item.metadata?.width && item.metadata?.height && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Dimensions:</span>
                  <span className="font-mono font-bold text-foreground">
                    {item.metadata.width} &times; {item.metadata.height} px
                  </span>
                </div>
              )}

              {item.metadata?.duration_seconds && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Duration:</span>
                  <span className="font-mono font-bold text-foreground">
                    {item.metadata.duration_seconds} seconds
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Uploader:</span>
                <span className="font-semibold text-foreground">
                  {item.uploader.display_name}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Uploaded:</span>
                <span className="text-[11px] text-muted-foreground">
                  {formatDate(item.created_at)}
                </span>
              </div>
            </div>

            {/* Direct URL Button */}
            <div className="pt-2 border-t border-border">
              <button
                type="button"
                onClick={handleCopyUrl}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-border bg-card text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied Direct URL</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>Copy Direct Asset URL</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Moderation Controls */}
          <div className="border border-border rounded-xl p-4 bg-card space-y-3 shadow-xs">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-primary" />
                Moderation Status
              </span>

              {item.status === 'approved' && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  Approved
                </span>
              )}
              {item.status === 'pending' && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-400">
                  <Clock className="w-3 h-3 text-amber-400" />
                  Pending
                </span>
              )}
              {item.status === 'rejected' && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border border-destructive/30 bg-destructive/10 text-destructive">
                  <AlertCircle className="w-3 h-3 text-destructive" />
                  Rejected
                </span>
              )}
            </div>

            {/* Rejection Note if already rejected */}
            {item.status === 'rejected' && item.rejection_reason && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-2.5 text-xs text-destructive space-y-1">
                <span className="font-bold block">Rejection Reason:</span>
                <p>{item.rejection_reason}</p>
              </div>
            )}

            {/* Action buttons */}
            {rejecting ? (
              <form onSubmit={handleReject} className="space-y-2 pt-1">
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="State reason for rejecting this asset..."
                  rows={2}
                  className="w-full px-2.5 py-1.5 text-xs border border-border rounded-lg text-foreground bg-card placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary resize-none transition-all"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-destructive text-destructive-foreground hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
                  >
                    Confirm Rejection
                  </button>
                  <button
                    type="button"
                    onClick={() => setRejecting(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-border text-foreground hover:bg-muted cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-2 pt-1">
                {item.status !== 'approved' && (
                  <button
                    type="button"
                    onClick={handleApprove}
                    disabled={isSubmitting}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer shadow-xs"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {item.status === 'rejected' ? 'Re-Approve Asset' : 'Approve Asset'}
                    </span>
                  </button>
                )}

                {item.status !== 'rejected' && (
                  <button
                    type="button"
                    onClick={() => setRejecting(true)}
                    disabled={isSubmitting}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-destructive/30 text-destructive bg-destructive/10 hover:bg-destructive/20 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <AlertCircle className="w-3.5 h-3.5 text-destructive" />
                    <span>
                      {item.status === 'approved' ? 'Take Down / Reject' : 'Reject Asset'}
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Delete Asset Action */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleDelete}
              disabled={isSubmitting}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-border text-muted-foreground hover:text-destructive hover:border-destructive/30 hover:bg-destructive/10 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete from Library</span>
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

export const MediaPreviewModal: React.FC<MediaPreviewModalProps> = ({
  item,
  isOpen,
  onClose,
  onModerate,
  onDelete,
}) => {
  if (!item) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-5xl max-h-[92vh]">
      <MediaPreviewModalContent
        key={item.id}
        item={item}
        onClose={onClose}
        onModerate={onModerate}
        onDelete={onDelete}
      />
    </Modal>
  )
}

export default MediaPreviewModal
