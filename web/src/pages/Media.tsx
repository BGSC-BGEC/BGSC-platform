import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Image as ImageIcon,
  LayoutGrid,
  List,
  Search,
  UploadCloud,
  RefreshCw,
  RotateCcw,
  HardDrive,
  Clock,
  FolderArchive,
  AlertCircle,
  X,
} from 'lucide-react'
import type {
  MediaAlbum,
  MediaCategory,
  MediaItem,
  MediaStatus,
  MediaType,
  UploadMediaPayload,
} from '../types/media'
import { mediaService } from '../services/mediaService'
import { MediaGrid } from '../components/media/MediaGrid'
import { MediaPreviewModal } from '../components/media/MediaPreviewModal'
import { UploadMediaModal } from '../components/media/UploadMediaModal'

function formatBytes(bytes: number): string {
  if (!bytes) return '0 MB'
  const mb = bytes / (1024 * 1024)
  if (mb < 1000) {
    return `${mb.toFixed(1)} MB`
  }
  return `${(mb / 1024).toFixed(2)} GB`
}

export const Media: React.FC = () => {
  const [allMediaItems, setAllMediaItems] = useState<MediaItem[]>([])
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([])
  const [albums, setAlbums] = useState<MediaAlbum[]>([])

  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [isUploadOpen, setIsUploadOpen] = useState(false)

  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')

  // Filter state
  const [categoryFilter, setCategoryFilter] = useState<MediaCategory | 'all'>('all')
  const [mediaTypeFilter, setMediaTypeFilter] = useState<MediaType | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<MediaStatus | 'all'>('all')
  const [searchTerm, setSearchTerm] = useState('')

  // Load initial data and whenever filters change
  useEffect(() => {
    let ignore = false

    Promise.all([
      mediaService.getMedia(),
      mediaService.getMedia({
        category: categoryFilter,
        media_type: mediaTypeFilter,
        status: statusFilter,
        search: searchTerm,
      }),
      mediaService.getAlbums(),
    ])
      .then(([allData, filteredData, albumData]) => {
        if (!ignore) {
          setAllMediaItems(allData)
          setMediaItems(filteredData)
          setAlbums(albumData)
          setError(null)
          setIsLoading(false)
          setIsRefreshing(false)
        }
      })
      .catch((err) => {
        if (!ignore) {
          setError(err instanceof Error ? err.message : 'Failed to load media')
          setIsLoading(false)
          setIsRefreshing(false)
        }
      })

    return () => {
      ignore = true
    }
  }, [categoryFilter, mediaTypeFilter, statusFilter, searchTerm])

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    setError(null)
    try {
      const [allData, filteredData, albumData] = await Promise.all([
        mediaService.getMedia(),
        mediaService.getMedia({
          category: categoryFilter,
          media_type: mediaTypeFilter,
          status: statusFilter,
          search: searchTerm,
        }),
        mediaService.getAlbums(),
      ])
      setAllMediaItems(allData)
      setMediaItems(filteredData)
      setAlbums(albumData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh media')
    } finally {
      setIsRefreshing(false)
    }
  }, [categoryFilter, mediaTypeFilter, statusFilter, searchTerm])

  // Aggregate metrics
  const metrics = useMemo(() => {
    const totalAssets = allMediaItems.length
    const pendingModeration = allMediaItems.filter((m) => m.status === 'pending')
      .length
    const totalBytes = allMediaItems.reduce((acc, item) => acc + item.size_bytes, 0)
    const storageConsumed = formatBytes(totalBytes)
    const activeAlbums = albums.length

    return { totalAssets, pendingModeration, storageConsumed, activeAlbums }
  }, [allMediaItems, albums])

  // Media actions
  const handleSelectItem = (item: MediaItem) => {
    setSelectedItem(item)
    setIsPreviewOpen(true)
  }

  const handleClosePreview = () => {
    setIsPreviewOpen(false)
    setSelectedItem(null)
  }

  const handleOpenUpload = () => {
    setIsUploadOpen(true)
  }

  const handleCloseUpload = () => {
    setIsUploadOpen(false)
  }

  const handleUpload = async (payload: UploadMediaPayload) => {
    const newItem = await mediaService.uploadMedia(payload)
    setMediaItems((prev) => [newItem, ...prev])
    setAllMediaItems((prev) => [newItem, ...prev])
  }

  const handleModerate = async (
    id: string,
    status: MediaStatus,
    rejectionReason?: string
  ) => {
    const updated = await mediaService.moderateMedia(id, status, rejectionReason)
    setSelectedItem(updated)
    setMediaItems((prev) => prev.map((m) => (m.id === id ? updated : m)))
    setAllMediaItems((prev) => prev.map((m) => (m.id === id ? updated : m)))
  }

  const handleDelete = async (id: string) => {
    await mediaService.deleteMedia(id)
    setMediaItems((prev) => prev.filter((m) => m.id !== id))
    setAllMediaItems((prev) => prev.filter((m) => m.id !== id))
    if (selectedItem?.id === id) {
      handleClosePreview()
    }
  }

  const handleResetDemo = async () => {
    mediaService.resetMockMedia()
    await handleRefresh()
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* 1. Header & Primary Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-black uppercase tracking-tight text-foreground flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-primary" />
              Media & Digital Assets
            </h1>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-primary/15 border border-primary/30 text-primary">
              Library
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Central repository for tournament banners, sponsor assets, match photography, and community highlights.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-border bg-card text-foreground hover:bg-muted transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-muted-foreground ${
                isRefreshing ? 'animate-spin' : ''
              }`}
            />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleResetDemo}
            disabled={isLoading || isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-border bg-card text-foreground hover:bg-muted transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
          >
            <RotateCcw className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Reset Demo</span>
          </button>

          <button
            type="button"
            onClick={handleOpenUpload}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload Media</span>
          </button>
        </div>
      </div>

      {/* 2. Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-xs text-foreground flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            className="font-bold underline hover:no-underline text-destructive cursor-pointer flex-shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* 3. Metric Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Assets */}
        <div className="bg-card p-4 rounded-2xl border border-border space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-bold uppercase tracking-wider">
              Total Assets
            </span>
            <ImageIcon className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-black text-foreground">
            {metrics.totalAssets}
          </div>
          <p className="text-[11px] text-muted-foreground">Images & video clips</p>
        </div>

        {/* Pending Moderation */}
        <div
          className={`bg-card p-4 rounded-2xl border transition-all space-y-1 shadow-xs ${
            metrics.pendingModeration > 0
              ? 'border-amber-500/40 bg-amber-500/5 ring-1 ring-amber-500/20'
              : 'border-border'
          }`}
        >
          <div className="flex items-center justify-between text-amber-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">
              Pending Review
            </span>
            <Clock
              className={`w-4 h-4 ${
                metrics.pendingModeration > 0
                  ? 'text-amber-400 animate-pulse'
                  : 'text-muted-foreground'
              }`}
            />
          </div>
          <div className="text-2xl font-black text-foreground">
            {metrics.pendingModeration}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Awaiting admin moderation
          </p>
        </div>

        {/* Storage Consumed */}
        <div className="bg-card p-4 rounded-2xl border border-border space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-bold uppercase tracking-wider">
              Storage Footprint
            </span>
            <HardDrive className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-black text-foreground">
            {metrics.storageConsumed}
          </div>
          <p className="text-[11px] text-muted-foreground">Digital assets volume</p>
        </div>

        {/* Active Albums */}
        <div className="bg-card p-4 rounded-2xl border border-border space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-bold uppercase tracking-wider">
              Album Collections
            </span>
            <FolderArchive className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-black text-foreground">
            {metrics.activeAlbums}
          </div>
          <p className="text-[11px] text-muted-foreground">Grouped event albums</p>
        </div>
      </div>

      {/* 4. Filter Toolbar & View Mode Switcher */}
      <div className="bg-card rounded-2xl border border-border p-4 space-y-3 shadow-xs">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search assets by filename, caption, tags, uploader..."
              className="w-full pl-9 pr-8 py-2 text-xs border border-border rounded-lg text-foreground bg-card placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* View Mode Toggle */}
          <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/40 text-xs self-start lg:self-auto">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
              title="Table View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Dropdowns Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-border/60 text-xs">
          {/* Category Dropdown */}
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
              Category:
            </label>
            <select
              value={categoryFilter}
              onChange={(e) =>
                setCategoryFilter(e.target.value as MediaCategory | 'all')
              }
              className="flex-1 px-2.5 py-1.5 border border-border rounded-lg text-foreground bg-card focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
            >
              <option value="all">All Categories</option>
              <option value="event">Tournament / Event</option>
              <option value="community">Community</option>
              <option value="memories">Memories & Gala</option>
              <option value="sponsor">Sponsor & Partner</option>
              <option value="hall_of_fame">Hall of Fame</option>
              <option value="general">General</option>
            </select>
          </div>

          {/* Media Type Dropdown */}
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
              Type:
            </label>
            <select
              value={mediaTypeFilter}
              onChange={(e) =>
                setMediaTypeFilter(e.target.value as MediaType | 'all')
              }
              className="flex-1 px-2.5 py-1.5 border border-border rounded-lg text-foreground bg-card focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
            >
              <option value="all">All Media Types</option>
              <option value="image">Images Only</option>
              <option value="video">Videos Only</option>
            </select>
          </div>

          {/* Moderation Status Dropdown */}
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
              Status:
            </label>
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as MediaStatus | 'all')
              }
              className="flex-1 px-2.5 py-1.5 border border-border rounded-lg text-foreground bg-card focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
            >
              <option value="all">All Moderation States</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending Review</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      {/* 5. Gallery Content */}
      {isLoading ? (
        <div className="py-20 text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-primary animate-spin mx-auto" />
          <p className="text-xs uppercase font-bold tracking-wider text-muted-foreground">
            Loading Media Library...
          </p>
        </div>
      ) : (
        <MediaGrid
          items={mediaItems}
          viewMode={viewMode}
          onSelectItem={handleSelectItem}
          onDeleteItem={handleDelete}
        />
      )}

      {/* 6. Modals */}
      <MediaPreviewModal
        item={selectedItem}
        isOpen={isPreviewOpen}
        onClose={handleClosePreview}
        onModerate={handleModerate}
        onDelete={handleDelete}
      />

      <UploadMediaModal
        isOpen={isUploadOpen}
        onClose={handleCloseUpload}
        onUpload={handleUpload}
        albums={albums}
      />
    </div>
  )
}

export default Media
