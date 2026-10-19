import React from 'react'
import {
  Film,
  Image as ImageIcon,
  Eye,
  Heart,
  Trash2,
  ExternalLink,
  Clock,
  CheckCircle2,
  AlertCircle,
  Inbox,
} from 'lucide-react'
import type { MediaCategory, MediaItem, MediaStatus } from '../../types/media'

export interface MediaGridProps {
  items: MediaItem[]
  viewMode: 'grid' | 'table'
  onSelectItem: (item: MediaItem) => void
  onDeleteItem: (id: string) => Promise<void>
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function formatDate(dateString: string): string {
  try {
    const d = new Date(dateString)
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return dateString
  }
}

function renderCategoryPill(category: MediaCategory) {
  switch (category) {
    case 'event':
      return (
        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-black/80 text-white backdrop-blur-xs">
          Event
        </span>
      )
    case 'sponsor':
      return (
        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-900/80 text-white backdrop-blur-xs">
          Sponsor
        </span>
      )
    case 'memories':
      return (
        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-900/80 text-white backdrop-blur-xs">
          Memories
        </span>
      )
    case 'community':
      return (
        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-900/80 text-white backdrop-blur-xs">
          Community
        </span>
      )
    case 'hall_of_fame':
      return (
        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-900/80 text-white backdrop-blur-xs">
          Hall of Fame
        </span>
      )
    case 'general':
    default:
      return (
        <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-gray-900/80 text-white backdrop-blur-xs">
          General
        </span>
      )
  }
}

function renderStatusBadge(status: MediaStatus) {
  switch (status) {
    case 'approved':
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-green-300 bg-green-50 text-green-700">
          <CheckCircle2 className="w-3 h-3 text-green-600" />
          Approved
        </span>
      )
    case 'pending':
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-amber-300 bg-amber-50 text-amber-800">
          <Clock className="w-3 h-3 text-amber-600" />
          Pending
        </span>
      )
    case 'rejected':
    default:
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-red-300 bg-red-50 text-red-700">
          <AlertCircle className="w-3 h-3 text-red-600" />
          Rejected
        </span>
      )
  }
}

export const MediaGrid: React.FC<MediaGridProps> = ({
  items,
  viewMode,
  onSelectItem,
  onDeleteItem,
}) => {
  if (items.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 py-16 text-center space-y-2">
        <Inbox className="w-8 h-8 text-gray-300 mx-auto" />
        <h3 className="text-sm font-bold text-black uppercase tracking-wider">
          No Media Assets Found
        </h3>
        <p className="text-xs text-gray-500 max-w-sm mx-auto">
          No assets match the selected category, media type, or search term.
        </p>
      </div>
    )
  }

  // 1. Grid Mode
  if (viewMode === 'grid') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {items.map((item) => (
          <div
            key={item.id}
            onClick={() => onSelectItem(item)}
            className="group relative bg-white rounded-lg border border-gray-200 overflow-hidden shadow-xs hover:border-black transition-all cursor-pointer flex flex-col"
          >
            {/* Visual Thumbnail Stage */}
            <div className="relative aspect-video bg-gray-100 overflow-hidden flex items-center justify-center">
              {item.media_type === 'video' ? (
                <>
                  <img
                    src={item.thumbnail_url || item.url}
                    alt={item.original_filename}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center group-hover:bg-black/20 transition-colors">
                    <span className="w-10 h-10 rounded-full bg-white/90 text-black flex items-center justify-center shadow">
                      <Film className="w-5 h-5 ml-0.5" />
                    </span>
                  </div>
                  {item.metadata?.duration_seconds && (
                    <span className="absolute bottom-2 right-2 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-black/80 text-white">
                      {item.metadata.duration_seconds}s
                    </span>
                  )}
                </>
              ) : (
                <img
                  src={item.thumbnail_url || item.url}
                  alt={item.original_filename}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              )}

              {/* Top Badges */}
              <div className="absolute top-2 left-2 flex items-center gap-1.5">
                {renderCategoryPill(item.category)}
              </div>

              <div className="absolute top-2 right-2">
                {item.status === 'approved' && (
                  <span
                    className="w-2.5 h-2.5 rounded-full bg-green-500 ring-2 ring-white shadow"
                    title="Approved"
                  />
                )}
                {item.status === 'pending' && (
                  <span
                    className="w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-white shadow animate-pulse"
                    title="Pending Moderation"
                  />
                )}
                {item.status === 'rejected' && (
                  <span
                    className="w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-white shadow"
                    title="Rejected"
                  />
                )}
              </div>
            </div>

            {/* Bottom Info Strip */}
            <div className="p-3 space-y-1.5 flex-1 flex flex-col justify-between">
              <div className="space-y-0.5">
                <h4 className="text-xs font-bold text-black truncate font-mono">
                  {item.original_filename}
                </h4>
                {item.caption && (
                  <p className="text-[11px] text-gray-500 line-clamp-1">
                    {item.caption}
                  </p>
                )}
              </div>

              <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-[10px] text-gray-500 font-mono">
                <span>{formatBytes(item.size_bytes)}</span>

                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-0.5">
                    <Eye className="w-3 h-3 text-gray-400" />
                    {item.views_count}
                  </span>
                  <span className="flex items-center gap-0.5">
                    <Heart className="w-3 h-3 text-gray-400" />
                    {item.likes_count}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  // 2. Table Mode (List View)
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-[10px] uppercase font-bold text-gray-500 tracking-wider">
              <th className="py-2.5 px-4 w-16">Preview</th>
              <th className="py-2.5 px-4">Filename & Details</th>
              <th className="py-2.5 px-3">Category</th>
              <th className="py-2.5 px-3">Type</th>
              <th className="py-2.5 px-3">Size</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-4">Uploader</th>
              <th className="py-2.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-xs">
            {items.map((item) => (
              <tr
                key={item.id}
                className="hover:bg-gray-50/80 transition-colors cursor-pointer"
                onClick={() => onSelectItem(item)}
              >
                {/* Thumbnail */}
                <td className="py-2.5 px-4">
                  <div className="w-12 h-12 rounded bg-gray-100 overflow-hidden border border-gray-200 flex-shrink-0 flex items-center justify-center">
                    {item.media_type === 'video' ? (
                      <Film className="w-5 h-5 text-gray-500" />
                    ) : (
                      <img
                        src={item.thumbnail_url || item.url}
                        alt={item.original_filename}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    )}
                  </div>
                </td>

                {/* Filename & Details */}
                <td className="py-2.5 px-4 max-w-xs">
                  <div className="space-y-0.5">
                    <span className="font-mono text-xs font-bold text-black truncate block">
                      {item.original_filename}
                    </span>
                    {item.caption && (
                      <p className="text-[11px] text-gray-500 truncate">
                        {item.caption}
                      </p>
                    )}
                    {item.event_title && (
                      <span className="text-[10px] text-gray-400 font-medium block truncate">
                        {item.event_title}
                      </span>
                    )}
                  </div>
                </td>

                {/* Category */}
                <td className="py-2.5 px-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-gray-200 bg-gray-50 text-gray-700">
                    {item.category.replace('_', ' ')}
                  </span>
                </td>

                {/* Type */}
                <td className="py-2.5 px-3">
                  <div className="flex items-center gap-1 text-[11px] text-gray-700 font-semibold uppercase">
                    {item.media_type === 'video' ? (
                      <Film className="w-3.5 h-3.5 text-gray-500" />
                    ) : (
                      <ImageIcon className="w-3.5 h-3.5 text-gray-500" />
                    )}
                    <span>{item.media_type}</span>
                  </div>
                </td>

                {/* Size */}
                <td className="py-2.5 px-3 font-mono text-[11px] text-gray-600">
                  {formatBytes(item.size_bytes)}
                </td>

                {/* Status */}
                <td className="py-2.5 px-3">
                  {renderStatusBadge(item.status)}
                </td>

                {/* Uploader */}
                <td className="py-2.5 px-4 text-xs text-gray-700">
                  <div className="truncate">
                    <span className="font-bold block truncate">
                      {item.uploader.display_name}
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">
                      {formatDate(item.created_at)}
                    </span>
                  </div>
                </td>

                {/* Actions */}
                <td className="py-2.5 px-4 text-right">
                  <div
                    className="inline-flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectItem(item)}
                      className="p-1.5 rounded text-gray-500 hover:text-black hover:bg-gray-100 transition-colors cursor-pointer"
                      title="Inspect Media"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          confirm(
                            `Delete asset "${item.original_filename}"? This action cannot be undone.`
                          )
                        ) {
                          onDeleteItem(item.id)
                        }
                      }}
                      className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                      title="Delete Asset"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default MediaGrid
