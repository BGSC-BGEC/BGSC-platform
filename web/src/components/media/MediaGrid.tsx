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
        <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-black/80 text-white backdrop-blur-xs border border-white/10">
          Event
        </span>
      )
    case 'sponsor':
      return (
        <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-sky-950/80 text-sky-300 backdrop-blur-xs border border-sky-500/20">
          Sponsor
        </span>
      )
    case 'memories':
      return (
        <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-purple-950/80 text-purple-300 backdrop-blur-xs border border-purple-500/20">
          Memories
        </span>
      )
    case 'community':
      return (
        <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-950/80 text-emerald-300 backdrop-blur-xs border border-emerald-500/20">
          Community
        </span>
      )
    case 'hall_of_fame':
      return (
        <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-950/80 text-amber-300 backdrop-blur-xs border border-amber-500/20">
          Hall of Fame
        </span>
      )
    case 'general':
    default:
      return (
        <span className="text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-neutral-900/80 text-neutral-300 backdrop-blur-xs border border-neutral-700/30">
          General
        </span>
      )
  }
}

function renderStatusBadge(status: MediaStatus) {
  switch (status) {
    case 'approved':
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          Approved
        </span>
      )
    case 'pending':
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-400">
          <Clock className="w-3 h-3 text-amber-400" />
          Pending
        </span>
      )
    case 'rejected':
    default:
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border border-destructive/30 bg-destructive/10 text-destructive">
          <AlertCircle className="w-3 h-3 text-destructive" />
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
      <div className="bg-card rounded-2xl border border-border py-16 text-center space-y-2">
        <Inbox className="w-8 h-8 text-muted-foreground/60 mx-auto" />
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
          No Media Assets Found
        </h3>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
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
            className="group relative bg-card rounded-2xl border border-border overflow-hidden shadow-xs hover:border-primary/40 transition-all cursor-pointer flex flex-col"
          >
            {/* Visual Thumbnail Stage */}
            <div className="relative aspect-video bg-muted/40 overflow-hidden flex items-center justify-center">
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
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center group-hover:bg-black/30 transition-colors">
                    <span className="w-10 h-10 rounded-full bg-black/70 backdrop-blur-md text-white flex items-center justify-center border border-white/20 shadow-md">
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
                    className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-card shadow"
                    title="Approved"
                  />
                )}
                {item.status === 'pending' && (
                  <span
                    className="w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-card shadow animate-pulse"
                    title="Pending Moderation"
                  />
                )}
                {item.status === 'rejected' && (
                  <span
                    className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-card shadow"
                    title="Rejected"
                  />
                )}
              </div>
            </div>

            {/* Bottom Info Strip */}
            <div className="p-3.5 space-y-2 flex-1 flex flex-col justify-between">
              <div className="space-y-0.5">
                <h4 className="text-xs font-bold text-foreground truncate font-mono">
                  {item.original_filename}
                </h4>
                {item.caption && (
                  <p className="text-[11px] text-muted-foreground line-clamp-1">
                    {item.caption}
                  </p>
                )}
              </div>

              <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                <span>{formatBytes(item.size_bytes)}</span>

                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-0.5">
                    <Eye className="w-3 h-3 text-muted-foreground" />
                    {item.views_count}
                  </span>
                  <span className="flex items-center gap-0.5">
                    <Heart className="w-3 h-3 text-muted-foreground" />
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
    <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
              <th className="py-3 px-4 w-16">Preview</th>
              <th className="py-3 px-4">Filename & Details</th>
              <th className="py-3 px-3">Category</th>
              <th className="py-3 px-3">Type</th>
              <th className="py-3 px-3">Size</th>
              <th className="py-3 px-3">Status</th>
              <th className="py-3 px-4">Uploader</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-xs">
            {items.map((item) => (
              <tr
                key={item.id}
                className="hover:bg-muted/40 transition-colors cursor-pointer"
                onClick={() => onSelectItem(item)}
              >
                {/* Thumbnail */}
                <td className="py-2.5 px-4">
                  <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden border border-border flex-shrink-0 flex items-center justify-center">
                    {item.media_type === 'video' ? (
                      <Film className="w-5 h-5 text-muted-foreground" />
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
                    <span className="font-mono text-xs font-bold text-foreground truncate block">
                      {item.original_filename}
                    </span>
                    {item.caption && (
                      <p className="text-[11px] text-muted-foreground truncate">
                        {item.caption}
                      </p>
                    )}
                    {item.event_title && (
                      <span className="text-[10px] text-muted-foreground font-medium block truncate">
                        {item.event_title}
                      </span>
                    )}
                  </div>
                </td>

                {/* Category */}
                <td className="py-2.5 px-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border border-border bg-muted/60 text-muted-foreground">
                    {item.category.replace('_', ' ')}
                  </span>
                </td>

                {/* Type */}
                <td className="py-2.5 px-3">
                  <div className="flex items-center gap-1 text-[11px] text-foreground font-semibold uppercase">
                    {item.media_type === 'video' ? (
                      <Film className="w-3.5 h-3.5 text-muted-foreground" />
                    ) : (
                      <ImageIcon className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                    <span>{item.media_type}</span>
                  </div>
                </td>

                {/* Size */}
                <td className="py-2.5 px-3 font-mono text-[11px] text-muted-foreground">
                  {formatBytes(item.size_bytes)}
                </td>

                {/* Status */}
                <td className="py-2.5 px-3">
                  {renderStatusBadge(item.status)}
                </td>

                {/* Uploader */}
                <td className="py-2.5 px-4 text-xs text-foreground">
                  <div className="truncate">
                    <span className="font-bold block truncate">
                      {item.uploader.display_name}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">
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
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
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
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
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
