import React, { useEffect, useState } from 'react'
import { AlertCircle, Download, Search, Trophy, Medal, Award } from 'lucide-react'
import type { ClubEvent } from '../../types/event'
import { LEADERBOARD_FORMAT_LABELS } from '../../types/event'
import type { LeaderboardFormat } from '../../types/event'
import type {
  EventLeaderboardEntry,
  EventLeaderboardPage,
  EventPodium,
  EventScoringContext,
} from '../../types/leaderboard'
import {
  getEventLeaderboard,
  getEventPodium,
  getEventScoringContext,
} from '../../services/leaderboardService'
import { rankOf } from '../../services/permissions'
import { useAuthStore } from '../../stores/authStore'
import { ScoreEntryTable } from './ScoreEntryTable'
import { downloadCsv, csvSafeName } from './csv'

export interface EventLeaderboardPanelProps {
  /** Events that have a leaderboard and are not drafts. */
  events: ClubEvent[]
  eventsLoading: boolean
  eventsError: string | null
}

const PAGE_SIZE = 50
const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 })

function RankBadge({ rank }: { rank: number | null }) {
  if (rank === 1)
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-black text-amber-400 font-bold text-xs mx-auto">
        <Trophy className="w-3.5 h-3.5" />
      </span>
    )
  if (rank === 2)
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-200 text-gray-800 font-bold text-xs mx-auto">
        <Medal className="w-3.5 h-3.5" />
      </span>
    )
  if (rank === 3)
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-100 text-amber-900 font-bold text-xs mx-auto">
        <Award className="w-3.5 h-3.5" />
      </span>
    )
  return <span className="font-mono text-xs font-semibold text-gray-600">{rank === null ? '-' : `#${rank}`}</span>
}

export const EventLeaderboardPanel: React.FC<EventLeaderboardPanelProps> = ({
  events,
  eventsLoading,
  eventsError,
}) => {
  const viewer = useAuthStore((s) => s.user)
  const [eventId, setEventId] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [reloadKey, setReloadKey] = useState(0)

  const [board, setBoard] = useState<EventLeaderboardPage | null>(null)
  const [podium, setPodium] = useState<EventPodium | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [scoring, setScoring] = useState<EventScoringContext | null>(null)
  const [scoringError, setScoringError] = useState<string | null>(null)

  const selectedEvent = events.find((e) => e.id === eventId) ?? null
  // Score entry is offered for LE events to core+ (route floor); the event-admin check runs below.
  const mayScoreType = selectedEvent?.type === 'LE' && rankOf(viewer?.role) >= rankOf('core')

  // Debounce the server-side name search.
  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput.trim() !== search) {
        setIsLoading(true)
        setPage(1)
        setSearch(searchInput.trim())
      }
    }, 350)
    return () => clearTimeout(t)
  }, [searchInput, search])

  useEffect(() => {
    if (!eventId) return
    let ignore = false
    Promise.all([
      getEventLeaderboard(eventId, { page, limit: PAGE_SIZE, search }),
      getEventPodium(eventId).catch(() => null),
    ])
      .then(([b, p]) => {
        if (ignore) return
        setBoard(b)
        setPodium(p)
        setError(null)
      })
      .catch((err) => {
        if (ignore) return
        setBoard(null)
        setPodium(null)
        setError(err instanceof Error ? err.message : 'Failed to load event leaderboard')
      })
      .finally(() => {
        if (!ignore) setIsLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [eventId, page, search, reloadKey])

  useEffect(() => {
    if (!eventId || !mayScoreType) return
    let ignore = false
    getEventScoringContext(eventId)
      .then((ctx) => {
        if (!ignore) {
          setScoring(ctx)
          setScoringError(null)
        }
      })
      .catch((err) => {
        if (!ignore) setScoringError(err instanceof Error ? err.message : 'Failed to load event scoring setup')
      })
    return () => {
      ignore = true
    }
  }, [eventId, mayScoreType])

  const handleSelectEvent = (id: string) => {
    setEventId(id)
    setBoard(null)
    setPodium(null)
    setError(null)
    setScoring(null)
    setScoringError(null)
    setPage(1)
    setSearchInput('')
    setSearch('')
    setIsLoading(Boolean(id))
  }

  const reload = () => {
    setIsLoading(true)
    setReloadKey((k) => k + 1)
  }

  // Mirrors isEventAdmin (shared/access/eventAdmin.ts): creator, listed core admin, or coordinator+.
  const isEventAdmin =
    Boolean(scoring && viewer) &&
    (rankOf(viewer?.role) >= rankOf('coordinator') ||
      scoring!.createdBy === viewer!.id ||
      scoring!.coreAdmins.includes(viewer!.id))

  const handleExport = () => {
    if (!board || !selectedEvent) return
    downloadCsv(
      `event-leaderboard-${csvSafeName(selectedEvent.slug || selectedEvent.title)}-page${board.page}.csv`,
      ['rank', 'participant_type', 'participant_id', 'name', 'raw_score', 'normalized_score', 'invested_points', 'final_score', 'eliminated'],
      board.standings.map((e) => [
        e.rank ?? '',
        e.participant.type,
        e.participant.id,
        e.participant.displayName,
        e.rawScore,
        e.normalizedScore,
        e.investedPoints,
        e.finalScore,
        e.eliminated ? 'yes' : 'no',
      ])
    )
  }

  const podiumEntries: EventLeaderboardEntry[] = podium?.podium ?? []

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={eventId}
          onChange={(e) => handleSelectEvent(e.target.value)}
          disabled={eventsLoading}
          className="flex-1 min-w-55 px-3 py-2 text-sm border border-gray-300 rounded text-black bg-white focus:outline-none focus:border-black"
        >
          <option value="">
            {eventsLoading ? 'Loading events...' : events.length ? 'Select an event...' : 'No events with a leaderboard'}
          </option>
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>
              {ev.title} — {ev.type} · {ev.status}
            </option>
          ))}
        </select>

        <div className="relative flex-1 min-w-55">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search participant name..."
            value={searchInput}
            maxLength={64}
            disabled={!eventId}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded text-black bg-white focus:outline-none focus:border-black"
          />
        </div>

        <button
          type="button"
          onClick={handleExport}
          disabled={!board || board.standings.length === 0}
          className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold border border-gray-300 text-black bg-white hover:bg-gray-100 rounded transition-colors cursor-pointer disabled:opacity-50"
        >
          <Download className="w-4 h-4 text-gray-600" />
          <span>Export CSV</span>
        </button>
      </div>

      {eventsError && (
        <div className="p-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded">{eventsError}</div>
      )}

      {!eventId && (
        <div className="p-12 text-center border border-gray-200 rounded-lg bg-white space-y-2">
          <Trophy className="w-10 h-10 text-gray-400 mx-auto" />
          <h3 className="text-base font-bold text-black">Select an event to view its leaderboard</h3>
          <p className="text-sm text-gray-500 max-w-sm mx-auto">
            Only published events with a leaderboard (LE, DLL, ALL) are listed.
          </p>
        </div>
      )}

      {eventId && isLoading && !board && (
        <div className="p-12 text-center text-sm text-gray-500 border border-gray-200 rounded bg-gray-50">
          Loading event standings...
        </div>
      )}

      {eventId && error && (
        <div className="p-4 border border-black text-black bg-white rounded flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span className="text-sm">{error}</span>
          </div>
          <button
            type="button"
            onClick={reload}
            className="px-3 py-1 text-xs border border-black hover:bg-black hover:text-white transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {eventId && board && (
        <div className="space-y-6">
          {/* Board meta */}
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-gray-200 bg-gray-50 text-gray-700">
              {LEADERBOARD_FORMAT_LABELS[board.format as LeaderboardFormat] ?? board.format}
            </span>
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                board.thresholdMet ? 'border-black bg-black text-white' : 'border-gray-300 bg-white text-gray-700'
              }`}
            >
              {board.thresholdMet
                ? 'Threshold met'
                : `Below threshold (min ${board.minParticipants} active)`}
            </span>
            <span className="text-gray-500">{board.total} participant(s)</span>
          </div>

          {/* Podium */}
          {podiumEntries.length > 0 && !search && page === 1 && (
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-black">Event Podium</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {podiumEntries.map((e) => (
                  <div
                    key={e.id}
                    className={`bg-white rounded-lg p-4 space-y-2 ${
                      e.rank === 1 ? 'border-2 border-black shadow-md' : 'border border-gray-300 shadow-xs'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <RankBadge rank={e.rank} />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                        {e.participant.type}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-black truncate">{e.participant.displayName}</h3>
                    <div className="text-2xl font-black text-black">
                      {fmt(e.finalScore)}
                      <span className="text-xs font-semibold text-gray-500 ml-1">final</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Standings */}
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-black">
              Event Standings ({board.total} Participants)
            </div>
            {board.standings.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500 border border-gray-200 rounded bg-gray-50">
                {search ? 'No participants match your search.' : 'No entries on this leaderboard yet.'}
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200 text-[10px] font-bold uppercase tracking-wider text-black">
                    <tr>
                      <th className="px-4 py-3 text-center w-16">Rank</th>
                      <th className="px-4 py-3">Participant</th>
                      <th className="px-4 py-3 text-right">Raw</th>
                      <th className="px-4 py-3 text-right">Normalized</th>
                      <th className="px-4 py-3 text-right">Invested</th>
                      <th className="px-4 py-3 text-right">Final Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {board.standings.map((e) => (
                      <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-center">
                          <RankBadge rank={e.rank} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-black text-xs sm:text-sm">{e.participant.displayName}</div>
                          <div className="text-[10px] text-gray-500 uppercase tracking-wider">
                            {e.participant.type}
                            {e.eliminated && ' · eliminated'}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-gray-700">{fmt(e.rawScore)}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-gray-700">{fmt(e.normalizedScore)}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-gray-700">{fmt(e.investedPoints)}</td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-mono font-bold text-black text-xs sm:text-sm">{fmt(e.finalScore)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {board.totalPages > 1 && (
              <div className="flex items-center justify-end gap-2 text-xs">
                <button
                  type="button"
                  disabled={page <= 1 || isLoading}
                  onClick={() => {
                    setIsLoading(true)
                    setPage((p) => p - 1)
                  }}
                  className="px-3 py-1 border border-gray-300 text-black bg-white hover:bg-gray-100 rounded transition-colors cursor-pointer disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-gray-600">
                  Page {board.page} of {board.totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= board.totalPages || isLoading}
                  onClick={() => {
                    setIsLoading(true)
                    setPage((p) => p + 1)
                  }}
                  className="px-3 py-1 border border-gray-300 text-black bg-white hover:bg-gray-100 rounded transition-colors cursor-pointer disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Score entry: LE events, event admins only */}
      {eventId && mayScoreType && (
        <div className="pt-4 border-t border-gray-200">
          {scoringError ? (
            <div className="p-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded">{scoringError}</div>
          ) : !scoring ? (
            <div className="p-4 text-center text-xs text-gray-500 border border-gray-200 rounded bg-gray-50">
              Loading score entry...
            </div>
          ) : isEventAdmin ? (
            <ScoreEntryTable key={scoring.id} context={scoring} onSaved={reload} />
          ) : (
            <div className="p-3 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded">
              Score entry is limited to this event's creator, its listed core admins, and coordinators.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default EventLeaderboardPanel
