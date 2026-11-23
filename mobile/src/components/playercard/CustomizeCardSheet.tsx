import React from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { BottomSheet } from '../BottomSheet';
import { Button } from '../Button';
import { Icon } from '../../icons/Icon';
import { Typography } from '../../typography/Typography';
import { useTheme } from '../../theme/ThemeProvider';
import { withAlpha } from '../../theme/colors';
import { PLAYER_CARD_HEIGHT, PLAYER_CARD_WIDTH, type PlayerCardViewProps } from './PlayerCardView';
import { CARD_STYLES, PlayerCard, type CardStyleId } from './cardStyles';
import { CARD_LOGOS, CardLogo, type CardLogoId } from './cardLogos';

/** BottomSheet's own side padding; the design row bleeds through it to the screen edges. */
const SHEET_PAD = 20;
const GAP = 10;
/** Frame padding + border around each preview, per side */
const FRAME_EDGE = 3 + 2;
/** Designs in view at once: two whole and the next one peeking, so the row reads as scrollable. */
const VISIBLE = 2.4;

/**
 * Pick the player card's design, then its logo. Each design is drawn small with the player's own
 * details and the chosen logo; a tap applies straight away and Done just closes.
 */
export function CustomizeCardSheet({
  visible,
  onClose,
  card,
  cardStyle,
  onCardStyleChange,
  logo,
  onLogoChange,
}: {
  visible: boolean;
  onClose: () => void;
  card: PlayerCardViewProps;
  cardStyle: CardStyleId;
  onCardStyleChange: (style: CardStyleId) => void;
  logo: CardLogoId;
  onLogoChange: (logo: CardLogoId) => void;
}) {
  const { colors } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  // Previews are the real cards, scaled so VISIBLE of them fit from the sheet's left padding.
  const itemW = (windowWidth - SHEET_PAD - GAP * Math.floor(VISIBLE)) / VISIBLE;
  const scale = Math.min(0.45, Math.max(0.3, (itemW - FRAME_EDGE * 2) / PLAYER_CARD_WIDTH));
  const PW = PLAYER_CARD_WIDTH * scale;
  const PH = PLAYER_CARD_HEIGHT * scale;
  const pick = <T,>(active: boolean, value: T, set: (v: T) => void) => () => {
    if (active) return;
    void Haptics.selectionAsync();
    set(value);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Typography variant="h2">Customize card</Typography>
      <Typography variant="bodySmall" color="textMuted" style={styles.subtitle}>
        Choose how your player card looks. Your stats stay the same in every design.
      </Typography>

      <Typography variant="caption" color="textMuted" style={styles.section}>
        DESIGN
      </Typography>
      {/* Scrolls sideways, edge to edge: the next design peeks in at the screen edge */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.designScroll}
        contentContainerStyle={styles.designRow}
      >
        {CARD_STYLES.map((s) => {
          const active = s.id === cardStyle;
          return (
            <Pressable
              key={s.id}
              onPress={pick(active, s.id as CardStyleId, onCardStyleChange)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${s.label} design`}
              style={styles.option}
            >
              <View style={[styles.frame, { borderColor: active ? colors.primary : 'transparent' }]}>
                <View style={{ width: PW, height: PH }}>
                  <View
                    pointerEvents="none"
                    style={{
                      width: PLAYER_CARD_WIDTH,
                      height: PLAYER_CARD_HEIGHT,
                      transform: [{ scale }],
                      marginLeft: -(PLAYER_CARD_WIDTH * (1 - scale)) / 2,
                      marginTop: -(PLAYER_CARD_HEIGHT * (1 - scale)) / 2,
                    }}
                  >
                    <PlayerCard {...card} logo={logo} cardStyle={s.id} />
                  </View>
                </View>
                {active && <Check color={colors.primary} />}
              </View>
              <Typography variant="bodySmall" color={active ? 'primary' : 'text'} style={styles.label}>
                {s.label}
              </Typography>
            </Pressable>
          );
        })}
      </ScrollView>

      <Typography variant="caption" color="textMuted" style={styles.section}>
        LOGO
      </Typography>
      <View style={styles.row}>
        {CARD_LOGOS.map((l) => {
          const active = l.id === logo;
          return (
            <Pressable
              key={l.id}
              onPress={pick(active, l.id as CardLogoId, onLogoChange)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${l.label} logo`}
              style={styles.option}
            >
              <View
                style={[
                  styles.logoTile,
                  {
                    backgroundColor: withAlpha(colors.surfaceInner, 0.85),
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
              >
                <CardLogo id={l.id} height={40} />
                {active && <Check color={colors.primary} />}
              </View>
              <Typography variant="bodySmall" color={active ? 'primary' : 'text'} style={styles.label}>
                {l.label}
              </Typography>
            </Pressable>
          );
        })}
      </View>

      <Button label="Done" onPress={onClose} />
    </BottomSheet>
  );
}

function Check({ color }: { color: string }) {
  return (
    <View style={[styles.check, { backgroundColor: color }]}>
      <Icon name="check" size={14} color="#FFFFFF" />
    </View>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    marginTop: 2,
    marginBottom: 10,
  },
  section: {
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  designScroll: {
    marginHorizontal: -SHEET_PAD,
    marginBottom: 8,
  },
  designRow: {
    gap: GAP,
    paddingTop: 6, // room for the check badge
    paddingHorizontal: SHEET_PAD,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
    marginBottom: 14,
  },
  option: {
    alignItems: 'center',
  },
  frame: {
    padding: 3,
    borderWidth: 2,
    borderRadius: 12,
  },
  logoTile: {
    width: 96,
    height: 64,
    borderWidth: 2,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    marginTop: 3,
    fontWeight: '600',
  },
});
