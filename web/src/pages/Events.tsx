import React, { useState, useEffect, useMemo } from 'react'
import { Plus, Search, AlertCircle } from 'lucide-react'
import type { ClubEvent } from '../types/event'
import { eventService } from '../services/eventService'
import { EventTable } from '../components/events/EventTable'
import { CreateEventModal } from '../components/events/CreateEventModal'

export const Events: React.FC = () => {
    const [events, setEvents] = useState<ClubEvent[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const [searchTerm, setSearchTerm] = useState('')
    const [categoryFilter, setCategoryFilter] = useState('all')
    const [statusFilter, setStatusFilter] = useState('all')
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

    useEffect(() => {
    let ignore = false

    eventService
        .getEvents()
        .then((data) => {
        if (!ignore) {
            setEvents(data)
            setIsLoading(false)
        }
        })
        .catch((err) => {
        if (!ignore) {
            setError(err instanceof Error ? err.message : 'Failed to load events')
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
    eventService
        .getEvents()
        .then((data) => setEvents(data))
        .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load events'))
        .finally(() => setIsLoading(false))
    }

    const handleEventCreated = (newEvent: ClubEvent) => {
    setEvents((prev) => [newEvent, ...prev])
    }

    const filteredEvents = useMemo(() => {
    return events.filter((event) => {
        const term = searchTerm.toLowerCase().trim()
        const matchesSearch =
        term === '' ||
        event.title.toLowerCase().includes(term) ||
        (event.venue && event.venue.toLowerCase().includes(term))

        const matchesCategory =
        categoryFilter === 'all' ||
        event.category.toLowerCase() === categoryFilter.toLowerCase()

        const matchesStatus =
        statusFilter === 'all' ||
        event.status.toLowerCase() === statusFilter.toLowerCase()

        return matchesSearch && matchesCategory && matchesStatus
    })
    }, [events, searchTerm, categoryFilter, statusFilter])

    const handleReset = () => {
    setSearchTerm('')
    setCategoryFilter('all')
    setStatusFilter('all')
    }

    return (
    <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-
gray-200">
        <div>
            <h1 className="text-xl font-bold uppercase tracking-wider text-black">
            Events & Tournaments
            </h1>
            <p className="text-sm text-gray-600 mt-1">
            Organize and track club leagues, esports brackets, and fitness activities.
            </p>
        </div>
        <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold border border-black bg-black
text-white hover:bg-gray-800 rounded transition-colors self-start sm:self-auto cursor-pointer"
        >
            <Plus className="w-4 h-4" />
            Create Tournament
        </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
/>
            <input
            type="text"
            placeholder="Search tournament name or venue..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded text-black bg-white
focus:outline-none focus:border-black"
            />
        </div>

        <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded text-black bg-white focus:outline-none
focus:border-black"
        >
            <option value="all">All Categories</option>
            <option value="leagues">Leagues</option>
            <option value="bgec">BGEC Esports</option>
            <option value="fitsoc">FitSoc</option>
            <option value="general">General</option>
        </select>

        <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded text-black bg-white focus:outline-none
focus:border-black"
        >
            <option value="all">All Statuses</option>
            <option value="upcoming">Upcoming</option>
            <option value="ongoing">Ongoing</option>
            <option value="past">Past / Completed</option>
            <option value="draft">Draft</option>
            <option value="cancelled">Cancelled</option>
        </select>

        <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2 text-sm border border-black text-black bg-white hover:bg-black hover:text-white
rounded transition-colors cursor-pointer"
        >
            Reset
        </button>
        </div>

        {!isLoading && error && (
        <div className="p-4 border border-black text-black bg-white rounded flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
            <AlertCircle className="w-4 h-4 text-black shrink-0" />
            <span>{error}</span>
            </div>
            <button
            type="button"
            onClick={handleRetry}
            className="px-3 py-1 text-xs border border-black hover:bg-black hover:text-white transition-colors
rounded cursor-pointer"
            >
            Retry
            </button>
        </div>
        )}
        {isLoading && (
        <div className="p-8 text-center text-sm text-gray-500 border border-gray-200 rounded bg-gray-50">
            Loading events & tournaments...
        </div>
        )}

        {!isLoading && !error && (
        <EventTable
            events={filteredEvents}
            onViewEvent={(event) => {
            console.log('Inspecting tournament:', event)
            }}
        />
        )}

        <CreateEventModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onEventCreated={handleEventCreated}
        />
    </div>
    )
}

export default Events