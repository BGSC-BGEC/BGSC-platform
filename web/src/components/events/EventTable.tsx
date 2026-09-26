import React from 'react'
import type { ClubEvent } from '../../types/event'

export interface EventTableProps {
    events: ClubEvent[]
    onViewEvent: (event: ClubEvent) => void
}

export const EventTable: React.FC<EventTableProps> = ({ events, onViewEvent }) => {
    return (
    <div className="overflow-x-auto rounded border border-gray-200 bg-white">
        <table className="w-full text-left text-sm text-black border-collapse">
        <thead className="border-b border-gray-200 bg-gray-50 text-xs font-bold uppercase text-gray-600 tracking-
wider">
            <tr>
            <th className="p-4">Event & Category</th>
            <th className="p-4">Format</th>
            <th className="p-4">Dates</th>
            <th className="p-4">Capacity</th>
            <th className="p-4">Status</th>
            <th className="p-4 text-right">Actions</th>
            </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
            {events.length === 0 ? (
            <tr>
                <td colSpan={6} className="p-12 text-center">
                <div className="text-base font-bold text-black">
                    No events currently
                </div>
                <div className="text-xs text-gray-500 mt-1">
                    Schedule a new tournament to get started.
                </div>
                </td>
            </tr>
            ) : (
            events.map((event) => (
                <tr key={event.id} className="hover:bg-gray-50 transition-colors">
                <td className="p-4">
                    <div className="font-bold text-black">{event.title}</div>
                    <div className="text-xs text-gray-500 uppercase mt-0.5">
                    {event.category} - {event.domain}
                    </div>
                </td>

                <td className="p-4 text-xs font-semibold uppercase text-black">
                    {event.isTeamed ? 'Team' : 'Solo'}
                </td>

                <td className="p-4 text-xs text-gray-600">
                    {event.startAt} to {event.endAt}
                </td>

                <td className="p-4 font-mono text-sm text-black">
                    {event.currentParticipants} / {event.maxParticipants ?? 'Unlimited'}
                </td>

                <td className="p-4 text-xs font-semibold uppercase text-black">
                    {event.status}
                </td>

                <td className="p-4 text-right">
                    <button
                    type="button"
                    onClick={() => onViewEvent(event)}
                    className="px-3 py-1 text-xs font-medium border border-black text-black bg-white hover:bg-
black hover:text-white transition-colors rounded"
                    >
                    View Details
                    </button>
                </td>
                </tr>
            ))
            )}
        </tbody>
        </table>
    </div>
    )
}

export default EventTable