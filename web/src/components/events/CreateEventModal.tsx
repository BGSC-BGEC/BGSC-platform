import React, { useState, useEffect } from 'react'
import type { ClubEvent, EventCategory, EventDomain } from '../../types/event'
import { eventService } from '../../services/eventService'

export interface CreateEventModalProps {
    isOpen: boolean
    onClose: () => void
    onEventCreated: (newEvent: ClubEvent) => void
}

export const CreateEventModal: React.FC<CreateEventModalProps> = ({
    isOpen,
    onClose,
    onEventCreated,
}) => {
    const today = new Date().toISOString().split('T')[0]

    const [title, setTitle] = useState('')
    const [category, setCategory] = useState<EventCategory>('leagues')
    const [domain, setDomain] = useState<EventDomain>('sports')
    const [venue, setVenue] = useState('')
    const [startAt, setStartAt] = useState(today)
    const [endAt, setEndAt] = useState(today)
    const [maxParticipants, setMaxParticipants] = useState<number>(32)
    const [isTeamed, setIsTeamed] = useState(false)
    const [status, setStatus] = useState<'draft' | 'upcoming'>('upcoming')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
        window.addEventListener('keydown', handleKeyDown)
    }
    return () => {
        window.removeEventListener('keydown', handleKeyDown)
    }
    }, [isOpen, onClose])

    if (!isOpen) return null

    const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    setIsSubmitting(true)
    setError(null)

    try {
        const createdEvent = await eventService.createEvent({
        title: title.trim(),
        category,
        domain,
        venue: venue.trim() || null,
        startAt,
        endAt,
        maxParticipants: maxParticipants > 0 ? maxParticipants : null,
        isTeamed,
        status,
        })

        onEventCreated(createdEvent)
        onClose()
    } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create event')
    } finally {
        setIsSubmitting(false)
    }
    }

    return (
    <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
        onClick={onClose}
    >
        <div
        className="bg-white rounded-lg border border-gray-200 shadow-xl max-w-lg w-full p-6 space-y-4 max-h-
[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        >
        <div className="flex items-center justify-between border-b border-gray-200 pb-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-black">
            Create New Tournament
            </h2>
            <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 text-xs font-bold border border-black text-black hover:bg-black hover:text-
white"
            >
            X
            </button>
        </div>

        {error && (
            <div className="p-2 border border-black text-xs text-black bg-gray-50">
            {error}
            </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
            <div>
            <label className="block text-xs font-bold uppercase text-black mb-1">
                Event Title
            </label>
            <input
                type="text"
                required
                placeholder="e.g. BGSC Badminton Smash Open"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded text-black bg-white
focus:outline-none focus:border-black"
            />
            </div>

            <div className="grid grid-cols-2 gap-3">
            <div>
                <label className="block text-xs font-bold uppercase text-black mb-1">
                Category
                </label>
                <select
                value={category}
                onChange={(e) => setCategory(e.target.value as EventCategory)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded text-black bg-white
focus:outline-none focus:border-black"
                >
                <option value="leagues">Leagues</option>
                <option value="bgec">BGEC</option>
                <option value="fitsoc">FitSoc</option>
                <option value="general">General</option>
                </select>
            </div>
            <div>
                <label className="block text-xs font-bold uppercase text-black mb-1">
                Domain
                </label>
                <select
                value={domain}
                onChange={(e) => setDomain(e.target.value as EventDomain)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded text-black bg-white
focus:outline-none focus:border-black"
                >
                <option value="sports">Sports</option>
                <option value="esports">Esports</option>
                <option value="fitness">Fitness</option>
                <option value="general">General</option>
                </select>
            </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
            <div>
                <label className="block text-xs font-bold uppercase text-black mb-1">
                Start Date
                </label>
                <input
                type="date"
                required
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded text-black bg-white
focus:outline-none focus:border-black"
                />
            </div>
            <div>
                <label className="block text-xs font-bold uppercase text-black mb-1">
                End Date
                </label>
                <input
                type="date"
                required
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded text-black bg-white
focus:outline-none focus:border-black"
                />
            </div>
            </div>

            <div>
            <label className="block text-xs font-bold uppercase text-black mb-1">
                Venue / Location
            </label>
            <input
                type="text"
                placeholder="e.g. Indoor Badminton Arena, Courts 1-4"
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded text-black bg-white
focus:outline-none focus:border-black"
            />
            </div>

            <div className="grid grid-cols-2 gap-3">
            <div>
                <label className="block text-xs font-bold uppercase text-black mb-1">
                Max Capacity
                </label>
                <input
                type="number"
                min={1}
                value={maxParticipants}
                onChange={(e) => setMaxParticipants(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded text-black bg-white
focus:outline-none focus:border-black"
                />
            </div>
            <div>
                <label className="block text-xs font-bold uppercase text-black mb-1">
                Initial Status
                </label>
                <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'draft' | 'upcoming')}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded text-black bg-white
focus:outline-none focus:border-black"
                >
                <option value="upcoming">Upcoming</option>
                <option value="draft">Draft</option>
                </select>
            </div>
            </div>

            <div className="pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold uppercase text-black">
                <input
                type="checkbox"
                checked={isTeamed}
                onChange={(e) => setIsTeamed(e.target.checked)}
                className="rounded border-gray-300 text-black focus:ring-black"
                />
                <span>Team Tournament (Check if Team vs. Solo)</span>
            </label>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-200">
            <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs border border-gray-300 text-black hover:bg-gray-100 rounded
transition-colors"
            >
                Cancel
            </button>
            <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 text-xs border border-black bg-black text-white hover:bg-gray-800 rounded
font-bold transition-colors disabled:opacity-50"
            >
                {isSubmitting ? 'Creating...' : 'Create Tournament'}
            </button>
            </div>
        </form>
        </div>
    </div>
    )
}

export default CreateEventModal