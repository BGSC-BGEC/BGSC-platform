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
      mediaService.getMedia(), // Global catalog for metrics
      mediaService.getMedia({
        category: categoryFilter,
        media_type: mediaTypeFilter,
        status: statusFilter,
        search: searchTerm,
      }),
      mediaService.getAlbums(),
    ])
      .then(([globalItems, filteredItems, albumList]) => {
        if (!ignore) {
          setAllMediaItems(globalItems)
          setMediaItems(filteredItems)
          setAlbums(albumList)
          setError(null)
          setIsLoading(false)
        }
      })
      .catch((err) => {
        if (!ignore) {
          setError(
            err instanceof Error ? err.message : 'Failed to load media assets.'
          )
          setIsLoading(false)
        }
      })

    return () => {
      ignore = true
    }
  }, [categoryFilter, mediaTypeFilter, statusFilter, searchTerm])

  // Explicit refresh handler
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    setError(null)

    try {
      const [globalItems, filteredItems, albumList] = await Promise.all([
        mediaService.getMedia(),
        mediaService.getMedia({
          category: categoryFilter,
          media_type: mediaTypeFilter,
          status: statusFilter,
          search: searchTerm,
        }),
        mediaService.getAlbums(),
      ])
      setAllMediaItems(globalItems)
      setMediaItems(filteredItems)
      setAlbums(albumList)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to refresh media library.'
      )
    } finally {
      setIsRefreshing(false)
    }
  }, [categoryFilter, mediaTypeFilter, statusFilter, searchTerm])

  // Computed metrics
  const metrics = useMemo(() => {
    const totalAssets = allMediaItems.length
    const pendingModeration = allMediaItems.filter(
      (item) => item.status === 'pending'
    ).length
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-black uppercase tracking-tight text-black flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-black" />
              Media & Digital Assets
            </h1>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-black text-white">
              Library
            </span>
          </div>
          <p className="text-xs text-gray-500">
            Central repository for tournament banners, sponsor assets, match photography, and community highlights.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-gray-600 ${
                isRefreshing ? 'animate-spin' : ''
              }`}
            />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleResetDemo}
            disabled={isLoading || isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded border border-gray-200 bg-white text-gray-700 hover:text-black hover:border-gray-400 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-gray-600" />
            <span>Reset Demo</span>
          </button>

          <button
            type="button"
            onClick={handleOpenUpload}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded bg-black text-white hover:bg-gray-800 transition-colors cursor-pointer"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload Media</span>
          </button>
        </div>
      </div>

      {/* 2. Error Banner */}
      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            className="font-bold underline hover:no-underline text-red-800 cursor-pointer flex-shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* 3. Metric Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Assets */}
        <div className="bg-white p-4 rounded-lg border border-gray-200 space-y-1">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-[10px] font-bold uppercase tracking-wider">
              Total Assets
            </span>
            <ImageIcon className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-2xl font-black text-black">
            {metrics.totalAssets}
          </div>
          <p className="text-[11px] text-gray-500">Images & video clips</p>
        </div>

        {/* Pending Moderation */}
        <div
          className={`bg-white p-4 rounded-lg border transition-all space-y-1 ${
            metrics.pendingModeration > 0
              ? 'border-amber-400 bg-amber-50/20'
              : 'border-gray-200'
          }`}
        >
          <div className="flex items-center justify-between text-amber-800">
            <span className="text-[10px] font-bold uppercase tracking-wider">
              Pending Review
            </span>
            <Clock
              className={`w-4 h-4 ${
                metrics.pendingModeration > 0
                  ? 'text-amber-600 animate-pulse'
                  : 'text-gray-400'
              }`}
            />
          </div>
          <div className="text-2xl font-black text-black">
            {metrics.pendingModeration}
          </div>
          <p className="text-[11px] text-gray-500">
            Awaiting admin moderation
          </p>
        </div>

        {/* Storage Consumed */}
        <div className="bg-white p-4 rounded-lg border border-gray-200 space-y-1">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-[10px] font-bold uppercase tracking-wider">
              Storage Footprint
            </span>
            <HardDrive className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-2xl font-black text-black">
            {metrics.storageConsumed}
          </div>
          <p className="text-[11px] text-gray-500">Digital assets volume</p>
        </div>

        {/* Active Albums */}
        <div className="bg-white p-4 rounded-lg border border-gray-200 space-y-1">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-[10px] font-bold uppercase tracking-wider">
              Album Collections
            </span>
            <FolderArchive className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-2xl font-black text-black">
            {metrics.activeAlbums}
          </div>
          <p className="text-[11px] text-gray-500">Grouped event albums</p>
        </div>
      </div>

      {/* 4. Filter Toolbar & View Mode Switcher */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3 shadow-xs">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search assets by filename, caption, tags, uploader..."
              className="w-full pl-9 pr-8 py-2 text-xs border border-gray-300 rounded text-black placeholder-gray-400 focus:outline-none focus:border-black"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* View Mode Toggle */}
          <div className="inline-flex rounded-md border border-gray-200 p-0.5 bg-gray-50 text-xs self-start lg:self-auto">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded transition-colors cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-black text-white shadow-xs'
                  : 'text-gray-600 hover:text-black hover:bg-gray-100'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded transition-colors cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-black text-white shadow-xs'
                  : 'text-gray-600 hover:text-black hover:bg-gray-100'
              }`}
              title="Table View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Dropdowns Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-gray-100 text-xs">
          {/* Category Dropdown */}
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap">
              Category:
            </label>
            <select
              value={categoryFilter}
              onChange={(e) =>
                setCategoryFilter(e.target.value as MediaCategory | 'all')
              }
              className="flex-1 px-2.5 py-1.5 border border-gray-300 rounded text-black bg-white focus:outline-none focus:border-black"
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
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap">
              Type:
            </label>
            <select
              value={mediaTypeFilter}
              onChange={(e) =>
                setMediaTypeFilter(e.target.value as MediaType | 'all')
              }
              className="flex-1 px-2.5 py-1.5 border border-gray-300 rounded text-black bg-white focus:outline-none focus:border-black"
            >
              <option value="all">All Media Types</option>
              <option value="image">Images Only</option>
              <option value="video">Videos Only</option>
            </select>
          </div>

          {/* Moderation Status Dropdown */}
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap">
              Status:
            </label>
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as MediaStatus | 'all')
              }
              className="flex-1 px-2.5 py-1.5 border border-gray-300 rounded text-black bg-white focus:outline-none focus:border-black"
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
          <RefreshCw className="w-8 h-8 text-black animate-spin mx-auto" />
          <p className="text-xs uppercase font-bold tracking-wider text-gray-500">
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
