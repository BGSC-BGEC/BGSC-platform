import React, { useState, useRef, useEffect } from 'react'
import {
  X,
  UploadCloud,
  Film,
  Plus,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import type {
  MediaAlbum,
  MediaCategory,
  MediaType,
  UploadMediaPayload,
} from '../../types/media'
import { Modal } from '../ui/modal'

export interface UploadMediaModalProps {
  isOpen: boolean
  onClose: () => void
  onUpload: (payload: UploadMediaPayload) => Promise<void>
  albums?: MediaAlbum[]
}

interface UploadMediaModalContentProps {
  onClose: () => void
  onUpload: (payload: UploadMediaPayload) => Promise<void>
  albums?: MediaAlbum[]
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

const UploadMediaModalContent: React.FC<UploadMediaModalContentProps> = ({
  onClose,
  onUpload,
  albums,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const [category, setCategory] = useState<MediaCategory>('event')
  const [caption, setCaption] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [selectedAlbumId, setSelectedAlbumId] = useState<string>('')

  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Escape key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Revoke object URL on unmount or file replacement
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  const handleFileSelect = (file: File) => {
    setError(null)

    // Max file limits: 50MB for video, 15MB for image
    const isVideo = file.type.startsWith('video')
    const maxBytes = isVideo ? 50 * 1024 * 1024 : 15 * 1024 * 1024

    if (file.size > maxBytes) {
      setError(
        `File is too large. Maximum size for ${
          isVideo ? 'videos is 50MB' : 'images is 15MB'
        }.`
      )
      return
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }

    const objectUrl = URL.createObjectURL(file)
    setSelectedFile(file)
    setPreviewUrl(objectUrl)
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
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }

  const handleAddTag = () => {
    const cleaned = tagInput.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '')
    if (cleaned && !tags.includes(cleaned)) {
      setTags([...tags, cleaned])
      setTagInput('')
    }
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFile || !previewUrl) {
      setError('Please select an asset file to upload.')
      return
    }

    setIsUploading(true)
    setError(null)

    try {
      const mediaType: MediaType = selectedFile.type.startsWith('video')
        ? 'video'
        : 'image'

      await onUpload({
        media_type: mediaType,
        category,
        caption: caption.trim() || undefined,
        tags: tags.length > 0 ? tags : undefined,
        original_filename: selectedFile.name,
        size_bytes: selectedFile.size,
        url: previewUrl,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <>
      {/* 1. Modal Header */}
      <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between gap-3 bg-muted/40">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
            Upload Media Asset
          </h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Add high-resolution tournament banners, game clips, or sponsor logos.
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* 2. Modal Body & Form */}
      <form
        onSubmit={handleSubmit}
        className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4"
      >
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
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50 bg-muted/20'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/mp4"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileSelect(e.target.files[0])
              }
            }}
          />

          {selectedFile && previewUrl ? (
            <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
              <div className="w-24 h-24 mx-auto rounded-xl overflow-hidden border border-border bg-muted flex items-center justify-center">
                {selectedFile.type.startsWith('video') ? (
                  <Film className="w-10 h-10 text-muted-foreground" />
                ) : (
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                )}
              </div>

              <div>
                <p className="text-xs font-bold text-foreground font-mono truncate max-w-xs mx-auto">
                  {selectedFile.name}
                </p>
                <p className="text-[11px] text-muted-foreground font-mono">
                  {formatBytes(selectedFile.size)} &bull; {selectedFile.type}
                </p>
              </div>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs font-semibold underline text-primary hover:opacity-80 cursor-pointer"
              >
                Change Selected File
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <UploadCloud className="w-10 h-10 text-muted-foreground mx-auto" />
              <div>
                <span className="text-xs font-bold text-foreground block">
                  Click to browse or drag and drop asset
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Images up to 15MB, Videos up to 50MB (PNG, JPG, WEBP, MP4)
                </span>
              </div>
              <span className="inline-block mt-2 px-3 py-1 text-xs font-semibold rounded-lg border border-border bg-card text-foreground hover:border-primary/40">
                Select File
              </span>
            </div>
          )}
        </div>

        {/* Category & Album Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Asset Category *
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as MediaCategory)}
              className="w-full px-3 py-2 text-xs border border-border rounded-lg text-foreground bg-card focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
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
              className="w-full px-3 py-2 text-xs border border-border rounded-lg text-foreground bg-card focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
            >
              <option value="">No Album (Standalone)</option>
              {albums?.map((alb) => (
                <option key={alb.id} value={alb.id}>
                  {alb.title} ({alb.media_count} items)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Caption */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Caption / Context
            </label>
            <span className="text-[10px] text-muted-foreground font-mono">
              {caption.length}/500
            </span>
          </div>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value.slice(0, 500))}
            rows={2}
            placeholder="Brief caption or description for public galleries..."
            className="w-full px-3 py-2 text-xs border border-border rounded-lg text-foreground bg-card placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary resize-none transition-all"
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
              placeholder="Add tag and press Enter (e.g. valorant, finals, crowd)..."
              className="flex-1 px-3 py-1.5 text-xs border border-border rounded-lg text-foreground bg-card placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
            />
            <button
              type="button"
              onClick={handleAddTag}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-border bg-card text-foreground hover:bg-muted cursor-pointer inline-flex items-center gap-1"
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
                    className="text-muted-foreground hover:text-foreground cursor-pointer"
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
            onClick={onClose}
            disabled={isUploading}
            className="px-4 py-2 rounded-lg text-xs font-semibold border border-border text-foreground hover:bg-muted transition-colors disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={isUploading || !selectedFile}
            className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer shadow-sm"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Uploading Asset...</span>
              </>
            ) : (
              <>
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Upload Asset</span>
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
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-2xl max-h-[92vh]">
      <UploadMediaModalContent
        onClose={onClose}
        onUpload={onUpload}
        albums={albums}
      />
    </Modal>
  )
}

export default UploadMediaModal
