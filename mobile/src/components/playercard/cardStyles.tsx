import React from 'react';

import { PlayerCardView, type PlayerCardViewProps } from './PlayerCardView';
import { ValorantCardView } from './ValorantCardView';
import { FifaCardView } from './FifaCardView';
import { MinecraftCardView } from './MinecraftCardView';
import { CounterStrikeCardView } from './CounterStrikeCardView';
import { CyberpunkCardView } from './CyberpunkCardView';

/**
 * The player card styles a user can pick from. Every style takes the same props and draws at the
 * same fixed size (PLAYER_CARD_WIDTH × PLAYER_CARD_HEIGHT), so the profile, landing and Customize
 * card sheet can show any of them. Each style keeps the BDome in its background.
 *
 * Adding a style: write a `<Name>CardView` taking `PlayerCardViewProps`, then add it here.
 */
export const CARD_STYLES = [
  { id: 'classic', label: 'Classic', Component: PlayerCardView },
  { id: 'valorant', label: 'Valorant', Component: ValorantCardView },
  { id: 'fifa', label: 'FIFA', Component: FifaCardView },
  { id: 'cyberpunk', label: 'Cyberpunk', Component: CyberpunkCardView },
  { id: 'counter-strike', label: 'Counter-Strike', Component: CounterStrikeCardView },
  { id: 'minecraft', label: 'Minecraft', Component: MinecraftCardView },
] as const;

export type CardStyleId = (typeof CARD_STYLES)[number]['id'];

export const DEFAULT_CARD_STYLE: CardStyleId = 'classic';

/** The card in the given style; an unknown id falls back to the default. */
export function PlayerCard({ cardStyle, ...props }: PlayerCardViewProps & { cardStyle?: string }) {
  const entry = CARD_STYLES.find((s) => s.id === cardStyle) ?? CARD_STYLES[0];
  const { Component } = entry;
  return <Component {...props} />;
}
