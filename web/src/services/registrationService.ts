import { apiClient } from './apiClient'

const isMock = import.meta.env.VITE_USE_MOCK === 'true'

export type FormFieldType =
  | 'short_text'
  | 'long_text'
  | 'number'
  | 'email'
  | 'phone'
  | 'select'
  | 'checkbox'

export interface FormFieldDef {
  key: string
  label: string
  type: FormFieldType
  required: boolean
  options?: string[]
  placeholder?: string
}

export interface RegistrationForm {
  id: string
  title: string
  description?: string
  status: 'draft' | 'published' | 'archived'
  version?: number
  fields: FormFieldDef[]
}

export interface EventRegistration {
  id: string
  ownerId: string
  userId: string
  username: string
  displayName: string
  status: 'confirmed' | 'waitlisted' | 'rejected' | 'pending' | 'cancelled'
  answers: Record<string, unknown>
  captainApplication?: {
    applied: boolean
    status?: 'pending' | 'approved' | 'declined'
  }
  attended?: boolean
  createdAt: string
}

const mockFormsByEvent: Record<string, RegistrationForm[]> = {}
const mockRegistrationsByEvent: Record<string, EventRegistration[]> = {
  'evt-001': [
    {
      id: 'reg-001',
      ownerId: 'evt-001',
      userId: 'usr-001',
      username: 'arjun_sharma',
      displayName: 'Arjun Sharma',
      status: 'confirmed',
      answers: { racket_grip: 'G4', skill_level: 'Advanced' },
      attended: true,
      createdAt: '2026-09-28',
    },
    {
      id: 'reg-002',
      ownerId: 'evt-001',
      userId: 'usr-002',
      username: 'priya_nair',
      displayName: 'Priya Nair',
      status: 'waitlisted',
      answers: { racket_grip: 'G5', skill_level: 'Intermediate' },
      attended: false,
      createdAt: '2026-09-29',
    },
  ],
}

// Backend FormFieldSchema wants options as {value,label}[] and a required `order`.
const toBackendFields = (fields: FormFieldDef[]) =>
  fields.map((f, order) => ({
    key: f.key,
    label: f.label,
    type: f.type,
    required: f.required,
    placeholder: f.placeholder || null,
    options: f.options?.length ? f.options.map((o) => ({ value: o, label: o })) : null,
    order,
  }))

const fromBackendFields = (fields: unknown): FormFieldDef[] =>
  Array.isArray(fields)
    ? fields.map((f: Record<string, unknown>) => ({
        key: String(f.key),
        label: String(f.label),
        type: f.type as FormFieldType,
        required: Boolean(f.required),
        placeholder: (f.placeholder as string) || undefined,
        options: Array.isArray(f.options)
          ? f.options.map((o: { value?: string } | string) => (typeof o === 'string' ? o : String(o.value)))
          : undefined,
      }))
    : []

function normalizeForm(raw: Record<string, unknown>): RegistrationForm {
  return {
    id: String(raw._id || raw.id || ''),
    title: String(raw.title || 'Registration Form'),
    description: typeof raw.description === 'string' ? raw.description : '',
    status: (raw.status as RegistrationForm['status']) || 'draft',
    version: typeof raw.version === 'number' ? raw.version : 1,
    fields: fromBackendFields(raw.fields),
  }
}

function normalizeRegistration(raw: Record<string, unknown>): EventRegistration {
  const userObj = (raw.user as Record<string, unknown>) || {}
  const ownerObj = (raw.owner as Record<string, unknown>) || {}
  const captainObj = (raw.captain_application as Record<string, unknown>) || undefined
  const attendanceObj = (raw.attendance as Record<string, unknown>) || undefined

  return {
    id: String(raw._id || raw.id || ''),
    ownerId: String(ownerObj.id || raw.owner_id || raw.event_id || ''),
    userId: String(userObj.id || raw.user_id || ''),
    username: String(userObj.username || raw.username || 'member'),
    displayName: String(
      userObj.display_name || userObj.full_name || raw.display_name || userObj.username || 'Member'
    ),
    status: (raw.status as EventRegistration['status']) || 'confirmed',
    answers: (raw.answers as Record<string, unknown>) || {},
    captainApplication: captainObj
      ? {
          applied: Boolean(captainObj.applied),
          status: captainObj.status as 'pending' | 'approved' | 'declined' | undefined,
        }
      : undefined,
    attended: Boolean(attendanceObj?.attended ?? raw.attended),
    createdAt: raw.created_at
      ? new Date(String(raw.created_at)).toLocaleDateString()
      : new Date().toLocaleDateString(),
  }
}

export async function getEventForms(eventId: string): Promise<RegistrationForm[]> {
  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 100))
    return mockFormsByEvent[eventId] || []
  }

  try {
    const res = await apiClient.get<{ forms?: Record<string, unknown>[] } | Record<string, unknown>[]>(
      `/forms?owner_type=event&owner_id=${eventId}`
    )
    const list = Array.isArray(res) ? res : res?.forms || []
    return list.map(normalizeForm)
  } catch (error) {
    console.warn(`[registrationService] Failed to fetch forms for event ${eventId}:`, error)
    return []
  }
}

export async function createForm(payload: {
  owner: { type: 'event' | 'challenge' | 'generic'; id: string | null }
  title: string
  description?: string
  fields: FormFieldDef[]
}): Promise<RegistrationForm> {
  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 150))
    const created: RegistrationForm = {
      id: `frm-${Date.now()}`,
      title: payload.title,
      description: payload.description || '',
      status: 'draft',
      version: 1,
      fields: payload.fields,
    }
    const ownerId = payload.owner.id || 'generic'
    mockFormsByEvent[ownerId] = [created, ...(mockFormsByEvent[ownerId] || [])]
    return created
  }

  const res = await apiClient.post<Record<string, unknown> | { form: Record<string, unknown> }>(
    '/forms',
    { ...payload, fields: toBackendFields(payload.fields) }
  )
  const raw =
    res && typeof res === 'object' && 'form' in res && res.form
      ? (res.form as Record<string, unknown>)
      : (res as Record<string, unknown>)
  return normalizeForm(raw)
}

export async function updateForm(
  formId: string,
  payload: { title?: string; description?: string; fields?: FormFieldDef[] }
): Promise<RegistrationForm> {
  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 150))
    for (const forms of Object.values(mockFormsByEvent)) {
      const f = forms.find((item) => item.id === formId)
      if (f) {
        if (payload.title !== undefined) f.title = payload.title
        if (payload.description !== undefined) f.description = payload.description
        if (payload.fields !== undefined) f.fields = payload.fields
        return { ...f }
      }
    }
    return {
      id: formId,
      title: payload.title || 'Registration Form',
      description: payload.description || '',
      status: 'draft',
      fields: payload.fields || [],
    }
  }

  const res = await apiClient.patch<Record<string, unknown> | { form: Record<string, unknown> }>(
    `/forms/${formId}`,
    { ...payload, fields: payload.fields && toBackendFields(payload.fields) }
  )
  const raw =
    res && typeof res === 'object' && 'form' in res && res.form
      ? (res.form as Record<string, unknown>)
      : (res as Record<string, unknown>)
  return normalizeForm(raw)
}

export async function publishForm(formId: string): Promise<RegistrationForm> {
  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 150))
    for (const forms of Object.values(mockFormsByEvent)) {
      const f = forms.find((item) => item.id === formId)
      if (f) {
        f.status = 'published'
        return { ...f }
      }
    }
    return {
      id: formId,
      title: 'Registration Form',
      status: 'published',
      fields: [],
    }
  }

  const res = await apiClient.post<Record<string, unknown> | { form: Record<string, unknown> }>(
    `/forms/${formId}/publish`
  )
  const raw =
    res && typeof res === 'object' && 'form' in res && res.form
      ? (res.form as Record<string, unknown>)
      : (res as Record<string, unknown>)
  return normalizeForm(raw)
}

export async function getEventRegistrations(
  eventId: string,
  status?: string
): Promise<EventRegistration[]> {
  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 120))
    const list = mockRegistrationsByEvent[eventId] || mockRegistrationsByEvent['evt-001'] || []
    return status && status !== 'all' ? list.filter((r) => r.status === status) : list
  }

  try {
    const query = `/registrations?owner_id=${eventId}${
      status && status !== 'all' ? `&status=${status}` : ''
    }`
    const res = await apiClient.get<
      { registrations?: Record<string, unknown>[] } | Record<string, unknown>[]
    >(query)
    const list = Array.isArray(res) ? res : res?.registrations || []
    return list.map(normalizeRegistration)
  } catch (error) {
    console.warn(`[registrationService] Failed to load registrations for ${eventId}:`, error)
    return []
  }
}

export async function updateRegistrationStatus(
  regId: string,
  status: 'confirmed' | 'waitlisted' | 'rejected',
  reason?: string
): Promise<EventRegistration | null> {
  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 150))
    for (const list of Object.values(mockRegistrationsByEvent)) {
      const reg = list.find((r) => r.id === regId)
      if (reg) {
        reg.status = status
        return { ...reg }
      }
    }
    return null
  }

  const res = await apiClient.patch<
    Record<string, unknown> | { registration: Record<string, unknown> }
  >(`/registrations/${regId}/status`, { status, reason })
  const raw =
    res && typeof res === 'object' && 'registration' in res && res.registration
      ? (res.registration as Record<string, unknown>)
      : (res as Record<string, unknown>)
  return normalizeRegistration(raw)
}

export async function updateCaptainApplication(
  regId: string,
  status: 'approved' | 'declined',
  note?: string
): Promise<EventRegistration | null> {
  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 150))
    return null
  }

  const res = await apiClient.patch<
    Record<string, unknown> | { registration: Record<string, unknown> }
  >(`/registrations/${regId}/captain-application`, { status, note })
  const raw =
    res && typeof res === 'object' && 'registration' in res && res.registration
      ? (res.registration as Record<string, unknown>)
      : (res as Record<string, unknown>)
  return normalizeRegistration(raw)
}

export const registrationService = {
  getEventForms,
  createForm,
  updateForm,
  publishForm,
  getEventRegistrations,
  updateRegistrationStatus,
  updateCaptainApplication,
}

export default registrationService
