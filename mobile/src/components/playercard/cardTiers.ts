import type { ThemeMode } from '../../theme/colors';

/**
 * Player card palettes, one per tier and theme mode. The backend decides the tier from the rating
 * (`CARD_TIERS` in user-service `playerCard.ts`); the app only maps the name to a look.
 *
 * The tier reads through the metal: the foil border, the avatar ring and the hero tint. The body
 * follows the app theme so a card never glares in dark mode or turns muddy in light. Rookie is
 * un-metalled stone with the brand coral; Legend keeps its maroon hero in both modes. Text pairs are ≥ 4.5:1 (ink, inkMuted, accent on surface; heroInk,
 * heroAccent on both hero stops; chipText on chipBg).
 */
export interface CardTierPalette {
  label: string;
  /** Card body */
  surface: string;
  /** Hero panel gradient, top to bottom */
  heroTop: string;
  heroBottom: string;
  /** Text on the hero (rating, wordmark) and the tier name there */
  heroInk: string;
  heroAccent: string;
  /** Metallic border, avatar ring and hero seam: dark edge, highlight, dark edge */
  foil: [string, string, string];
  /** Body text */
  ink: string;
  inkMuted: string;
  /** Hairlines between stats */
  hairline: string;
  /** Interest chips */
  chipBg: string;
  chipText: string;
  /** Fill behind initials when there's no photo */
  avatarBg: string;
}

type TierPalettes = Record<ThemeMode, CardTierPalette>;

export const CARD_TIER_STYLES: Record<string, TierPalettes> = {
  Rookie: {
    light: {
      label: 'Rookie',
      surface: '#FFFBF7', heroTop: '#EDE4DC', heroBottom: '#F7F1EB',
      heroInk: '#2A160E', heroAccent: '#9A4129',
      foil: ['#9C8E83', '#ECE5DE', '#74675D'],
      ink: '#1F1410', inkMuted: '#6B5549', hairline: '#EFDCD1',
      chipBg: '#F3EAE3', chipText: '#7A3520', avatarBg: '#E6D6CA',
    },
    dark: {
      label: 'Rookie',
      surface: '#1B1F27', heroTop: '#36302D', heroBottom: '#26252A',
      heroInk: '#F6ECE6', heroAccent: '#F0A48E',
      foil: ['#7E736B', '#D9D0C8', '#57504A'],
      ink: '#F3ECE6', inkMuted: '#B3A8A0', hairline: '#2F333C',
      chipBg: '#2B2928', chipText: '#F2C3B1', avatarBg: '#433B36',
    },
  },
  Bronze: {
    light: {
      label: 'Bronze',
      surface: '#FFF9F3', heroTop: '#EFCCAE', heroBottom: '#F9E6D5',
      heroInk: '#24160C', heroAccent: '#7E3F14',
      foil: ['#A8642C', '#F2C99F', '#74401A'],
      ink: '#24160C', inkMuted: '#6A4F3B', hairline: '#EEDCCB',
      chipBg: '#F4E1CF', chipText: '#6A3412', avatarBg: '#E7B27E',
    },
    dark: {
      label: 'Bronze',
      surface: '#1D1A18', heroTop: '#4A2E1C', heroBottom: '#2D221B',
      heroInk: '#F7ECE1', heroAccent: '#EBAE76',
      foil: ['#A8642C', '#F2C99F', '#74401A'],
      ink: '#F5EADF', inkMuted: '#BFAA98', hairline: '#332B25',
      chipBg: '#33271F', chipText: '#EEC39C', avatarBg: '#5A3A22',
    },
  },
  Silver: {
    light: {
      label: 'Silver',
      surface: '#FAFBFC', heroTop: '#D5DDE6', heroBottom: '#EAEFF4',
      heroInk: '#18202A', heroAccent: '#3B4856',
      foil: ['#7D8896', '#EEF2F6', '#56616E'],
      ink: '#18202A', inkMuted: '#556170', hairline: '#E1E6EC',
      chipBg: '#E7ECF1', chipText: '#2A3644', avatarBg: '#C9D2DB',
    },
    dark: {
      label: 'Silver',
      surface: '#1A1E25', heroTop: '#36404D', heroBottom: '#252B34',
      heroInk: '#F0F4F8', heroAccent: '#CBD5DF',
      foil: ['#7D8896', '#EEF2F6', '#56616E'],
      ink: '#EEF2F6', inkMuted: '#A9B3BE', hairline: '#2C323C',
      chipBg: '#272D36', chipText: '#D5DDE5', avatarBg: '#3A4350',
    },
  },
  Gold: {
    light: {
      label: 'Gold',
      surface: '#FFFCF3', heroTop: '#F8DC8E', heroBottom: '#FCEFC8',
      heroInk: '#22180A', heroAccent: '#7A4E08',
      foil: ['#C38A16', '#FFE7A3', '#8E5D0E'],
      ink: '#22180A', inkMuted: '#6A5428', hairline: '#F1E4BF',
      chipBg: '#FAEBC2', chipText: '#5E3D06', avatarBg: '#F7D77A',
    },
    dark: {
      label: 'Gold',
      surface: '#1D1B16', heroTop: '#4E3B12', heroBottom: '#2E2716',
      heroInk: '#FBF2DC', heroAccent: '#F2C14E',
      foil: ['#C38A16', '#FFE39A', '#8E5D0E'],
      ink: '#FBF2DC', inkMuted: '#C9B88F', hairline: '#36301F',
      chipBg: '#332C1A', chipText: '#F5D684', avatarBg: '#5A4614',
    },
  },
  Legend: {
    light: {
      label: 'Legend',
      surface: '#FFF9F2', heroTop: '#4B111C', heroBottom: '#7A1F2E',
      heroInk: '#F6EAD3', heroAccent: '#F0C45C',
      foil: ['#B8862A', '#FFF0B8', '#8A6218'],
      ink: '#2A1418', inkMuted: '#6E5156', hairline: '#F0DED6',
      chipBg: '#F5E1D8', chipText: '#6A1A27', avatarBg: '#E0B14A',
    },
    dark: {
      label: 'Legend',
      surface: '#17131A', heroTop: '#3E0D17', heroBottom: '#6E1A29',
      heroInk: '#F6EAD3', heroAccent: '#F0C45C',
      foil: ['#B8862A', '#FFF0B8', '#8A6218'],
      ink: '#F6EAD3', inkMuted: '#CDBB9C', hairline: '#2E2329',
      chipBg: '#2C1E24', chipText: '#F2D9A0', avatarBg: '#7A1F2E',
    },
  },
};

export function cardTierStyle(tier: string | null | undefined, mode: ThemeMode = 'light'): CardTierPalette {
  return (CARD_TIER_STYLES[tier ?? ''] ?? CARD_TIER_STYLES.Rookie)[mode];
}
