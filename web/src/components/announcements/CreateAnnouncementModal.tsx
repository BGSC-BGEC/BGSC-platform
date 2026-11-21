import React, { useState, useEffect, useCallback } from 'react'
import {
  X,
  Megaphone,
  AlertTriangle,
  Loader2,
  Pin,
  Send,
  FileText,
  Users,
  Calendar,
} from 'lucide-react'
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
import { Modal } from '../ui/modal'
import { Button } from '../ui/button'
import { cn } from '../../lib/utils'

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

const INPUT =
  'w-full px-3.5 py-2 text-sm rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all'

const LABEL = 'block text-xs font-bold uppercase tracking-wider text-foreground mb-1.5'

export const CreateAnnouncementModal: React.FC<CreateAnnouncementModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const myRole = useAuthStore((s) => s.user?.role)

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<AnnouncementCategory[]>([
    'highlight',
  ])
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
              <label className={cn(LABEL, 'mb-0')}>
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
              className={INPUT}
            />
          </div>

          {/* Category Selector */}
          <div>
            <label className={LABEL}>
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

          {/* Priority & Tags */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Priority Level</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as AnnouncementPriority)}
                className={INPUT}
              >
                <option value="normal">Normal (Standard bulletin)</option>
                <option value="important">Important (High-contrast card)</option>
                <option value="urgent">Urgent (High-visibility alert)</option>
              </select>
            </div>

            <div>
              <label className={LABEL}>Tags (comma-separated)</label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="weather, turf, safety"
                className={INPUT}
              />
            </div>
          </div>

          {/* Message Body */}
          <div>
            <label className={LABEL}>
              Message Body <span className="text-destructive">*</span>
            </label>
            <textarea
              required
              rows={5}
              maxLength={5000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write the complete announcement details for the club community..."
              className={cn(INPUT, 'resize-y leading-relaxed')}
            />
          </div>

          {/* Audience */}
          <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-primary" />
              Audience
            </span>

            <div>
              <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                Minimum role
              </label>
              <select
                value={minRole}
                onChange={(e) => setMinRole(e.target.value as AudienceRole)}
                className={INPUT}
              >
                {roleOptions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
              {selectedCategories.includes('teams') && rankOf(minRole) < rankOf('core') && (
                <span className="text-[11px] text-muted-foreground mt-1 block">
                  The Teams category is always restricted to Core and above.
                </span>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                Only participants of event (optional)
              </label>
              <select
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                disabled={eventsLoading}
                className={cn(INPUT, 'disabled:opacity-50')}
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
                <span className="text-[11px] text-muted-foreground mt-1 block">
                  Visible only to users with a confirmed registration for this event.
                </span>
              )}
            </div>
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

            {isPinned && (
              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                  Pinned until <span className="text-destructive">*</span>
                </label>
                <input
                  type="datetime-local"
                  required
                  value={pinnedUntilInput}
                  onChange={(e) => setPinnedUntilInput(e.target.value)}
                  className={INPUT}
                />
                <span className="text-[11px] text-muted-foreground mt-1 block">
                  Must not be later than the announcement's 4-month expiry.
                </span>
              </div>
            )}

            <div className="pt-2 border-t border-border space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                Publishing Option
              </span>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <label className="flex items-center gap-1.5 text-xs font-medium text-foreground cursor-pointer select-none">
                  <input
                    type="radio"
                    name="status"
                    value="published"
                    checked={mode === 'published'}
                    onChange={() => setMode('published')}
                    className="accent-primary cursor-pointer"
                  />
                  <span>Publish Immediately</span>
                </label>
                <label className="flex items-center gap-1.5 text-xs font-medium text-foreground cursor-pointer select-none">
                  <input
                    type="radio"
                    name="status"
                    value="scheduled"
                    checked={mode === 'scheduled'}
                    onChange={() => setMode('scheduled')}
                    className="accent-primary cursor-pointer"
                  />
                  <span>Schedule for Later</span>
                </label>
                <label className="flex items-center gap-1.5 text-xs font-medium text-foreground cursor-pointer select-none">
                  <input
                    type="radio"
                    name="status"
                    value="draft"
                    checked={mode === 'draft'}
                    onChange={() => setMode('draft')}
                    className="accent-primary cursor-pointer"
                  />
                  <span>Save as Draft</span>
                </label>
              </div>
            </div>

            {mode === 'scheduled' && (
              <div className="pt-2 border-t border-border">
                <label className="block text-[11px] font-semibold text-muted-foreground mb-1 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  Publish at <span className="text-destructive">*</span>
                </label>
                <input
                  type="datetime-local"
                  required
                  value={scheduledForInput}
                  onChange={(e) => setScheduledForInput(e.target.value)}
                  className={INPUT}
                />
              </div>
            )}
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
          <Button type="submit" size="sm" disabled={isSubmitting} className="text-xs font-semibold gap-1.5">
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Submitting...
              </>
            ) : mode === 'published' ? (
              <>
                <Send className="w-3.5 h-3.5" />
                Publish Announcement
              </>
            ) : mode === 'scheduled' ? (
              <>
                <Calendar className="w-3.5 h-3.5" />
                Schedule Announcement
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
