declare module '*/mock' {
  export const isMockModeActive: () => boolean;
  export const handleMockRequest: (config: any) => Promise<any> | null;
  export const mockUser: any;
  export const mockPlayerCard: any;
  export const mockStandings: any[];
  export const mockEvents: any[];
  export const mockAnnouncements: any[];
  export const mockChallenges: any[];
  export const mockParticipations: any[];
  export const mockNotifications: any[];
  export const mockHallOfFameEntries: any[];
  export const mockAlbums: any[];
  export const mockMediaItems: any[];
}
