import React, { useEffect, useMemo, useState } from 'react'
import { AlertCircle } from 'lucide-react'
import type { Announcement, AnnouncementStats } from '../../types/announcement'
import { announcementService } from '../../services/announcementService'
import { DeliveryStatusSummary } from './DeliveryStatusSummary'
import { describeAnnouncementError } from './announcementErrors'

export interface AnnouncementHistoryProps {
  /** Every announcement the page loaded; only published/archived ones are listed. */
  announcements: Announcement[]
  eventTitles: Record<string, string>
}

const ROLE_LABELS: Record<string, string> = {
  guest: 'Everyone',
  user: 'Signed-in users',
  member: 'Members+',
  core: 'Core+',
  coordinator: 'Coordinators+',
  founder: 'Founders only',
}

function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return '—'
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

/**
 * Broadcast history: published (and archived) announcements with reach, reads, read rate and
 * delivery. Stats come from GET /announcements/stats (coordinator+).
 */
export const AnnouncementHistory: React.FC<AnnouncementHistoryProps> = ({
  announcements,
  eventTitles,
}) => {
  const broadcasts = useMemo(
    () =>
      announcements
        .filter((a) => a.status === 'published' || a.status === 'archived')
        .sort(
          (a, b) =>
            new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime()
        ),
    [announcements]
  )
  const idsKey = broadcasts.map((a) => a.id).join(',')

  const [stats, setStats] = useState<Record<string, AnnouncementStats>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    const ids = idsKey ? idsKey.split(',') : []
    if (ids.length === 0) return
    let ignore = false
    setIsLoading(true)
    setError(null)
    announcementService
      .getAnnouncementStats(ids)
      .then((list) => {
        if (ignore) return
        const byId: Record<string, AnnouncementStats> = {}
        list.forEach((s) => {
          byId[s.announcementId] = s
        })
        setStats(byId)
      })
      .catch((err) => {
        if (!ignore) setError(describeAnnouncementError(err, 'Failed to load read statistics'))
      })
      .finally(() => {
        if (!ignore) setIsLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [idsKey, reloadToken])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground max-w-2xl">
          <span className="font-semibold text-foreground">Reach</span> is the number of active accounts
          that can see the announcement today (minimum role and event participation applied).{' '}
          <span className="font-semibold text-foreground">Reads</span> counts those who opened the
          Announcements tab after it was published, or opened the card itself — so it measures
          "seen in the feed", not only full opens.
        </p>
        <button
          type="button"
          onClick={() => setReloadToken((t) => t + 1)}
          disabled={isLoading || broadcasts.length === 0}
          className="px-4 py-2 text-sm border border-foreground/70 text-foreground bg-card hover:bg-primary hover:text-primary-foreground rounded transition-colors cursor-pointer disabled:opacity-50"
        >
          {isLoading ? 'Loading...' : 'Refresh Stats'}
        </button>
      </div>

      {error && (
        <div className="p-4 border border-foreground/70 text-foreground bg-card rounded flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-destructive" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      <div className="overflow-x-auto rounded border border-border bg-card">
        <table className="w-full text-left text-sm text-foreground border-collapse">
          <thead className="border-b border-border bg-muted/30 text-xs font-bold uppercase text-muted-foreground tracking-wider">
            <tr>
              <th className="p-4">Broadcast</th>
              <th className="p-4">Audience</th>
              <th className="p-4 text-right">Reach</th>
              <th className="p-4 text-right">Reads</th>
              <th className="p-4 text-right">Read Rate</th>
              <th className="p-4">Delivery</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {broadcasts.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-12 text-center">
                  <div className="text-base font-bold text-foreground">No broadcasts yet</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Published announcements will appear here with their read statistics.
                  </div>
                </td>
              </tr>
            ) : (
              broadcasts.map((a) => {
                const s = stats[a.id]
                const audience = a.audience
                return (
                  <tr key={a.id} className="hover:bg-muted/30 transition-colors align-top">
                    <td className="p-4">
                      <div className="font-bold text-foreground">{a.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {formatDateTime(a.publishedAt)}
                        {a.status === 'archived' && ' · archived'}
                        {a.authorName && ` · ${a.authorName}`}
                      </div>
                    </td>
                    <td className="p-4 text-xs text-foreground">
                      {audience ? ROLE_LABELS[audience.minRole] || audience.minRole : 'Everyone'}
                      {audience?.eventId && (
                        <div className="text-muted-foreground mt-0.5">
                          Participants of{' '}
                          {eventTitles[audience.eventId]
                            ? `"${eventTitles[audience.eventId]}"`
                            : `event ${audience.eventId}`}
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-right tabular-nums">
                      {s ? s.eligible : isLoading ? '…' : '—'}
                    </td>
                    <td className="p-4 text-right tabular-nums">
                      {s ? s.read : isLoading ? '…' : '—'}
                    </td>
                    <td className="p-4 text-right tabular-nums font-semibold">
                      {s
                        ? s.readRate === null
                          ? '—'
                          : `${(s.readRate * 100).toFixed(1)}%`
                        : isLoading
                        ? '…'
                        : '—'}
                    </td>
                    <td className="p-4 min-w-60">
                      <DeliveryStatusSummary delivery={a.delivery} compact />
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default AnnouncementHistory
