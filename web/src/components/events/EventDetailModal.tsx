import React, { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, CheckCircle, AlertCircle } from 'lucide-react'
import type { ClubEvent, EventStatus } from '../../types/event'
import { eventService } from '../../services/eventService'
import {
  registrationService,
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

  useEffect(() => {
    if (event) {
      setStatus(event.status)
      setVenue(event.venue || '')
      setFormTitle(`${event.title} Registration`)
      setFeedbackMsg(null)
      setErrorMsg(null)
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
    } finally {
      setIsLoadingRegs(false)
    }
  }, [])

  useEffect(() => {
    if (!isOpen || !event) return
    if (activeTab === 'form') {
      loadForms(event.id, event.title)
    } else if (activeTab === 'registrations') {
      loadRegistrations(event.id, regStatusFilter)
    }
  }, [isOpen, event, activeTab, regStatusFilter, loadForms, loadRegistrations])

  if (!isOpen || !event) return null

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

      const closesIso = new Date(
        event.endAt ? `${event.endAt}T23:59:59Z` : Date.now() + 7 * 86400000
      ).toISOString()

      const updatedEvent = await eventService.updateEvent(event.id, {
        registration: {
          form_id: published.id,
          closes_at: closesIso,
          max_participants: event.maxParticipants,
          waitlist_enabled: event.waitlistEnabled ?? true,
          requires_approval: event.requiresApproval ?? false,
        },
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg border border-gray-200 shadow-xl max-w-3xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-200 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold uppercase tracking-wider text-black">
                {event.title}
              </h2>
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase border border-black rounded">
                {event.type || 'LE'}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              ID: {event.id} &bull; {event.category.toUpperCase()} &bull; {event.domain.toUpperCase()}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-2.5 py-1 text-xs font-bold border border-black text-black hover:bg-black hover:text-white cursor-pointer"
          >
            X
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 text-xs font-bold uppercase border-b-2 transition-colors cursor-pointer ${
              activeTab === 'overview'
                ? 'border-black text-black'
                : 'border-transparent text-gray-500 hover:text-black'
            }`}
          >
            1. Overview & Lifecycle
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('form')}
            className={`px-4 py-2 text-xs font-bold uppercase border-b-2 transition-colors cursor-pointer ${
              activeTab === 'form'
                ? 'border-black text-black'
                : 'border-transparent text-gray-500 hover:text-black'
            }`}
          >
            2. Registration Form
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('registrations')}
            className={`px-4 py-2 text-xs font-bold uppercase border-b-2 transition-colors cursor-pointer ${
              activeTab === 'registrations'
                ? 'border-black text-black'
                : 'border-transparent text-gray-500 hover:text-black'
            }`}
          >
            3. Registrations & Attendance
          </button>
        </div>

        {feedbackMsg && (
          <div className="p-3 border border-black bg-gray-50 text-xs text-black flex items-center gap-2 rounded">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{feedbackMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 border border-red-300 bg-red-50 text-xs text-red-700 flex items-center gap-2 rounded">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* TAB 1: Overview & Lifecycle */}
        {activeTab === 'overview' && (
          <div className="space-y-4 text-left">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50 p-3 rounded border border-gray-200 text-xs">
              <div>
                <span className="text-gray-500 block uppercase font-bold text-[10px]">Dates</span>
                <span className="font-semibold text-black">
                  {event.startAt} &rarr; {event.endAt}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block uppercase font-bold text-[10px]">Capacity</span>
                <span className="font-semibold text-black">
                  {event.currentParticipants} / {event.maxParticipants ?? 'Unlimited'}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block uppercase font-bold text-[10px]">Format</span>
                <span className="font-semibold text-black">
                  {event.isTeamed ? 'Team Tournament' : 'Solo Entry'}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block uppercase font-bold text-[10px]">Linked Form</span>
                <span className="font-semibold text-black">
                  {event.registrationFormId || currentForm?.id || 'Default'}
                </span>
              </div>
            </div>

            {event.description && (
              <div className="text-xs text-gray-700 p-3 border border-gray-200 rounded">
                {event.description}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-black mb-1">
                  Lifecycle Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as EventStatus)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded text-black bg-white focus:outline-none focus:border-black"
                >
                  <option value="draft">Draft</option>
                  <option value="upcoming">Upcoming (Registration Open)</option>
                  <option value="ongoing">Ongoing (Live)</option>
                  <option value="past">Past / Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-black mb-1">
                  Venue
                </label>
                <input
                  type="text"
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded text-black bg-white focus:outline-none focus:border-black"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              {event.status === 'draft' ? (
                <button
                  type="button"
                  onClick={handleDeleteEvent}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold border border-red-600 text-red-600 hover:bg-red-600 hover:text-white rounded transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Draft
                </button>
              ) : (
                <span className="text-xs text-gray-500">
                  Only draft tournaments can be permanently deleted.
                </span>
              )}

              <button
                type="button"
                onClick={handleUpdateLifecycle}
                disabled={isSaving}
                className="px-4 py-2 text-xs font-bold border border-black bg-black text-white hover:bg-gray-800 rounded transition-colors cursor-pointer disabled:opacity-50"
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
                <label className="block text-xs font-bold uppercase text-black mb-1">
                  Form Title
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded text-black bg-white"
                />
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold uppercase text-gray-500 block">
                  Form Status
                </span>
                <span className="inline-block mt-1 px-2.5 py-1 text-xs font-bold uppercase border border-black rounded">
                  {currentForm?.status || 'uncreated'}
                </span>
              </div>
            </div>

            {/* Existing Fields */}
            <div className="border border-gray-200 rounded divide-y divide-gray-200">
              {fields.length === 0 ? (
                <div className="p-4 text-center text-xs text-gray-500">
                  No custom fields added yet. Add fields below.
                </div>
              ) : (
                fields.map((f, idx) => (
                  <div
                    key={`${f.key}-${idx}`}
                    className="p-3 flex items-center justify-between text-xs bg-white"
                  >
                    <div>
                      <span className="font-bold text-black">{f.label}</span>{' '}
                      <span className="text-gray-400 font-mono">({f.key})</span>
                      <div className="text-[11px] text-gray-500 mt-0.5">
                        Type: <span className="font-semibold">{f.type}</span> &bull;{' '}
                        {f.required ? 'Required' : 'Optional'}
                        {f.options && f.options.length > 0
                          ? ` • Options: ${f.options.join(', ')}`
                          : ''}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveField(idx)}
                      className="p-1.5 text-gray-500 hover:text-black border border-gray-200 rounded cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Add New Field Box */}
            <div className="p-3 bg-gray-50 border border-gray-200 rounded space-y-3">
              <div className="text-xs font-bold uppercase text-black">
                Add Custom Form Field
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="Field Label (e.g. In-Game Role)"
                  value={newFieldLabel}
                  onChange={(e) => setNewFieldLabel(e.target.value)}
                  className="px-3 py-1.5 text-xs border border-gray-300 rounded bg-white text-black"
                />
                <select
                  value={newFieldType}
                  onChange={(e) => setNewFieldType(e.target.value as FormFieldType)}
                  className="px-3 py-1.5 text-xs border border-gray-300 rounded bg-white text-black"
                >
                  {FIELD_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-black cursor-pointer">
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
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold border border-black bg-white text-black hover:bg-black hover:text-white rounded cursor-pointer"
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
                  className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded bg-white text-black"
                />
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-200">
              <button
                type="button"
                onClick={handleSaveFormDraft}
                disabled={isSaving}
                className="px-4 py-2 text-xs font-bold border border-black text-black bg-white hover:bg-gray-100 rounded cursor-pointer"
              >
                Save Draft
              </button>
              <button
                type="button"
                onClick={handlePublishForm}
                disabled={isSaving}
                className="px-4 py-2 text-xs font-bold border border-black bg-black text-white hover:bg-gray-800 rounded cursor-pointer"
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
              <span className="text-xs font-bold uppercase text-black">
                Participant Roster ({registrations.length})
              </span>
              <select
                value={regStatusFilter}
                onChange={(e) => setRegStatusFilter(e.target.value)}
                className="px-3 py-1.5 text-xs border border-gray-300 rounded bg-white text-black"
              >
                <option value="all">All Statuses</option>
                <option value="confirmed">Confirmed</option>
                <option value="waitlisted">Waitlisted</option>
                <option value="pending">Pending</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            {isLoadingRegs ? (
              <div className="p-6 text-center text-xs text-gray-500 border border-gray-200 rounded">
                Loading registrations...
              </div>
            ) : registrations.length === 0 ? (
              <div className="p-6 text-center text-xs text-gray-500 border border-gray-200 rounded">
                No registrations found for this filter.
              </div>
            ) : (
              <div className="border border-gray-200 rounded overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 text-[10px] font-bold uppercase text-gray-600">
                      <th className="py-2.5 px-3">Participant</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Attendance</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {registrations.map((reg) => (
                      <tr key={reg.id} className="hover:bg-gray-50">
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-black">{reg.displayName}</div>
                          <div className="text-[11px] text-gray-500">@{reg.username}</div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 text-[10px] font-bold uppercase border border-gray-300 rounded">
                            {reg.status}
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
                              className="px-2 py-1 text-[10px] font-bold border border-black bg-black text-white rounded cursor-pointer"
                            >
                              Promote
                            </button>
                          )}
                          {reg.status !== 'confirmed' && (
                            <button
                              type="button"
                              onClick={() => handleRegStatusChange(reg.id, 'confirmed')}
                              className="px-2 py-1 text-[10px] font-bold border border-gray-300 hover:border-black rounded cursor-pointer"
                            >
                              Confirm
                            </button>
                          )}
                          {reg.status !== 'rejected' && (
                            <button
                              type="button"
                              onClick={() => handleRegStatusChange(reg.id, 'rejected')}
                              className="px-2 py-1 text-[10px] font-bold border border-gray-300 text-red-600 hover:border-red-600 rounded cursor-pointer"
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
      </div>
    </div>
  )
}

export default EventDetailModal
