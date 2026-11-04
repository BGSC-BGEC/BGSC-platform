import React, { useState, useEffect } from 'react'
import { X, Trophy, AlertTriangle, Loader2 } from 'lucide-react'
import type { ClubEvent, EventCategory, EventDomain, EventType } from '../../types/event'
import { eventService } from '../../services/eventService'
import { Modal } from '../ui/modal'
import { Button } from '../ui/button'

export interface CreateEventModalProps {
  isOpen: boolean
  onClose: () => void
  onEventCreated: (newEvent: ClubEvent) => void
}

export const CreateEventModal: React.FC<CreateEventModalProps> = ({
  isOpen,
  onClose,
  onEventCreated,
}) => {
  const today = new Date().toISOString().split('T')[0]

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<EventCategory>('leagues')
  const [type, setType] = useState<EventType>('LE')
  const [domain, setDomain] = useState<EventDomain>('sports')
  const [venue, setVenue] = useState('')
  const [startAt, setStartAt] = useState(today)
  const [endAt, setEndAt] = useState(today)
  const [registrationClosesAt, setRegistrationClosesAt] = useState(today)
  const [maxParticipants, setMaxParticipants] = useState<number>(32)
  const [isTeamed, setIsTeamed] = useState(false)
  const [waitlistEnabled, setWaitlistEnabled] = useState(true)
  const [requiresApproval, setRequiresApproval] = useState(false)
  const [status, setStatus] = useState<'draft' | 'upcoming'>('draft')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    if (endAt < startAt) {
      setError('The end date cannot be before the start date.')
      return
    }
    if (registrationClosesAt > startAt) {
      setError('Registration must close on or before the start date.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const createdEvent = await eventService.createEvent({
        title: title.trim(),
        description: description.trim(),
        category,
        type,
        domain,
        venue: venue.trim() || null,
        startAt,
        endAt,
        registrationClosesAt,
        maxParticipants: maxParticipants > 0 ? maxParticipants : null,
        isTeamed: type === 'ALL' ? true : isTeamed,
        waitlistEnabled,
        requiresApproval,
        status,
      })

      onEventCreated(createdEvent)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create event')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <Trophy className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
              Create New Tournament
            </h2>
            <p className="text-xs text-muted-foreground">
              Set tournament format, registration dates, and participant quotas
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="flex items-center gap-2 p-3 text-xs rounded-xl border border-destructive/40 bg-destructive/10 text-destructive animate-in fade-in">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-foreground mb-1.5">
              Event Title <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. BGSC Badminton Smash Open"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-foreground mb-1.5">
              Description
            </label>
            <textarea
              rows={2}
              placeholder="Brief overview of rules, format, and prizes..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all resize-y"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-foreground mb-1.5">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as EventCategory)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
              >
                <option value="leagues">Leagues</option>
                <option value="bgec">BGEC</option>
                <option value="fitsoc">FitSoc</option>
                <option value="general">General</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-foreground mb-1.5">
                Format Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as EventType)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
              >
                <option value="LE">LE (Standard)</option>
                <option value="DE">DE (Double Elim)</option>
                <option value="ALL">ALL (Auction League)</option>
                <option value="DLL">DLL (Dual League)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-foreground mb-1.5">
                Domain
              </label>
              <select
                value={domain}
                onChange={(e) => setDomain(e.target.value as EventDomain)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
              >
                <option value="sports">Sports</option>
                <option value="esports">Esports</option>
                <option value="fitness">Fitness</option>
                <option value="social">Social</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-foreground mb-1.5">
                Start Date
              </label>
              <input
                type="date"
                required
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-foreground mb-1.5">
                End Date
              </label>
              <input
                type="date"
                required
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-foreground mb-1.5">
                Registration Closes
              </label>
              <input
                type="date"
                required
                value={registrationClosesAt}
                onChange={(e) => setRegistrationClosesAt(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-foreground mb-1.5">
              Venue / Location
            </label>
            <input
              type="text"
              placeholder="e.g. Indoor Badminton Arena, Courts 1-4"
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-foreground mb-1.5">
                Max Capacity
              </label>
              <input
                type="number"
                min={1}
                value={maxParticipants}
                onChange={(e) => setMaxParticipants(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-foreground mb-1.5">
                Initial Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'draft' | 'upcoming')}
                className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
              >
                <option value="upcoming">Upcoming</option>
                <option value="draft">Draft</option>
              </select>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2.5">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-foreground select-none">
              <input
                type="checkbox"
                checked={type === 'ALL' ? true : isTeamed}
                disabled={type === 'ALL'}
                onChange={(e) => setIsTeamed(e.target.checked)}
                className="rounded accent-primary"
              />
              <span>Team Tournament (Check if Team vs. Solo)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-foreground select-none">
              <input
                type="checkbox"
                checked={waitlistEnabled}
                onChange={(e) => setWaitlistEnabled(e.target.checked)}
                className="rounded accent-primary"
              />
              <span>Enable Waitlist when capacity is reached</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-foreground select-none">
              <input
                type="checkbox"
                checked={requiresApproval}
                onChange={(e) => setRequiresApproval(e.target.checked)}
                className="rounded accent-primary"
              />
              <span>Require Admin Approval for Registrations</span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border bg-muted/20 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-xs"
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
                Creating...
              </>
            ) : (
              'Create Tournament'
            )}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default CreateEventModal
