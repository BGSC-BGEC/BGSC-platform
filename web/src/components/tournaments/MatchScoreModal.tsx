import React, { useState } from 'react'
import { X, Trophy, AlertTriangle, Loader2, Calendar, MapPin } from 'lucide-react'
import type { Match } from '../../types/bracket'
import { bracketService } from '../../services/bracketService'
import { Modal } from '../ui/modal'
import { Button } from '../ui/button'

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
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <Trophy className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
              Match Controls & Scoring
            </h2>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-mono">
              Round {match.round} • Match #{match.slot}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-6 space-y-5 overflow-y-auto flex-1">
        {/* Error Alert */}
        {error && (
          <div className="p-3 text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-xl flex items-center gap-2 animate-in fade-in">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Matchup Overview */}
        <div className="p-4 border border-border bg-muted/20 rounded-xl space-y-2.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Current Matchup
          </div>
          <div className="flex items-center justify-between text-xs font-semibold text-foreground">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-muted border border-border text-foreground">
                {match.a ? `#${match.a.seed}` : '-'}
              </span>
              <span>{match.a ? match.a.displayName : 'TBD'}</span>
            </div>
            <span className="text-muted-foreground font-normal">vs</span>
            <div className="flex items-center gap-2">
              <span>{match.b ? match.b.displayName : 'TBD'}</span>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-muted border border-border text-foreground">
                {match.b ? `#${match.b.seed}` : '-'}
              </span>
            </div>
          </div>
          <div className="text-[10px] text-muted-foreground pt-2 border-t border-border flex justify-between">
            <span>Status: <strong className="uppercase text-foreground">{match.status}</strong></span>
            {match.winner && (
              <span>Winner: <strong className="text-primary">Side {match.winner.toUpperCase()}</strong></span>
            )}
          </div>
        </div>

        {/* Section 1: Score Reporting Form */}
        <form onSubmit={handleReportScore} className="space-y-3.5 pt-2 border-t border-border">
          <div className="text-xs font-bold uppercase tracking-wider text-foreground">
            Report Final Result
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-muted-foreground mb-1 truncate">
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
                className="w-full px-3.5 py-2 text-sm border border-border rounded-xl text-foreground bg-card focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-muted-foreground mb-1 truncate">
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
                className="w-full px-3.5 py-2 text-sm border border-border rounded-xl text-foreground bg-card focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
              />
            </div>
          </div>

          {!bothParticipantsSet && (
            <p className="text-[11px] text-muted-foreground italic">
              Scores can only be submitted once prior round winners have advanced to this match.
            </p>
          )}

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={!bothParticipantsSet || isSubmitting}
              size="sm"
              className="text-xs font-semibold gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Reporting...
                </>
              ) : (
                'Report Final Score'
              )}
            </Button>
          </div>
        </form>

        {/* Section 2: Scheduling & Venue */}
        <div className="space-y-3 pt-3 border-t border-border">
          <div className="text-xs font-bold uppercase tracking-wider text-foreground">
            Match Logistics
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> Scheduled Date & Time
              </label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-border rounded-xl text-foreground bg-card focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" /> Venue / Court / Lab
              </label>
              <input
                type="text"
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                placeholder="e.g. Gaming Lab A, Court 2"
                className="w-full px-3.5 py-2 text-sm border border-border rounded-xl text-foreground bg-card focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleUpdateSchedule}
              disabled={isSubmitting}
              className="text-xs font-semibold gap-1.5"
            >
              {isSubmitting ? 'Updating...' : 'Update Schedule & Venue'}
            </Button>
          </div>
        </div>
      </div>

      {/* Modal Close Action */}
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
    </>
  )
}

export const MatchScoreModal: React.FC<MatchScoreModalProps> = ({
  match,
  isOpen,
  onClose,
  onMatchUpdated,
}) => {
  if (!match) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-lg">
      <MatchScoreModalContent
        key={match.id}
        match={match}
        onClose={onClose}
        onMatchUpdated={onMatchUpdated}
      />
    </Modal>
  )
}

export default MatchScoreModal
