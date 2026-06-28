import { apiClient } from '../api/ApiClient';
import type { HallOfFameEventWinner, HallOfFameSponsorChampion } from '../types';

export const HallOfFameRepository = {
  async getEventWinners(): Promise<HallOfFameEventWinner[]> {
    const dtos = await apiClient.get<any[]>('/hall-of-fame/event-winners');
    return dtos.map((d) => ({
      ...d,
      eventDate: typeof d.eventDate === 'string' ? d.eventDate : new Date(d.eventDate).toISOString(),
    }));
  },

  getSponsorChampions(): Promise<HallOfFameSponsorChampion[]> {
    return apiClient.get<HallOfFameSponsorChampion[]>('/hall-of-fame/sponsor-champions');
  },
};
