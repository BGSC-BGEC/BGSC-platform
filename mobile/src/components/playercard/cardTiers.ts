/**
 * Player card styles, one per tier. The backend decides the tier from the rating
 * (`CARD_TIERS` in user-service `playerCard.ts`); the app only maps the name to a look.
 *
 * Rookie is the plain cream-and-tan card, Legend the dark maroon-and-gold one; Bronze, Silver and
 * Gold sit between. Each tier's ink/inkMuted on its bg is ≥ 4.5:1.
 */
export interface CardTierStyle {
  label: string;
  /** Card body */
  bg: string;
  /** Outer frame and its darker edge */
  frame: string;
  frameDeep: string;
  /** Ornaments, inner border line, plaque text */
  accent: string;
  /** Text */
  ink: string;
  inkMuted: string;
  /** Avatar ring and fill behind initials */
  ring: string;
  avatarBg: string;
  /** Bottom icon band */
  band: string;
  bandIcon: string;
  /** Interest chips */
  chipBg: string;
  chipText: string;
}

export const CARD_TIER_STYLES: Record<string, CardTierStyle> = {
  Rookie: {
    label: 'Rookie',
    bg: '#FAF4E8', frame: '#C9A97A', frameDeep: '#9C7B4E', accent: '#8C3B2E',
    ink: '#2B1D14', inkMuted: '#6B5440',
    ring: '#C9A97A', avatarBg: '#EBD3A8', band: '#EFE2C8', bandIcon: '#8C3B2E',
    chipBg: '#EBC0A6', chipText: '#5E2418',
  },
  Bronze: {
    label: 'Bronze',
    bg: '#F7E9DC', frame: '#B8733A', frameDeep: '#844A1E', accent: '#7A3418',
    ink: '#2E1B10', inkMuted: '#6A4A33',
    ring: '#C98A4B', avatarBg: '#E7B27E', band: '#EDD3BA', bandIcon: '#7A3418',
    chipBg: '#E3B392', chipText: '#5A2810',
  },
  Silver: {
    label: 'Silver',
    bg: '#EEF1F4', frame: '#9AA5B1', frameDeep: '#66717D', accent: '#3E4C5B',
    ink: '#1E2731', inkMuted: '#515C68',
    ring: '#B8C2CC', avatarBg: '#D5DCE3', band: '#DCE2E8', bandIcon: '#3E4C5B',
    chipBg: '#C9D2DB', chipText: '#26323E',
  },
  Gold: {
    label: 'Gold',
    bg: '#FFF6DA', frame: '#E0A92E', frameDeep: '#A06C14', accent: '#8A4B0F',
    ink: '#2A1B08', inkMuted: '#6A5024',
    ring: '#F2C14E', avatarBg: '#F7D77A', band: '#F7E3A6', bandIcon: '#8A4B0F',
    chipBg: '#F0C978', chipText: '#553106',
  },
  Legend: {
    label: 'Legend',
    bg: '#1F1A1D', frame: '#7A1F2E', frameDeep: '#4B111C', accent: '#E0B14A',
    ink: '#F6EAD3', inkMuted: '#CDBB9C',
    ring: '#E0B14A', avatarBg: '#E0B14A', band: '#7A1F2E', bandIcon: '#E0B14A',
    chipBg: '#7A1F2E', chipText: '#F6EAD3',
  },
};

export function cardTierStyle(tier: string | null | undefined): CardTierStyle {
  return CARD_TIER_STYLES[tier ?? ''] ?? CARD_TIER_STYLES.Rookie;
}
