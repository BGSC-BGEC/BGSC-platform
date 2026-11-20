import React, { useEffect, useMemo, useState } from 'react'
import { Search, Save } from 'lucide-react'
import type {
  EventScoringContext,
  ScoreSubmission,
  ScoringParameter,
} from '../../types/leaderboard'
import {
  getAllEventEntries,
  getConfirmedParticipants,
  submitEventScores,
} from '../../services/leaderboardService'

export interface ScoreEntryTableProps {
  context: EventScoringContext
  /** Called after a successful save so the standings above can refresh. */
  onSaved: () => void
}

interface ScoreRow {
  participantId: string
  name: string
  type: 'user' | 'team'
  onBoard: boolean
  raw: Record<string, number | boolean>
}

type DraftValue = string | boolean
type Draft = Record<string, DraftValue>

/** Statuses the backend refuses score writes for (leaderboard.service.ts submitScores). */
const CLOSED_STATUSES: Record<string, string> = {
  draft: 'This event is still a draft; scores can be entered once it is published.',
  past: 'This event has ended; its leaderboard is closed to score changes.',
  cancelled: 'This event was cancelled; its leaderboard is closed.',
}

function draftFrom(raw: Record<string, number | boolean>, params: ScoringParameter[]): Draft {
  const d: Draft = {}
  for (const p of params) {
    const v = raw[p.key]
    if (v === undefined) continue
    d[p.key] = p.kind === 'bool' ? Boolean(v) : String(v)
  }
  return d
}

/** Draft -> `raw`. Blank numeric cells are omitted (the backend skips missing keys). */
function rawFrom(
  draft: Draft,
  params: ScoringParameter[]
): { raw: Record<string, number | boolean> } | { error: string } {
  const raw: Record<string, number | boolean> = {}
  for (const p of params) {
    const v = draft[p.key]
    if (v === undefined) continue
    if (p.kind === 'bool') {
      raw[p.key] = Boolean(v)
      continue
    }
    const text = String(v).trim()
    if (text === '') continue
    const n = Number(text)
    if (!Number.isFinite(n)) return { error: `"${p.label}" must be a number` }
    if (p.kind === 'int' && !Number.isInteger(n)) return { error: `"${p.label}" must be a whole number` }
    raw[p.key] = n
  }
  return { raw }
}

export const ScoreEntryTable: React.FC<ScoreEntryTableProps> = ({ context, onSaved }) => {
  const params = context.parameters
  const [rows, setRows] = useState<ScoreRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [filter, setFilter] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  const closedReason = CLOSED_STATUSES[context.status] ?? null

  useEffect(() => {
    let ignore = false
    Promise.all([
      getAllEventEntries(context.id),
      // A teamed event is scored per team; registrations list users, so only board entries apply.
      context.isTeamed ? Promise.resolve([]) : getConfirmedParticipants(context.id),
    ])
      .then(([entries, participants]) => {
        if (ignore) return
        const byId = new Map<string, ScoreRow>()
        for (const e of entries) {
          byId.set(e.participant.id, {
            participantId: e.participant.id,
            name: e.participant.displayName,
            type: e.participant.type,
            onBoard: true,
            raw: e.raw,
          })
        }
        for (const p of participants) {
          if (byId.has(p.userId)) continue
          byId.set(p.userId, {
            participantId: p.userId,
            name: p.displayName,
            type: 'user',
            onBoard: false,
            raw: {},
          })
        }
        setRows([...byId.values()].sort((a, b) => a.name.localeCompare(b.name)))
        setLoadError(null)
        setIsLoading(false)
      })
      .catch((err) => {
        if (ignore) return
        setLoadError(err instanceof Error ? err.message : 'Failed to load participants')
        setIsLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [context.id, context.isTeamed, reloadKey])

  const visibleRows = useMemo(() => {
    const term = filter.trim().toLowerCase()
    return term ? rows.filter((r) => r.name.toLowerCase().includes(term)) : rows
  }, [rows, filter])

  const dirtyCount = Object.keys(drafts).length

  const setCell = (row: ScoreRow, key: string, value: DraftValue) => {
    setSaveMessage(null)
    setDrafts((prev) => ({
      ...prev,
      [row.participantId]: { ...(prev[row.participantId] ?? draftFrom(row.raw, params)), [key]: value },
    }))
  }

  const cellValue = (row: ScoreRow, p: ScoringParameter): DraftValue => {
    const d = drafts[row.participantId]
    if (d) return d[p.key] ?? (p.kind === 'bool' ? false : '')
    const v = row.raw[p.key]
    if (p.kind === 'bool') return Boolean(v)
    return v === undefined ? '' : String(v)
  }

  const handleSave = async () => {
    setSaveError(null)
    setSaveMessage(null)
    const submissions: ScoreSubmission[] = []
    for (const row of rows) {
      const d = drafts[row.participantId]
      if (!d) continue
      const result = rawFrom(d, params)
      if ('error' in result) {
        setSaveError(`${row.name}: ${result.error}`)
        return
      }
      submissions.push({ participantId: row.participantId, raw: result.raw })
    }
    if (submissions.length === 0) return

    setIsSaving(true)
    try {
      const res = await submitEventScores(context.id, submissions)
      setDrafts({})
      setSaveMessage(
        `Saved ${res.count} score row(s).${res.thresholdMet ? '' : ' Participation threshold not met yet: ranks are provisional.'}`
      )
      setIsLoading(true)
      setReloadKey((k) => k + 1)
      onSaved()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save scores')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-black">Score Entry</div>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Each saved row replaces that participant's raw values. Blank cells are left out of the score.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dirtyCount > 0 && (
            <button
              type="button"
              onClick={() => {
                setDrafts({})
                setSaveError(null)
              }}
              disabled={isSaving}
              className="px-3 py-2 text-xs border border-gray-300 text-black bg-white hover:bg-gray-100 rounded transition-colors cursor-pointer disabled:opacity-50"
            >
              Discard Changes
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || dirtyCount === 0 || Boolean(closedReason)}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold border border-black bg-black text-white hover:bg-gray-800 rounded transition-colors cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving...' : `Save Scores${dirtyCount ? ` (${dirtyCount})` : ''}`}</span>
          </button>
        </div>
      </div>

      {closedReason && (
        <div className="p-3 text-xs text-black bg-gray-50 border border-gray-300 rounded">{closedReason}</div>
      )}
      {params.length === 0 && (
        <div className="p-3 text-xs text-black bg-gray-50 border border-gray-300 rounded">
          This event has no scoring parameters configured, so there is nothing to score.
        </div>
      )}
      {saveError && (
        <div className="p-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded">{saveError}</div>
      )}
      {saveMessage && (
        <div className="p-3 text-xs text-green-700 bg-green-50 border border-green-200 rounded">{saveMessage}</div>
      )}

      {params.length > 0 && (
        <>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Filter participants..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded text-black bg-white focus:outline-none focus:border-black"
            />
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-sm text-gray-500 border border-gray-200 rounded bg-gray-50">
              Loading participants...
            </div>
          ) : loadError ? (
            <div className="p-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded">{loadError}</div>
          ) : visibleRows.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500 border border-gray-200 rounded bg-gray-50">
              {rows.length === 0
                ? context.isTeamed
                  ? 'No teams are on this board yet.'
                  : 'No confirmed participants yet.'
                : 'No participants match the filter.'}
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-b border-gray-200 text-[10px] font-bold uppercase tracking-wider text-black">
                  <tr>
                    <th className="px-4 py-3">Participant</th>
                    {params.map((p) => (
                      <th key={p.key} className="px-3 py-3 whitespace-nowrap" title={`key: ${p.key}`}>
                        {p.label}
                        <span className="block text-[9px] font-semibold text-gray-500 normal-case tracking-normal">
                          {p.kind} · weight {p.weight}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {visibleRows.map((row) => {
                    const dirty = Boolean(drafts[row.participantId])
                    return (
                      <tr
                        key={row.participantId}
                        className={`transition-colors ${dirty ? 'bg-gray-50' : 'hover:bg-gray-50'}`}
                      >
                        <td className="px-4 py-2">
                          <div className="font-bold text-black text-xs sm:text-sm">
                            {row.name}
                            {dirty && <span className="ml-1 text-[10px] text-gray-500">•</span>}
                          </div>
                          <div className="text-[10px] text-gray-500 uppercase tracking-wider">
                            {row.type}
                            {!row.onBoard && ' · not yet scored'}
                          </div>
                        </td>
                        {params.map((p) => {
                          const v = cellValue(row, p)
                          return (
                            <td key={p.key} className="px-3 py-2">
                              {p.kind === 'bool' ? (
                                <input
                                  type="checkbox"
                                  checked={Boolean(v)}
                                  disabled={Boolean(closedReason)}
                                  onChange={(e) => setCell(row, p.key, e.target.checked)}
                                  className="w-4 h-4 accent-black cursor-pointer"
                                />
                              ) : (
                                <input
                                  type="number"
                                  step={p.kind === 'int' ? 1 : 'any'}
                                  value={String(v)}
                                  disabled={Boolean(closedReason)}
                                  onChange={(e) => setCell(row, p.key, e.target.value)}
                                  className="w-24 px-2 py-1 text-xs font-mono border border-gray-300 rounded text-black bg-white focus:outline-none focus:border-black disabled:bg-gray-50"
                                />
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default ScoreEntryTable
