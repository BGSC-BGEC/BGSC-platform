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
  style,
}: ListRowProps) {
  const { colors } = useTheme();
  const content = (
    <>
      {icon ? (
        <View style={[styles.icon, { backgroundColor: danger ? colors.dangerMuted : colors.surfaceInner }]}>
          <Icon name={icon} size={18} color={danger ? 'danger' : 'textMuted'} />
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
      style={[styles.row, disabled && styles.disabled, style]}
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
  icon: { padding: 8, borderRadius: 12 },
  text: { flex: 1, minWidth: 0, gap: 4 },
});
