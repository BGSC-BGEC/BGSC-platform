import React, { useState, useEffect, useMemo } from 'react'
import { Plus, Search, Megaphone, AlertCircle } from 'lucide-react'
import type { Announcement } from '../types/announcement'
import { announcementService } from '../services/announcementService'
import { AnnouncementCard } from '../components/announcements/AnnouncementCard'
import { CreateAnnouncementModal } from '../components/announcements/CreateAnnouncementModal'

export const Announcements: React.FC = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  const handleCreate = (newAnnouncement: Announcement) => {
    setAnnouncements((prev) => [newAnnouncement, ...prev])
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this broadcast?')) return

    const success = await announcementService.deleteAnnouncement(id)
    if (success) {
      setAnnouncements((prev) => prev.filter((a) => a.id !== id))
    }
  }

  const handlePublish = async (id: string) => {
    const updated = await announcementService.publishAnnouncement(id)
    if (updated) {
      setAnnouncements((prev) =>
        prev.map((a) => (a.id === id ? updated : a))
      )
    } else {
      setAnnouncements((prev) =>
        prev.map((a) =>
          a.id === id
            ? {
                ...a,
                status: 'published',
                publishedAt: new Date().toISOString(),
              }
            : a
        )
      )
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

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold uppercase tracking-wider text-black">
            Announcements & Broadcasts
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Publish and manage campus sports bulletins, weather updates, and esports notifications.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsCreateModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold border border-black bg-black text-white hover:bg-gray-800 rounded transition-colors self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Create Broadcast
        </button>
      </div>

      {/* Toolbar / Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-55">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search title, content, or #tag..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded text-black bg-white focus:outline-none focus:border-black"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 rounded text-black bg-white focus:outline-none focus:border-black"
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
          className="px-3 py-2 text-sm border border-gray-300 rounded text-black bg-white focus:outline-none focus:border-black"
        >
          <option value="all">All Priorities</option>
          <option value="urgent">Urgent</option>
          <option value="important">Important</option>
          <option value="normal">Normal</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 rounded text-black bg-white focus:outline-none focus:border-black"
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
          className="px-4 py-2 text-sm border border-black text-black bg-white hover:bg-black hover:text-white rounded transition-colors cursor-pointer"
        >
          Reset
        </button>
      </div>

      {/* Feed Area */}
      {isLoading && (
        <div className="p-8 text-center text-sm text-gray-500 border border-gray-200 rounded bg-gray-50">
          Loading announcements feed...
        </div>
      )}

      {!isLoading && error && (
        <div className="p-4 border border-black text-black bg-white rounded flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span className="text-sm">{error}</span>
          </div>
          <button
            type="button"
            onClick={handleRetry}
            className="px-3 py-1 text-xs border border-black hover:bg-black hover:text-white transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {!isLoading && !error && filteredAnnouncements.length === 0 && (
        <div className="p-12 text-center border border-gray-200 rounded bg-white space-y-2">
          <Megaphone className="w-8 h-8 text-gray-400 mx-auto" />
          <h3 className="text-base font-bold text-black">No announcements currently</h3>
          <p className="text-sm text-gray-500">
            No broadcasts found matching your criteria. Broadcast a new announcement to notify the community.
          </p>
        </div>
      )}

      {!isLoading && !error && filteredAnnouncements.length > 0 && (
        <div className="space-y-4">
          {filteredAnnouncements.map((announcement) => (
            <AnnouncementCard
              key={announcement.id}
              announcement={announcement}
              onDelete={handleDelete}
              onPublish={handlePublish}
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
