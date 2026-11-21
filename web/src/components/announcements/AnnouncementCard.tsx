import React from 'react'
import { Pin, Trash2, Send } from 'lucide-react'
import type { Announcement, AudienceRole } from '../../types/announcement'
import { DeliveryStatusSummary } from './DeliveryStatusSummary'

export interface AnnouncementCardProps {
  announcement: Announcement
  /** Omitted when the viewer may not delete (useCan('announcements.delete')). */
  onDelete?: (id: string) => void
  onPublish?: (id: string) => void
  onUnschedule?: (id: string) => void
  /** Title of `audience.eventId`, when the page could resolve it. */
  eventTitle?: string
}

const ROLE_LABELS: Record<AudienceRole, string> = {
  guest: 'Everyone',
  user: 'Signed-in users',
  member: 'Members+',
  core: 'Core+',
  coordinator: 'Coordinators+',
  founder: 'Founders only',
}

function formatDisplayDateTime(dateStr?: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const CATEGORY_LABELS: Record<string, string> = {
  bgec: 'BGEC',
  fitsoc: 'FITSOC',
  airball: 'AIRBALL',
  offside: 'OFFSIDE',
  powerplay: 'POWERPLAY',
  around_the_net: 'AROUND THE NET',
  deuce: 'DEUCE',
  highlight: 'HIGHLIGHT',
  teams: 'TEAMS',
}

function formatDisplayDate(dateStr?: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export const AnnouncementCard: React.FC<AnnouncementCardProps> = ({
  announcement,
  onDelete,
  onPublish,
  onUnschedule,
  eventTitle,
}) => {
  const audience = announcement.audience
  const hasAudienceRule = !!audience && (audience.minRole !== 'guest' || !!audience.eventId)
  const isBroadcast = announcement.status === 'published' || announcement.status === 'archived'
  const isUrgent = announcement.priority === 'urgent'
  const isImportant = announcement.priority === 'important'

  return (
    <div
      className={`rounded-xl border bg-card text-card-foreground shadow-xs p-5 space-y-4 transition-all duration-200 dark:bg-transparent ${
        announcement.isPinned
          ? 'border-orange-500/50 ring-1 ring-orange-500/20'
          : 'border-border hover:border-border/80'
      }`}
    >
      {/* Card Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
        {/* Category Badges */}
        <div className="flex flex-wrap items-center gap-1.5">
          {announcement.categories.map((cat) => (
            <span
              key={cat}
              className="text-[10px] font-mono font-semibold uppercase tracking-wider px-2 py-0.5 rounded border border-border bg-muted/40 text-foreground"
            >
              {CATEGORY_LABELS[cat] || cat.toUpperCase()}
            </span>
          ))}
        </div>

        {/* Priority & Status & Pin Indicators */}
        <div className="flex items-center gap-2">
          {/* Priority Indicator */}
          {isUrgent && (
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-rose-500/10 text-rose-500 border border-rose-500/25">
              Urgent
            </span>
          )}
          {isImportant && (
            <span className="text-[10px] font-mono font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-orange-500/10 text-orange-500 border border-orange-500/25">
              Important
            </span>
          )}
          {!isUrgent && !isImportant && (
            <span className="text-[10px] font-mono font-medium uppercase tracking-wider px-2 py-0.5 rounded border border-border text-muted-foreground bg-muted/20">
              Normal
            </span>
          )}

          {/* Pin Indicator */}
          {announcement.isPinned && (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-muted text-foreground border border-border">
              <Pin className="w-3 h-3 fill-current text-orange-500" />
              Pinned
            </span>
          )}

          {/* Status Pill */}
          <span
            className={`text-[10px] font-mono font-semibold uppercase tracking-wider px-2 py-0.5 rounded border ${
              announcement.status === 'published'
                ? 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
                : announcement.status === 'draft'
                ? 'border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10'
                : announcement.status === 'scheduled'
                ? 'border-blue-500/30 text-blue-600 dark:text-blue-400 bg-blue-500/10'
                : 'border-border text-muted-foreground bg-muted/20'
            }`}
          >
            {announcement.status}
          </span>
        </div>
      </div>

      {/* Card Body */}
      <div className="space-y-2">
        <h3 className="text-base font-bold text-foreground leading-snug tracking-tight">
          {announcement.title}
        </h3>
        <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
          {announcement.body}
        </p>

        {/* Audience & pin window */}
        {(hasAudienceRule || announcement.pinnedUntil) && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-xs text-muted-foreground">
            {audience && hasAudienceRule && (
              <span>
                <span className="font-semibold text-foreground">Audience:</span>{' '}
                {ROLE_LABELS[audience.minRole] || audience.minRole}
                {audience.eventId && (
                  <> · participants of {eventTitle ? `"${eventTitle}"` : `event ${audience.eventId}`}</>
                )}
              </span>
            )}
            {announcement.pinnedUntil && (
              <span>
                <span className="font-semibold text-foreground">Pinned until:</span>{' '}
                {formatDisplayDateTime(announcement.pinnedUntil)}
              </span>
            )}
          </div>
        )}

        {/* Tags */}
        {announcement.tags && announcement.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {announcement.tags.map((tag) => (
              <span
                key={tag}
                className="text-[11px] font-mono text-muted-foreground bg-muted/30 border border-border px-2 py-0.5 rounded"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Delivery (read-only, composer view) */}
      {isBroadcast && announcement.delivery !== undefined && (
        <div className="pt-3 border-t border-border">
          <DeliveryStatusSummary delivery={announcement.delivery} />
        </div>
      )}

      {/* Card Footer */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-border">
        <div className="text-xs text-muted-foreground">
          {announcement.status === 'published' && announcement.publishedAt && (
            <span>Published on {formatDisplayDate(announcement.publishedAt)}</span>
          )}
          {announcement.status === 'scheduled' && announcement.scheduledFor && (
            <span>Scheduled for {formatDisplayDateTime(announcement.scheduledFor)}</span>
          )}
          {announcement.status === 'draft' && (
            <span>Draft created on {formatDisplayDate(announcement.createdAt)}</span>
          )}
          {announcement.status === 'archived' && (
            <span>
              Archived on{' '}
              {formatDisplayDate(
                announcement.publishedAt || announcement.createdAt
              )}
            </span>
          )}
          {announcement.authorName && (
            <span className="opacity-80"> by {announcement.authorName}</span>
          )}
        </div>

        {/* Admin Action Buttons */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {announcement.status === 'draft' && onPublish && (
            <button
              type="button"
              onClick={() => onPublish(announcement.id)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-orange-500 hover:bg-orange-600 text-white transition-colors cursor-pointer"
            >
              <Send className="w-3 h-3" />
              <span>Publish</span>
            </button>
          )}
          {announcement.status === 'scheduled' && onUnschedule && (
            <button
              type="button"
              onClick={() => onUnschedule(announcement.id)}
              className="px-3 py-1.5 text-xs font-semibold border border-border text-foreground bg-card hover:bg-muted rounded-lg transition-colors cursor-pointer"
            >
              Unschedule
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(announcement.id)}
              aria-label="Delete announcement"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-rose-500 rounded-lg border border-border hover:border-rose-500/30 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Delete</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default AnnouncementCard
