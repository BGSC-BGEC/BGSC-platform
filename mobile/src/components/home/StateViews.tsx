import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/GlassCard';
import { PillButton } from '@/components/PillButton';
import { FONTS } from '@/core/theme/fonts';
import { useColors } from '@/hooks/use-colors';

/**
 * Shared section-level state views for data-driven Home sections
 * (home-page.md §18 state matrices). Vector icons only — no emoji (§16.2).
 */

export function SectionError({ message, onRetry }: { message?: string; onRetry: () => void }) {
  const colors = useColors();
  return (
    <GlassCard>
      <View style={styles.errorRow}>
        <Ionicons name="alert-circle-outline" size={22} color={colors.danger} />
        <Text style={[styles.errorText, { color: colors.textMuted }]}>
          {message ?? 'Could not load this section.'}
        </Text>
      </View>
      <PillButton
        label="Retry"
        variant="ghost"
        onPress={onRetry}
        accessibilityLabel="Retry loading"
        style={styles.retry}
      />
    </GlassCard>
  );
}

export function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const colors = useColors();
  return (
    <GlassCard>
      <View style={styles.emptyRoot}>
        <Ionicons name={icon} size={40} color={colors.textMuted} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.emptyMessage, { color: colors.textMuted }]}>{message}</Text>
        {actionLabel && onAction ? (
          <PillButton
            label={actionLabel}
            variant="ghost"
            onPress={onAction}
            accessibilityLabel={actionLabel}
            style={styles.emptyAction}
          />
        ) : null}
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  errorText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    flexShrink: 1,
  },
  retry: {
    marginTop: 12,
  },
  emptyRoot: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  emptyTitle: {
    fontFamily: FONTS.semibold,
    fontSize: 16,
    marginTop: 4,
  },
  emptyMessage: {
    fontFamily: FONTS.body,
    fontSize: 13,
    textAlign: 'center',
  },
  emptyAction: {
    marginTop: 12,
  },
});
