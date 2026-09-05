import { EventTable } from '../components/EventTable'

export function Events() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-100">Events</h1>
        <p className="text-sm text-slate-400 mt-1">All platform events from the event service.</p>
      </div>
      <EventTable />
    </div>
  )
}
