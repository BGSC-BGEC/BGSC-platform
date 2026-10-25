import React, { useState, useEffect, useCallback } from 'react'
import {
  Plus,
  Flame,
  CheckCircle,
  Archive,
  Trash2,
  ClipboardCheck,
  AlertCircle,
} from 'lucide-react'
import {
  challengeService,
  type ChallengeItem,
  type ChallengeDomain,
  type ChallengeKind,
  type ChallengeDifficulty,
  type ChallengeParticipation,
} from '../services/challengeService'

export const Challenges: React.FC = () => {
  const [challenges, setChallenges] = useState<ChallengeItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [statusFilter, setStatusFilter] = useState<string>('active')
  const [domainFilter, setDomainFilter] = useState<string>('all')

  // Create modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [domain, setDomain] = useState<ChallengeDomain>('sports')
  const [kind, setKind] = useState<ChallengeKind>('physical')
  const [difficulty, setDifficulty] = useState<ChallengeDifficulty>('medium')
  const [awardPoints, setAwardPoints] = useState<number>(200)
  const [locationName, setLocationName] = useState('Campus Ground / Sports Complex')
  const [grantsHof, setGrantsHof] = useState(false)
  const [autoApprove, setAutoApprove] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Review Queue Modal state
  const [reviewChallenge, setReviewChallenge] = useState<ChallengeItem | null>(null)
  const [participations, setParticipations] = useState<ChallengeParticipation[]>([])
  const [isLoadingQueue, setIsLoadingQueue] = useState(false)

  const fetchChallenges = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const list = await challengeService.getChallenges({
        status: statusFilter,
        domain: domainFilter,
      })
      setChallenges(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load challenges')
    } finally {
      setIsLoading(false)
    }
  }, [statusFilter, domainFilter])

  useEffect(() => {
    fetchChallenges()
  }, [fetchChallenges])

  const handleCreateChallenge = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    setIsSubmitting(true)
    setError(null)
    try {
      await challengeService.createChallenge({
        title: title.trim(),
        description: description.trim(),
        domain,
        kind,
        difficulty,
        award_points: awardPoints,
        grants_hall_of_fame: grantsHof,
        autoApprove,
        locationName: kind === 'physical' ? locationName.trim() : undefined,
      })
      setIsCreateOpen(false)
      setTitle('')
      setDescription('')
      setStatusFilter('draft')
      await fetchChallenges()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create challenge')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleTransition = async (
    id: string,
    verb: 'activate' | 'complete' | 'archive'
  ) => {
    setError(null)
    try {
      await challengeService.transitionChallenge(id, verb)
      await fetchChallenges()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : `Failed to ${verb} challenge`
      )
    }
  }

  const handleDelete = async (id: string) => {
    setError(null)
    try {
      await challengeService.deleteChallenge(id)
      setChallenges((prev) => prev.filter((c) => c.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete challenge')
    }
  }

  const handleOpenReviewQueue = async (challenge: ChallengeItem) => {
    setReviewChallenge(challenge)
    setIsLoadingQueue(true)
    try {
      const list = await challengeService.getReviewQueue(
        challenge.id,
        'under_review'
      )
      setParticipations(list)
    } finally {
      setIsLoadingQueue(false)
    }
  }

  const handleReviewDecision = async (
    participationId: string,
    decision: 'approved' | 'rejected'
  ) => {
    try {
      await challengeService.reviewParticipation(participationId, decision)
      setParticipations((prev) => prev.filter((p) => p.id !== participationId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to review submission')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold uppercase tracking-wider text-black flex items-center gap-2">
            <Flame className="w-5 h-5" />
            Challenges & Quests
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Create physical and digital club challenges, review proof submissions, and award points.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold border border-black bg-black text-white hover:bg-gray-800 rounded transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Create Challenge
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 rounded text-black bg-white focus:outline-none focus:border-black"
        >
          <option value="active">Active Challenges</option>
          <option value="draft">Drafts</option>
          <option value="completed">Completed</option>
          <option value="archived">Archived</option>
        </select>

        <select
          value={domainFilter}
          onChange={(e) => setDomainFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 rounded text-black bg-white focus:outline-none focus:border-black"
        >
          <option value="all">All Domains</option>
          <option value="sports">Sports</option>
          <option value="esports">Esports</option>
          <option value="dev">Dev</option>
          <option value="general">General</option>
        </select>
      </div>

      {error && (
        <div className="p-4 border border-black bg-white text-black rounded flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchChallenges}
            className="px-3 py-1 border border-black rounded font-bold hover:bg-black hover:text-white cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="p-8 text-center text-sm text-gray-500 border border-gray-200 rounded bg-gray-50">
          Loading challenges...
        </div>
      ) : challenges.length === 0 ? (
        <div className="p-8 text-center text-sm text-gray-500 border border-gray-200 rounded bg-white">
          No challenges found matching the selected filters.
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-xs font-bold uppercase text-gray-600">
                <th className="py-3 px-4">Challenge</th>
                <th className="py-3 px-4">Domain / Kind</th>
                <th className="py-3 px-4">Difficulty</th>
                <th className="py-3 px-4">Reward</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {challenges.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <div className="font-bold text-black">{c.title}</div>
                    <div className="text-xs text-gray-500 line-clamp-1">
                      {c.description}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-xs uppercase font-semibold text-gray-700">
                    {c.domain} &bull; {c.kind}
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase border border-black rounded">
                      {c.difficulty}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-bold text-black text-xs">
                    +{c.awardPoints} pts
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase border border-gray-300 bg-gray-100 rounded">
                      {c.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                    {c.status === 'draft' && (
                      <button
                        type="button"
                        onClick={() => handleTransition(c.id, 'activate')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold border border-black bg-black text-white rounded cursor-pointer"
                      >
                        <CheckCircle className="w-3 h-3" />
                        Activate
                      </button>
                    )}
                    {c.status === 'active' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleOpenReviewQueue(c)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold border border-black text-black bg-white hover:bg-black hover:text-white rounded cursor-pointer"
                        >
                          <ClipboardCheck className="w-3 h-3" />
                          Review Submissions
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTransition(c.id, 'complete')}
                          className="px-2.5 py-1 text-xs font-bold border border-gray-300 hover:border-black rounded cursor-pointer"
                        >
                          Complete
                        </button>
                      </>
                    )}
                    {c.status !== 'archived' && (
                      <button
                        type="button"
                        onClick={() => handleTransition(c.id, 'archive')}
                        title="Archive"
                        className="p-1.5 text-gray-600 hover:text-black border border-gray-200 rounded cursor-pointer"
                      >
                        <Archive className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(c.id)}
                      title="Delete"
                      className="p-1.5 text-red-600 hover:bg-red-50 border border-gray-200 rounded cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Challenge Modal */}
      {isCreateOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setIsCreateOpen(false)}
        >
          <div
            className="bg-white rounded-lg border border-gray-200 shadow-xl max-w-lg w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-black">
                Create New Challenge
              </h2>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="px-2 py-1 text-xs font-bold border border-black text-black hover:bg-black hover:text-white cursor-pointer"
              >
                X
              </button>
            </div>

            <form onSubmit={handleCreateChallenge} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-bold uppercase text-black mb-1">
                  Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 100km Monthly Running Streak"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded text-black bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-black mb-1">
                  Description & Proof Requirements
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Describe how members complete the challenge and what proof to submit..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded text-black bg-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-black mb-1">
                    Domain
                  </label>
                  <select
                    value={domain}
                    onChange={(e) => setDomain(e.target.value as ChallengeDomain)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded text-black bg-white"
                  >
                    <option value="sports">Sports</option>
                    <option value="esports">Esports</option>
                    <option value="dev">Dev</option>
                    <option value="general">General</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-black mb-1">
                    Kind
                  </label>
                  <select
                    value={kind}
                    onChange={(e) => setKind(e.target.value as ChallengeKind)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded text-black bg-white"
                  >
                    <option value="physical">Physical</option>
                    <option value="digital">Digital</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-black mb-1">
                    Difficulty
                  </label>
                  <select
                    value={difficulty}
                    onChange={(e) =>
                      setDifficulty(e.target.value as ChallengeDifficulty)
                    }
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded text-black bg-white"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                    <option value="legend">Legend</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-black mb-1">
                  Award Points
                </label>
                <input
                  type="number"
                  min={10}
                  step={10}
                  value={awardPoints}
                  onChange={(e) => setAwardPoints(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded text-black bg-white"
                />
              </div>

              {kind === 'physical' && (
                <div>
                  <label className="block text-xs font-bold uppercase text-black mb-1">
                    Physical Location
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Indoor Badminton Arena or Main Sports Track"
                    value={locationName}
                    onChange={(e) => setLocationName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded text-black bg-white"
                  />
                </div>
              )}

              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-2 text-xs font-bold uppercase text-black cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoApprove}
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
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 text-xs border border-gray-300 rounded text-black cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-bold border border-black bg-black text-white rounded cursor-pointer"
                >
                  {isSubmitting ? 'Creating...' : 'Create Challenge'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review Submissions Modal */}
      {reviewChallenge && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setReviewChallenge(null)}
        >
          <div
            className="bg-white rounded-lg border border-gray-200 shadow-xl max-w-2xl w-full p-6 space-y-4 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-black">
                  Submission Review Queue — {reviewChallenge.title}
                </h2>
                <p className="text-xs text-gray-500">
                  Approving a submission automatically credits +{reviewChallenge.awardPoints} points.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReviewChallenge(null)}
                className="px-2 py-1 text-xs font-bold border border-black text-black hover:bg-black hover:text-white cursor-pointer"
              >
                X
              </button>
            </div>

            {isLoadingQueue ? (
              <div className="p-6 text-center text-xs text-gray-500">
                Loading pending submissions...
              </div>
            ) : participations.length === 0 ? (
              <div className="p-6 text-center text-xs text-gray-500 border border-gray-200 rounded">
                No pending submissions awaiting review for this challenge.
              </div>
            ) : (
              <div className="divide-y divide-gray-200 border border-gray-200 rounded">
                {participations.map((p) => (
                  <div
                    key={p.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1 text-left">
                      <div className="font-bold text-black">
                        {p.displayName}{' '}
                        <span className="text-gray-500 font-normal">@{p.username}</span>
                      </div>
                      {p.proofText && (
                        <p className="text-gray-700">{p.proofText}</p>
                      )}
                      {p.proofUrl && (
                        <a
                          href={p.proofUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-black underline font-semibold block"
                        >
                          View Proof Link
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleReviewDecision(p.id, 'approved')}
                        className="px-3 py-1.5 text-xs font-bold border border-black bg-black text-white rounded cursor-pointer"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReviewDecision(p.id, 'rejected')}
                        className="px-3 py-1.5 text-xs font-bold border border-red-600 text-red-600 hover:bg-red-600 hover:text-white rounded cursor-pointer"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Challenges
