import React, { useState, useEffect } from 'react'
import type { Match } from '../../types/bracket'
import { bracketService } from '../../services/bracketService'

export interface MatchScoreModalProps {
  match: Match | null
  isOpen: boolean
  onClose: () => void
  onMatchUpdated: (updatedMatch: Match) => void
}

interface MatchScoreModalContentProps {
  match: Match
  onClose: () => void
  onMatchUpdated: (updatedMatch: Match) => void
}

const MatchScoreModalContent: React.FC<MatchScoreModalContentProps> = ({
  match,
  onClose,
  onMatchUpdated,
}) => {
  const [scoreA, setScoreA] = useState<number | ''>(
    match.scoreA !== null && match.scoreA !== undefined ? match.scoreA : ''
  )
  const [scoreB, setScoreB] = useState<number | ''>(
    match.scoreB !== null && match.scoreB !== undefined ? match.scoreB : ''
  )
  const [venue, setVenue] = useState<string>(match.venue || '')
  const [scheduledAt, setScheduledAt] = useState<string>(
    match.scheduledAt ? match.scheduledAt.slice(0, 16) : ''
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const handleReportScore = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!match.a || !match.b) {
      setError('Both participants must be determined before reporting the final score.')
      return
    }

    if (scoreA === '' || scoreB === '') {
      setError('Please provide scores for both participants.')
      return
    }

    const numA = Number(scoreA)
    const numB = Number(scoreB)

    if (numA < 0 || numB < 0) {
      setError('Scores cannot be negative.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const updatedMatch = await bracketService.reportMatchResult(match.id, numA, numB)
      onMatchUpdated(updatedMatch)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to report match score')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdateSchedule = async () => {
    setIsSubmitting(true)
    setError(null)

    try {
      const isoDate = scheduledAt ? new Date(scheduledAt).toISOString() : null
      const updatedMatch = await bracketService.scheduleMatch(
        match.id,
        isoDate,
        venue.trim() || null
      )
      onMatchUpdated(updatedMatch)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update schedule')
    } finally {
      setIsSubmitting(false)
    }
  }

  const bothParticipantsSet = Boolean(match.a && match.b)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg border border-gray-200 shadow-xl max-w-lg w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 pb-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-black">
              Match Controls & Scoring
            </h2>
            <span className="text-[10px] text-gray-500 uppercase tracking-wider">
              Round {match.round} • Match #{match.slot}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 text-xs font-bold border border-black text-black hover:bg-black hover:text-white cursor-pointer"
          >
            X
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded">
            {error}
          </div>
        )}

        {/* Matchup Overview */}
        <div className="p-3.5 border border-gray-200 bg-gray-50 rounded space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
            Current Matchup
          </div>
          <div className="flex items-center justify-between text-xs font-semibold text-black">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-800">
                {match.a ? `#${match.a.seed}` : '-'}
              </span>
              <span>{match.a ? match.a.displayName : 'TBD'}</span>
            </div>
            <span className="text-gray-400 font-normal">vs</span>
            <div className="flex items-center gap-2">
              <span>{match.b ? match.b.displayName : 'TBD'}</span>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-800">
                {match.b ? `#${match.b.seed}` : '-'}
              </span>
            </div>
          </div>
          <div className="text-[10px] text-gray-500 pt-1 border-t border-gray-200 flex justify-between">
            <span>Status: <strong className="uppercase text-black">{match.status}</strong></span>
            {match.winner && (
              <span>Winner: <strong className="text-black">Side {match.winner.toUpperCase()}</strong></span>
            )}
          </div>
        </div>

        {/* Section 1: Score Reporting Form */}
        <form onSubmit={handleReportScore} className="space-y-3 pt-1 border-t border-gray-200">
          <div className="text-xs font-bold uppercase tracking-wider text-black">
            Report Final Result
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1 truncate">
                {match.a ? match.a.displayName : 'Side A'} Score
              </label>
              <input
                type="number"
                min="0"
                step="1"
                disabled={!bothParticipantsSet || isSubmitting}
                value={scoreA}
                onChange={(e) =>
                  setScoreA(e.target.value === '' ? '' : parseInt(e.target.value, 10))
                }
                placeholder="0"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded text-black bg-white focus:outline-none focus:border-black disabled:bg-gray-100 disabled:text-gray-400"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1 truncate">
                {match.b ? match.b.displayName : 'Side B'} Score
              </label>
              <input
                type="number"
                min="0"
                step="1"
                disabled={!bothParticipantsSet || isSubmitting}
                value={scoreB}
                onChange={(e) =>
                  setScoreB(e.target.value === '' ? '' : parseInt(e.target.value, 10))
                }
                placeholder="0"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded text-black bg-white focus:outline-none focus:border-black disabled:bg-gray-100 disabled:text-gray-400"
              />
            </div>
          </div>

          {!bothParticipantsSet && (
            <p className="text-[11px] text-gray-500 italic">
              Scores can only be submitted once prior round winners have advanced to this match.
            </p>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!bothParticipantsSet || isSubmitting}
              className="px-4 py-2 text-xs font-bold border border-black bg-black text-white hover:bg-gray-800 rounded transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Reporting...' : 'Report Final Score'}
            </button>
          </div>
        </form>

        {/* Section 2: Scheduling & Venue */}
        <div className="space-y-3 pt-3 border-t border-gray-200">
          <div className="text-xs font-bold uppercase tracking-wider text-black">
            Match Logistics
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                Scheduled Date & Time
              </label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded text-black bg-white focus:outline-none focus:border-black"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                Venue / Court / Lab
              </label>
              <input
                type="text"
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                placeholder="e.g. Gaming Lab A, Court 2"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded text-black bg-white focus:outline-none focus:border-black"
              />
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={handleUpdateSchedule}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold border border-black text-black bg-white hover:bg-black hover:text-white rounded transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Updating...' : 'Update Schedule & Venue'}
            </button>
          </div>
        </div>

        {/* Modal Close Action */}
        <div className="flex justify-end pt-3 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs border border-gray-300 text-black hover:bg-gray-100 rounded transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export const MatchScoreModal: React.FC<MatchScoreModalProps> = ({
  match,
  isOpen,
  onClose,
  onMatchUpdated,
}) => {
  if (!isOpen || !match) return null

  return (
    <MatchScoreModalContent
      key={match.id}
      match={match}
      onClose={onClose}
      onMatchUpdated={onMatchUpdated}
    />
  )
}

export default MatchScoreModal
