import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { PillButton } from '@/components/PillButton';
import { FONTS } from '@/core/theme/fonts';
import { useColors } from '@/hooks/use-colors';

/** UPPERCASE letter-spaced section label flanked by hairlines (spec §5.3). */
export function SectionLabel({ label }: { label: string }) {
  const colors = useColors();
  return (
    <View style={styles.sectionLabelRow}>
      <View style={[styles.sectionHairline, { backgroundColor: colors.border }]} />
      <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{label}</Text>
      <View style={[styles.sectionHairline, { backgroundColor: colors.border }]} />
    </View>
  );
}

/** Empty state — illustration-free, message + optional CTA (spec states matrices). */
export function EmptyState({
  message,
  actionLabel,
  onAction,
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const colors = useColors();
  return (
    <View style={styles.state}>
      <Ionicons name="calendar-clear-outline" size={40} color={colors.textMuted} />
      <Text style={[styles.stateMessage, { color: colors.textMuted }]}>{message}</Text>
      {actionLabel && onAction ? (
        <PillButton label={actionLabel} onPress={onAction} variant="ghost" fullWidth={false} />
      ) : null}
    </View>
  );
}

/** Error state with retry (ORCHESTRATOR checklist: every data section). */
export function ErrorState({ message, onRetry }: { message?: string; onRetry: () => void }) {
  const colors = useColors();
  return (
    <View style={styles.state}>
      <Ionicons name="cloud-offline-outline" size={40} color={colors.danger} />
      <Text style={[styles.stateMessage, { color: colors.textMuted }]}>
        {message ?? "Couldn't load events. Check your connection."}
      </Text>
      <PillButton label="Retry" onPress={onRetry} variant="ghost" fullWidth={false} />
    </View>
  );
}

/** Small colored status pill (upcoming/ongoing/past) — STATUS_COLORS only. */
export function StatusPill({ status }: { status: 'upcoming' | 'ongoing' | 'past' }) {
  const colors = useColors();
  const color =
    status === 'ongoing' ? colors.success : status === 'upcoming' ? colors.info : colors.textMuted;
  return (
    <View style={[styles.statusPill, { backgroundColor: colors.surfaceMuted }]}>
      <View style={[styles.statusDot, { backgroundColor: color }]} />
      <Text style={[styles.statusText, { color: colors.textMuted }]}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 4,
  },
  sectionHairline: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  sectionLabel: {
    fontFamily: FONTS.semibold,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  state: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  stateMessage: {
    fontFamily: FONTS.body,
    fontSize: 14,
    textAlign: 'center',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
});
