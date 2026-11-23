import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Plus, Search, Megaphone, AlertCircle } from 'lucide-react'
import type { Announcement } from '../types/announcement'
import { announcementService } from '../services/announcementService'
import { eventService } from '../services/eventService'
import { rankOf, useCan } from '../services/permissions'
import { useAuthStore } from '../stores/authStore'
import { AnnouncementCard } from '../components/announcements/AnnouncementCard'
import { AnnouncementHistory } from '../components/announcements/AnnouncementHistory'
import { CreateAnnouncementModal } from '../components/announcements/CreateAnnouncementModal'
import { describeAnnouncementError } from '../components/announcements/announcementErrors'
import { PageError } from '../components/ui/page-error'

type View = 'feed' | 'history'

export const Announcements: React.FC = () => {
  const canDelete = useCan('announcements.delete')
  // GET /announcements/stats is coordinator+ (same floor as delete). permissions.ts has no key for
  // it yet, so the rank is compared directly.
  const role = useAuthStore((s) => s.user?.role)
  const canViewHistory = rankOf(role) >= rankOf('coordinator')

  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [eventTitles, setEventTitles] = useState<Record<string, string>>({})

  const [view, setView] = useState<View>('feed')
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  useEffect(() => {
    let ignore = false

    announcementService
      .getAnnouncements()
      .then((data) => {
        if (!ignore) {
          setAnnouncements(data)
          setIsLoading(false)
        }
      })
      .catch((err) => {
        if (!ignore) {
          setError(
            err instanceof Error ? err.message : 'Failed to load announcements'
          )
          setIsLoading(false)
        }
      })

    // Titles for event-scoped audiences. Best effort: without them the id is shown.
    eventService.getEvents().then((events) => {
      if (ignore) return
      const map: Record<string, string> = {}
      events.forEach((ev) => {
        map[ev.id] = ev.title
      })
      setEventTitles(map)
    })

    return () => {
      ignore = true
    }
  }, [])

  const handleRetry = () => {
    setIsLoading(true)
    setError(null)
    announcementService
      .getAnnouncements()
      .then((data) => setAnnouncements(data))
      .catch((err) =>
        setError(
          err instanceof Error ? err.message : 'Failed to load announcements'
        )
      )
      .finally(() => setIsLoading(false))
  }

  const replaceOne = useCallback((updated: Announcement) => {
    setAnnouncements((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
  }, [])

  const handleCreate = (newAnnouncement: Announcement, warning?: string) => {
    setAnnouncements((prev) => [newAnnouncement, ...prev])
    setActionMessage(warning ?? null)
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this broadcast?')) return
    setActionMessage(null)
    try {
      await announcementService.deleteAnnouncement(id)
      setAnnouncements((prev) => prev.filter((a) => a.id !== id))
    } catch (err) {
      setActionMessage(`Delete failed: ${describeAnnouncementError(err, 'unknown error')}`)
    }
  }

  const handlePublish = async (id: string) => {
    setActionMessage(null)
    try {
      replaceOne(await announcementService.publishAnnouncement(id))
    } catch (err) {
      setActionMessage(`Publish failed: ${describeAnnouncementError(err, 'unknown error')}`)
    }
  }

  const handleUnschedule = async (id: string) => {
    if (!window.confirm('Cancel the schedule? The announcement returns to draft.')) return
    setActionMessage(null)
    try {
      replaceOne(await announcementService.unscheduleAnnouncement(id))
    } catch (err) {
      setActionMessage(`Unschedule failed: ${describeAnnouncementError(err, 'unknown error')}`)
    }
  }

  const filteredAnnouncements = useMemo(() => {
    return announcements
      .filter((a) => {
        const term = searchTerm.toLowerCase().trim()
        const matchesSearch =
          term === '' ||
          a.title.toLowerCase().includes(term) ||
          a.body.toLowerCase().includes(term) ||
          (a.tags && a.tags.some((t) => t.toLowerCase().includes(term)))

        const matchesCategory =
          categoryFilter === 'all' ||
          a.categories.some(
            (c) => c.toLowerCase() === categoryFilter.toLowerCase()
          )

        const matchesPriority =
          priorityFilter === 'all' ||
          a.priority.toLowerCase() === priorityFilter.toLowerCase()

        const matchesStatus =
          statusFilter === 'all' ||
          a.status.toLowerCase() === statusFilter.toLowerCase()

        return matchesSearch && matchesCategory && matchesPriority && matchesStatus
      })
      .sort((a, b) => {
        // Pinned items float to top
        if (a.isPinned !== b.isPinned) {
          return a.isPinned ? -1 : 1
        }
        // Then sort by newest createdAt date
        const timeA = new Date(a.createdAt).getTime()
        const timeB = new Date(b.createdAt).getTime()
        return timeB - timeA
      })
  }, [announcements, searchTerm, categoryFilter, priorityFilter, statusFilter])

  const handleReset = () => {
    setSearchTerm('')
    setCategoryFilter('all')
    setPriorityFilter('all')
    setStatusFilter('all')
  }

  const activeView: View = canViewHistory ? view : 'feed'

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-xl font-bold uppercase tracking-wider text-foreground">
            Announcements & Broadcasts
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Publish and manage campus sports bulletins, weather updates, and esports notifications.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsCreateModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-orange-500 hover:bg-orange-600 text-primary-foreground transition-colors self-start sm:self-auto cursor-pointer shadow-xs"
        >
          <Plus className="w-4 h-4" />
          Create Broadcast
        </button>
      </div>

      {/* View switch (History is coordinator+) */}
      {canViewHistory && (
        <div className="flex border-b border-border gap-2">
          {(['feed', 'history'] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`px-4 py-2 text-xs font-bold uppercase border-b-2 transition-colors cursor-pointer ${
                activeView === v
                  ? 'border-foreground/70 text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {v === 'feed' ? 'All Announcements' : 'Broadcast History'}
            </button>
          ))}
        </div>
      )}

      {/* Action result (publish / schedule / delete failures) */}
      {actionMessage && (
        <div className="p-4 border border-foreground/70 text-foreground bg-card rounded flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
            <span className="text-sm">{actionMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionMessage(null)}
            className="px-3 py-1 text-xs border border-foreground/70 hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Toolbar / Filters */}
      {activeView === 'feed' && (
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-55">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search title, content, or #tag..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg text-foreground bg-background focus:outline-none focus:ring-1 focus:ring-orange-500 transition-colors"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-border rounded-lg text-foreground bg-background focus:outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer"
        >
          <option value="all">All Categories</option>
          <option value="bgec">BGEC (Esports)</option>
          <option value="fitsoc">FitSoc (Athletics)</option>
          <option value="airball">Airball (Basketball)</option>
          <option value="offside">Offside (Football)</option>
          <option value="powerplay">Powerplay (Cricket)</option>
          <option value="around_the_net">Around The Net (Volleyball)</option>
          <option value="deuce">Deuce (Badminton / Tennis)</option>
          <option value="highlight">Highlight</option>
          <option value="teams">Teams (Internal Core)</option>
        </select>

        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-border rounded-lg text-foreground bg-background focus:outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer"
        >
          <option value="all">All Priorities</option>
          <option value="urgent">Urgent</option>
          <option value="important">Important</option>
          <option value="normal">Normal</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-border rounded-lg text-foreground bg-background focus:outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer"
        >
          <option value="all">All Statuses</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="scheduled">Scheduled</option>
          <option value="archived">Archived</option>
        </select>

        <button
          type="button"
          onClick={handleReset}
          className="px-4 py-2 text-sm border border-border text-muted-foreground hover:text-foreground bg-muted/30 hover:bg-muted/50 rounded-lg transition-colors cursor-pointer"
        >
          Reset
        </button>
      </div>
      )}

      {/* Feed Area */}
      {isLoading && (
        <div className="p-8 text-center text-sm text-muted-foreground border border-border rounded-xl bg-card dark:bg-transparent">
          Loading announcements feed...
        </div>
      )}

      {!isLoading && error && <PageError message={error} onRetry={handleRetry} />}

      {!isLoading && !error && activeView === 'history' && (
        <AnnouncementHistory announcements={announcements} eventTitles={eventTitles} />
      )}

      {!isLoading && !error && activeView === 'feed' && filteredAnnouncements.length === 0 && (
        <div className="p-12 text-center border border-dashed border-border rounded-xl bg-card dark:bg-transparent space-y-2">
          <Megaphone className="w-8 h-8 text-muted-foreground/60 mx-auto" />
          <h3 className="text-base font-semibold text-foreground">No announcements currently</h3>
          <p className="text-sm text-muted-foreground">
            No broadcasts found matching your criteria. Broadcast a new announcement to notify the community.
          </p>
        </div>
      )}

      {!isLoading && !error && activeView === 'feed' && filteredAnnouncements.length > 0 && (
        <div className="space-y-4">
          {filteredAnnouncements.map((announcement) => (
            <AnnouncementCard
              key={announcement.id}
              announcement={announcement}
              onDelete={canDelete ? handleDelete : undefined}
              onPublish={handlePublish}
              onUnschedule={handleUnschedule}
              eventTitle={
                announcement.audience?.eventId
                  ? eventTitles[announcement.audience.eventId]
                  : undefined
              }
            />
          ))}
        </div>
      )}

      {/* Create Modal */}
      <CreateAnnouncementModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={handleCreate}
      />
    </div>
  )
}

export default Announcements
