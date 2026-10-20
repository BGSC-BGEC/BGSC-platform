import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';

import { Icon } from '../icons/Icon';
import { Typography } from '../typography/Typography';
import { FONT_FAMILIES } from '../theme/typography';
import { useTheme } from '../theme/ThemeProvider';

export interface InterestTileProps {
  label: string;
  selected: boolean;
  onToggle: () => void;
  /** Tile width — the screen passes a third of its content width */
  width: number;
}

/** v2/InterestTile — multi-select tile: tinted with an orange outline and check when selected. */
export function InterestTile({ label, selected, onToggle, width }: InterestTileProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync();
        onToggle();
      }}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      style={[
        styles.tile,
        { width },
        selected
          ? { backgroundColor: colors.accentMuted, borderColor: colors.primary, borderWidth: 1.5, padding: 11.5 }
          : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
      ]}
    >
      <Typography color={selected ? 'text' : 'textMuted'} style={styles.label} numberOfLines={1}>
        {label}
      </Typography>
      {selected ? <Icon name="check" size={14} color="primary" /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 16 },
  label: { flex: 1, fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 13, lineHeight: 21 },
});
