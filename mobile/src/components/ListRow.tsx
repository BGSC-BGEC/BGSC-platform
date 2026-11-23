import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Icon, type IconName } from '../icons/Icon';
import { Typography } from '../typography/Typography';
import { useTheme } from '../theme/ThemeProvider';

export interface ListRowProps {
  title: string;
  subtitle?: string;
  icon?: IconName;
  trailing?: React.ReactNode;
  onPress?: () => void;
  danger?: boolean;
  disabled?: boolean;
  /** Brand-tinted icon tile (orange icon on a soft orange square) instead of the neutral one. */
  accent?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function ListRow({
  title,
  subtitle,
  icon,
  trailing,
  onPress,
  danger = false,
  disabled = false,
  accent = false,
  style,
}: ListRowProps) {
  const { colors } = useTheme();
  const tileBg = danger ? colors.dangerMuted : accent ? colors.accentMuted : colors.surfaceInner;
  const tileFg = danger ? 'danger' : accent ? 'primary' : 'textMuted';
  const content = (
    <>
      {icon ? (
        <View style={[styles.icon, { backgroundColor: tileBg }]}>
          <Icon name={icon} size={18} color={tileFg} />
        </View>
      ) : null}
      <View style={styles.text}>
        <Typography variant="button" color={danger ? 'danger' : 'text'} numberOfLines={1}>
          {title}
        </Typography>
        {subtitle ? (
          <Typography variant="caption" color="textMuted" numberOfLines={2}>
            {subtitle}
          </Typography>
        ) : null}
      </View>
      {trailing ?? (onPress ? <Icon name="chevron-right" size={18} color="textMuted" /> : null)}
    </>
  );
  return onPress ? (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.row,
        disabled && styles.disabled,
        style,
        pressed && { backgroundColor: colors.surfaceHighlight },
      ]}
    >
      {content}
    </Pressable>
  ) : (
    <View style={[styles.row, disabled && styles.disabled, style]}>{content}</View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 12 },
  disabled: { opacity: 0.5 },
  icon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0, gap: 4 },
});
