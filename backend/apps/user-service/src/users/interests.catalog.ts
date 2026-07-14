export interface InterestEntry {
  id: string;
  label: string;
  domain: 'sports' | 'esports' | 'gaming_industry' | 'game_dev';
}

/** Canonical interest catalog — spec §6.2 Interest Fields Popup. */
export const INTERESTS_CATALOG: InterestEntry[] = [
  // Sports
  { id: 'football', label: 'Football', domain: 'sports' },
  { id: 'basketball', label: 'Basketball', domain: 'sports' },
  { id: 'cricket', label: 'Cricket', domain: 'sports' },
  { id: 'badminton', label: 'Badminton', domain: 'sports' },
  { id: 'table_tennis', label: 'Table Tennis', domain: 'sports' },
  // Esports
  { id: 'valorant', label: 'Valorant', domain: 'esports' },
  { id: 'cs', label: 'CS (Counter-Strike)', domain: 'esports' },
  { id: 'tekken', label: 'Tekken', domain: 'esports' },
  { id: 'minecraft', label: 'Minecraft', domain: 'esports' },
  { id: 'other_esport', label: 'Other Esport Games', domain: 'esports' },
  // Gaming Industry
  { id: 'story_mode_games', label: 'Story Mode Games', domain: 'gaming_industry' },
  { id: 'indie_games', label: 'Indie Games', domain: 'gaming_industry' },
  // Game Development
  { id: 'unity', label: 'Unity', domain: 'game_dev' },
  { id: 'unreal_engine', label: 'Unreal Engine', domain: 'game_dev' },
  { id: 'indie_from_scratch', label: 'Indie Games from Scratch', domain: 'game_dev' },
];

export const INTEREST_ID_SET = new Set(INTERESTS_CATALOG.map((i) => i.id));
