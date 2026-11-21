import React, { useEffect, useMemo, useState } from 'react'
import { AlertCircle, SlidersHorizontal } from 'lucide-react'
import { pointsService } from '../services/pointsService'
import type { PointRule, PointRulePatch } from '../services/pointsService'
import { useCan } from '../services/permissions'

interface RowDraft {
  defaultAmount: string
  enabled: boolean
  /** '' = never expires (null). */
  expiresAfterDays: string
}

const toDraft = (r: PointRule): RowDraft => ({
  defaultAmount: String(r.defaultAmount),
  enabled: r.enabled,
  expiresAfterDays: r.expiresAfterDays === null ? '' : String(r.expiresAfterDays),
})

/** Validates against RulePatchBody (points.schemas.ts) and returns only the changed fields. */
function buildPatch(rule: PointRule, d: RowDraft): { patch: PointRulePatch } | { error: string } {
  const patch: PointRulePatch = {}

  const amountText = d.defaultAmount.trim()
  const amount = Number(amountText)
  if (amountText === '' || !Number.isInteger(amount) || amount < 0 || amount > 10000) {
    return { error: 'Default amount must be a whole number from 0 to 10,000.' }
  }
  if (amount !== rule.defaultAmount) patch.default_amount = amount

  if (d.enabled !== rule.enabled) patch.enabled = d.enabled

  const daysText = d.expiresAfterDays.trim()
  let days: number | null = null
  if (daysText !== '') {
    days = Number(daysText)
    if (!Number.isInteger(days) || days < 1 || days > 3650) {
      return { error: 'Expiry must be a whole number of days from 1 to 3650, or blank for never.' }
    }
  }
  if (days !== rule.expiresAfterDays) patch.expires_after_days = days

  return { patch }
}

function formatDate(s: string | null): string {
  if (!s) return '-'
  const d = new Date(s)
  return isNaN(d.getTime())
    ? s
    : d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export const PointsRules: React.FC = () => {
  const canEdit = useCan('points.rules.edit')

  const [rules, setRules] = useState<PointRule[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({})
  const [sourceFilter, setSourceFilter] = useState('all')

  useEffect(() => {
    let ignore = false
    pointsService
      .getPointRules()
      .then((list) => {
        if (!ignore) {
          setRules(list)
          setError(null)
          setIsLoading(false)
        }
      })
      .catch((err) => {
        if (!ignore) {
          setError(err instanceof Error ? err.message : 'Failed to load point rules')
          setIsLoading(false)
        }
      })
    return () => {
      ignore = true
    }
  }, [reloadKey])

  const sources = useMemo(() => [...new Set(rules.map((r) => r.source))].sort(), [rules])
  const visibleRules = useMemo(
    () => (sourceFilter === 'all' ? rules : rules.filter((r) => r.source === sourceFilter)),
    [rules, sourceFilter]
  )

  const omitKey = <T,>(obj: Record<string, T>, key: string): Record<string, T> => {
    const next = { ...obj }
    delete next[key]
    return next
  }

  const draftOf = (r: PointRule) => drafts[r.id] ?? toDraft(r)

  const updateDraft = (r: PointRule, change: Partial<RowDraft>) => {
    setRowErrors((prev) => omitKey(prev, r.id))
    setDrafts((prev) => ({ ...prev, [r.id]: { ...(prev[r.id] ?? toDraft(r)), ...change } }))
  }

  const discard = (id: string) => {
    setDrafts((prev) => omitKey(prev, id))
    setRowErrors((prev) => omitKey(prev, id))
  }

  const save = async (r: PointRule) => {
    const d = drafts[r.id]
    if (!d) return
    const result = buildPatch(r, d)
    if ('error' in result) {
      setRowErrors((prev) => ({ ...prev, [r.id]: result.error }))
      return
    }
    if (Object.keys(result.patch).length === 0) {
      discard(r.id)
      return
    }
    setSavingId(r.id)
    try {
      const updated = await pointsService.updatePointRule(r.id, result.patch)
      setRules((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
      discard(r.id)
    } catch (err) {
      setRowErrors((prev) => ({
        ...prev,
        [r.id]: err instanceof Error ? err.message : 'Failed to save rule',
      }))
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-xl font-bold uppercase tracking-wider text-foreground">Points Rules</h1>
          <p className="text-sm text-muted-foreground mt-1">
            What each activity awards by default. Changes apply to new transactions only; history is never rewritten.
          </p>
        </div>
        {!canEdit && (
          <span className="self-start sm:self-auto text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border border-border bg-muted/30 text-foreground">
            Read only — coordinators can edit
          </span>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-border rounded text-foreground bg-card focus:outline-none focus:border-primary"
        >
          <option value="all">All Sources</option>
          {sources.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <p className="text-[11px] text-muted-foreground">
          Amount 0 means the trigger (event or challenge) always supplies the amount. Blank expiry = never expires.
        </p>
      </div>

      {isLoading && (
        <div className="p-12 text-center text-sm text-muted-foreground border border-border rounded bg-muted/30">
          Loading point rules...
        </div>
      )}

      {!isLoading && error && (
        <div className="p-4 border border-foreground/70 text-foreground bg-card rounded flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-destructive" />
            <span className="text-sm">{error}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setIsLoading(true)
              setError(null)
              setReloadKey((k) => k + 1)
            }}
            className="px-3 py-1 text-xs border border-foreground/70 hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {!isLoading && !error && visibleRules.length === 0 && (
        <div className="p-12 text-center border border-border rounded-lg bg-card space-y-2">
          <SlidersHorizontal className="w-10 h-10 text-muted-foreground mx-auto" />
          <h3 className="text-base font-bold text-foreground">No point rules found</h3>
        </div>
      )}

      {!isLoading && !error && visibleRules.length > 0 && (
        <div className="bg-card rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/30 border-b border-border text-[10px] font-bold uppercase tracking-wider text-foreground">
              <tr>
                <th className="px-4 py-3">Rule</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3 text-center">Enabled</th>
                <th className="px-4 py-3 text-right">Default Amount</th>
                <th className="px-4 py-3 text-right">Expires After (days)</th>
                <th className="px-4 py-3">Last Updated</th>
                {canEdit && <th className="px-4 py-3 text-right">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {visibleRules.map((r) => {
                const d = draftOf(r)
                const dirty = Boolean(drafts[r.id])
                const saving = savingId === r.id
                return (
                  <React.Fragment key={r.id}>
                    <tr className={`transition-colors ${dirty ? 'bg-muted/30' : 'hover:bg-muted/30'}`}>
                      <td className="px-4 py-3">
                        <div className="font-bold text-foreground text-xs sm:text-sm">{r.label}</div>
                        <div className="text-[11px] text-muted-foreground font-mono">{r.id}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-border bg-muted/30 text-foreground">
                          {r.source}
                        </span>
                        {r.overridableBy && (
                          <div className="text-[10px] text-muted-foreground mt-1">overridable by {r.overridableBy}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {canEdit ? (
                          <input
                            type="checkbox"
                            checked={d.enabled}
                            disabled={saving}
                            onChange={(e) => updateDraft(r, { enabled: e.target.checked })}
                            className="w-4 h-4 accent-black cursor-pointer"
                          />
                        ) : (
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                              r.enabled ? 'border-foreground/70 bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground'
                            }`}
                          >
                            {r.enabled ? 'On' : 'Off'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canEdit ? (
                          <input
                            type="number"
                            min={0}
                            max={10000}
                            step={1}
                            value={d.defaultAmount}
                            disabled={saving}
                            onChange={(e) => updateDraft(r, { defaultAmount: e.target.value })}
                            className="w-24 px-2 py-1 text-xs font-mono text-right border border-border rounded text-foreground bg-card focus:outline-none focus:border-primary"
                          />
                        ) : (
                          <span className="font-mono font-bold text-foreground text-xs sm:text-sm">
                            {r.defaultAmount.toLocaleString()}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canEdit ? (
                          <input
                            type="number"
                            min={1}
                            max={3650}
                            step={1}
                            placeholder="never"
                            value={d.expiresAfterDays}
                            disabled={saving}
                            onChange={(e) => updateDraft(r, { expiresAfterDays: e.target.value })}
                            className="w-24 px-2 py-1 text-xs font-mono text-right border border-border rounded text-foreground bg-card focus:outline-none focus:border-primary"
                          />
                        ) : (
                          <span className="font-mono text-xs text-foreground">
                            {r.expiresAfterDays === null ? 'never' : r.expiresAfterDays}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-muted-foreground whitespace-nowrap">
                        <div className="font-mono">{formatDate(r.updatedAt)}</div>
                        {r.updatedBy && (
                          <div className="font-mono" title={r.updatedBy}>
                            by {r.updatedBy === 'system' ? 'system' : `${r.updatedBy.slice(0, 8)}…`}
                          </div>
                        )}
                      </td>
                      {canEdit && (
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {dirty ? (
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => discard(r.id)}
                                disabled={saving}
                                className="px-3 py-1 text-xs border border-border text-foreground hover:bg-muted rounded transition-colors cursor-pointer disabled:opacity-50"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => save(r)}
                                disabled={saving}
                                className="px-3 py-1 text-xs font-bold border border-foreground/70 bg-primary text-primary-foreground hover:bg-primary/90 rounded transition-colors cursor-pointer disabled:opacity-50"
                              >
                                {saving ? 'Saving...' : 'Save'}
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">-</span>
                          )}
                        </td>
                      )}
                    </tr>
                    {rowErrors[r.id] && (
                      <tr>
                        <td colSpan={canEdit ? 7 : 6} className="px-4 pb-3">
                          <div className="p-2 text-xs text-destructive bg-destructive/10 border border-destructive/40 rounded">
                            {rowErrors[r.id]}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default PointsRules
