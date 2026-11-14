import React, { useState, useCallback } from 'react'
import {
  X,
  Megaphone,
  AlertTriangle,
  Loader2,
  Pin,
  Send,
  FileText,
} from 'lucide-react'
import type {
  Announcement,
  AnnouncementCategory,
  AnnouncementPriority,
} from '../../types/announcement'
import { announcementService } from '../../services/announcementService'
import { Modal } from '../ui/modal'
import { Button } from '../ui/button'
import { cn } from '../../lib/utils'

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
  const [selectedCategories, setSelectedCategories] = useState<AnnouncementCategory[]>([
    'highlight',
  ])
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

  const toggleCategory = (cat: AnnouncementCategory) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
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
      setError(err instanceof Error ? err.message : 'Failed to create announcement')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} className="max-w-xl">
      {/* Modal Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <Megaphone className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
              Compose Broadcast Announcement
            </h2>
            <p className="text-xs text-muted-foreground">
              Publish news, alerts, and updates to the member feed
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close modal"
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Form Body */}
      <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Error Alert */}
          {error && (
            <div className="flex items-center gap-2 p-3 text-xs rounded-xl border border-destructive/40 bg-destructive/10 text-destructive animate-in fade-in">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Title */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-foreground">
                Title <span className="text-destructive">*</span>
              </label>
              <span className="text-[10px] text-muted-foreground font-mono">
                {title.length}/120
              </span>
            </div>
            <input
              type="text"
              required
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Inclement Weather Notice: Outdoor Matches Rescheduled"
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
            />
          </div>

          {/* Category Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-foreground mb-2">
              Categories (Multi-select) <span className="text-destructive">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {ALL_CATEGORIES.map(({ id, label }) => {
                const isSelected = selectedCategories.includes(id)
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleCategory(id)}
                    className={cn(
                      'px-3 py-1 text-xs font-semibold rounded-lg border transition-all cursor-pointer',
                      isSelected
                        ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                        : 'bg-muted/40 text-muted-foreground border-border hover:bg-muted hover:text-foreground'
                    )}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
            {selectedCategories.length === 0 && (
              <span className="text-[11px] text-destructive mt-1.5 block">
                At least one category is required.
              </span>
            )}
          </div>

          {/* Priority & Status Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-foreground mb-1.5">
                Priority Level
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as AnnouncementPriority)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
              >
                <option value="normal">Normal (Standard bulletin)</option>
                <option value="important">Important (High-contrast card)</option>
                <option value="urgent">Urgent (High-visibility alert)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-foreground mb-1.5">
                Tags (comma-separated)
              </label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="weather, turf, safety"
                className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
              />
            </div>
          </div>

          {/* Message Body */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-foreground mb-1.5">
              Message Body <span className="text-destructive">*</span>
            </label>
            <textarea
              required
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write the complete announcement details for the club community..."
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all resize-y leading-relaxed"
            />
          </div>

          {/* Pin & Status Options */}
          <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
            <label className="flex items-center gap-2.5 text-xs font-medium text-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isPinned}
                onChange={(e) => setIsPinned(e.target.checked)}
                className="w-4 h-4 accent-primary rounded cursor-pointer"
              />
              <span className="flex items-center gap-1.5">
                <Pin className="w-3.5 h-3.5 text-primary" />
                Pin to top of feed for maximum visibility
              </span>
            </label>

            <div className="pt-2 border-t border-border flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">
                Publishing State:
              </span>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 text-xs font-medium text-foreground cursor-pointer select-none">
                  <input
                    type="radio"
                    name="status"
                    value="published"
                    checked={status === 'published'}
                    onChange={() => setStatus('published')}
                    className="accent-primary cursor-pointer"
                  />
                  <span>Publish Immediately</span>
                </label>
                <label className="flex items-center gap-1.5 text-xs font-medium text-foreground cursor-pointer select-none">
                  <input
                    type="radio"
                    name="status"
                    value="draft"
                    checked={status === 'draft'}
                    onChange={() => setStatus('draft')}
                    className="accent-primary cursor-pointer"
                  />
                  <span>Save as Draft</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Action Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/20 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClose}
            disabled={isSubmitting}
            className="text-xs font-medium"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="text-xs font-semibold gap-1.5"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Submitting...
              </>
            ) : status === 'published' ? (
              <>
                <Send className="w-3.5 h-3.5" />
                Publish Announcement
              </>
            ) : (
              <>
                <FileText className="w-3.5 h-3.5" />
                Save Draft
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default CreateAnnouncementModal
