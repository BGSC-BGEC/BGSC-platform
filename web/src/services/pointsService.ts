import { apiClient } from './apiClient'

/** A row of `point_rules` (backend/packages/shared/src/models/Points.ts IPointRule). */
export interface PointRule {
  /** The reason key, e.g. 'event.participation'. */
  id: string
  label: string
  source: string
  defaultAmount: number
  overridableBy: string | null
  enabled: boolean
  expiresAfterDays: number | null
  updatedBy: string | null
  updatedAt: string | null
}

/** The only fields PATCH /points/rules/:id accepts (RulePatchBody). */
export interface PointRulePatch {
  default_amount?: number // int 0..10000
  enabled?: boolean
  expires_after_days?: number | null // int 1..3650, null = never expires
}

interface RawPointRule {
  _id: string
  label?: string
  source?: string
  default_amount?: number
  overridable_by?: string | null
  enabled?: boolean
  expires_after_days?: number | null
  updated_by?: string
  updated_at?: string
}

function mapRule(raw: RawPointRule): PointRule {
  return {
    id: raw._id,
    label: raw.label ?? raw._id,
    source: raw.source ?? '',
    defaultAmount: raw.default_amount ?? 0,
    overridableBy: raw.overridable_by ?? null,
    enabled: raw.enabled ?? true,
    expiresAfterDays: raw.expires_after_days ?? null,
    updatedBy: raw.updated_by ?? null,
    updatedAt: raw.updated_at ?? null,
  }
}

/** GET /points/rules (core+). */
export async function getPointRules(): Promise<PointRule[]> {
  const res = await apiClient.get<{ rules?: RawPointRule[] }>('/points/rules')
  return (res?.rules || []).map(mapRule)
}

/** PATCH /points/rules/:id (coordinator+). Send only changed fields; at least one is required. */
export async function updatePointRule(id: string, patch: PointRulePatch): Promise<PointRule> {
  const res = await apiClient.patch<{ rule: RawPointRule }>(
    `/points/rules/${encodeURIComponent(id)}`,
    patch
  )
  return mapRule(res.rule)
}

export const pointsService = { getPointRules, updatePointRule }

export default pointsService
