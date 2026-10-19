import React from 'react'
import { Pin, Trash2 } from 'lucide-react'
import type { Announcement } from '../../types/announcement'

export interface AnnouncementCardProps {
  announcement: Announcement
  onDelete: (id: string) => void
  onPublish?: (id: string) => void
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
}) => {
  const isUrgent = announcement.priority === 'urgent'
  const isImportant = announcement.priority === 'important'

  return (
    <div
      className={`bg-white rounded-lg border transition-shadow hover:shadow-md p-5 space-y-4 ${
        announcement.isPinned
          ? 'border-black ring-1 ring-black/10'
          : 'border-gray-200'
      }`}
    >
      {/* Card Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
        {/* Category Badges */}
        <div className="flex flex-wrap items-center gap-1.5">
          {announcement.categories.map((cat) => (
            <span
              key={cat}
              className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-gray-200 bg-gray-50 text-gray-800"
            >
              {CATEGORY_LABELS[cat] || cat.toUpperCase()}
            </span>
          ))}
        </div>

        {/* Priority & Status & Pin Indicators */}
        <div className="flex items-center gap-2">
          {/* Priority Indicator */}
          {isUrgent && (
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-red-600 text-white">
              Urgent
            </span>
          )}
          {isImportant && (
            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border border-black bg-black text-white">
              Important
            </span>
          )}
          {!isUrgent && !isImportant && (
            <span className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded border border-gray-200 text-gray-600 bg-gray-50">
              Normal
            </span>
          )}

          {/* Pin Indicator */}
          {announcement.isPinned && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-black text-white">
              <Pin className="w-3 h-3 fill-white" />
              Pinned
            </span>
          )}

          {/* Status Pill */}
          <span
            className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border ${
              announcement.status === 'published'
                ? 'border-green-600/30 text-green-700 bg-green-50'
                : announcement.status === 'draft'
                ? 'border-yellow-600/30 text-yellow-800 bg-yellow-50'
                : announcement.status === 'scheduled'
                ? 'border-blue-600/30 text-blue-700 bg-blue-50'
                : 'border-gray-300 text-gray-600 bg-gray-100'
            }`}
          >
            {announcement.status}
          </span>
        </div>
      </div>

      {/* Card Body */}
      <div className="space-y-2">
        <h3 className="text-lg font-bold text-black">{announcement.title}</h3>
        <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
          {announcement.body}
        </p>

        {/* Tags */}
        {announcement.tags && announcement.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-2">
            {announcement.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Card Footer */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-gray-100">
        <div className="text-xs text-gray-500">
          {announcement.status === 'published' && announcement.publishedAt && (
            <span>Published on {formatDisplayDate(announcement.publishedAt)}</span>
          )}
          {announcement.status === 'scheduled' && announcement.scheduledFor && (
            <span>Scheduled for {formatDisplayDate(announcement.scheduledFor)}</span>
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
            <span> by {announcement.authorName}</span>
          )}
        </div>

        {/* Admin Action Buttons */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {announcement.status === 'draft' && onPublish && (
            <button
              type="button"
              onClick={() => onPublish(announcement.id)}
              className="px-3 py-1 text-xs font-semibold border border-black bg-black text-white hover:bg-gray-800 rounded transition-colors cursor-pointer"
            >
              Publish Now
            </button>
          )}
          <button
            type="button"
            onClick={() => onDelete(announcement.id)}
            aria-label="Delete announcement"
            className="p-1.5 text-xs text-gray-500 hover:text-red-600 border border-gray-200 hover:border-red-300 rounded transition-colors cursor-pointer flex items-center gap-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Delete</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default AnnouncementCard
