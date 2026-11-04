import React, { useState, useEffect, useCallback } from 'react'
import { Modal } from '../components/ui/modal'
import {
  Plus,
  Flame,
  CheckCircle,
  Archive,
  Trash2,
  ClipboardCheck,
  AlertCircle,
  X,
  Sparkles,
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-xl font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-500" />
            Challenges & Quests
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create physical and digital club challenges, review proof submissions, and award points.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold bg-primary text-primary-foreground hover:opacity-90 rounded-lg transition-colors cursor-pointer self-start sm:self-auto shadow-sm"
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
          className="px-3 py-2 text-sm border border-border rounded-lg text-foreground bg-card focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
        >
          <option value="active">Active Challenges</option>
          <option value="draft">Drafts</option>
          <option value="completed">Completed</option>
          <option value="archived">Archived</option>
        </select>

        <select
          value={domainFilter}
          onChange={(e) => setDomainFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-border rounded-lg text-foreground bg-card focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
        >
          <option value="all">All Domains</option>
          <option value="sports">Sports</option>
          <option value="esports">Esports</option>
          <option value="dev">Dev</option>
          <option value="general">General</option>
        </select>
      </div>

      {error && (
        <div className="p-4 border border-destructive/40 bg-destructive/10 text-foreground rounded-xl flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-destructive" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchChallenges}
            className="px-3 py-1 border border-border rounded-lg font-bold hover:bg-muted cursor-pointer transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="p-12 text-center text-sm text-muted-foreground border border-border rounded-2xl bg-card">
          Loading challenges...
        </div>
      ) : challenges.length === 0 ? (
        <div className="p-12 text-center text-sm text-muted-foreground border border-border rounded-2xl bg-card">
          No challenges found matching the selected filters.
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="py-3 px-4">Challenge</th>
                  <th className="py-3 px-4">Domain / Kind</th>
                  <th className="py-3 px-4">Difficulty</th>
                  <th className="py-3 px-4">Reward</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {challenges.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-foreground">{c.title}</div>
                      <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                        {c.description}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs uppercase font-medium text-muted-foreground">
                      {c.domain} &bull; {c.kind}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 text-[10px] font-bold uppercase border border-border bg-muted/60 text-foreground rounded-md tracking-wider">
                        {c.difficulty}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-primary text-xs">
                      +{c.awardPoints} pts
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 text-[10px] font-bold uppercase border border-border/80 bg-muted/50 text-foreground rounded-md tracking-wider">
                        {c.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                      {c.status === 'draft' && (
                        <button
                          type="button"
                          onClick={() => handleTransition(c.id, 'activate')}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-primary text-primary-foreground hover:opacity-90 rounded-lg cursor-pointer transition-colors shadow-xs"
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
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold border border-border bg-card hover:bg-muted text-foreground rounded-lg cursor-pointer transition-colors"
                          >
                            <ClipboardCheck className="w-3 h-3 text-primary" />
                            Review
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTransition(c.id, 'complete')}
                            className="px-2.5 py-1 text-xs font-semibold border border-border hover:border-primary/50 text-foreground rounded-lg cursor-pointer transition-colors"
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
                          className="p-1.5 text-muted-foreground hover:text-foreground border border-border hover:bg-muted rounded-lg cursor-pointer transition-colors"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDelete(c.id)}
                        title="Delete"
                        className="p-1.5 text-destructive hover:bg-destructive/10 border border-border hover:border-destructive/30 rounded-lg cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Challenge Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} className="max-w-lg p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
              Create New Challenge
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setIsCreateOpen(false)}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleCreateChallenge} className="space-y-4 text-left">
          <div>
            <label className="block text-xs font-bold uppercase text-foreground mb-1">
              Title
            </label>
            <input
              type="text"
              required
              placeholder="e.g. 100km Monthly Running Streak"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg text-foreground bg-card placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-foreground mb-1">
              Description & Proof Requirements
            </label>
            <textarea
              rows={3}
              required
              placeholder="Describe how members complete the challenge and what proof to submit..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg text-foreground bg-card placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase text-foreground mb-1">
                Domain
              </label>
              <select
                value={domain}
                onChange={(e) => setDomain(e.target.value as ChallengeDomain)}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg text-foreground bg-card focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
              >
                <option value="sports">Sports</option>
                <option value="esports">Esports</option>
                <option value="dev">Dev</option>
                <option value="general">General</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-foreground mb-1">
                Kind
              </label>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as ChallengeKind)}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg text-foreground bg-card focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
              >
                <option value="physical">Physical</option>
                <option value="digital">Digital</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-foreground mb-1">
                Difficulty
              </label>
              <select
                value={difficulty}
                onChange={(e) =>
                  setDifficulty(e.target.value as ChallengeDifficulty)
                }
                className="w-full px-3 py-2 text-sm border border-border rounded-lg text-foreground bg-card focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
                <option value="legend">Legend</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-foreground mb-1">
              Award Points
            </label>
            <input
              type="number"
              min={10}
              step={10}
              value={awardPoints}
              onChange={(e) => setAwardPoints(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg text-foreground bg-card focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
            />
          </div>

          {kind === 'physical' && (
            <div>
              <label className="block text-xs font-bold uppercase text-foreground mb-1">
                Physical Location
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Indoor Badminton Arena or Main Sports Track"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg text-foreground bg-card placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
              />
            </div>
          )}

          <div className="space-y-2 pt-1">
            <label className="flex items-center gap-2 text-xs font-semibold text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={autoApprove}
                onChange={(e) => setAutoApprove(e.target.checked)}
                className="rounded border-border text-primary focus:ring-primary"
              />
              <span>Auto-Approve Submissions (Instant Points)</span>
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={grantsHof}
                onChange={(e) => setGrantsHof(e.target.checked)}
                className="rounded border-border text-primary focus:ring-primary"
              />
              <span>Grants Hall of Fame Eligibility</span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-2 text-xs font-semibold border border-border rounded-lg text-foreground hover:bg-muted cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold bg-primary text-primary-foreground hover:opacity-90 rounded-lg cursor-pointer transition-colors shadow-xs disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Create Challenge'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Review Submissions Modal */}
      <Modal isOpen={!!reviewChallenge} onClose={() => setReviewChallenge(null)} className="max-w-2xl p-6 space-y-4">
        {reviewChallenge && (
          <>
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
                  Submission Review Queue — {reviewChallenge.title}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Approving a submission automatically credits +{reviewChallenge.awardPoints} points.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReviewChallenge(null)}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isLoadingQueue ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                Loading pending submissions...
              </div>
            ) : participations.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground border border-border rounded-xl bg-card">
                No pending submissions awaiting review for this challenge.
              </div>
            ) : (
              <div className="divide-y divide-border border border-border rounded-xl overflow-hidden bg-card">
                {participations.map((p) => (
                  <div
                    key={p.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:bg-muted/30 transition-colors"
                  >
                    <div className="space-y-1 text-left">
                      <div className="font-bold text-foreground">
                        {p.displayName}{' '}
                        <span className="text-muted-foreground font-normal">@{p.username}</span>
                      </div>
                      {p.proofText && (
                        <p className="text-muted-foreground leading-relaxed">{p.proofText}</p>
                      )}
                      {p.proofUrl && (
                        <a
                          href={p.proofUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline font-semibold block"
                        >
                          View Proof Link
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleReviewDecision(p.id, 'approved')}
                        className="px-3 py-1.5 text-xs font-bold bg-primary text-primary-foreground hover:opacity-90 rounded-lg cursor-pointer transition-colors shadow-xs"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReviewDecision(p.id, 'rejected')}
                        className="px-3 py-1.5 text-xs font-bold border border-destructive/40 text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer transition-colors"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </Modal>
    </div>
  )
}

export default Challenges
