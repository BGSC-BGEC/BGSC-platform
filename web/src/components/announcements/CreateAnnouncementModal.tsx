import React, { useState, useEffect, useCallback } from 'react'
import type {
  Announcement,
  AnnouncementCategory,
  AnnouncementPriority,
  AudienceRole,
} from '../../types/announcement'
import type { ClubEvent } from '../../types/event'
import { announcementService } from '../../services/announcementService'
import { eventService } from '../../services/eventService'
import { rankOf } from '../../services/permissions'
import { useAuthStore } from '../../stores/authStore'
import { describeAnnouncementError } from './announcementErrors'

export interface CreateAnnouncementModalProps {
  isOpen: boolean
  onClose: () => void
  /** `warning` is set when the draft was saved but the publish/schedule step failed. */
  onCreated: (newAnnouncement: Announcement, warning?: string) => void
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

/** Backend ROLE_RANK order. The backend refuses a minimum above the composer's own rank. */
const AUDIENCE_ROLES: { id: AudienceRole; label: string }[] = [
  { id: 'guest', label: 'Everyone (including guests)' },
  { id: 'user', label: 'Signed-in users' },
  { id: 'member', label: 'Members and above' },
  { id: 'core', label: 'Core and above' },
  { id: 'coordinator', label: 'Coordinators and above' },
  { id: 'founder', label: 'Founders only' },
]

type PublishMode = 'published' | 'scheduled' | 'draft'

/** `<input type="datetime-local">` value (local wall time) → ISO with zone, or null if invalid. */
function localToIso(value: string): string | null {
  if (!value) return null
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

export const CreateAnnouncementModal: React.FC<CreateAnnouncementModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const myRole = useAuthStore((s) => s.user?.role)

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<
    AnnouncementCategory[]
  >(['highlight'])
  const [tagsInput, setTagsInput] = useState('')
  const [priority, setPriority] = useState<AnnouncementPriority>('normal')
  const [isPinned, setIsPinned] = useState(false)
  const [pinnedUntilInput, setPinnedUntilInput] = useState('')
  const [minRole, setMinRole] = useState<AudienceRole>('guest')
  const [eventId, setEventId] = useState('')
  const [mode, setMode] = useState<PublishMode>('published')
  const [scheduledForInput, setScheduledForInput] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [events, setEvents] = useState<ClubEvent[]>([])
  const [eventsLoading, setEventsLoading] = useState(false)

  const resetForm = useCallback(() => {
    setTitle('')
    setBody('')
    setSelectedCategories(['highlight'])
    setTagsInput('')
    setPriority('normal')
    setIsPinned(false)
    setPinnedUntilInput('')
    setMinRole('guest')
    setEventId('')
    setMode('published')
    setScheduledForInput('')
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

  // Events for the "only participants of event" selector, loaded when the modal opens.
  useEffect(() => {
    if (!isOpen) return
    let ignore = false
    setEventsLoading(true)
    eventService
      .getEvents()
      .then((list) => {
        if (!ignore) setEvents(list)
      })
      .finally(() => {
        if (!ignore) setEventsLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [isOpen])

  if (!isOpen) return null

  const roleOptions = AUDIENCE_ROLES.filter((r) => rankOf(r.id) <= rankOf(myRole))

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

    let pinnedUntil: string | null = null
    if (isPinned) {
      pinnedUntil = localToIso(pinnedUntilInput)
      if (!pinnedUntil) {
        setError('Choose the date and time the pin should end')
        return
      }
      if (new Date(pinnedUntil).getTime() <= Date.now()) {
        setError('Pin end must be in the future')
        return
      }
    }

    let scheduledFor: string | null = null
    if (mode === 'scheduled') {
      scheduledFor = localToIso(scheduledForInput)
      if (!scheduledFor) {
        setError('Choose the date and time to publish')
        return
      }
      if (new Date(scheduledFor).getTime() <= Date.now()) {
        setError('Scheduled time must be in the future')
        return
      }
    }

    setIsSubmitting(true)
    setError(null)

    const parsedTags = tagsInput
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)

    // Step 1: create. The backend always creates a draft.
    let draft: Announcement
    try {
      draft = await announcementService.createAnnouncement({
        title: title.trim(),
        body: body.trim(),
        categories: selectedCategories,
        tags: parsedTags,
        priority,
        pinnedUntil,
        audience: {
          minRole,
          eventId: eventId || null,
        },
      })
    } catch (err) {
      setError(describeAnnouncementError(err, 'Failed to create announcement'))
      setIsSubmitting(false)
      return
    }

    // Step 2: publish now or schedule. If this fails the draft already exists, so hand it to the
    // page with a warning rather than leaving the form open (a resubmit would create a duplicate).
    if (mode === 'draft') {
      onCreated(draft)
      handleClose()
      return
    }

    try {
      const updated = await announcementService.publishAnnouncement(
        draft.id,
        scheduledFor ?? undefined
      )
      onCreated(updated)
    } catch (err) {
      onCreated(
        draft,
        `"${draft.title}" was saved as a draft, but ${
          mode === 'scheduled' ? 'scheduling' : 'publishing'
        } failed: ${describeAnnouncementError(err, 'unknown error')}`
      )
    }
    handleClose()
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
              maxLength={5000}
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

          {/* Audience */}
          <div className="pt-2 border-t border-gray-200 space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-black">
              Audience
            </label>
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                Minimum role
              </label>
              <select
                value={minRole}
                onChange={(e) => setMinRole(e.target.value as AudienceRole)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded text-black bg-white focus:outline-none focus:border-black"
              >
                {roleOptions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
              {selectedCategories.includes('teams') && rankOf(minRole) < rankOf('core') && (
                <span className="text-[11px] text-gray-500 mt-1 block">
                  The Teams category is always restricted to Core and above.
                </span>
              )}
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                Only participants of event (optional)
              </label>
              <select
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                disabled={eventsLoading}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded text-black bg-white focus:outline-none focus:border-black disabled:opacity-50"
              >
                <option value="">
                  {eventsLoading ? 'Loading events...' : 'No event restriction'}
                </option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.title} ({ev.status})
                  </option>
                ))}
              </select>
              {eventId && (
                <span className="text-[11px] text-gray-500 mt-1 block">
                  Visible only to users with a confirmed registration for this event.
                </span>
              )}
            </div>
          </div>

          {/* Pin */}
          <div className="pt-1 space-y-2">
            <label className="flex items-center gap-2 text-xs font-semibold text-black cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isPinned}
                onChange={(e) => setIsPinned(e.target.checked)}
                className="w-4 h-4 accent-black rounded cursor-pointer"
              />
              Pin to top of feed for high visibility
            </label>
            {isPinned && (
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                  Pinned until <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  required
                  value={pinnedUntilInput}
                  onChange={(e) => setPinnedUntilInput(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded text-black bg-white focus:outline-none focus:border-black"
                />
                <span className="text-[11px] text-gray-500 mt-1 block">
                  Must not be later than the announcement's 4-month expiry.
                </span>
              </div>
            )}
          </div>

          {/* Status Option */}
          <div className="pt-2 border-t border-gray-200">
            <label className="block text-xs font-bold uppercase tracking-wider text-black mb-2">
              Publishing Option
            </label>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <label className="flex items-center gap-2 text-xs font-medium text-black cursor-pointer select-none">
                <input
                  type="radio"
                  name="status"
                  value="published"
                  checked={mode === 'published'}
                  onChange={() => setMode('published')}
                  className="accent-black cursor-pointer"
                />
                Publish Immediately
              </label>
              <label className="flex items-center gap-2 text-xs font-medium text-black cursor-pointer select-none">
                <input
                  type="radio"
                  name="status"
                  value="scheduled"
                  checked={mode === 'scheduled'}
                  onChange={() => setMode('scheduled')}
                  className="accent-black cursor-pointer"
                />
                Schedule for Later
              </label>
              <label className="flex items-center gap-2 text-xs font-medium text-black cursor-pointer select-none">
                <input
                  type="radio"
                  name="status"
                  value="draft"
                  checked={mode === 'draft'}
                  onChange={() => setMode('draft')}
                  className="accent-black cursor-pointer"
                />
                Save as Draft
              </label>
            </div>
            {mode === 'scheduled' && (
              <div className="mt-3">
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                  Publish at <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  required
                  value={scheduledForInput}
                  onChange={(e) => setScheduledForInput(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded text-black bg-white focus:outline-none focus:border-black"
                />
              </div>
            )}
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
                : mode === 'published'
                ? 'Publish Announcement'
                : mode === 'scheduled'
                ? 'Schedule Announcement'
                : 'Save Draft'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CreateAnnouncementModal
