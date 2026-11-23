import React from 'react';
import { Image } from 'expo-image';

/**
 * Logos a player can put on their card. `aspect` is width ÷ height of the (margin-cropped) image,
 * so every logo is sized by height and keeps its shape.
 *
 * Adding a logo: drop a transparent PNG, cropped to its edges, in assets/images/card-logos and
 * add a line here.
 */
export const CARD_LOGOS = [
  { id: 'bgsc', label: 'BGSC', source: require('../../../assets/images/bgsc-logo.png'), aspect: 1 },
  { id: 'bgec', label: 'BGEC', source: require('../../../assets/images/card-logos/bgec.png'), aspect: 983 / 623 },
] as const;

export type CardLogoId = (typeof CARD_LOGOS)[number]['id'];

export const DEFAULT_CARD_LOGO: CardLogoId = 'bgsc';

export function cardLogo(id: string | null | undefined) {
  return CARD_LOGOS.find((l) => l.id === id) ?? CARD_LOGOS[0];
}

/** The chosen logo at the given height; an unknown id falls back to the default. */
export function CardLogo({ id, height }: { id?: string | null; height: number }) {
  const logo = cardLogo(id);
  return (
    <Image
      source={logo.source}
      style={{ width: height * logo.aspect, height }}
      contentFit="contain"
      accessibilityLabel={`${logo.label} logo`}
    />
  );
}
