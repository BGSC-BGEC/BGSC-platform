import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '../icons/Icon';
import { Typography } from '../typography/Typography';
import { FONT_FAMILIES } from '../theme/typography';
import { useTheme } from '../theme/ThemeProvider';

export interface FabProps {
  label: string;
  icon?: IconName;
  onPress: () => void;
  /** Extra bottom offset, e.g. when a tab bar sits under the screen content */
  bottom?: number;
}

/** v2 floating action button — solid orange pill, bottom-right. */
export function Fab({ label, icon = 'plus', onPress, bottom = 0 }: FabProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.fab,
        { backgroundColor: colors.primarySolid, bottom: bottom + Math.max(insets.bottom, 16) },
        pressed && styles.pressed,
      ]}
    >
      <Icon name={icon} size={20} color="primaryText" />
      <Typography variant="button" color="primaryText" style={styles.label}>
        {label}
      </Typography>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  pressed: { opacity: 0.85 },
  label: { fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 14 },
});
