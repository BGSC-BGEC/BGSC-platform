import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Plus, Trash2, CheckCircle, AlertCircle, Gavel, GitBranch, Trophy, ArrowUp, ArrowDown } from 'lucide-react'
import { Modal } from '../ui/modal'
import type { ClubEvent, EventStatus } from '../../types/event'
import { LEADERBOARD_FORMAT_LABELS, rulesFor } from '../../types/event'
import { eventService, type EventCaptain } from '../../services/eventService'
import {
  registrationService,
  REGISTRATION_STATUSES,
  type FormFieldDef,
  type FormFieldType,
  type RegistrationForm,
  type EventRegistration,
} from '../../services/registrationService'

export interface EventDetailModalProps {
  event: ClubEvent | null
  isOpen: boolean
  onClose: () => void
  onEventUpdated: (updated: ClubEvent) => void
  onEventDeleted: (eventId: string) => void
}

type ActiveTab = 'overview' | 'form' | 'registrations' | 'captains' | 'preview'

const STATUS_LABELS: Record<EventRegistration['status'], string> = {
  draft: 'Draft',
  submitted: 'Awaiting review',
  confirmed: 'Confirmed',
  waitlisted: 'Waitlisted',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
}

const FIELD_TYPES: { value: FormFieldType; label: string }[] = [
  { value: 'short_text', label: 'Short Text' },
  { value: 'long_text', label: 'Long Text' },
  { value: 'number', label: 'Number' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'select', label: 'Dropdown Select' },
  { value: 'checkbox', label: 'Checkbox' },
]

export const EventDetailModal: React.FC<EventDetailModalProps> = ({
  event,
  isOpen,
  onClose,
  onEventUpdated,
  onEventDeleted,
}) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview')
  const [status, setStatus] = useState<EventStatus>('upcoming')
  const [venue, setVenue] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Form Builder state
  const [currentForm, setCurrentForm] = useState<RegistrationForm | null>(null)
  const [formTitle, setFormTitle] = useState('')
  const [fields, setFields] = useState<FormFieldDef[]>([])
  const [newFieldLabel, setNewFieldLabel] = useState('')
  const [newFieldType, setNewFieldType] = useState<FormFieldType>('short_text')
  const [newFieldRequired, setNewFieldRequired] = useState(true)
  const [newFieldOptions, setNewFieldOptions] = useState('')

  // Registrations & Attendance state
  const [registrations, setRegistrations] = useState<EventRegistration[]>([])
  const [regStatusFilter, setRegStatusFilter] = useState('all')
  const [isLoadingRegs, setIsLoadingRegs] = useState(false)

  // Captain review (leagues / teamed events, spec §5.5 Captain Request Flow)
  const [captainRegs, setCaptainRegs] = useState<EventRegistration[]>([])
  const [captainPool, setCaptainPool] = useState<EventCaptain[]>([])
  const [captainNotes, setCaptainNotes] = useState<Record<string, string>>({})
  const [isLoadingCaptains, setIsLoadingCaptains] = useState(false)

  const navigate = useNavigate()

  // Images + per-event points
  const [uploadingKind, setUploadingKind] = useState<'cover' | 'logo' | null>(null)
  const [ppParticipation, setPpParticipation] = useState(0)
  const [ppMultipliers, setPpMultipliers] = useState('')
  const [ppSponsorBonus, setPpSponsorBonus] = useState(0)
  const [ppInvestment, setPpInvestment] = useState(false)
  const [ppInvestmentCap, setPpInvestmentCap] = useState<number | ''>('')

  useEffect(() => {
    if (event?.pointsPool) {
      setPpParticipation(event.pointsPool.participation)
      setPpMultipliers(event.pointsPool.podiumMultipliers.join(', '))
      setPpSponsorBonus(event.pointsPool.sponsorBonus)
      setPpInvestment(event.pointsPool.investmentEnabled)
      setPpInvestmentCap(event.pointsPool.investmentCap ?? '')
    }
  }, [event])

  useEffect(() => {
    if (event) {
      setStatus(event.status)
      setVenue(event.venue || '')
      setFormTitle(`${event.title} Registration`)
      setFeedbackMsg(null)
      setErrorMsg(null)
      setActiveTab('overview')
    }
  }, [event])

  const loadForms = useCallback(async (eventId: string, fallbackTitle: string) => {
    const forms = await registrationService.getEventForms(eventId)
    if (forms.length > 0) {
      const f = forms[0]
      setCurrentForm(f)
      setFormTitle(f.title)
      setFields(f.fields || [])
    } else {
      setCurrentForm(null)
      setFormTitle(`${fallbackTitle} Registration`)
      setFields([
        { key: 'discord_tag', label: 'Discord / IGN', type: 'short_text', required: true },
      ])
    }
  }, [])

  const loadRegistrations = useCallback(async (eventId: string, filter: string) => {
    setIsLoadingRegs(true)
    try {
      const list = await registrationService.getEventRegistrations(
        eventId,
        filter === 'all' ? undefined : filter
      )
      setRegistrations(list)
    } catch (err) {
      setRegistrations([])
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load registrations')
    } finally {
      setIsLoadingRegs(false)
    }
  }, [])

  const loadCaptains = useCallback(async (eventId: string, withPool: boolean) => {
    setIsLoadingCaptains(true)
    try {
      const [list, pool] = await Promise.all([
        registrationService.getEventRegistrations(eventId),
        withPool ? eventService.getCaptains(eventId) : Promise.resolve([] as EventCaptain[]),
      ])
      // Pending applications first, then approved, then declined.
      const order = { pending: 0, approved: 1, declined: 2, none: 3 }
      setCaptainRegs(
        list
          .filter((r) => r.role === 'captain' && r.status !== 'cancelled')
          .sort((a, b) => order[a.captainApplication.status] - order[b.captainApplication.status])
      )
      setCaptainPool(pool)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load captain applications')
    } finally {
      setIsLoadingCaptains(false)
    }
  }, [])

  useEffect(() => {
    if (!isOpen || !event) return
    if (activeTab === 'form') {
      loadForms(event.id, event.title)
    } else if (activeTab === 'registrations') {
      loadRegistrations(event.id, regStatusFilter)
    } else if (activeTab === 'captains') {
      loadCaptains(event.id, rulesFor(event.type).isAuction)
    }
  }, [isOpen, event, activeTab, regStatusFilter, loadForms, loadRegistrations, loadCaptains])

  if (!isOpen || !event) return null

  const rules = rulesFor(event.type)
  const showCaptains = event.isTeamed
  const pendingCaptains = captainRegs.filter((r) => r.captainApplication.status === 'pending').length

  const handleCaptainDecision = async (reg: EventRegistration, decision: 'approved' | 'declined') => {
    setErrorMsg(null)
    setFeedbackMsg(null)
    try {
      await registrationService.updateCaptainApplication(reg.id, decision, captainNotes[reg.id]?.trim() || undefined)
      setFeedbackMsg(
        decision === 'approved'
          ? `${reg.displayName} approved as captain${rules.isAuction ? ' and added to the auction captain pool' : ''}.`
          : `${reg.displayName}'s captain application declined.`
      )
      await loadCaptains(event.id, rules.isAuction)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to review captain application')
    }
  }

  const handleImageUpload = async (kind: 'cover' | 'logo', file: File) => {
    setErrorMsg(null)
    setFeedbackMsg(null)
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('Image must be 10 MB or smaller.')
      return
    }
    setUploadingKind(kind)
    try {
      const url = await eventService.uploadEventImage(event.id, kind, file)
      onEventUpdated({ ...event, ...(kind === 'cover' ? { coverMediaUrl: url } : { logoUrl: url }) })
      setFeedbackMsg(kind === 'cover' ? 'Cover image updated.' : 'Logo updated.')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to upload image')
    } finally {
      setUploadingKind(null)
    }
  }

  const handleSavePoints = async () => {
    setErrorMsg(null)
    setFeedbackMsg(null)
    const multipliers = ppMultipliers.split(',').map((s) => Number(s.trim()))
    if (multipliers.some((m) => !(m > 0))) {
      setErrorMsg('Podium multipliers must be positive numbers, e.g. 3, 2, 1.5.')
      return
    }
    setIsSaving(true)
    try {
      const updated = await eventService.updatePointsPool(event.id, {
        participation: ppParticipation,
        podiumMultipliers: multipliers,
        sponsorBonus: ppSponsorBonus,
        investmentEnabled: rules.hasLeaderboard && ppInvestment,
        investmentCap: ppInvestmentCap === '' ? null : Number(ppInvestmentCap),
      })
      onEventUpdated(updated)
      setFeedbackMsg('Points settings saved.')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save points')
    } finally {
      setIsSaving(false)
    }
  }

  const handleMoveField = (index: number, delta: -1 | 1) => {
    setFields((prev) => {
      const next = [...prev]
      const target = index + delta
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const handleExportRegistrations = () => {
    const answerKeys = [...new Set(registrations.flatMap((r) => Object.keys(r.answers)))]
    const header = ['Name', 'User ID', 'Role', 'Status', 'Attended', 'Base Price', 'Registered', ...answerKeys]
    const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const rows = registrations.map((r) =>
      [
        r.displayName,
        r.userId,
        r.role,
        r.status,
        r.attended ? 'yes' : 'no',
        r.basePrice ?? '',
        r.createdAt,
        ...answerKeys.map((k) => (typeof r.answers[k] === 'object' ? JSON.stringify(r.answers[k]) : r.answers[k])),
      ]
        .map(cell)
        .join(',')
    )
    const csv = [header.map(cell).join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${event.slug || event.id}-registrations-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleRemoveFromPool = async (captain: EventCaptain) => {
    if (!window.confirm(`Remove ${captain.displayName} from the auction captain pool?`)) return
    setErrorMsg(null)
    try {
      await eventService.removeCaptain(event.id, captain.userId)
      await loadCaptains(event.id, true)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to remove captain')
    }
  }

  const handleUpdateLifecycle = async () => {
    setIsSaving(true)
    setErrorMsg(null)
    setFeedbackMsg(null)
    try {
      const updated = await eventService.updateEvent(event.id, {
        status,
        venue: venue.trim() || null,
      })
      onEventUpdated(updated)
      setFeedbackMsg('Event lifecycle and metadata updated.')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update event')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteEvent = async () => {
    if (!window.confirm(`Are you sure you want to delete "${event.title}"?`)) return
    setIsSaving(true)
    setErrorMsg(null)
    try {
      await eventService.deleteEvent(event.id)
      onEventDeleted(event.id)
      onClose()
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to delete event (only draft events can be deleted)')
    } finally {
      setIsSaving(false)
    }
  }

  const handleAddField = () => {
    if (!newFieldLabel.trim()) return
    const key = newFieldLabel
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')

    const options =
      newFieldType === 'select'
        ? newFieldOptions
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined

    setFields((prev) => [
      ...prev,
      {
        key: key || `field_${prev.length + 1}`,
        label: newFieldLabel.trim(),
        type: newFieldType,
        required: newFieldRequired,
        options,
      },
    ])
    setNewFieldLabel('')
    setNewFieldOptions('')
  }

  const handleRemoveField = (index: number) => {
    setFields((prev) => prev.filter((_, idx) => idx !== index))
  }

  const handleSaveFormDraft = async (): Promise<RegistrationForm | null> => {
    setIsSaving(true)
    setErrorMsg(null)
    setFeedbackMsg(null)
    try {
      let saved: RegistrationForm
      if (currentForm?.id && currentForm.status === 'draft') {
        saved = await registrationService.updateForm(currentForm.id, {
          title: formTitle.trim() || `${event.title} Registration`,
          fields,
        })
      } else {
        saved = await registrationService.createForm({
          owner: { type: 'event', id: event.id },
          title: formTitle.trim() || `${event.title} Registration`,
          fields,
        })
      }
      setCurrentForm(saved)
      setFeedbackMsg('Registration form draft saved.')
      return saved
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save form')
      return null
    } finally {
      setIsSaving(false)
    }
  }

  const handlePublishForm = async () => {
    setIsSaving(true)
    setErrorMsg(null)
    setFeedbackMsg(null)
    try {
      let formToPublish = currentForm
      if (!formToPublish || formToPublish.status === 'draft') {
        formToPublish = await handleSaveFormDraft()
      }
      if (!formToPublish) return

      const published = await registrationService.publishForm(formToPublish.id)
      setCurrentForm(published)

      // Only link the form. PATCH merges `registration`, so the deadline/capacity chosen at
      // creation stay as they are. (This used to overwrite closes_at with the event's END date,
      // which the backend refuses — registration must close before the event starts.)
      const updatedEvent = await eventService.updateEvent(event.id, {
        registration: { form_id: published.id },
      })
      onEventUpdated(updatedEvent)
      setFeedbackMsg('Form published and linked to event registrations.')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to publish form')
    } finally {
      setIsSaving(false)
    }
  }

  const handleRegStatusChange = async (
    regId: string,
    newStatus: 'confirmed' | 'waitlisted' | 'rejected'
  ) => {
    setErrorMsg(null)
    try {
      await registrationService.updateRegistrationStatus(regId, newStatus)
      await loadRegistrations(event.id, regStatusFilter)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update registration status')
    }
  }

  const handlePromoteWaitlist = async (regId: string) => {
    setErrorMsg(null)
    try {
      await eventService.promoteWaitlist(event.id, regId)
      await loadRegistrations(event.id, regStatusFilter)
      setFeedbackMsg('Waitlisted participant promoted to confirmed.')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to promote from waitlist')
    }
  }

  const handleToggleAttendance = async (reg: EventRegistration) => {
    setErrorMsg(null)
    const nextAttended = !reg.attended
    try {
      await eventService.recordAttendance(event.id, [
        { registration_id: reg.id, attended: nextAttended },
      ])
      setRegistrations((prev) =>
        prev.map((item) =>
          item.id === reg.id ? { ...item, attended: nextAttended } : item
        )
      )
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to record attendance')
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-3xl">
      <div className="p-6 space-y-5 overflow-y-auto flex-1">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold uppercase tracking-wider text-foreground">
                {event.title}
              </h2>
              <span
                title={rules.description}
                className="px-2 py-0.5 text-[10px] font-bold uppercase border border-foreground/70 rounded"
              >
                {rules.label}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              ID: {event.id} &bull; {event.category.toUpperCase()} &bull; {event.domain.toUpperCase()}
            </p>
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

        {/* Tabs */}
        <div className="flex border-b border-border gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 text-xs font-bold uppercase border-b-2 transition-colors cursor-pointer ${
              activeTab === 'overview'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            1. Overview & Lifecycle
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('form')}
            className={`px-4 py-2 text-xs font-bold uppercase border-b-2 transition-colors cursor-pointer ${
              activeTab === 'form'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            2. Registration Form
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('registrations')}
            className={`px-4 py-2 text-xs font-bold uppercase border-b-2 transition-colors cursor-pointer ${
              activeTab === 'registrations'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            3. Registrations & Attendance
          </button>
          {showCaptains && (
            <button
              type="button"
              onClick={() => setActiveTab('captains')}
              className={`px-4 py-2 text-xs font-bold uppercase border-b-2 transition-colors cursor-pointer ${
                activeTab === 'captains'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              4. Captain Applications
              {pendingCaptains > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 text-[10px] bg-primary text-primary-foreground rounded">
                  {pendingCaptains}
                </span>
              )}
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`px-4 py-2 text-xs font-bold uppercase border-b-2 transition-colors cursor-pointer ${
              activeTab === 'preview'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Preview
          </button>
        </div>

        {feedbackMsg && (
          <div className="p-3 border border-foreground/70 bg-muted/30 text-xs text-foreground flex items-center gap-2 rounded">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{feedbackMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 border border-destructive/40 bg-destructive/10 text-xs text-destructive flex items-center gap-2 rounded">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* TAB 1: Overview & Lifecycle */}
        {activeTab === 'overview' && (
          <div className="space-y-4 text-left">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/30 p-3 rounded border border-border text-xs">
              <div>
                <span className="text-muted-foreground block uppercase font-bold text-[10px]">Dates</span>
                <span className="font-semibold text-foreground">
                  {event.startAt} &rarr; {event.endAt}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block uppercase font-bold text-[10px]">Capacity</span>
                <span className="font-semibold text-foreground">
                  {event.currentParticipants} / {event.maxParticipants ?? 'Unlimited'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block uppercase font-bold text-[10px]">Format</span>
                <span className="font-semibold text-foreground">
                  {event.isTeamed
                    ? `Teams of ${event.teaming?.teamSizeMin ?? '?'}–${event.teaming?.teamSizeMax ?? '?'}${
                        event.teaming?.maxTeams ? ` · max ${event.teaming.maxTeams}` : ''
                      }`
                    : 'Solo Entry'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block uppercase font-bold text-[10px]">Linked Form</span>
                <span className="font-semibold text-foreground">
                  {event.registrationFormId || currentForm?.id || 'Default'}
                </span>
              </div>
            </div>

            {/* Type-specific configuration (what this event type switches on) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 border border-border rounded">
                <span className="text-muted-foreground block uppercase font-bold text-[10px]">Registration closes</span>
                <span className="font-semibold text-foreground">
                  {event.registrationClosesAt ? new Date(event.registrationClosesAt).toLocaleString() : '—'}
                </span>
              </div>
              {rules.hasLeaderboard && event.leaderboard && (
                <div className="p-3 border border-border rounded">
                  <span className="text-muted-foreground block uppercase font-bold text-[10px]">Leaderboard</span>
                  <span className="font-semibold text-foreground">
                    {LEADERBOARD_FORMAT_LABELS[event.leaderboard.format]}
                    {event.leaderboard.format === 'elim_after_n' && ` (N = ${event.leaderboard.elimAfterN})`}
                    {` · min ${event.leaderboard.minParticipants}`}
                  </span>
                </div>
              )}
              {event.isTeamed && (
                <div className="p-3 border border-border rounded">
                  <span className="text-muted-foreground block uppercase font-bold text-[10px]">Captains</span>
                  <span className="font-semibold text-foreground">
                    {event.teaming?.captainApplicationRequired ? 'Admin-approved applications' : 'Auto-approved on registration'}
                  </span>
                </div>
              )}
              {rules.isAuction && event.auction && (
                <div className="p-3 border border-border rounded">
                  <span className="text-muted-foreground block uppercase font-bold text-[10px]">Auction</span>
                  <span className="font-semibold text-foreground">
                    {event.auction.status.replace('_', ' ')} · K {event.auction.kMultiplier} · +{event.auction.minBidIncrement}/bid ·{' '}
                    {event.auction.bidTimerSeconds}s · {event.auction.captainUserIds.length} captain
                    {event.auction.captainUserIds.length === 1 ? '' : 's'}
                  </span>
                </div>
              )}
            </div>

            {/* Type-driven shortcuts: only the tools this type actually has */}
            {(rules.hasLeaderboard || rules.isAuction) && (
              <div className="flex flex-wrap gap-2">
                {rules.hasLeaderboard && (
                  <button
                    type="button"
                    onClick={() => navigate(`/tournaments?event=${event.id}`)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-foreground/70 text-foreground bg-card hover:bg-primary hover:text-primary-foreground rounded cursor-pointer"
                  >
                    <GitBranch className="w-3.5 h-3.5" />
                    {rules.isLeague ? 'Bracket & Matches' : 'Scores & Bracket'}
                  </button>
                )}
                {rules.hasLeaderboard && (
                  <button
                    type="button"
                    onClick={() => navigate('/leaderboard')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-foreground/70 text-foreground bg-card hover:bg-primary hover:text-primary-foreground rounded cursor-pointer"
                  >
                    <Trophy className="w-3.5 h-3.5" />
                    Leaderboard
                  </button>
                )}
                {rules.isAuction && (
                  <button
                    type="button"
                    onClick={() => navigate(`/auction?event=${event.id}`)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-foreground/70 bg-primary text-primary-foreground hover:bg-primary/90 rounded cursor-pointer"
                  >
                    <Gavel className="w-3.5 h-3.5" />
                    Open Auction Console
                  </button>
                )}
              </div>
            )}

            {event.description && (
              <div className="text-xs text-foreground p-3 border border-border rounded">
                {event.description}
              </div>
            )}

            {/* Event images: cover/poster + logo (POST /events/:id/media) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(['cover', 'logo'] as const).map((kind) => {
                const url = kind === 'cover' ? event.coverMediaUrl : event.logoUrl
                const frozen = event.status === 'past' || event.status === 'cancelled'
                return (
                  <div key={kind} className="p-3 border border-border rounded space-y-2">
                    <span className="text-muted-foreground block uppercase font-bold text-[10px]">
                      {kind === 'cover' ? 'Cover / Poster' : 'Logo'}
                    </span>
                    {url ? (
                      <img src={url} alt={kind} className="w-full h-28 object-contain bg-muted/30 border border-border rounded" />
                    ) : (
                      <div className="h-28 grid place-items-center text-[11px] text-muted-foreground bg-muted/30 border border-dashed border-border rounded">
                        No image
                      </div>
                    )}
                    <label
                      className={`inline-block px-3 py-1.5 text-xs font-bold border border-foreground/70 rounded ${
                        frozen || uploadingKind ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-primary hover:text-primary-foreground'
                      }`}
                    >
                      {uploadingKind === kind ? 'Uploading…' : url ? 'Replace' : 'Upload'}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        disabled={frozen || Boolean(uploadingKind)}
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          e.target.value = ''
                          if (file) handleImageUpload(kind, file)
                        }}
                      />
                    </label>
                    {frozen && <p className="text-[10px] text-muted-foreground">Images are frozen for past/cancelled events.</p>}
                  </div>
                )
              })}
            </div>

            {/* Points for this event (points_pool) */}
            <div className="p-3 border border-border rounded space-y-3">
              <span className="text-muted-foreground block uppercase font-bold text-[10px]">Points</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <label className="block">
                  <span className="block text-[10px] font-bold uppercase text-foreground mb-1">Participation</span>
                  <input type="number" min={0} value={ppParticipation} onChange={(e) => setPpParticipation(Number(e.target.value))} className="w-full px-2 py-1.5 text-xs border border-border rounded bg-card text-foreground" />
                </label>
                <label className="block">
                  <span className="block text-[10px] font-bold uppercase text-foreground mb-1">Podium ×</span>
                  <input type="text" value={ppMultipliers} onChange={(e) => setPpMultipliers(e.target.value)} placeholder="3, 2, 1.5" className="w-full px-2 py-1.5 text-xs border border-border rounded bg-card text-foreground" />
                </label>
                <label className="block">
                  <span className="block text-[10px] font-bold uppercase text-foreground mb-1">Sponsor bonus</span>
                  <input type="number" min={0} value={ppSponsorBonus} onChange={(e) => setPpSponsorBonus(Number(e.target.value))} className="w-full px-2 py-1.5 text-xs border border-border rounded bg-card text-foreground" />
                </label>
                {rules.hasLeaderboard && (
                  <label className="block">
                    <span className="block text-[10px] font-bold uppercase text-foreground mb-1">Investment</span>
                    <span className="flex items-center gap-2">
                      <input type="checkbox" checked={ppInvestment} onChange={(e) => setPpInvestment(e.target.checked)} />
                      {ppInvestment && (
                        <input type="number" min={1} placeholder="cap" value={ppInvestmentCap} onChange={(e) => setPpInvestmentCap(e.target.value === '' ? '' : Number(e.target.value))} className="w-full px-2 py-1.5 text-xs border border-border rounded bg-card text-foreground" />
                      )}
                    </span>
                  </label>
                )}
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSavePoints}
                  disabled={isSaving}
                  className="px-3 py-1.5 text-xs font-bold border border-foreground/70 text-foreground bg-card hover:bg-primary hover:text-primary-foreground rounded cursor-pointer disabled:opacity-50"
                >
                  Save Points
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-foreground mb-1">
                  Lifecycle Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as EventStatus)}
                  className="w-full px-3 py-2 text-sm border border-border rounded text-foreground bg-card focus:outline-none focus:border-primary"
                >
                  <option value="draft">Draft</option>
                  <option value="upcoming">Upcoming (Registration Open)</option>
                  <option value="ongoing">Ongoing (Live)</option>
                  <option value="past">Past / Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-foreground mb-1">
                  Venue
                </label>
                <input
                  type="text"
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-border rounded text-foreground bg-card focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-border">
              {event.status === 'draft' ? (
                <button
                  type="button"
                  onClick={handleDeleteEvent}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold border border-destructive text-destructive hover:bg-red-600 hover:text-primary-foreground rounded transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Draft
                </button>
              ) : (
                <span className="text-xs text-muted-foreground">
                  Only draft tournaments can be permanently deleted.
                </span>
              )}

              <button
                type="button"
                onClick={handleUpdateLifecycle}
                disabled={isSaving}
                className="px-4 py-2 text-xs font-bold border border-foreground/70 bg-primary text-primary-foreground hover:bg-primary/90 rounded transition-colors cursor-pointer disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: Dynamic Registration Form Builder */}
        {activeTab === 'form' && (
          <div className="space-y-4 text-left">
            <div className="flex items-center justify-between">
              <div className="flex-1 mr-4">
                <label className="block text-xs font-bold uppercase text-foreground mb-1">
                  Form Title
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-border rounded text-foreground bg-card"
                />
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold uppercase text-muted-foreground block">
                  Form Status
                </span>
                <span className="inline-block mt-1 px-2.5 py-1 text-xs font-bold uppercase border border-foreground/70 rounded">
                  {currentForm?.status || 'uncreated'}
                </span>
              </div>
            </div>

            {/* Existing Fields */}
            <div className="border border-border rounded divide-y divide-border/60">
              {fields.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  No custom fields added yet. Add fields below.
                </div>
              ) : (
                fields.map((f, idx) => (
                  <div
                    key={`${f.key}-${idx}`}
                    className="p-3 flex items-center justify-between text-xs bg-card"
                  >
                    <div>
                      <span className="font-bold text-foreground">{f.label}</span>{' '}
                      <span className="text-muted-foreground font-mono">({f.key})</span>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        Type: <span className="font-semibold">{f.type}</span> &bull;{' '}
                        {f.required ? 'Required' : 'Optional'}
                        {f.options && f.options.length > 0
                          ? ` • Options: ${f.options.join(', ')}`
                          : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        title="Move up"
                        onClick={() => handleMoveField(idx, -1)}
                        disabled={idx === 0}
                        className="p-1.5 text-muted-foreground hover:text-foreground border border-border rounded cursor-pointer disabled:opacity-30"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        title="Move down"
                        onClick={() => handleMoveField(idx, 1)}
                        disabled={idx === fields.length - 1}
                        className="p-1.5 text-muted-foreground hover:text-foreground border border-border rounded cursor-pointer disabled:opacity-30"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveField(idx)}
                        className="p-1.5 text-muted-foreground hover:text-foreground border border-border rounded cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Add New Field Box */}
            <div className="p-3 bg-muted/30 border border-border rounded space-y-3">
              <div className="text-xs font-bold uppercase text-foreground">
                Add Custom Form Field
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="Field Label (e.g. In-Game Role)"
                  value={newFieldLabel}
                  onChange={(e) => setNewFieldLabel(e.target.value)}
                  className="px-3 py-1.5 text-xs border border-border rounded bg-card text-foreground"
                />
                <select
                  value={newFieldType}
                  onChange={(e) => setNewFieldType(e.target.value as FormFieldType)}
                  className="px-3 py-1.5 text-xs border border-border rounded bg-card text-foreground"
                >
                  {FIELD_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newFieldRequired}
                      onChange={(e) => setNewFieldRequired(e.target.checked)}
                    />
                    <span>Required</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleAddField}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold border border-foreground/70 bg-card text-foreground hover:bg-primary hover:text-primary-foreground rounded cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add
                  </button>
                </div>
              </div>
              {newFieldType === 'select' && (
                <input
                  type="text"
                  placeholder="Comma-separated options (e.g. Duelist, Controller, Sentinel)"
                  value={newFieldOptions}
                  onChange={(e) => setNewFieldOptions(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-border rounded bg-card text-foreground"
                />
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={handleSaveFormDraft}
                disabled={isSaving}
                className="px-4 py-2 text-xs font-bold border border-foreground/70 text-foreground bg-card hover:bg-muted rounded cursor-pointer"
              >
                Save Draft
              </button>
              <button
                type="button"
                onClick={handlePublishForm}
                disabled={isSaving}
                className="px-4 py-2 text-xs font-bold border border-foreground/70 bg-primary text-primary-foreground hover:bg-primary/90 rounded cursor-pointer"
              >
                Publish & Link to Event
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: Registrations & Attendance */}
        {activeTab === 'registrations' && (
          <div className="space-y-4 text-left">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-3">
                <span className="text-xs font-bold uppercase text-foreground">
                  Participant Roster ({registrations.length})
                </span>
                <button
                  type="button"
                  onClick={handleExportRegistrations}
                  disabled={registrations.length === 0}
                  className="px-2.5 py-1 text-[10px] font-bold uppercase border border-foreground/70 text-foreground bg-card hover:bg-primary hover:text-primary-foreground rounded cursor-pointer disabled:opacity-40"
                >
                  Export CSV
                </button>
              </span>
              <select
                value={regStatusFilter}
                onChange={(e) => setRegStatusFilter(e.target.value)}
                className="px-3 py-1.5 text-xs border border-border rounded bg-card text-foreground"
              >
                <option value="all">All Statuses</option>
                {REGISTRATION_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>

            {isLoadingRegs ? (
              <div className="p-6 text-center text-xs text-muted-foreground border border-border rounded">
                Loading registrations...
              </div>
            ) : registrations.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground border border-border rounded">
                No registrations found for this filter.
              </div>
            ) : (
              <div className="border border-border rounded overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/30 text-[10px] font-bold uppercase text-muted-foreground">
                      <th className="py-2.5 px-3">Participant</th>
                      {event.isTeamed && <th className="py-2.5 px-3">Role</th>}
                      {rules.isAuction && <th className="py-2.5 px-3">Base Price</th>}
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Attendance</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {registrations.map((reg) => (
                      <tr key={reg.id} className="hover:bg-muted/30">
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-foreground">{reg.displayName}</div>
                          <div className="text-[11px] text-muted-foreground font-mono">{reg.userId.slice(0, 8)}</div>
                        </td>
                        {event.isTeamed && (
                          <td className="py-2.5 px-3 uppercase text-[11px] font-semibold">
                            {reg.role}
                            {reg.role === 'captain' && reg.captainApplication.status !== 'none' && (
                              <span className="block text-[10px] text-muted-foreground normal-case">
                                application {reg.captainApplication.status}
                              </span>
                            )}
                          </td>
                        )}
                        {rules.isAuction && (
                          <td className="py-2.5 px-3 font-mono">{reg.basePrice ?? '—'}</td>
                        )}
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 text-[10px] font-bold uppercase border border-border rounded">
                            {STATUS_LABELS[reg.status] ?? reg.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <label className="inline-flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={Boolean(reg.attended)}
                              onChange={() => handleToggleAttendance(reg)}
                            />
                            <span>{reg.attended ? 'Checked In' : 'Absent'}</span>
                          </label>
                        </td>
                        <td className="py-2.5 px-3 text-right space-x-1">
                          {reg.status === 'waitlisted' && (
                            <button
                              type="button"
                              onClick={() => handlePromoteWaitlist(reg.id)}
                              className="px-2 py-1 text-[10px] font-bold border border-foreground/70 bg-primary text-primary-foreground rounded cursor-pointer"
                            >
                              Promote
                            </button>
                          )}
                          {reg.status !== 'confirmed' && (
                            <button
                              type="button"
                              onClick={() => handleRegStatusChange(reg.id, 'confirmed')}
                              className="px-2 py-1 text-[10px] font-bold border border-border hover:border-primary/50 rounded cursor-pointer"
                            >
                              Confirm
                            </button>
                          )}
                          {reg.status !== 'rejected' && (
                            <button
                              type="button"
                              onClick={() => handleRegStatusChange(reg.id, 'rejected')}
                              className="px-2 py-1 text-[10px] font-bold border border-border text-destructive hover:border-red-600 rounded cursor-pointer"
                            >
                              Reject
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* PREVIEW: how participants see the event (read-only; nothing is published) */}
        {activeTab === 'preview' && (
          <div className="space-y-3 text-left">
            <p className="text-[11px] text-muted-foreground">
              Participant view of this event as currently saved. Previewing does not publish anything.
            </p>
            <div className="max-w-sm mx-auto border border-border rounded-lg overflow-hidden shadow-sm">
              {event.coverMediaUrl ? (
                <img src={event.coverMediaUrl} alt="cover" className="w-full h-40 object-cover" />
              ) : (
                <div className="w-full h-40 bg-muted grid place-items-center text-xs text-muted-foreground">No cover image</div>
              )}
              <div className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  {event.logoUrl && <img src={event.logoUrl} alt="logo" className="w-8 h-8 object-contain" />}
                  <div>
                    <div className="text-base font-bold text-foreground">{event.title}</div>
                    <div className="text-[10px] uppercase font-bold text-muted-foreground">
                      {event.category} · {event.domain} · {rules.label}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-foreground">
                  {event.startAt} → {event.endAt}
                  {event.venue ? ` · ${event.venue}` : ''}
                </div>
                {event.registrationClosesAt && (
                  <div className="text-xs text-foreground">
                    Registration closes {new Date(event.registrationClosesAt).toLocaleString()}
                  </div>
                )}
                <div className="text-xs text-foreground">
                  {event.isTeamed
                    ? `Team event · teams of ${event.teaming?.teamSizeMin ?? '?'}–${event.teaming?.teamSizeMax ?? '?'}`
                    : 'Solo entry'}
                  {' · '}
                  {event.currentParticipants} / {event.maxParticipants ?? '∞'} registered
                </div>
                {event.description && <p className="text-xs text-muted-foreground whitespace-pre-wrap">{event.description}</p>}
                {event.pointsPool && (
                  <div className="text-[11px] text-muted-foreground">
                    +{event.pointsPool.participation} pts for taking part
                  </div>
                )}
                <div className="pt-1">
                  <span className="inline-block px-3 py-1.5 text-xs font-bold bg-primary text-primary-foreground rounded">
                    {event.status === 'upcoming' ? 'Register' : event.status === 'draft' ? 'Draft — not visible to users' : event.status}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: Captain Applications (spec §5.5 Captain Request Flow) */}
        {activeTab === 'captains' && showCaptains && (
          <div className="space-y-4 text-left">
            <p className="text-xs text-muted-foreground">
              {event.teaming?.captainApplicationRequired
                ? 'Users who registered as Team Captain are waiting for review by this event’s core admins.'
                : 'Captain applications are auto-approved for this event (approval not required at creation).'}
              {rules.isAuction && ' Approving a captain adds them to the auction captain pool.'}
            </p>

            {isLoadingCaptains ? (
              <div className="p-6 text-center text-xs text-muted-foreground border border-border rounded">
                Loading captain applications...
              </div>
            ) : captainRegs.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground border border-border rounded">
                No one has registered as captain yet.
              </div>
            ) : (
              <div className="border border-border rounded divide-y divide-border/60">
                {captainRegs.map((reg) => {
                  const appStatus = reg.captainApplication.status
                  return (
                    <div key={reg.id} className="p-3 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-bold text-foreground">{reg.displayName}</span>
                          <span className="ml-2 text-muted-foreground font-mono">{reg.userId.slice(0, 8)}</span>
                          <span className="ml-2 text-muted-foreground">registered {reg.createdAt}</span>
                        </div>
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold uppercase border rounded ${
                            appStatus === 'pending'
                              ? 'border-foreground/70 bg-primary text-primary-foreground'
                              : appStatus === 'declined'
                                ? 'border-destructive/40 text-destructive'
                                : 'border-border text-foreground'
                          }`}
                        >
                          {appStatus === 'none' ? 'auto-approved' : appStatus}
                        </span>
                      </div>
                      {Object.keys(reg.answers).length > 0 && (
                        <div className="text-[11px] text-muted-foreground">
                          {Object.entries(reg.answers)
                            .map(([k, v]) => `${k}: ${String(v)}`)
                            .join(' · ')}
                        </div>
                      )}
                      {appStatus === 'pending' ? (
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            type="text"
                            placeholder="Review note (optional)"
                            value={captainNotes[reg.id] ?? ''}
                            onChange={(e) => setCaptainNotes((prev) => ({ ...prev, [reg.id]: e.target.value }))}
                            className="flex-1 px-3 py-1.5 text-xs border border-border rounded bg-card text-foreground"
                          />
                          <button
                            type="button"
                            onClick={() => handleCaptainDecision(reg, 'approved')}
                            className="px-3 py-1.5 text-xs font-bold border border-foreground/70 bg-primary text-primary-foreground hover:bg-primary/90 rounded cursor-pointer"
                          >
                            Approve Captain
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCaptainDecision(reg, 'declined')}
                            className="px-3 py-1.5 text-xs font-bold border border-border text-destructive hover:border-red-600 rounded cursor-pointer"
                          >
                            Decline
                          </button>
                        </div>
                      ) : (
                        reg.captainApplication.note && (
                          <div className="text-[11px] text-muted-foreground">Note: {reg.captainApplication.note}</div>
                        )
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {rules.isAuction && (
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase text-foreground">
                  Auction Captain Pool ({captainPool.length})
                </div>
                {captainPool.length === 0 ? (
                  <div className="p-4 text-center text-xs text-muted-foreground border border-border rounded">
                    No captains in the pool yet. Approve applications above.
                  </div>
                ) : (
                  <div className="border border-border rounded divide-y divide-border/60">
                    {captainPool.map((c) => (
                      <div key={c.userId} className="p-2.5 flex items-center justify-between text-xs">
                        <span className="font-bold text-foreground">{c.displayName}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveFromPool(c)}
                          disabled={event.auction?.status === 'finished'}
                          className="px-2 py-1 text-[10px] font-bold border border-border text-destructive hover:border-red-600 rounded cursor-pointer disabled:opacity-40"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}

export default EventDetailModal
