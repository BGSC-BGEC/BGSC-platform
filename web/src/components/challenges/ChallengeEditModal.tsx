import React, { useState } from 'react'
import { AlertCircle } from 'lucide-react'
import {
  challengeService,
  type ChallengeDifficulty,
  type ChallengeDomain,
  type ChallengeItem,
  type ChallengeKind,
  type UpdateChallengeBody,
} from '../../services/challengeService'

interface ChallengeEditModalProps {
  challenge: ChallengeItem
  onClose: () => void
  onSaved: (challenge: ChallengeItem) => void
}

const inputClass = 'w-full px-3 py-2 text-sm border border-gray-300 rounded text-black bg-white'
const labelClass = 'block text-xs font-bold uppercase text-black mb-1'

/**
 * PATCH /challenges/:id with only the changed fields (UpdateChallengeBody: all optional, nested
 * groups merged server-side). The backend allows edits in every status; it refuses an
 * award_points change once anyone has accepted (409 challenge_has_participations).
 */
export const ChallengeEditModal: React.FC<ChallengeEditModalProps> = ({
  challenge,
  onClose,
  onSaved,
}) => {
  const [title, setTitle] = useState(challenge.title)
  const [description, setDescription] = useState(challenge.description)
  const [domain, setDomain] = useState<ChallengeDomain>(challenge.domain)
  const [kind, setKind] = useState<ChallengeKind>(challenge.kind)
  const [difficulty, setDifficulty] = useState<ChallengeDifficulty>(challenge.difficulty)
  const [awardPoints, setAwardPoints] = useState(String(challenge.awardPoints))
  const [locationName, setLocationName] = useState(challenge.location?.name ?? '')
  const [autoApprove, setAutoApprove] = useState(challenge.autoApprove)
  const [grantsHof, setGrantsHof] = useState(challenge.grantsHallOfFame)

  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const buildBody = (): UpdateChallengeBody | string => {
    const body: UpdateChallengeBody = {}

    if (!title.trim()) return 'Title is required.'
    if (!description.trim()) return 'Description is required.'
    const points = Number(awardPoints)
    if (!Number.isInteger(points) || points < 1 || points > 100_000) {
      return 'Award points must be a whole number from 1 to 100,000.'
    }

    if (title.trim() !== challenge.title) body.title = title.trim()
    if (description.trim() !== challenge.description) body.description = description.trim()
    if (domain !== challenge.domain) body.domain = domain
    if (kind !== challenge.kind) body.kind = kind
    if (difficulty !== challenge.difficulty) body.difficulty = difficulty
    if (points !== challenge.awardPoints) body.award_points = points
    // Sent only when touched: leaving it out is what lets the backend's Legend rule turn it on
    // when difficulty moves to legend.
    if (grantsHof !== challenge.grantsHallOfFame) body.grants_hall_of_fame = grantsHof
    if (autoApprove !== challenge.autoApprove) body.submission = { auto_approve: autoApprove }

    if (kind === 'physical') {
      if (!locationName.trim()) return 'A physical challenge needs a location.'
      if (locationName.trim() !== (challenge.location?.name ?? '')) {
        // `location` is replaced whole on update: carry the stored details over.
        body.location = { name: locationName.trim(), details: challenge.location?.details ?? null }
      }
    }

    return body
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const body = buildBody()
    if (typeof body === 'string') {
      setFormError(body)
      return
    }
    if (Object.keys(body).length === 0) {
      onClose()
      return
    }
    setFormError(null)
    setIsSubmitting(true)
    try {
      onSaved(await challengeService.updateChallenge(challenge.id, body))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update challenge'
      setFormError(
        message === 'challenge_has_participations'
          ? 'Award points cannot change once members have accepted this challenge.'
          : message
      )
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
        className="bg-white rounded-lg border border-gray-200 shadow-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 pb-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-black">
            Edit Challenge
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 text-xs font-bold border border-black text-black hover:bg-black hover:text-white cursor-pointer"
          >
            X
          </button>
        </div>

        {formError && (
          <div className="p-3 border border-black bg-white text-black rounded flex items-center gap-2 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <div>
            <label className={labelClass}>Title</label>
            <input
              type="text"
              required
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Description & Proof Requirements</label>
            <textarea
              rows={3}
              required
              maxLength={20000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>Domain</label>
              <select
                value={domain}
                onChange={(e) => setDomain(e.target.value as ChallengeDomain)}
                className={inputClass}
              >
                <option value="sports">Sports</option>
                <option value="esports">Esports</option>
                <option value="dev">Dev</option>
                <option value="general">General</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Kind</label>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as ChallengeKind)}
                className={inputClass}
              >
                <option value="physical">Physical</option>
                <option value="digital">Digital</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Difficulty</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as ChallengeDifficulty)}
                className={inputClass}
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
                <option value="legend">Legend</option>
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass}>Award Points</label>
            <input
              type="number"
              min={1}
              max={100000}
              step={1}
              value={awardPoints}
              onChange={(e) => setAwardPoints(e.target.value)}
              className={inputClass}
            />
            {challenge.participantsCount > 0 && (
              <p className="text-[11px] text-gray-500 mt-1">
                Members have already joined; the server will refuse a change to award points.
              </p>
            )}
          </div>

          {kind === 'physical' && (
            <div>
              <label className={labelClass}>Physical Location</label>
              <input
                type="text"
                required
                maxLength={200}
                placeholder="e.g. Indoor Badminton Arena or Main Sports Track"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                className={inputClass}
              />
            </div>
          )}

          <div className="space-y-2 pt-1">
            <label
              className={`flex items-center gap-2 text-xs font-bold uppercase cursor-pointer ${
                challenge.requiresProof ? 'text-black' : 'text-gray-400'
              }`}
            >
              <input
                type="checkbox"
                checked={autoApprove}
                disabled={!challenge.requiresProof}
                onChange={(e) => setAutoApprove(e.target.checked)}
              />
              <span>Auto-Approve Submissions (Instant Points)</span>
            </label>
            <label className="flex items-center gap-2 text-xs font-bold uppercase text-black cursor-pointer">
              <input
                type="checkbox"
                checked={grantsHof}
                onChange={(e) => setGrantsHof(e.target.checked)}
              />
              <span>Grants Hall of Fame Eligibility</span>
            </label>
            {difficulty === 'legend' &&
              challenge.difficulty !== 'legend' &&
              grantsHof === challenge.grantsHallOfFame && (
                <p className="text-[11px] text-gray-500">
                  Promoting to Legend turns Hall of Fame eligibility on unless you change it here.
                </p>
              )}
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs border border-gray-300 rounded text-black cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold border border-black bg-black text-white rounded cursor-pointer"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ChallengeEditModal
