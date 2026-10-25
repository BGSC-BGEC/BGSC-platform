import { api, cleanParams } from '../api/client';
import type {
  ApiEvent,
  EventCategory,
  EventEligibility,
  EventListResponse,
  EventStatus,
  FormSubmission,
} from '../api/types';

export interface EventListQuery {
  category?: EventCategory[];
  status?: EventStatus[];
  search?: string;
  type?: ApiEvent['type'];
  sort?: 'date_asc' | 'date_desc' | 'popular' | 'title';
  limit?: number;
  cursor?: string | null;
}

export type InvestmentEvent = ApiEvent & {
  points_pool?: { investment_enabled: boolean; investment_cap: number | null };
};

export class EventsRepository {
  /** GET /events — cursor pagination (pass `next_cursor` back as `cursor`). */
  list(query: EventListQuery = {}): Promise<EventListResponse> {
    return api.get<EventListResponse>('/events', {
      params: cleanParams({ limit: 20, ...query }),
    });
  }

  /** GET /events/:ref — ref is the event id or its slug. */
  get(ref: string): Promise<InvestmentEvent> {
    return api.get<InvestmentEvent>(`/events/${encodeURIComponent(ref)}`);
  }

  /** Alias for `get(ref)` used by standings/leaderboard screens. */
  getById(ref: string): Promise<InvestmentEvent> {
    return this.get(ref);
  }

  /** GET /events/:ref/eligibility — can the signed-in member register right now? */
  eligibility(ref: string): Promise<EventEligibility> {
    return api.get<EventEligibility>(`/events/${encodeURIComponent(ref)}/eligibility`);
  }

  /** GET /events/:ref/my-registration — null when not registered. */
  myRegistration(ref: string): Promise<FormSubmission | null> {
    return api.get<FormSubmission | null>(`/events/${encodeURIComponent(ref)}/my-registration`);
  }
}

export const eventsRepository = new EventsRepository();
