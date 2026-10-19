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
      setError('Please provide a reason for rejecting this asset.')
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      await onModerate(item.id, 'rejected', rejectionReason.trim())
      setRejecting(false)
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
    <div
      className="bg-white rounded-lg shadow-2xl border border-gray-200 w-full max-w-5xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in duration-150"
      onClick={(e) => e.stopPropagation()}
    >
      {/* 1. Modal Header */}
      <div className="p-4 sm:p-5 border-b border-gray-200 flex items-center justify-between gap-3 bg-gray-50/50">
        <div className="flex items-center gap-2.5 truncate">
          <span className="font-mono text-xs font-bold text-black px-2 py-0.5 rounded bg-gray-100 border border-gray-300 truncate">
            {item.original_filename}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-gray-200 bg-gray-50 text-gray-700 flex-shrink-0">
            {item.category.replace('_', ' ')}
          </span>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded text-gray-400 hover:text-black hover:bg-gray-100 transition-colors cursor-pointer flex-shrink-0"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* 2. Modal Body: Split Stage & Metadata */}
      <div className="flex-1 overflow-y-auto p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left / Main Stage (Asset Showcase) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="rounded-lg bg-neutral-900/5 border border-gray-200 overflow-hidden flex items-center justify-center min-h-[300px] max-h-[60vh]">
            {item.media_type === 'video' ? (
              <video
                controls
                src={item.url}
                className="w-full max-h-[60vh] object-contain bg-black rounded"
              />
            ) : (
              <img
                src={item.url}
                alt={item.original_filename}
                className="w-full max-h-[60vh] object-contain rounded"
              />
            )}
          </div>

          {/* Caption & Event */}
          {item.caption && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-800 leading-relaxed">
              <strong className="text-black block mb-0.5">Caption:</strong>
              {item.caption}
            </div>
          )}

          {/* Tournament context & Tags */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            {item.event_title && (
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-200 px-2.5 py-1 rounded">
                <Trophy className="w-3.5 h-3.5 text-black" />
                <span>{item.event_title}</span>
              </div>
            )}

            {item.tags && item.tags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 ml-auto">
                {item.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="text-[10px] font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded border border-gray-200"
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
            <div className="p-3 rounded bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Technical Specs Box */}
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50/50 space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-black block border-b border-gray-200 pb-2">
              Technical Specifications
            </span>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">MIME Format:</span>
                <span className="font-mono font-bold text-black">
                  {item.mime_type}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-500">File Size:</span>
                <span className="font-mono font-bold text-black">
                  {formatBytes(item.size_bytes)}
                </span>
              </div>

              {item.metadata?.width && item.metadata?.height && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Dimensions:</span>
                  <span className="font-mono font-bold text-black">
                    {item.metadata.width} &times; {item.metadata.height} px
                  </span>
                </div>
              )}

              {item.metadata?.duration_seconds && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Duration:</span>
                  <span className="font-mono font-bold text-black">
                    {item.metadata.duration_seconds} seconds
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-gray-500">Uploader:</span>
                <span className="font-semibold text-black">
                  {item.uploader.display_name}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-500">Uploaded:</span>
                <span className="text-[11px] text-gray-600">
                  {formatDate(item.created_at)}
                </span>
              </div>
            </div>

            {/* Direct URL Button */}
            <div className="pt-2 border-t border-gray-200">
              <button
                type="button"
                onClick={handleCopyUrl}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded border border-gray-300 bg-white text-gray-700 hover:text-black hover:border-black transition-colors cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-green-600" />
                    <span>Copied Direct URL</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Direct Asset URL</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Moderation Controls */}
          <div className="border border-gray-200 rounded-lg p-4 bg-white space-y-3 shadow-xs">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-black flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-black" />
                Moderation Status
              </span>

              {item.status === 'approved' && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-green-300 bg-green-50 text-green-700">
                  <CheckCircle2 className="w-3 h-3 text-green-600" />
                  Approved
                </span>
              )}
              {item.status === 'pending' && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-amber-300 bg-amber-50 text-amber-800">
                  <Clock className="w-3 h-3 text-amber-600" />
                  Pending
                </span>
              )}
              {item.status === 'rejected' && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-red-300 bg-red-50 text-red-700">
                  <AlertCircle className="w-3 h-3 text-red-600" />
                  Rejected
                </span>
              )}
            </div>

            {/* Rejection Note if already rejected */}
            {item.status === 'rejected' && item.rejection_reason && (
              <div className="bg-red-50 border border-red-200 rounded p-2.5 text-xs text-red-700 space-y-1">
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
                  className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded text-black placeholder-gray-400 focus:outline-none focus:border-black resize-none"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 px-3 py-1.5 rounded text-xs font-bold bg-red-600 text-white hover:bg-red-700 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Confirm Rejection
                  </button>
                  <button
                    type="button"
                    onClick={() => setRejecting(false)}
                    className="px-3 py-1.5 rounded text-xs font-semibold border border-gray-300 text-gray-700 hover:bg-gray-100 cursor-pointer"
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
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded bg-black text-white hover:bg-gray-800 transition-colors disabled:opacity-50 cursor-pointer"
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
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <AlertCircle className="w-3.5 h-3.5 text-red-600" />
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
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded border border-gray-200 text-gray-600 hover:text-red-700 hover:border-red-300 hover:bg-red-50 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete from Library</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export const MediaPreviewModal: React.FC<MediaPreviewModalProps> = ({
  item,
  isOpen,
  onClose,
  onModerate,
  onDelete,
}) => {
  if (!isOpen || !item) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <MediaPreviewModalContent
        key={item.id}
        item={item}
        onClose={onClose}
        onModerate={onModerate}
        onDelete={onDelete}
      />
    </div>
  )
}

export default MediaPreviewModal
