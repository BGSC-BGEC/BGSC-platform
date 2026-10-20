import React, { useState, useEffect, useCallback } from 'react'
import type {
  Announcement,
  AnnouncementCategory,
  AnnouncementPriority,
} from '../../types/announcement'
import { announcementService } from '../../services/announcementService'

export interface CreateAnnouncementModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated: (newAnnouncement: Announcement) => void
}

const ALL_CATEGORIES: { id: AnnouncementCategory; label: string }[] = [
  { id: 'bgec', label: 'BGEC' },
  { id: 'fitsoc', label: 'FitSoc' },
  { id: 'airball', label: 'Airball' },
  { id: 'offside', label: 'Offside' },
  { id: 'powerplay', label: 'Powerplay' },
  { id: 'around_the_net', label: 'Around The Net' },
  { id: 'deuce', label: 'Deuce' },
  { id: 'highlight', label: 'Highlight' },
  { id: 'teams', label: 'Teams' },
]

export const CreateAnnouncementModal: React.FC<CreateAnnouncementModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<
    AnnouncementCategory[]
  >(['highlight'])
  const [tagsInput, setTagsInput] = useState('')
  const [priority, setPriority] = useState<AnnouncementPriority>('normal')
  const [isPinned, setIsPinned] = useState(false)
  const [status, setStatus] = useState<'published' | 'draft'>('published')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resetForm = useCallback(() => {
    setTitle('')
    setBody('')
    setSelectedCategories(['highlight'])
    setTagsInput('')
    setPriority('normal')
    setIsPinned(false)
    setStatus('published')
    setIsSubmitting(false)
    setError(null)
  }, [])

  const handleClose = useCallback(() => {
    resetForm()
    onClose()
  }, [resetForm, onClose])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose()
      }
    }

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, handleClose])

  if (!isOpen) return null

  const toggleCategory = (cat: AnnouncementCategory) => {
    setSelectedCategories((prev) =>
      prev.includes(cat)
        ? prev.filter((c) => c !== cat)
        : [...prev, cat]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim()) {
      setError('Title is required')
      return
    }

    if (!body.trim()) {
      setError('Message body is required')
      return
    }

    if (selectedCategories.length === 0) {
      setError('Please select at least one category')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const parsedTags = tagsInput
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)

      const created = await announcementService.createAnnouncement({
        title: title.trim(),
        body: body.trim(),
        categories: selectedCategories,
        tags: parsedTags,
        priority,
        isPinned,
        status,
      })

      onCreated(created)
      handleClose()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to create announcement'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-lg border border-gray-200 shadow-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 pb-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-black">
            Compose Broadcast Announcement
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="px-2 py-1 text-xs font-bold border border-black text-black hover:bg-black hover:text-white cursor-pointer"
          >
            X
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-black mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Inclement Weather Notice"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded text-black bg-white focus:outline-none focus:border-black"
            />
            <span className="text-[10px] text-gray-500 mt-0.5 block text-right">
              {title.length}/120
            </span>
          </div>

          {/* Category Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-black mb-1.5">
              Categories (Multi-select) <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_CATEGORIES.map(({ id, label }) => {
                const isSelected = selectedCategories.includes(id)
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleCategory(id)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-black text-white border-black'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
            {selectedCategories.length === 0 && (
              <span className="text-[11px] text-red-500 mt-1 block">
                At least one category is required.
              </span>
            )}
          </div>

          {/* Priority */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-black mb-1">
              Priority Level
            </label>
            <select
              value={priority}
              onChange={(e) =>
                setPriority(e.target.value as AnnouncementPriority)
              }
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded text-black bg-white focus:outline-none focus:border-black"
            >
              <option value="normal">Normal (Standard feed item)</option>
              <option value="important">Important (High-contrast styling)</option>
              <option value="urgent">Urgent (High-visibility alert)</option>
            </select>
          </div>

          {/* Message Body */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-black mb-1">
              Message Body <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write the complete announcement details for the club community..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded text-black bg-white focus:outline-none focus:border-black resize-y leading-relaxed"
            />
          </div>

          {/* Tags Input */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-black mb-1">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g. weather, turf, matches, safety"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded text-black bg-white focus:outline-none focus:border-black"
            />
          </div>

          {/* Pin Checkbox */}
          <div className="pt-1">
            <label className="flex items-center gap-2 text-xs font-semibold text-black cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isPinned}
                onChange={(e) => setIsPinned(e.target.checked)}
                className="w-4 h-4 accent-black rounded cursor-pointer"
              />
              Pin to top of feed for high visibility
            </label>
          </div>

          {/* Status Option */}
          <div className="pt-2 border-t border-gray-200">
            <label className="block text-xs font-bold uppercase tracking-wider text-black mb-2">
              Publishing Option
            </label>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-xs font-medium text-black cursor-pointer select-none">
                <input
                  type="radio"
                  name="status"
                  value="published"
                  checked={status === 'published'}
                  onChange={() => setStatus('published')}
                  className="accent-black cursor-pointer"
                />
                Publish Immediately
              </label>
              <label className="flex items-center gap-2 text-xs font-medium text-black cursor-pointer select-none">
                <input
                  type="radio"
                  name="status"
                  value="draft"
                  checked={status === 'draft'}
                  onChange={() => setStatus('draft')}
                  className="accent-black cursor-pointer"
                />
                Save as Draft
              </label>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-200">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs border border-gray-300 text-black hover:bg-gray-100 rounded transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold border border-black bg-black text-white hover:bg-gray-800 rounded transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSubmitting
                ? 'Submitting...'
                : status === 'published'
                ? 'Publish Announcement'
                : 'Save Draft'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CreateAnnouncementModal
