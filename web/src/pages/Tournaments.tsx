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
    if (!selectedEventId) return

    bracketService
      .getBracket(selectedEventId)
      .then((b) => {
        if (!ignore) {
          setBracket(b)
          setError(null)
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

  const selectedEvent = useMemo(
    () => events.find((e) => e.id === selectedEventId),
    [events, selectedEventId]
  )

  const handleEventChange = (eventId: string) => {
    setIsLoading(true)
    setError(null)
    setSelectedEventId(eventId)
  }

  const handleSelectMatch = (match: Match) => {
    setSelectedMatch(match)
    setIsScoreModalOpen(true)
  }

  const handleMatchUpdated = (updatedMatch: Match) => {
    setBracket((prev) => {
      if (!prev) return null
      return {
        ...prev,
        matches: prev.matches.map((m) =>
          m.id === updatedMatch.id ? updatedMatch : m
        ),
      }
    })
    // Re-fetch bracket to reflect score updates and auto-advanced winners
    bracketService.getBracket(selectedEventId).then((b) => {
      if (b) setBracket(b)
    })
  }

  const handleBracketGenerated = (newBracket: Bracket) => {
    setBracket(newBracket)
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold uppercase tracking-wider text-black">
            Tournament Brackets & Fixtures
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Generate elimination draws, track live fixtures, and record official scores.
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-3 border border-gray-200 rounded-lg">
        {/* Event Selector */}
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold uppercase tracking-wider text-black whitespace-nowrap">
            Tournament:
          </label>
          <select
            value={selectedEventId}
            onChange={(e) => handleEventChange(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded text-black bg-white focus:outline-none focus:border-black max-w-xs sm:max-w-md truncate"
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
              <div className="flex items-center border border-gray-300 rounded overflow-hidden">
                <button
                  type="button"
                  onClick={() => setViewMode('bracket')}
                  title="Bracket Tree View"
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold cursor-pointer transition-colors ${
                    viewMode === 'bracket'
                      ? 'bg-black text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <GitBranch className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Bracket Tree</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  title="Matches List View"
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold cursor-pointer transition-colors ${
                    viewMode === 'table'
                      ? 'bg-black text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-100'
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
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-gray-300 text-red-600 hover:border-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Reset Draw</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setIsGenerateModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-black bg-black text-white hover:bg-gray-800 rounded transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Generate Bracket
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading && (
        <div className="p-12 text-center text-sm text-gray-500 border border-gray-200 rounded bg-gray-50">
          Loading tournament bracket fixtures...
        </div>
      )}

      {!isLoading && error && (
        <div className="p-4 border border-black text-black bg-white rounded flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span className="text-sm">{error}</span>
          </div>
          <button
            type="button"
            onClick={handleRetry}
            className="px-3 py-1 text-xs border border-black hover:bg-black hover:text-white transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {!isLoading && !error && !bracket && (
        <div className="p-12 text-center border border-gray-200 rounded-lg bg-white space-y-3">
          <Trophy className="w-10 h-10 text-gray-400 mx-auto" />
          <h3 className="text-base font-bold text-black">
            No bracket generated yet for this tournament
          </h3>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            Generate the official draw to establish fixtures, assign participant seeds, schedule match times, and record live scores.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setIsGenerateModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold border border-black bg-black text-white hover:bg-gray-800 rounded transition-colors cursor-pointer"
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
            <div className="bg-white rounded-lg border border-gray-200 p-2">
              <BracketTree
                bracket={bracket}
                onSelectMatch={handleSelectMatch}
              />
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-b border-gray-200 text-[10px] font-bold uppercase tracking-wider text-black">
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
                <tbody className="divide-y divide-gray-100">
                  {bracket.matches.map((m) => {
                    const isWinnerA = m.winner === 'a'
                    const isWinnerB = m.winner === 'b'
                    return (
                      <tr
                        key={m.id}
                        onClick={() => handleSelectMatch(m)}
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3 font-semibold text-xs text-black">
                          Round {m.round} • #{m.slot}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-xs ${
                              isWinnerA ? 'font-bold text-black' : 'text-gray-700'
                            }`}
                          >
                            {m.a ? `#${m.a.seed} ${m.a.displayName}` : 'TBD'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-xs font-semibold">
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
                              isWinnerB ? 'font-bold text-black' : 'text-gray-700'
                            }`}
                          >
                            {m.b ? `#${m.b.seed} ${m.b.displayName}` : 'TBD'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border ${
                              m.status === 'completed'
                                ? 'bg-green-50 text-green-700 border-green-200'
                                : m.status === 'ongoing'
                                ? 'bg-black text-white border-black'
                                : m.status === 'cancelled'
                                ? 'bg-red-50 text-red-600 border-red-200'
                                : 'bg-white text-gray-700 border-gray-200'
                            }`}
                          >
                            {m.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {m.venue || '-'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleSelectMatch(m)
                            }}
                            className="px-2.5 py-1 text-xs border border-black bg-white hover:bg-black hover:text-white rounded transition-colors cursor-pointer"
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
