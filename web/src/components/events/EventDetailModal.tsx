import React, { useState, useEffect, useCallback } from 'react'
import {
  X,
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  Calendar,
  Users,
  Trophy,
  FileText,
  MapPin,
  Loader2,
} from 'lucide-react'
import type { ClubEvent, EventStatus } from '../../types/event'
import { eventService } from '../../services/eventService'
import {
  registrationService,
  type FormFieldDef,
  type FormFieldType,
  type RegistrationForm,
  type EventRegistration,
} from '../../services/registrationService'
import { Modal } from '../ui/modal'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { cn } from '../../lib/utils'

export interface EventDetailModalProps {
  event: ClubEvent | null
  isOpen: boolean
  onClose: () => void
  onEventUpdated: (updated: ClubEvent) => void
  onEventDeleted: (eventId: string) => void
}

type ActiveTab = 'overview' | 'form' | 'registrations'

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

  // Reset tab and load initial event state
  useEffect(() => {
    if (event) {
      setStatus(event.status)
      setVenue(event.venue || '')
      setFeedbackMsg(null)
      setErrorMsg(null)
      setActiveTab('overview')
    }
  }, [event])

  // Fetch linked registration form
  useEffect(() => {
    if (!isOpen || !event) return
    let ignore = false

    const loadForm = async () => {
      try {
        const forms = await registrationService.getEventForms(event.id)
        const form = forms.find((f) => f.id === event.registrationFormId) || forms[0] || null

        if (!ignore && form) {
          setCurrentForm(form)
          setFormTitle(form.title)
          setFields(form.fields || [])
        }
      } catch (err) {
        if (!ignore) {
          console.warn('No custom registration form found for event, using fallback.', err)
        }
      }
    }

    loadForm()
    return () => {
      ignore = true
    }
  }, [isOpen, event])

  // Fetch registrations
  const fetchRegistrations = useCallback(async () => {
    if (!event) return
    setIsLoadingRegs(true)
    try {
      const data = await registrationService.getEventRegistrations(
        event.id,
        regStatusFilter === 'all' ? undefined : regStatusFilter
      )
      setRegistrations(data)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load registrations')
    } finally {
      setIsLoadingRegs(false)
    }
  }, [event, regStatusFilter])

  useEffect(() => {
    if (isOpen && activeTab === 'registrations') {
      fetchRegistrations()
    }
  }, [isOpen, activeTab, fetchRegistrations])

  if (!event) return null

  const handleUpdateLifecycle = async () => {
    setIsSaving(true)
    setErrorMsg(null)
    setFeedbackMsg(null)
    try {
      const updated = await eventService.updateEvent(event.id, {
        status,
        venue,
      })
      onEventUpdated(updated)
      setFeedbackMsg('Event details updated successfully.')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update event.')
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
      setErrorMsg(err instanceof Error ? err.message : 'Failed to delete event.')
      setIsSaving(false)
    }
  }

  const handleAddField = () => {
    if (!newFieldLabel.trim()) return
    const key = newFieldLabel.toLowerCase().replace(/[^a-z0-9]/g, '_')
    const parsedOptions =
      newFieldType === 'select'
        ? newFieldOptions
            .split(',')
            .map((opt) => opt.trim())
            .filter(Boolean)
        : undefined

    const field: FormFieldDef = {
      key: `${key}_${Date.now().toString().slice(-4)}`,
      label: newFieldLabel.trim(),
      type: newFieldType,
      required: newFieldRequired,
      options: parsedOptions,
    }

    setFields((prev) => [...prev, field])
    setNewFieldLabel('')
    setNewFieldOptions('')
    setNewFieldType('short_text')
    setNewFieldRequired(true)
  }

  const handleRemoveField = (idx: number) => {
    setFields((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleSaveFormDraft = async () => {
    setIsSaving(true)
    setErrorMsg(null)
    setFeedbackMsg(null)
    try {
      if (currentForm) {
        const updated = await registrationService.updateForm(currentForm.id, {
          title: formTitle,
          fields,
        })
        setCurrentForm(updated)
      } else {
        const created = await registrationService.createForm({
          owner: { type: 'event', id: event.id },
          title: formTitle || `${event.title} Registration Form`,
          fields,
        })
        setCurrentForm(created)
      }
      setFeedbackMsg('Registration form draft saved.')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save form draft')
    } finally {
      setIsSaving(false)
    }
  }

  const handlePublishForm = async () => {
    setIsSaving(true)
    setErrorMsg(null)
    setFeedbackMsg(null)
    try {
      let published: RegistrationForm
      if (currentForm) {
        await registrationService.updateForm(currentForm.id, {
          title: formTitle,
          fields,
        })
        published = await registrationService.publishForm(currentForm.id)
      } else {
        const created = await registrationService.createForm({
          owner: { type: 'event', id: event.id },
          title: formTitle || `${event.title} Registration Form`,
          fields,
        })
        published = await registrationService.publishForm(created.id)
      }
      setCurrentForm(published)

      const updatedEvt = await eventService.updateEvent(event.id, {
        registrationFormId: published.id,
      })
      onEventUpdated(updatedEvt)
      setFeedbackMsg('Registration form published and linked to tournament.')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to publish form')
    } finally {
      setIsSaving(false)
    }
  }

  const handleRegStatusChange = async (
    regId: string,
    nextStatus: 'confirmed' | 'rejected' | 'waitlisted'
  ) => {
    setErrorMsg(null)
    try {
      const updated = await registrationService.updateRegistrationStatus(
        regId,
        nextStatus
      )
      if (updated) {
        setRegistrations((prev) =>
          prev.map((item) => (item.id === regId ? updated : item))
        )
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update status')
    }
  }

  const handlePromoteWaitlist = async (regId: string) => {
    setErrorMsg(null)
    try {
      await eventService.promoteWaitlist(event.id, regId)
      await registrationService.updateRegistrationStatus(regId, 'confirmed')
      setRegistrations((prev) =>
        prev.map((item) => (item.id === regId ? { ...item, status: 'confirmed' } : item))
      )
      setFeedbackMsg('Participant promoted to confirmed registration.')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to promote participant')
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
      {/* Header */}
      <div className="flex items-start justify-between px-6 py-4 border-b border-border bg-muted/30 shrink-0">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-bold uppercase tracking-wider text-foreground truncate max-w-md">
              {event.title}
            </h2>
            <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary text-[10px] font-bold uppercase">
              {event.type || 'LE'}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 font-mono">
            ID: {event.id} &bull; <span className="uppercase text-foreground">{event.category}</span> &bull; <span className="uppercase text-foreground">{event.domain}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border px-6 bg-muted/10 gap-2 shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={cn(
            'px-3 py-2.5 text-xs font-bold uppercase border-b-2 transition-colors cursor-pointer',
            activeTab === 'overview'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          1. Overview & Lifecycle
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('form')}
          className={cn(
            'px-3 py-2.5 text-xs font-bold uppercase border-b-2 transition-colors cursor-pointer',
            activeTab === 'form'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          2. Registration Form
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('registrations')}
          className={cn(
            'px-3 py-2.5 text-xs font-bold uppercase border-b-2 transition-colors cursor-pointer',
            activeTab === 'registrations'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          3. Registrations & Attendance
        </button>
      </div>

      {/* Main Body */}
      <div className="p-6 space-y-5 overflow-y-auto flex-1">
        {feedbackMsg && (
          <div className="p-3 border border-emerald-500/30 bg-emerald-500/10 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2 rounded-xl animate-in fade-in">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{feedbackMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 border border-destructive/30 bg-destructive/10 text-xs text-destructive flex items-center gap-2 rounded-xl animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* TAB 1: Overview & Lifecycle */}
        {activeTab === 'overview' && (
          <div className="space-y-4 text-left">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/20 p-4 rounded-xl border border-border text-xs">
              <div className="space-y-1">
                <span className="text-muted-foreground flex items-center gap-1 font-bold text-[10px] uppercase">
                  <Calendar className="w-3 h-3" /> Dates
                </span>
                <span className="font-semibold text-foreground block">
                  {event.startAt} &rarr; {event.endAt}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-muted-foreground flex items-center gap-1 font-bold text-[10px] uppercase">
                  <Users className="w-3 h-3" /> Capacity
                </span>
                <span className="font-semibold text-foreground block font-mono">
                  {event.currentParticipants} / {event.maxParticipants ?? 'Unlimited'}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-muted-foreground flex items-center gap-1 font-bold text-[10px] uppercase">
                  <Trophy className="w-3 h-3" /> Format
                </span>
                <span className="font-semibold text-foreground block">
                  {event.isTeamed ? 'Team Tournament' : 'Solo Entry'}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-muted-foreground flex items-center gap-1 font-bold text-[10px] uppercase">
                  <FileText className="w-3 h-3" /> Linked Form
                </span>
                <span className="font-semibold text-foreground block truncate">
                  {event.registrationFormId || currentForm?.id || 'Default'}
                </span>
              </div>
            </div>

            {event.description && (
              <div className="text-xs text-muted-foreground p-3.5 border border-border rounded-xl bg-muted/10 leading-relaxed">
                {event.description}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-foreground mb-1.5">
                  Lifecycle Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as EventStatus)}
                  className="w-full px-3.5 py-2.5 text-sm border border-border rounded-xl text-foreground bg-card focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                >
                  <option value="draft">Draft</option>
                  <option value="upcoming">Upcoming (Registration Open)</option>
                  <option value="ongoing">Ongoing (Live)</option>
                  <option value="past">Past / Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-foreground mb-1.5">
                  Venue
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={venue}
                    onChange={(e) => setVenue(e.target.value)}
                    placeholder="e.g. Campus Football Ground"
                    className="w-full pl-9 pr-3.5 py-2.5 text-sm border border-border rounded-xl text-foreground bg-card focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-border">
              {event.status === 'draft' ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDeleteEvent}
                  disabled={isSaving}
                  className="text-xs font-semibold text-destructive border-destructive/30 hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-all gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Draft
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">
                  Only draft tournaments can be permanently deleted.
                </span>
              )}

              <Button
                type="button"
                onClick={handleUpdateLifecycle}
                disabled={isSaving}
                size="sm"
                className="text-xs font-semibold gap-1.5"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </div>
        )}

        {/* TAB 2: Dynamic Registration Form Builder */}
        {activeTab === 'form' && (
          <div className="space-y-4 text-left">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-foreground mb-1.5">
                  Form Title
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-border rounded-xl text-foreground bg-card focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                  Form Status
                </span>
                <Badge variant="outline" className="mt-1 uppercase text-xs">
                  {currentForm?.status || 'uncreated'}
                </Badge>
              </div>
            </div>

            {/* Existing Fields */}
            <div className="border border-border rounded-xl divide-y divide-border overflow-hidden bg-card shadow-xs">
              {fields.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  No custom fields added yet. Add fields below.
                </div>
              ) : (
                fields.map((f, idx) => (
                  <div
                    key={`${f.key}-${idx}`}
                    className="p-3.5 flex items-center justify-between text-xs hover:bg-muted/30 transition-colors"
                  >
                    <div>
                      <span className="font-bold text-foreground">{f.label}</span>{' '}
                      <span className="text-muted-foreground font-mono">({f.key})</span>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        Type: <span className="font-semibold text-foreground">{f.type}</span> &bull;{' '}
                        {f.required ? 'Required' : 'Optional'}
                        {f.options && f.options.length > 0
                          ? ` • Options: ${f.options.join(', ')}`
                          : ''}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveField(idx)}
                      className="p-1.5 text-muted-foreground hover:text-destructive border border-border rounded-lg hover:border-destructive transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Add New Field Box */}
            <div className="p-4 bg-muted/20 border border-border rounded-xl space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-foreground">
                Add Custom Form Field
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <input
                  type="text"
                  placeholder="Field Label (e.g. In-Game Role)"
                  value={newFieldLabel}
                  onChange={(e) => setNewFieldLabel(e.target.value)}
                  className="px-3 py-2 text-xs border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <select
                  value={newFieldType}
                  onChange={(e) => setNewFieldType(e.target.value as FormFieldType)}
                  className="px-3 py-2 text-xs border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {FIELD_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-foreground cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={newFieldRequired}
                      onChange={(e) => setNewFieldRequired(e.target.checked)}
                      className="rounded border-border"
                    />
                    <span>Required</span>
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddField}
                    className="text-xs font-semibold gap-1 h-8"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add
                  </Button>
                </div>
              </div>
              {newFieldType === 'select' && (
                <input
                  type="text"
                  placeholder="Comma-separated options (e.g. Duelist, Controller, Sentinel)"
                  value={newFieldOptions}
                  onChange={(e) => setNewFieldOptions(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              )}
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSaveFormDraft}
                disabled={isSaving}
                className="text-xs font-semibold"
              >
                Save Draft
              </Button>
              <Button
                type="button"
                onClick={handlePublishForm}
                disabled={isSaving}
                size="sm"
                className="text-xs font-semibold"
              >
                Publish & Link to Event
              </Button>
            </div>
          </div>
        )}

        {/* TAB 3: Registrations & Attendance */}
        {activeTab === 'registrations' && (
          <div className="space-y-4 text-left">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                Participant Roster ({registrations.length})
              </span>
              <select
                value={regStatusFilter}
                onChange={(e) => setRegStatusFilter(e.target.value)}
                className="px-3 py-1.5 text-xs border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="all">All Statuses</option>
                <option value="confirmed">Confirmed</option>
                <option value="waitlisted">Waitlisted</option>
                <option value="pending">Pending</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            {isLoadingRegs ? (
              <div className="p-8 text-center text-xs text-muted-foreground border border-border rounded-xl flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span>Loading registrations...</span>
              </div>
            ) : registrations.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl bg-muted/10">
                No registrations found for this filter.
              </div>
            ) : (
              <div className="border border-border rounded-xl overflow-hidden bg-card shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        <th className="py-2.5 px-3">Participant</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Attendance</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {registrations.map((reg) => (
                        <tr key={reg.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-foreground">{reg.displayName}</div>
                            <div className="text-[11px] text-muted-foreground font-mono">@{reg.username}</div>
                          </td>
                          <td className="py-2.5 px-3">
                            <Badge variant="outline" className="text-[10px] uppercase font-bold">
                              {reg.status}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3">
                            <label className="inline-flex items-center gap-1.5 cursor-pointer text-foreground select-none">
                              <input
                                type="checkbox"
                                checked={Boolean(reg.attended)}
                                onChange={() => handleToggleAttendance(reg)}
                                className="rounded border-border"
                              />
                              <span className="text-[11px]">{reg.attended ? 'Checked In' : 'Absent'}</span>
                            </label>
                          </td>
                          <td className="py-2.5 px-3 text-right space-x-1">
                            {reg.status === 'waitlisted' && (
                              <button
                                type="button"
                                onClick={() => handlePromoteWaitlist(reg.id)}
                                className="px-2 py-1 text-[10px] font-bold rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
                              >
                                Promote
                              </button>
                            )}
                            {reg.status !== 'confirmed' && (
                              <button
                                type="button"
                                onClick={() => handleRegStatusChange(reg.id, 'confirmed')}
                                className="px-2 py-1 text-[10px] font-bold border border-border text-foreground hover:border-foreground rounded transition-colors cursor-pointer"
                              >
                                Confirm
                              </button>
                            )}
                            {reg.status !== 'rejected' && (
                              <button
                                type="button"
                                onClick={() => handleRegStatusChange(reg.id, 'rejected')}
                                className="px-2 py-1 text-[10px] font-bold border border-destructive/40 text-destructive hover:bg-destructive/10 rounded transition-colors cursor-pointer"
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
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex justify-end px-6 py-4 border-t border-border bg-muted/20 shrink-0">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClose}
          className="text-xs px-4"
        >
          Close
        </Button>
      </div>
    </Modal>
  )
}

export default EventDetailModal
