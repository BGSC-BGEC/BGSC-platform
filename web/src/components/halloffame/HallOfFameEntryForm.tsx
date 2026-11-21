import React, { useEffect, useMemo, useState } from 'react'
import { AlertCircle, X } from 'lucide-react'
import {
  hallOfFameService,
  isValidHofLink,
  type CreateHofEntryBody,
  type HallOfFameEntry,
  type HofCategory,
  type HofHonoreeType,
  type HofSourceType,
  type HofUserOption,
  type UpdateHofEntryBody,
} from '../../services/hallOfFameService'
import { eventService } from '../../services/eventService'
import { challengeService } from '../../services/challengeService'
import { UserSearchPicker } from './UserSearchPicker'

interface HallOfFameEntryFormProps {
  /** Present: edit that entry (PATCH with only the changed fields). Absent: create. */
  entry?: HallOfFameEntry | null
  onClose: () => void
  onSaved: (entry: HallOfFameEntry) => void
}

interface HonoreeState {
  type: HofHonoreeType
  id: string
  displayName: string
  avatarUrl: string | null
}

interface MemberState {
  userId: string
  displayName: string
  avatarUrl: string | null
}

interface SourceOption {
  id: string
  title: string
  label: string
}

const inputClass = 'w-full px-3 py-2 text-sm border border-border rounded text-foreground bg-card'
const labelClass = 'block text-xs font-bold uppercase text-foreground mb-1'

/** A user's avatar becomes the snapshot's only if the backend `Link` rule would accept it. */
const safeAvatar = (url: string | null | undefined): string | null =>
  url && isValidHofLink(url) ? url.trim() : null

const userDisplayName = (u: HofUserOption) => (u.fullName || u.username).slice(0, 120)

const parseTags = (text: string): string[] =>
  Array.from(
    new Set(
      text
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
    )
  )

const sameList = (a: string[], b: string[]) =>
  a.length === b.length && a.every((v, i) => v === b[i])

export const HallOfFameEntryForm: React.FC<HallOfFameEntryFormProps> = ({
  entry,
  onClose,
  onSaved,
}) => {
  const isEdit = Boolean(entry)

  const [category, setCategory] = useState<HofCategory>(entry?.category ?? 'event_winner')
  const [title, setTitle] = useState(entry?.title ?? '')
  const [description, setDescription] = useState(entry?.description ?? '')
  const [quote, setQuote] = useState(entry?.quote ?? '')

  const [honoree, setHonoree] = useState<HonoreeState | null>(
    entry
      ? {
          type: entry.honoree.type,
          id: entry.honoree.id,
          displayName: entry.honoree.displayName,
          avatarUrl: entry.honoree.avatarUrl,
        }
      : null
  )
  const [members, setMembers] = useState<MemberState[]>(
    entry?.members.map((m) => ({
      userId: m.userId,
      displayName: m.displayName,
      avatarUrl: m.avatarUrl,
    })) ?? []
  )

  const [sourceType, setSourceType] = useState<HofSourceType>(entry?.source.type ?? 'manual')
  const [sourceId, setSourceId] = useState<string>(entry?.source.id ?? '')
  const [sourceTitle, setSourceTitle] = useState<string>(entry?.source.title ?? '')

  const [domain, setDomain] = useState(entry?.achievement.domain ?? '')
  const [season, setSeason] = useState(entry?.achievement.season ?? '')
  const [year, setYear] = useState(String(entry?.achievement.year ?? new Date().getFullYear()))
  const [difficulty, setDifficulty] = useState(entry?.achievement.difficulty ?? '')
  const [awardPoints, setAwardPoints] = useState(
    entry?.achievement.awardPoints != null ? String(entry.achievement.awardPoints) : ''
  )

  const [mediaUrl, setMediaUrl] = useState(entry?.mediaUrl ?? '')
  const [coverUrl, setCoverUrl] = useState(entry?.coverUrl ?? '')
  const [tagsText, setTagsText] = useState((entry?.tags ?? []).join(', '))
  const [featured, setFeatured] = useState(entry ? entry.featured : true)
  const [featuredOrder, setFeaturedOrder] = useState(
    entry?.featuredOrder != null ? String(entry.featuredOrder) : ''
  )

  const [eventOptions, setEventOptions] = useState<SourceOption[] | null>(null)
  const [challengeOptions, setChallengeOptions] = useState<SourceOption[] | null>(null)
  const [isLoadingSources, setIsLoadingSources] = useState(false)
  const [sourceLoadError, setSourceLoadError] = useState<string | null>(null)

  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Source lists load on first need, once per modal.
  useEffect(() => {
    if (sourceType === 'event' && eventOptions === null) {
      setIsLoadingSources(true)
      setSourceLoadError(null)
      eventService
        .getEvents()
        .then((events) =>
          setEventOptions(
            events.map((ev) => ({
              id: ev.id,
              title: ev.title,
              label: `${ev.title}${ev.startAt ? ` (${new Date(ev.startAt).toLocaleDateString()})` : ''}`,
            }))
          )
        )
        .catch((err) => {
          setEventOptions([])
          setSourceLoadError(err instanceof Error ? err.message : 'Failed to load events')
        })
        .finally(() => setIsLoadingSources(false))
    }
    if (sourceType === 'challenge' && challengeOptions === null) {
      setIsLoadingSources(true)
      setSourceLoadError(null)
      challengeService
        .getAllChallenges()
        .then((list) =>
          setChallengeOptions(
            list.map((c) => ({ id: c.id, title: c.title, label: `${c.title} (${c.status})` }))
          )
        )
        .catch((err) => {
          setChallengeOptions([])
          setSourceLoadError(err instanceof Error ? err.message : 'Failed to load challenges')
        })
        .finally(() => setIsLoadingSources(false))
    }
  }, [sourceType, eventOptions, challengeOptions])

  const sourceOptions = useMemo(() => {
    const list = (sourceType === 'event' ? eventOptions : challengeOptions) ?? []
    // Keep the stored link selectable even if it is no longer listed (e.g. deleted since).
    if (sourceId && !list.some((o) => o.id === sourceId)) {
      return [{ id: sourceId, title: sourceTitle, label: `${sourceTitle || sourceId} (current)` }, ...list]
    }
    return list
  }, [sourceType, eventOptions, challengeOptions, sourceId, sourceTitle])

  const handleSourceTypeChange = (next: HofSourceType) => {
    setSourceType(next)
    // An id from another source type would point at the wrong collection.
    if (entry && next === entry.source.type) {
      setSourceId(entry.source.id ?? '')
      setSourceTitle(entry.source.title ?? '')
    } else {
      setSourceId('')
      setSourceTitle('')
    }
  }

  const handleSourcePick = (id: string) => {
    setSourceId(id)
    const found = sourceOptions.find((o) => o.id === id)
    setSourceTitle(found ? found.title.slice(0, 200) : '')
  }

  const handleHonoreePick = (u: HofUserOption) => {
    setHonoree({
      type: 'user',
      id: u.id,
      displayName: userDisplayName(u),
      avatarUrl: safeAvatar(u.avatarUrl),
    })
  }

  const handleMemberPick = (u: HofUserOption) => {
    setMembers((prev) =>
      prev.some((m) => m.userId === u.id)
        ? prev
        : [...prev, { userId: u.id, displayName: userDisplayName(u), avatarUrl: safeAvatar(u.avatarUrl) }]
    )
  }

  /** Client-side mirror of CreateHallOfFameEntrySchema bounds; returns an error message or null. */
  const validate = (): string | null => {
    if (!honoree || !honoree.id) return 'Pick an honoree.'
    if (!honoree.displayName.trim()) return 'Honoree display name is required.'
    if (!title.trim()) return 'Achievement title is required.'
    const y = Number(year)
    if (!Number.isInteger(y) || y < 1900 || y > 2100) return 'Year must be a whole number between 1900 and 2100.'
    if (awardPoints.trim()) {
      const p = Number(awardPoints)
      if (!Number.isInteger(p) || p < 0 || p > 1_000_000) return 'Award points must be a whole number from 0 to 1,000,000.'
    } else if (isEdit && entry?.achievement.awardPoints != null) {
      return 'Award points cannot be cleared once set (the API has no null for it). Enter a value.'
    }
    if (featuredOrder.trim()) {
      const o = Number(featuredOrder)
      if (!Number.isInteger(o) || o < 0 || o > 1000) return 'Featured order must be a whole number from 0 to 1000.'
    }
    if (sourceType !== 'manual' && !sourceId) {
      return `Pick the ${sourceType} this entry comes from, or choose Manual.`
    }
    if (mediaUrl.trim() && !isValidHofLink(mediaUrl)) return 'Media URL must be an http(s) URL or an /uploads/ path.'
    if (coverUrl.trim() && !isValidHofLink(coverUrl)) return 'Cover URL must be an http(s) URL or an /uploads/ path.'
    const tags = parseTags(tagsText)
    if (tags.length > 20) return 'At most 20 tags.'
    if (tags.some((t) => t.length > 40)) return 'Each tag must be 40 characters or fewer.'
    if (members.length > 50) return 'At most 50 members.'
    return null
  }

  const buildCreateBody = (): CreateHofEntryBody => {
    const h = honoree as HonoreeState
    const tags = parseTags(tagsText)
    const body: CreateHofEntryBody = {
      category,
      title: title.trim(),
      description: description.trim() || null,
      quote: quote.trim() || null,
      honoree: {
        type: h.type,
        id: h.id,
        display_name: h.displayName.trim(),
        avatar_url: h.avatarUrl,
      },
      source:
        sourceType === 'manual'
          ? { type: 'manual', id: null, title: sourceTitle.trim() || null }
          : { type: sourceType, id: sourceId, title: sourceTitle.trim() || null },
      achievement: { year: Number(year) },
      media_url: mediaUrl.trim() || null,
      cover_url: coverUrl.trim() || null,
      featured,
      featured_order: featuredOrder.trim() ? Number(featuredOrder) : null,
    }
    if (domain.trim()) body.achievement.domain = domain.trim()
    if (season.trim()) body.achievement.season = season.trim()
    if (difficulty.trim()) body.achievement.difficulty = difficulty.trim()
    if (awardPoints.trim()) body.achievement.award_points = Number(awardPoints)
    if (members.length > 0) {
      body.members = members.map((m) => ({
        user_id: m.userId,
        display_name: m.displayName.trim(),
        avatar_url: m.avatarUrl,
      }))
    }
    if (tags.length > 0) body.tags = tags
    return body
  }

  /** Only what changed, nested groups partial: UpdateHallOfFameEntrySchema + the service's merge. */
  const buildUpdateBody = (orig: HallOfFameEntry): UpdateHofEntryBody => {
    const h = honoree as HonoreeState
    const body: UpdateHofEntryBody = {}

    if (category !== orig.category) body.category = category
    if (title.trim() !== orig.title) body.title = title.trim()
    if (description.trim() !== orig.description) body.description = description.trim() || null
    if (quote.trim() !== orig.quote) body.quote = quote.trim() || null

    if (h.id !== orig.honoree.id || h.type !== orig.honoree.type) {
      // A different honoree: send the whole snapshot so no field of the old one survives the merge.
      body.honoree = { type: h.type, id: h.id, display_name: h.displayName.trim(), avatar_url: h.avatarUrl }
    } else if (h.displayName.trim() !== orig.honoree.displayName) {
      body.honoree = { display_name: h.displayName.trim() }
    }

    const memberKey = (list: { userId: string; displayName: string }[]) =>
      list.map((m) => `${m.userId}\u0000${m.displayName.trim()}`)
    if (!sameList(memberKey(members), memberKey(orig.members))) {
      body.members = members.map((m) => ({
        user_id: m.userId,
        display_name: m.displayName.trim(),
        avatar_url: m.avatarUrl,
      }))
    }

    const nextSourceId = sourceType === 'manual' ? null : sourceId
    const nextSourceTitle = sourceTitle.trim() || null
    if (
      sourceType !== orig.source.type ||
      nextSourceId !== orig.source.id ||
      nextSourceTitle !== orig.source.title
    ) {
      // Whole group, so a switch to manual clears the stored id instead of merging over it.
      body.source = { type: sourceType, id: nextSourceId, title: nextSourceTitle }
    }

    const ach: NonNullable<UpdateHofEntryBody['achievement']> = {}
    if (Number(year) !== orig.achievement.year) ach.year = Number(year)
    if (domain.trim() !== orig.achievement.domain) ach.domain = domain.trim()
    if (season.trim() !== orig.achievement.season) ach.season = season.trim()
    if (difficulty.trim() !== orig.achievement.difficulty) ach.difficulty = difficulty.trim()
    if (awardPoints.trim() && Number(awardPoints) !== orig.achievement.awardPoints) {
      ach.award_points = Number(awardPoints)
    }
    if (Object.keys(ach).length > 0) body.achievement = ach

    if ((mediaUrl.trim() || null) !== orig.mediaUrl) body.media_url = mediaUrl.trim() || null
    if ((coverUrl.trim() || null) !== orig.coverUrl) body.cover_url = coverUrl.trim() || null
    const tags = parseTags(tagsText)
    if (!sameList(tags, orig.tags)) body.tags = tags
    if (featured !== orig.featured) body.featured = featured
    const order = featuredOrder.trim() ? Number(featuredOrder) : null
    if (order !== orig.featuredOrder) body.featured_order = order

    return body
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const problem = validate()
    if (problem) {
      setFormError(problem)
      return
    }
    setFormError(null)

    setIsSubmitting(true)
    try {
      if (entry) {
        const body = buildUpdateBody(entry)
        if (Object.keys(body).length === 0) {
          onClose()
          return
        }
        onSaved(await hallOfFameService.updateEntry(entry.id, body))
      } else {
        onSaved(await hallOfFameService.createEntry(buildCreateBody()))
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save entry')
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
        className="bg-card rounded-lg border border-border shadow-xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
            {isEdit ? 'Edit Hall of Fame Entry' : 'Induct into Hall of Fame'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 text-xs font-bold border border-foreground/70 text-foreground hover:bg-primary hover:text-primary-foreground cursor-pointer"
          >
            X
          </button>
        </div>

        {formError && (
          <div className="p-3 border border-foreground/70 bg-card text-foreground rounded flex items-center gap-2 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          {/* Honoree */}
          <div className="space-y-2">
            <label className={labelClass}>Honoree</label>
            {honoree ? (
              <div className="p-3 border border-border rounded space-y-2">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-mono text-muted-foreground truncate">
                    {honoree.type === 'team' ? 'Team' : 'User'} &bull; {honoree.id}
                  </span>
                  <button
                    type="button"
                    onClick={() => setHonoree(null)}
                    className="px-2 py-0.5 text-xs font-bold border border-border hover:border-primary/50 rounded cursor-pointer shrink-0"
                  >
                    Change
                  </button>
                </div>
                <div>
                  <label className={labelClass}>Display Name</label>
                  <input
                    type="text"
                    required
                    maxLength={120}
                    value={honoree.displayName}
                    onChange={(e) => setHonoree({ ...honoree, displayName: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>
            ) : (
              <UserSearchPicker onSelect={handleHonoreePick} />
            )}
            {honoree?.type === 'team' && (
              <p className="text-[11px] text-muted-foreground">
                Team honorees can be kept and renamed here; picking a new honoree selects a user.
              </p>
            )}
          </div>

          <div>
            <label className={labelClass}>Achievement Title</label>
            <input
              type="text"
              required
              maxLength={200}
              placeholder="e.g. BGSC Badminton Smash S3 Champion"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as HofCategory)}
                className={inputClass}
              >
                <option value="event_winner">Event Winner</option>
                <option value="challenge_legend">Challenge Legend</option>
                <option value="sponsor_champion">Sponsor Champion</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Year</label>
              <input
                type="number"
                required
                min={1900}
                max={2100}
                step={1}
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          {/* Source */}
          <div className="space-y-2">
            <label className={labelClass}>Source</label>
            <div className="grid grid-cols-3 gap-3">
              <select
                value={sourceType}
                onChange={(e) => handleSourceTypeChange(e.target.value as HofSourceType)}
                className={inputClass}
              >
                <option value="manual">Manual</option>
                <option value="event">Event</option>
                <option value="challenge">Challenge</option>
              </select>
              {sourceType === 'manual' ? (
                <input
                  type="text"
                  maxLength={200}
                  placeholder="Source title (optional)"
                  value={sourceTitle}
                  onChange={(e) => setSourceTitle(e.target.value)}
                  className={`${inputClass} col-span-2`}
                />
              ) : (
                <select
                  value={sourceId}
                  onChange={(e) => handleSourcePick(e.target.value)}
                  disabled={isLoadingSources}
                  className={`${inputClass} col-span-2`}
                >
                  <option value="">
                    {isLoadingSources ? 'Loading...' : `-- Choose ${sourceType} --`}
                  </option>
                  {sourceOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
            {sourceLoadError && <p className="text-[11px] text-foreground">{sourceLoadError}</p>}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className={labelClass}>Domain</label>
              <input
                type="text"
                list="hof-domain-options"
                maxLength={40}
                placeholder="e.g. sports"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className={inputClass}
              />
              <datalist id="hof-domain-options">
                <option value="sports" />
                <option value="esports" />
                <option value="dev" />
                <option value="fitness" />
                <option value="general" />
              </datalist>
            </div>
            <div>
              <label className={labelClass}>Season</label>
              <input
                type="text"
                maxLength={40}
                placeholder="e.g. S3"
                value={season}
                onChange={(e) => setSeason(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Difficulty</label>
              <input
                type="text"
                list="hof-difficulty-options"
                maxLength={40}
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className={inputClass}
              />
              <datalist id="hof-difficulty-options">
                <option value="easy" />
                <option value="medium" />
                <option value="hard" />
                <option value="legend" />
              </datalist>
            </div>
            <div>
              <label className={labelClass}>Award Pts</label>
              <input
                type="number"
                min={0}
                max={1000000}
                step={1}
                value={awardPoints}
                onChange={(e) => setAwardPoints(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Description</label>
            <textarea
              rows={2}
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Story behind the championship or milestone..."
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Winner Quote (Optional)</label>
            <input
              type="text"
              maxLength={500}
              value={quote}
              onChange={(e) => setQuote(e.target.value)}
              placeholder="Memorable quote..."
              className={inputClass}
            />
          </div>

          {/* Members */}
          <div className="space-y-2">
            <label className={labelClass}>Members (Optional)</label>
            {members.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {members.map((m) => (
                  <span
                    key={m.userId}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-xs border border-border rounded"
                  >
                    {m.displayName}
                    <button
                      type="button"
                      onClick={() => setMembers((prev) => prev.filter((x) => x.userId !== m.userId))}
                      className="text-muted-foreground hover:text-foreground cursor-pointer"
                      title="Remove member"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <UserSearchPicker
              onSelect={handleMemberPick}
              placeholder="Add a member..."
              excludeIds={members.map((m) => m.userId)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Media URL</label>
              <input
                type="text"
                maxLength={2048}
                placeholder="https://... or /uploads/..."
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Cover URL</label>
              <input
                type="text"
                maxLength={2048}
                placeholder="https://... or /uploads/..."
                value={coverUrl}
                onChange={(e) => setCoverUrl(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className={labelClass}>Tags (comma separated)</label>
              <input
                type="text"
                value={tagsText}
                onChange={(e) => setTagsText(e.target.value)}
                placeholder="e.g. badminton, singles"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Featured Order</label>
              <input
                type="number"
                min={0}
                max={1000}
                step={1}
                value={featuredOrder}
                onChange={(e) => setFeaturedOrder(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs font-bold uppercase text-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={featured}
              onChange={(e) => setFeatured(e.target.checked)}
            />
            <span>Feature on Club Hall of Fame Spotlight</span>
          </label>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs border border-border rounded text-foreground cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold border border-foreground/70 bg-primary text-primary-foreground rounded cursor-pointer"
            >
              {isSubmitting
                ? isEdit
                  ? 'Saving...'
                  : 'Inducting...'
                : isEdit
                  ? 'Save Changes'
                  : 'Induct Honoree'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default HallOfFameEntryForm
