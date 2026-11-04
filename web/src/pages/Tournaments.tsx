import React, { useState, useEffect, useMemo } from 'react'
import {
  Trophy,
  RotateCcw,
  Plus,
  List,
  GitBranch,
  AlertCircle,
} from 'lucide-react'
import type { Bracket, Match } from '../types/bracket'
import { bracketService } from '../services/bracketService'
import type { ClubEvent } from '../types/event'
import { eventService } from '../services/eventService'
import { BracketTree } from '../components/tournaments/BracketTree'
import { MatchScoreModal } from '../components/tournaments/MatchScoreModal'
import { GenerateBracketModal } from '../components/tournaments/GenerateBracketModal'

export const Tournaments: React.FC = () => {
  const [events, setEvents] = useState<ClubEvent[]>([])
  const [selectedEventId, setSelectedEventId] = useState<string>('evt-002')
  const [bracket, setBracket] = useState<Bracket | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null)
  const [isScoreModalOpen, setIsScoreModalOpen] = useState(false)
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'bracket' | 'table'>('bracket')

  // Load events list on mount
  useEffect(() => {
    let ignore = false

    eventService
      .getEvents()
      .then((data) => {
        if (!ignore) {
          setEvents(data)
          setSelectedEventId((prev) => {
            if (data.length > 0 && !data.some((e) => e.id === prev)) {
              return data[0].id
            }
            return prev
          })
        }
      })
      .catch((err) => {
        if (!ignore) {
          console.warn('[Tournaments] Failed to fetch events:', err)
        }
      })

    return () => {
      ignore = true
    }
  }, [])

  // Load bracket whenever selected event changes
  useEffect(() => {
    let ignore = false
    setIsLoading(true)
    setError(null)

    bracketService
      .getBracket(selectedEventId)
      .then((b) => {
        if (!ignore) {
          setBracket(b)
          setIsLoading(false)
        }
      })
      .catch((err) => {
        if (!ignore) {
          setError(
            err instanceof Error ? err.message : 'Failed to load tournament bracket'
          )
          setIsLoading(false)
        }
      })

    return () => {
      ignore = true
    }
  }, [selectedEventId])

  const selectedEvent = useMemo(() => {
    return events.find((e) => e.id === selectedEventId) || null
  }, [events, selectedEventId])

  const handleEventChange = (newId: string) => {
    setSelectedEventId(newId)
  }

  const handleSelectMatch = (match: Match) => {
    setSelectedMatch(match)
    setIsScoreModalOpen(true)
  }

  const handleMatchUpdated = (updatedMatch: Match) => {
    if (!bracket) return

    setBracket({
      ...bracket,
      matches: bracket.matches.map((m) =>
        m.id === updatedMatch.id ? updatedMatch : m
      ),
    })
    setIsScoreModalOpen(false)
    setSelectedMatch(null)
  }

  const handleBracketGenerated = (newBracket: Bracket) => {
    setBracket(newBracket)
    setIsGenerateModalOpen(false)
  }

  const handleResetBracket = async () => {
    if (
      !window.confirm(
        'Reset this bracket? All recorded match fixtures and scores will be wiped.'
      )
    ) {
      return
    }

    const success = await bracketService.resetBracket(selectedEventId)
    if (success) {
      setBracket(null)
    }
  }

  const handleRetry = () => {
    setIsLoading(true)
    setError(null)
    bracketService
      .getBracket(selectedEventId)
      .then((b) => {
        setBracket(b)
        setIsLoading(false)
      })
      .catch((err) => {
        setError(
          err instanceof Error ? err.message : 'Failed to load tournament bracket'
        )
        setIsLoading(false)
      })
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-xl font-bold uppercase tracking-wider text-foreground">
            Tournament Brackets & Fixtures
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Generate elimination draws, track live fixtures, and record official scores.
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-card border border-border rounded-xl p-3.5 dark:bg-transparent">
        {/* Event Selector */}
        <div className="flex items-center gap-3">
          <label className="text-xs font-mono font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
            Tournament:
          </label>
          <select
            value={selectedEventId}
            onChange={(e) => handleEventChange(e.target.value)}
            className="px-3 py-1.5 text-sm border border-border rounded-lg text-foreground bg-background focus:outline-none focus:ring-1 focus:ring-orange-500 max-w-xs sm:max-w-md truncate cursor-pointer"
          >
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.title} ({ev.category.toUpperCase()})
              </option>
            ))}
          </select>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {bracket ? (
            <>
              {/* View Switcher */}
              <div className="flex items-center border border-border rounded-lg overflow-hidden bg-muted/30">
                <button
                  type="button"
                  onClick={() => setViewMode('bracket')}
                  title="Bracket Tree View"
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors ${
                    viewMode === 'bracket'
                      ? 'bg-orange-500 text-white font-semibold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  <GitBranch className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Bracket Tree</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  title="Matches List View"
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors ${
                    viewMode === 'table'
                      ? 'bg-orange-500 text-white font-semibold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  <List className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Matches List</span>
                </button>
              </div>

              {/* Reset Draw */}
              <button
                type="button"
                onClick={handleResetBracket}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border text-rose-500 hover:border-rose-500/40 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Reset Draw</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setIsGenerateModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-orange-500 hover:bg-orange-600 text-white transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              Generate Bracket
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading && (
        <div className="p-12 text-center text-sm text-muted-foreground border border-border rounded-xl bg-card dark:bg-transparent">
          Loading tournament bracket fixtures...
        </div>
      )}

      {!isLoading && error && (
        <div className="p-4 border border-rose-500/30 text-foreground bg-rose-500/5 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500" />
            <span className="text-sm">{error}</span>
          </div>
          <button
            type="button"
            onClick={handleRetry}
            className="px-3 py-1 text-xs border border-border hover:border-foreground rounded-lg transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {!isLoading && !error && !bracket && (
        <div className="p-12 text-center border border-dashed border-border rounded-xl bg-card dark:bg-transparent space-y-3">
          <Trophy className="w-10 h-10 text-muted-foreground/60 mx-auto" />
          <h3 className="text-base font-semibold text-foreground">
            No bracket generated yet for this tournament
          </h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Generate the official draw to establish fixtures, assign participant seeds, schedule match times, and record live scores.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setIsGenerateModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-orange-500 hover:bg-orange-600 text-white transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              Generate Bracket
            </button>
          </div>
        </div>
      )}

      {!isLoading && !error && bracket && (
        <div>
          {viewMode === 'bracket' ? (
            <div className="bg-card rounded-xl border border-border p-3 dark:bg-transparent overflow-x-auto">
              <BracketTree
                bracket={bracket}
                onSelectMatch={handleSelectMatch}
              />
            </div>
          ) : (
            <div className="bg-card rounded-xl border border-border overflow-hidden dark:bg-transparent">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/20 border-b border-border text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Round / Slot</th>
                      <th className="px-4 py-3">Side A</th>
                      <th className="px-4 py-3 text-center">Score</th>
                      <th className="px-4 py-3">Side B</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Venue / Schedule</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {bracket.matches.map((m) => {
                      const isWinnerA = m.winner === 'a'
                      const isWinnerB = m.winner === 'b'
                      return (
                        <tr
                          key={m.id}
                          onClick={() => handleSelectMatch(m)}
                          className="hover:bg-muted/30 cursor-pointer transition-colors"
                        >
                          <td className="px-4 py-3 font-medium text-xs text-foreground font-mono">
                            Round {m.round} • #{m.slot}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`text-xs ${
                                isWinnerA ? 'font-bold text-foreground' : 'text-muted-foreground'
                              }`}
                            >
                              {m.a ? `#${m.a.seed} ${m.a.displayName}` : 'TBD'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center font-mono text-xs font-semibold tabular-nums text-foreground">
                            {m.scoreA !== null && m.scoreA !== undefined
                              ? m.scoreA
                              : '-'}{' '}
                            :{' '}
                            {m.scoreB !== null && m.scoreB !== undefined
                              ? m.scoreB
                              : '-'}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`text-xs ${
                                isWinnerB ? 'font-bold text-foreground' : 'text-muted-foreground'
                              }`}
                            >
                              {m.b ? `#${m.b.seed} ${m.b.displayName}` : 'TBD'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`text-[10px] font-mono font-medium uppercase tracking-wider px-2 py-0.5 rounded border ${
                                m.status === 'completed'
                                  ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/25'
                                  : m.status === 'ongoing'
                                  ? 'bg-orange-500/10 text-orange-500 border-orange-500/25'
                                  : m.status === 'cancelled'
                                  ? 'bg-rose-500/10 text-rose-500 border-rose-500/25'
                                  : 'bg-muted/20 text-muted-foreground border-border'
                              }`}
                            >
                              {m.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {m.venue || '-'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleSelectMatch(m)
                              }}
                              className="px-2.5 py-1 text-xs border border-border text-muted-foreground hover:text-foreground hover:border-foreground/40 rounded transition-colors cursor-pointer"
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <MatchScoreModal
        match={selectedMatch}
        isOpen={isScoreModalOpen}
        onClose={() => setIsScoreModalOpen(false)}
        onMatchUpdated={handleMatchUpdated}
      />

      <GenerateBracketModal
        eventId={selectedEventId}
        eventTitle={selectedEvent?.title || ''}
        isOpen={isGenerateModalOpen}
        onClose={() => setIsGenerateModalOpen(false)}
        onBracketGenerated={handleBracketGenerated}
      />
    </div>
  )
}

export default Tournaments
