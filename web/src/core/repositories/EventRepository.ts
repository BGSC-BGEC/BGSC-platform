import { apiClient } from '../api/ApiClient'
import type { PlatformEvent } from '../types'

export const EventRepository = {
  list(): Promise<PlatformEvent[]> {
    return apiClient.get<PlatformEvent[]>('/events')
  },

  getById(id: string): Promise<PlatformEvent> {
    return apiClient.get<PlatformEvent>(`/events/${id}`)
  },
}
