import React, { useState, useEffect } from 'react'
import type {
  ClubEvent,
  EventCategory,
  EventDomain,
  EventType,
  LeaderboardFormat,
} from '../../types/event'
import {
  DEFAULT_POINTS_POOL,
  EVENT_TYPE_RULES,
  LEADERBOARD_FORMAT_LABELS,
  SELECTABLE_LEADERBOARD_FORMATS,
  canPublishWithoutForm,
  rulesFor,
} from '../../types/event'
import { eventService } from '../../services/eventService'

export interface CreateEventModalProps {
  isOpen: boolean
  onClose: () => void
  onEventCreated: (newEvent: ClubEvent) => void
}

const INPUT =
  'w-full px-3 py-2 text-sm border border-gray-300 rounded text-black bg-white focus:outline-none focus:border-black'
const LABEL = 'block text-xs font-bold uppercase text-black mb-1'
const SECTION = 'space-y-3 p-3 border border-gray-200 rounded bg-gray-50'
const SECTION_TITLE = 'text-xs font-bold uppercase tracking-wider text-black'

/** `datetime-local` value for a Date, in local time. */
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function defaults() {
  const start = new Date()
  start.setDate(start.getDate() + 7)
  start.setHours(10, 0, 0, 0)
  const end = new Date(start)
  end.setHours(18)
  const closes = new Date(start)
  closes.setDate(closes.getDate() - 1)
  closes.setHours(23, 59, 0, 0)
  return { start: toLocalInput(start), end: toLocalInput(end), closes: toLocalInput(closes) }
}

export const CreateEventModal: React.FC<CreateEventModalProps> = ({
  isOpen,
  onClose,
  onEventCreated,
}) => {
  const initial = defaults()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<EventCategory>('general')
  const [type, setType] = useState<EventType>('DE')
  const [domain, setDomain] = useState<EventDomain>('sports')
  const [venue, setVenue] = useState('')
  const [startAt, setStartAt] = useState(initial.start)
  const [endAt, setEndAt] = useState(initial.end)
  const [closesAt, setClosesAt] = useState(initial.closes)
  const [rosterFinalizesAt, setRosterFinalizesAt] = useState('')
  const [capacityEnabled, setCapacityEnabled] = useState(false)
  const [maxParticipants, setMaxParticipants] = useState<number>(32)
  const [waitlistEnabled, setWaitlistEnabled] = useState(true)
  const [requiresApproval, setRequiresApproval] = useState(false)
  const [status, setStatus] = useState<'draft' | 'upcoming'>('draft')

  // Teams (leagues default on; ALL forces it)
  const [isTeamed, setIsTeamed] = useState(false)
  const [teamSizeMin, setTeamSizeMin] = useState(2)
  const [teamSizeMax, setTeamSizeMax] = useState(5)
  const [maxTeams, setMaxTeams] = useState(8)
  const [captainApplicationRequired, setCaptainApplicationRequired] = useState(false)

  // Leaderboard (every type except DE)
  const [leaderboardFormat, setLeaderboardFormat] = useState<LeaderboardFormat>('points_table')
  // elim_after_n is not offered (no bracket generator for it); kept only to satisfy the input type.
  const elimAfterN = 2
  const [minParticipants, setMinParticipants] = useState(2)

  // Auction (ALL only) — spec §5.15.4 defaults: 5 s timer
  const [kMultiplier, setKMultiplier] = useState(1.0)
  const [minBidIncrement, setMinBidIncrement] = useState(100)
  const [bidTimerSeconds, setBidTimerSeconds] = useState(5)
  const [pursePerTeam, setPursePerTeam] = useState<number | ''>('')

  // Points (event.points_pool) — backend defaults
  const [participationPoints, setParticipationPoints] = useState(DEFAULT_POINTS_POOL.participation)
  const [podiumMultipliers, setPodiumMultipliers] = useState(DEFAULT_POINTS_POOL.podiumMultipliers.join(', '))
  const [sponsorBonus, setSponsorBonus] = useState(DEFAULT_POINTS_POOL.sponsorBonus)
  const [investmentEnabled, setInvestmentEnabled] = useState(false)
  const [investmentCap, setInvestmentCap] = useState<number | ''>('')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const rules = rulesFor(type)
  const teamed = rules.forcesTeams || isTeamed
  const capacity = capacityEnabled ? maxParticipants : null
  const canGoLive = canPublishWithoutForm(type, teamed, capacity)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  /** Changing the type re-shapes the form to that type's defaults (spec §5.5 / §5.15). */
  const handleTypeChange = (next: EventType) => {
    const r = rulesFor(next)
    setType(next)
    setIsTeamed(r.isLeague)
    setCaptainApplicationRequired(r.isLeague)
    if (r.isLeague) setCategory('leagues')
    if (r.isLeague) setLeaderboardFormat(r.isAuction ? 'single_elim' : 'round_robin')
    else setLeaderboardFormat('points_table')
    if (!canPublishWithoutForm(next, r.isLeague, capacity)) setStatus('draft')
  }

  const validate = (): string | null => {
    const s = new Date(startAt)
    const e = new Date(endAt)
    const c = new Date(closesAt)
    if (!(s < e)) return 'The event must end after it starts.'
    if (c > s) return 'Registration must close at or before the event start.'
    if (teamed) {
      if (teamSizeMin < 1 || teamSizeMin > teamSizeMax) return 'Team size: 1 ≤ min ≤ max.'
      if (rosterFinalizesAt) {
        const r = new Date(rosterFinalizesAt)
        if (r < c || r > s) return 'Roster lock must fall between registration close and the event start.'
      }
    }
    const multipliers = podiumMultipliers.split(',').map((s) => Number(s.trim()))
    if (multipliers.some((m) => !(m > 0))) return 'Podium multipliers must be positive numbers, e.g. 3, 2, 1.5.'
    if (participationPoints < 0 || sponsorBonus < 0) return 'Points cannot be negative.'
    if (rules.isAuction) {
      if (!(kMultiplier > 0)) return 'K multiplier must be greater than 0.'
      if (minBidIncrement < 1) return 'Minimum bid increment must be at least 1.'
      if (bidTimerSeconds < 5 || bidTimerSeconds > 60) return 'Bid timer must be 5–60 seconds.'
    }
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    const problem = validate()
    if (problem) {
      setError(problem)
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const createdEvent = await eventService.createEvent({
        title: title.trim(),
        description: description.trim(),
        category,
        type,
        domain,
        status,
        venue: venue.trim() || null,
        startAt,
        endAt,
        registrationClosesAt: closesAt,
        rosterFinalizesAt: rosterFinalizesAt || null,
        maxParticipants: capacity,
        waitlistEnabled: capacityEnabled && waitlistEnabled,
        requiresApproval,
        isTeamed: teamed,
        teamSizeMin,
        teamSizeMax,
        maxTeams,
        captainApplicationRequired,
        leaderboardFormat,
        elimAfterN,
        minParticipants,
        auction: {
          kMultiplier,
          minBidIncrement,
          bidTimerSeconds,
          pursePerTeam: pursePerTeam === '' ? null : Number(pursePerTeam),
        },
        pointsPool: {
          participation: participationPoints,
          podiumMultipliers: podiumMultipliers.split(',').map((s) => Number(s.trim())),
          sponsorBonus,
          investmentEnabled: rules.hasLeaderboard && investmentEnabled,
          investmentCap: investmentCap === '' ? null : Number(investmentCap),
        },
      })

      onEventCreated(createdEvent)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create event')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg border border-gray-200 shadow-xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 pb-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-black">
            {rules.isLeague ? 'Create New League' : 'Create New Event'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 text-xs font-bold border border-black text-black hover:bg-black hover:text-white cursor-pointer"
          >
            X
          </button>
        </div>

        {error && (
          <div className="p-2 border border-black text-xs text-black bg-gray-50">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          {/* Type first: it decides which sections exist below. */}
          <div>
            <label className={LABEL}>Event Type</label>
            <select
              value={type}
              onChange={(e) => handleTypeChange(e.target.value as EventType)}
              className={INPUT}
            >
              {(Object.keys(EVENT_TYPE_RULES) as EventType[]).map((t) => (
                <option key={t} value={t}>
                  {EVENT_TYPE_RULES[t].label}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-gray-500 mt-1">{rules.description}</p>
          </div>

          <div>
            <label className={LABEL}>Event Title</label>
            <input
              type="text"
              required
              placeholder="e.g. BGSC Badminton Smash Open"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={INPUT}
            />
          </div>

          <div>
            <label className={LABEL}>Description</label>
            <textarea
              rows={2}
              placeholder="Brief overview of rules, format, and prizes..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={INPUT}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as EventCategory)}
                className={INPUT}
              >
                <option value="leagues">Leagues</option>
                <option value="bgec">BGEC</option>
                <option value="fitsoc">FitSoc</option>
                <option value="general">General</option>
              </select>
            </div>
            <div>
              <label className={LABEL}>Domain</label>
              <select
                value={domain}
                onChange={(e) => setDomain(e.target.value as EventDomain)}
                className={INPUT}
              >
                <option value="sports">Sports</option>
                <option value="esports">Esports</option>
                <option value="fitness">Fitness</option>
                <option value="general">General</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={LABEL}>Registration Closes</label>
              <input type="datetime-local" required value={closesAt} onChange={(e) => setClosesAt(e.target.value)} className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Starts</label>
              <input type="datetime-local" required value={startAt} onChange={(e) => setStartAt(e.target.value)} className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Ends</label>
              <input type="datetime-local" required value={endAt} onChange={(e) => setEndAt(e.target.value)} className={INPUT} />
            </div>
          </div>

          <div>
            <label className={LABEL}>Venue / Location</label>
            <input
              type="text"
              placeholder="e.g. Indoor Badminton Arena, Courts 1-4"
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              className={INPUT}
            />
          </div>

          {/* Capacity */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold uppercase text-black">
              <input
                type="checkbox"
                checked={capacityEnabled}
                onChange={(e) => {
                  setCapacityEnabled(e.target.checked)
                  if (e.target.checked) setStatus('draft')
                }}
                className="rounded border-gray-300 text-black focus:ring-black"
              />
              <span>Limit capacity</span>
            </label>
            {capacityEnabled && (
              <div className="grid grid-cols-2 gap-3 items-end">
                <div>
                  <label className={LABEL}>Max Participants</label>
                  <input type="number" min={1} value={maxParticipants} onChange={(e) => setMaxParticipants(Number(e.target.value))} className={INPUT} />
                </div>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold uppercase text-black pb-2">
                  <input
                    type="checkbox"
                    checked={waitlistEnabled}
                    onChange={(e) => setWaitlistEnabled(e.target.checked)}
                    className="rounded border-gray-300 text-black focus:ring-black"
                  />
                  <span>Waitlist when full</span>
                </label>
              </div>
            )}
          </div>

          {/* Teams — leagues, or any event the admin makes teamed */}
          <div className={SECTION}>
            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold uppercase text-black">
              <input
                type="checkbox"
                checked={teamed}
                disabled={rules.forcesTeams}
                onChange={(e) => {
                  setIsTeamed(e.target.checked)
                  if (e.target.checked) setStatus('draft')
                }}
                className="rounded border-gray-300 text-black focus:ring-black"
              />
              <span>Team event{rules.forcesTeams ? ' (required for auction leagues)' : ''}</span>
            </label>
            {teamed && (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={LABEL}>Team Size Min</label>
                    <input type="number" min={1} value={teamSizeMin} onChange={(e) => setTeamSizeMin(Number(e.target.value))} className={INPUT} />
                  </div>
                  <div>
                    <label className={LABEL}>Team Size Max</label>
                    <input type="number" min={1} value={teamSizeMax} onChange={(e) => setTeamSizeMax(Number(e.target.value))} className={INPUT} />
                  </div>
                  <div>
                    <label className={LABEL}>Max Teams</label>
                    <input type="number" min={1} value={maxTeams} onChange={(e) => setMaxTeams(Number(e.target.value))} className={INPUT} />
                  </div>
                </div>
                <div>
                  <label className={LABEL}>Roster Lock (optional)</label>
                  <input type="datetime-local" value={rosterFinalizesAt} onChange={(e) => setRosterFinalizesAt(e.target.value)} className={INPUT} />
                  <p className="text-[11px] text-gray-500 mt-1">Between registration close and the event start.</p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold uppercase text-black">
                  <input
                    type="checkbox"
                    checked={captainApplicationRequired}
                    onChange={(e) => setCaptainApplicationRequired(e.target.checked)}
                    className="rounded border-gray-300 text-black focus:ring-black"
                  />
                  <span>Captains must be approved by admins</span>
                </label>
                <p className="text-[11px] text-gray-500">
                  {captainApplicationRequired
                    ? 'Users apply as captain at registration; core admins review them under "Captain Applications".'
                    : 'Anyone registering as captain is approved automatically.'}
                  {rules.isAuction && ' Approved captains join the auction captain pool.'}
                </p>
              </>
            )}
          </div>

          {/* Leaderboard — every type except DE */}
          {rules.hasLeaderboard && (
            <div className={SECTION}>
              <div className={SECTION_TITLE}>Leaderboard / Bracket</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Format</label>
                  <select
                    value={leaderboardFormat}
                    onChange={(e) => setLeaderboardFormat(e.target.value as LeaderboardFormat)}
                    className={INPUT}
                  >
                    {SELECTABLE_LEADERBOARD_FORMATS.map((f) => (
                      <option key={f} value={f}>
                        {LEADERBOARD_FORMAT_LABELS[f]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={LABEL}>Min Participants to Activate</label>
                  <input type="number" min={1} value={minParticipants} onChange={(e) => setMinParticipants(Number(e.target.value))} className={INPUT} />
                </div>
              </div>
            </div>
          )}

          {/* Points — per-event points_pool (spec §5.15.3 point award toggles) */}
          <div className={SECTION}>
            <div className={SECTION_TITLE}>Points</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL}>Participation Points</label>
                <input type="number" min={0} value={participationPoints} onChange={(e) => setParticipationPoints(Number(e.target.value))} className={INPUT} />
              </div>
              <div>
                <label className={LABEL}>Podium Multipliers (1st, 2nd, 3rd)</label>
                <input
                  type="text"
                  value={podiumMultipliers}
                  onChange={(e) => setPodiumMultipliers(e.target.value)}
                  placeholder="3, 2, 1.5"
                  className={INPUT}
                />
              </div>
              <div>
                <label className={LABEL}>Sponsor Bonus</label>
                <input type="number" min={0} value={sponsorBonus} onChange={(e) => setSponsorBonus(Number(e.target.value))} className={INPUT} />
              </div>
              {rules.hasLeaderboard && (
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold uppercase text-black pt-5">
                    <input
                      type="checkbox"
                      checked={investmentEnabled}
                      onChange={(e) => setInvestmentEnabled(e.target.checked)}
                      className="rounded border-gray-300 text-black focus:ring-black"
                    />
                    <span>Allow points investment</span>
                  </label>
                  {investmentEnabled && (
                    <input
                      type="number"
                      min={1}
                      placeholder="Investment cap (optional)"
                      value={investmentCap}
                      onChange={(e) => setInvestmentCap(e.target.value === '' ? '' : Number(e.target.value))}
                      className={INPUT}
                    />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Auction — ALL only (spec §5.15.4) */}
          {rules.isAuction && (
            <div className={SECTION}>
              <div className={SECTION_TITLE}>Auction Setup</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>K Multiplier</label>
                  <input type="number" min={0.1} step={0.1} value={kMultiplier} onChange={(e) => setKMultiplier(Number(e.target.value))} className={INPUT} />
                  <p className="text-[11px] text-gray-500 mt-1">Purse pool = K × Σ player base prices</p>
                </div>
                <div>
                  <label className={LABEL}>Purse Per Team (optional)</label>
                  <input
                    type="number"
                    min={0}
                    placeholder="Computed from K"
                    value={pursePerTeam}
                    onChange={(e) => setPursePerTeam(e.target.value === '' ? '' : Number(e.target.value))}
                    className={INPUT}
                  />
                </div>
                <div>
                  <label className={LABEL}>Min Bid Increment (M)</label>
                  <input type="number" min={1} value={minBidIncrement} onChange={(e) => setMinBidIncrement(Number(e.target.value))} className={INPUT} />
                </div>
                <div>
                  <label className={LABEL}>Bid Countdown (seconds)</label>
                  <input type="number" min={5} max={60} value={bidTimerSeconds} onChange={(e) => setBidTimerSeconds(Number(e.target.value))} className={INPUT} />
                </div>
              </div>
              <p className="text-[11px] text-gray-500">
                The 3/7ths OC override quota is applied by the backend. Captains and lots are managed on the Auction page.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 items-end">
            <div>
              <label className={LABEL}>Initial Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'draft' | 'upcoming')}
                className={INPUT}
              >
                <option value="draft">Draft</option>
                <option value="upcoming" disabled={!canGoLive}>
                  Upcoming{canGoLive ? '' : ' (link a registration form first)'}
                </option>
              </select>
            </div>
            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold uppercase text-black pb-2">
              <input
                type="checkbox"
                checked={requiresApproval}
                onChange={(e) => setRequiresApproval(e.target.checked)}
                className="rounded border-gray-300 text-black focus:ring-black"
              />
              <span>Admin approval for registrations</span>
            </label>
          </div>
          {!canGoLive && (
            <p className="text-[11px] text-gray-500">
              This event is saved as a draft. Open it, publish a registration form, then set it to Upcoming.
            </p>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs border border-gray-300 text-black hover:bg-gray-100 rounded transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs border border-black bg-black text-white hover:bg-gray-800 rounded font-bold transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? 'Creating...' : rules.isLeague ? 'Create League' : 'Create Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CreateEventModal
