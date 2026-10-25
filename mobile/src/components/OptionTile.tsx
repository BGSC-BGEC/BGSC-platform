import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Icon, type IconName } from '../icons/Icon';
import { Typography } from '../typography/Typography';
import { useTheme } from '../theme/ThemeProvider';

export interface OptionTileProps {
  label: string;
  description?: string;
  icon?: IconName;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

export function OptionTile({
  label,
  description,
  icon,
  selected,
  disabled = false,
  onPress,
  style,
}: OptionTileProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => {
        if (disabled) return;
        void Haptics.selectionAsync();
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      style={[
        styles.tile,
        {
          backgroundColor: selected ? colors.accentMuted : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      <View style={styles.header}>
        {icon ? <Icon name={icon} size={18} color={selected ? 'primary' : 'textMuted'} /> : null}
        <Typography variant="button" color={selected ? 'primary' : 'text'} numberOfLines={1} style={styles.label}>
          {label}
        </Typography>
      </View>
      {description ? (
        <Typography variant="caption" color="textMuted" numberOfLines={2}>
          {description}
        </Typography>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexGrow: 1,
    flexBasis: '46%',
    minWidth: 120,
    minHeight: 56,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 4,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { flex: 1 },
});
