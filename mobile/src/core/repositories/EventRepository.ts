import type { PlatformEvent } from '../types';

/**
 * Event Model layer.
 *
 * TODO(Milestone 1.2 — Event Service): replace MOCK_EVENTS with real gateway
 * calls (`apiClient.get('/events')`) once the Event Service ships. The shape
 * here already matches the planned `GET /events` response so swapping the
 * implementation won't touch callers.
 */
const MOCK_EVENTS: PlatformEvent[] = [
  {
    id: 'evt-offside-2026',
    title: 'Offside — Football League',
    type: 'LE',
    status: 'upcoming',
    startDate: '2026-07-01',
    endDate: '2026-07-20',
    venue: 'Sports Complex Ground',
  },
  {
    id: 'evt-valorant-cup',
    title: 'BGEC Valorant Cup',
    type: 'DE',
    status: 'ongoing',
    startDate: '2026-06-15',
    endDate: '2026-06-25',
    venue: 'Esports Arena',
  },
  {
    id: 'evt-fitsoc-run',
    title: 'FitSoc Campus 5K Run',
    type: 'ALL',
    status: 'past',
    startDate: '2026-05-10',
    endDate: '2026-05-10',
    venue: 'Main Gate',
  },
];

export const EventRepository = {
  async list(): Promise<PlatformEvent[]> {
    // Simulate network latency so loading states are exercised in the shell.
    await new Promise((resolve) => setTimeout(resolve, 200));
    return MOCK_EVENTS;
  },
};
