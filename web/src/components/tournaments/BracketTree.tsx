import React, { useMemo } from 'react'
import { Calendar, MapPin, Trophy } from 'lucide-react'
import type { Bracket, Match } from '../../types/bracket'

export interface BracketTreeProps {
  bracket: Bracket
  onSelectMatch: (match: Match) => void
}

function getRoundTitle(round: number, totalRounds: number): string {
  if (round === totalRounds) return 'Grand Finals'
  if (round === totalRounds - 1) return 'Semifinals'
  if (round === totalRounds - 2) return 'Quarterfinals'
  if (round === totalRounds - 3) return 'Round of 16'
  return `Round ${round}`
}

function formatMatchTime(dateStr?: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

interface MatchCardProps {
  match: Match
  onSelectMatch: (match: Match) => void
}

const MatchCard: React.FC<MatchCardProps> = ({ match, onSelectMatch }) => {
  const isWinnerA = match.winner === 'a'
  const isWinnerB = match.winner === 'b'

  const formattedTime = formatMatchTime(match.scheduledAt)

  return (
    <div
      onClick={() => onSelectMatch(match)}
      className="bg-white rounded-lg border border-gray-200 shadow-xs hover:shadow-md transition-all cursor-pointer overflow-hidden border-l-4 border-l-black"
    >
      {/* Top Bar: Status & Venue */}
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-gray-50 border-b border-gray-100 text-[10px]">
        <span
          className={`font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
            match.status === 'completed'
              ? 'bg-green-50 text-green-700 border-green-200'
              : match.status === 'ongoing'
              ? 'bg-black text-white border-black'
              : match.status === 'cancelled'
              ? 'bg-red-50 text-red-600 border-red-200'
              : 'bg-white text-gray-700 border-gray-200'
          }`}
        >
          {match.status}
        </span>

        <div className="flex items-center gap-2 text-gray-500 truncate">
          {match.venue && (
            <span className="flex items-center gap-1 truncate max-w-[100px]">
              <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
              <span className="truncate">{match.venue}</span>
            </span>
          )}
          {formattedTime && (
            <span className="flex items-center gap-1">
              <Calendar className="w-2.5 h-2.5 flex-shrink-0" />
              <span>{formattedTime}</span>
            </span>
          )}
        </div>
      </div>

      {/* Side A */}
      <div
        className={`flex items-center justify-between px-3 py-2 text-xs border-b border-gray-100 transition-colors ${
          isWinnerA ? 'bg-gray-50 font-bold text-black' : 'text-gray-700'
        }`}
      >
        <div className="flex items-center gap-2 truncate pr-2">
          {match.a ? (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-200 text-gray-800">
              #{match.a.seed}
            </span>
          ) : (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-100 text-gray-400">
              -
            </span>
          )}
          <span className="truncate">
            {match.a ? match.a.displayName : 'TBD'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isWinnerA && <Trophy className="w-3 h-3 text-black" />}
          <span
            className={`font-mono text-xs px-2 py-0.5 rounded ${
              isWinnerA
                ? 'bg-black text-white font-bold'
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            {match.scoreA !== null && match.scoreA !== undefined
              ? match.scoreA
              : '-'}
          </span>
        </div>
      </div>

      {/* Side B */}
      <div
        className={`flex items-center justify-between px-3 py-2 text-xs transition-colors ${
          isWinnerB ? 'bg-gray-50 font-bold text-black' : 'text-gray-700'
        }`}
      >
        <div className="flex items-center gap-2 truncate pr-2">
          {match.b ? (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-200 text-gray-800">
              #{match.b.seed}
            </span>
          ) : (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-100 text-gray-400">
              -
            </span>
          )}
          <span className="truncate">
            {match.b ? match.b.displayName : 'TBD'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isWinnerB && <Trophy className="w-3 h-3 text-black" />}
          <span
            className={`font-mono text-xs px-2 py-0.5 rounded ${
              isWinnerB
                ? 'bg-black text-white font-bold'
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            {match.scoreB !== null && match.scoreB !== undefined
              ? match.scoreB
              : '-'}
          </span>
        </div>
      </div>
    </div>
  )
}

export const BracketTree: React.FC<BracketTreeProps> = ({
  bracket,
  onSelectMatch,
}) => {
  const roundGroups = useMemo(() => {
    const map = new Map<number, Match[]>()
    for (const match of bracket.matches) {
      if (!map.has(match.round)) {
        map.set(match.round, [])
      }
      map.get(match.round)!.push(match)
    }

    // Sort matches within each round by slot
    for (const matches of map.values()) {
      matches.sort((a, b) => a.slot - b.slot)
    }

    const sortedRounds = Array.from(map.keys()).sort((a, b) => a - b)
    return sortedRounds.map((round) => ({
      round,
      title: getRoundTitle(round, bracket.rounds),
      matches: map.get(round)!,
    }))
  }, [bracket])

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex items-stretch gap-8 min-w-max p-4">
        {roundGroups.map((group) => (
          <div key={group.round} className="w-72 flex-shrink-0 flex flex-col">
            {/* Column Header */}
            <div className="text-center pb-3 mb-4 border-b border-gray-200">
              <h3 className="text-xs font-bold uppercase tracking-wider text-black">
                {group.title}
              </h3>
              <span className="text-[10px] text-gray-500 uppercase tracking-wider">
                {group.matches.length}{' '}
                {group.matches.length === 1 ? 'Match' : 'Matches'}
              </span>
            </div>

            {/* Column Matches Stack */}
            <div className="flex flex-col justify-around gap-6 flex-1 py-2">
              {group.matches.map((match) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  onSelectMatch={onSelectMatch}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default BracketTree
