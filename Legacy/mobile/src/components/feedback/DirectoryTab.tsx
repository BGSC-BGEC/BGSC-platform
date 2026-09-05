import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Clipboard, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { SectionHeader } from '@/components/feedback/SectionHeader';
import { initialsOf } from '@/components/feedback/types';
import { GlassCard } from '@/components/GlassCard';
import { PillButton } from '@/components/PillButton';
import { SkeletonBlock } from '@/components/SkeletonBlock';
import { useToast } from '@/components/Toast';
import type { Coordinator, LegacyAdmin } from '@/core/repositories/FeedbackRepository';
import { FONTS } from '@/core/theme/fonts';
import { WHATSAPP_BRAND } from '@/core/theme/tokens';
import { useColors } from '@/hooks/use-colors';

export interface DirectoryTabProps {
  coordinators: Coordinator[] | undefined;
  isLoading: boolean;
  isError: boolean;
  legacy: LegacyAdmin[] | undefined;
  onRetry: () => void;
  onReportIssue: (coordinatorName: string) => void;
}

/** Tab 2 — active coordinator contacts + read-only Hall of Admin (spec §5). */
export function DirectoryTab({
  coordinators,
  isLoading,
  isError,
  legacy,
  onRetry,
  onReportIssue,
}: DirectoryTabProps) {
  const colors = useColors();
  const [openLegacy, setOpenLegacy] = useState(false);
  const header = <SectionHeader title="Contact Directory" subtitle="Current, for this term." />;

  if (isLoading) {
    return (
      <View style={styles.tab}>
        {header}
        {[0, 1, 2].map((i) => (
          <GlassCard key={i} accessibilityLabel="Loading coordinator" style={styles.skeletonCard}>
            <View style={styles.skeletonTop}>
              <SkeletonBlock width={48} height={48} radius={24} />
              <View style={styles.skeletonCol}>
                <SkeletonBlock width="55%" height={15} radius={4} style={styles.cardLine} />
                <SkeletonBlock width="35%" height={12} radius={4} />
              </View>
            </View>
            <SkeletonBlock height={36} radius={6} style={styles.cardLine} />
            <SkeletonBlock height={36} radius={6} />
          </GlassCard>
        ))}
      </View>
    );
  }

  if (isError || !coordinators) {
    return (
      <View style={styles.tab}>
        {header}
        <StateCard message="Unable to load the directory." action="Retry" onAction={onRetry} />
      </View>
    );
  }

  if (coordinators.length === 0) {
    return (
      <View style={styles.tab}>
        {header}
        <StateCard
          message="No active coordinators listed for this term."
          action="Submit a Ticket"
          onAction={() => onReportIssue('')}
        />
      </View>
    );
  }

  return (
    <View style={styles.tab}>
      {header}
      <View style={styles.list}>
        {coordinators.map((coordinator) => (
          <CoordinatorCard
            key={coordinator.id}
            coordinator={coordinator}
            onReport={() => onReportIssue(coordinator.name)}
          />
        ))}
      </View>

      <SectionHeader title="Hall of Admin" subtitle="The legacy leaders who built BGSC." />
      <GlassCard accessibilityLabel="Hall of Admin, past coordinators" style={styles.legacyCard}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            setOpenLegacy((open) => !open);
          }}
          accessibilityRole="button"
          accessibilityLabel={`${openLegacy ? 'Collapse' : 'Expand'} past coordinators`}
          accessibilityState={{ expanded: openLegacy }}
          style={styles.legacyHeader}
        >
          <Text style={[styles.legacyTitle, { color: colors.text }]}>Past Coordinators</Text>
          <Ionicons name={openLegacy ? 'chevron-up' : 'chevron-down'} size={20} color={colors.accent} />
        </Pressable>
        {openLegacy
          ? (legacy ?? []).map((admin) => <LegacyRow key={admin.id} admin={admin} />)
          : null}
      </GlassCard>
    </View>
  );
}

function CoordinatorCard({ coordinator, onReport }: { coordinator: Coordinator; onReport: () => void }) {
  const colors = useColors();
  const toast = useToast();
  const [revealed, setRevealed] = useState(false);

  const reveal = () => {
    if (revealed) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRevealed(true);
  };

  const openWhatsApp = () => {
    reveal();
    const number = coordinator.phone.replace(/\s+/g, '').replace(/^\+/, '');
    Linking.openURL(`https://wa.me/${number}`).catch(() => toast.show('Could not open WhatsApp.'));
  };

  const email = () =>
    Linking.openURL(`mailto:${coordinator.email}`).catch(() => toast.show('Could not open your mail app.'));

  const copy = () => {
    // RN core Clipboard is deprecated; ponytail: use it until an approved clipboard package is added.
    Clipboard.setString(`${coordinator.name} · ${coordinator.role} · ${coordinator.email} · ${coordinator.phone}`);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    toast.show('Contact details copied');
  };

  return (
    <GlassCard accessibilityLabel={`Contact ${coordinator.name}`} style={styles.coordinatorCard}>
      <View style={styles.coordinatorTop}>
        <View style={[styles.avatar, { backgroundColor: colors.surfaceMuted }]}>
          <Text style={[styles.avatarText, { color: colors.textMuted }]}>{initialsOf(coordinator.name)}</Text>
        </View>
        <View style={styles.coordinatorCol}>
          <Text style={[styles.coordinatorName, { color: colors.text }]}>{coordinator.name}</Text>
          <Text style={[styles.muted, { color: colors.textMuted }]}>
            {coordinator.role} · {coordinator.tenure}
          </Text>
          <Text style={[styles.muted, { color: colors.textMuted }]}>{coordinator.email}</Text>
        </View>
      </View>

      <View style={styles.contactRow}>
        <Pressable
          onPress={openWhatsApp}
          accessibilityRole="button"
          accessibilityLabel={`Chat with ${coordinator.name} on WhatsApp`}
          style={({ pressed }) => [
            styles.whatsAppButton,
            { borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Ionicons name="logo-whatsapp" size={20} color={WHATSAPP_BRAND} />
        </Pressable>
        <Pressable
          onPress={reveal}
          disabled={revealed}
          accessibilityRole="button"
          accessibilityLabel={revealed ? `Phone ${coordinator.phone}` : 'Tap to reveal phone number'}
          accessibilityState={{ disabled: revealed }}
          style={[styles.phoneContainer, { borderColor: colors.border }]}
        >
          <Text style={[styles.phoneText, { color: revealed ? colors.text : colors.borderActive }]}>
            {coordinator.phone}
          </Text>
          {!revealed ? (
            <View style={[StyleSheet.absoluteFill, styles.phoneMask, { backgroundColor: colors.surfaceSolid }]}>
              <Ionicons name="eye-off-outline" size={15} color={colors.textMuted} />
              <Text style={[styles.revealHint, { color: colors.textMuted }]}>Tap to reveal</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      <View style={styles.actionRow}>
        <ActionButton label="Email" icon="mail-outline" onPress={email} />
        <ActionButton label="Copy" icon="copy-outline" onPress={copy} />
        <ActionButton label="Report Issue" icon="flag-outline" onPress={onReport} />
      </View>
    </GlassCard>
  );
}

function ActionButton({ label, icon, onPress }: { label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.actionButton,
        { borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <Ionicons name={icon} size={15} color={colors.textMuted} />
      <Text style={[styles.actionLabel, { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

function LegacyRow({ admin }: { admin: LegacyAdmin }) {
  const colors = useColors();
  return (
    <View style={[styles.legacyRow, { borderTopColor: colors.border }]}>
      <View style={[styles.legacyAvatar, { backgroundColor: colors.surfaceMuted }]}>
        <Text style={[styles.legacyAvatarText, { color: colors.textMuted }]}>{initialsOf(admin.name)}</Text>
      </View>
      <View style={styles.legacyCol}>
        <View style={styles.legacyTitleRow}>
          <Text style={[styles.legacyName, { color: colors.text }]} numberOfLines={1}>{admin.name}</Text>
          <Text style={[styles.tenureBadge, { color: colors.textMuted }]}>{admin.tenure}</Text>
        </View>
        <Text style={[styles.muted, { color: colors.textMuted }]}>{admin.role}</Text>
        <Text style={[styles.legacyQuote, { color: colors.textMuted }]}>“{admin.quote}”</Text>
      </View>
    </View>
  );
}

function StateCard({ message, action, onAction }: { message: string; action: string; onAction: () => void }) {
  const colors = useColors();
  return (
    <GlassCard accessibilityLabel={message} style={styles.stateCard}>
      <Text style={[styles.stateMessage, { color: colors.text }]}>{message}</Text>
      <PillButton variant="ghost" label={action} onPress={onAction} style={styles.stateAction} />
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  tab: { paddingHorizontal: 16, paddingBottom: 40 },
  list: { gap: 12, marginBottom: 12 },
  coordinatorCard: { borderRadius: 8, padding: 16 },
  coordinatorTop: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: FONTS.heading, fontSize: 20 },
  coordinatorCol: { flex: 1, gap: 1 },
  coordinatorName: { fontFamily: FONTS.semibold, fontSize: 16, lineHeight: 22 },
  muted: { fontFamily: FONTS.body, fontSize: 13, lineHeight: 18 },
  contactRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  whatsAppButton: { width: 44, height: 44, borderRadius: 6, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  phoneContainer: { flex: 1, height: 44, borderRadius: 6, borderWidth: 1, paddingHorizontal: 12, justifyContent: 'center', overflow: 'hidden' },
  phoneText: { fontFamily: FONTS.mono, fontSize: 13, lineHeight: 16 },
  phoneMask: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  revealHint: { fontFamily: FONTS.body, fontSize: 12 },
  actionRow: { flexDirection: 'row', gap: 8 },
  actionButton: { flex: 1, minHeight: 44, borderRadius: 6, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  actionLabel: { fontFamily: FONTS.body, fontSize: 11, lineHeight: 16 },
  legacyCard: { borderRadius: 8, padding: 12 },
  legacyHeader: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  legacyTitle: { fontFamily: FONTS.semibold, fontSize: 15 },
  legacyRow: { flexDirection: 'row', gap: 10, borderTopWidth: 1, paddingTop: 12, marginTop: 10 },
  legacyAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  legacyAvatarText: { fontFamily: FONTS.heading, fontSize: 17 },
  legacyCol: { flex: 1 },
  legacyTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  legacyName: { flex: 1, fontFamily: FONTS.semibold, fontSize: 14, lineHeight: 18 },
  tenureBadge: { fontFamily: FONTS.body, fontSize: 12 },
  legacyQuote: { fontFamily: FONTS.body, fontSize: 12, lineHeight: 18, marginTop: 4, fontStyle: 'italic' },
  stateMessage: { fontFamily: FONTS.medium, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  stateAction: { marginTop: 14 },
  stateCard: { marginTop: 12, gap: 10 },
  skeletonCard: { marginBottom: 12 },
  skeletonTop: { flexDirection: 'row', gap: 12, marginBottom: 10 },
  skeletonCol: { flex: 1 },
  cardLine: { marginBottom: 8 },
});
