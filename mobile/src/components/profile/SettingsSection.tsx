import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';

import { GlassCard } from '@/components/GlassCard';
import { PillButton } from '@/components/PillButton';
import { useToast } from '@/components/Toast';
import { FONTS } from '@/core/theme/fonts';
import { useColors } from '@/hooks/use-colors';

/**
 * Settings & account actions (profile spec §8): placeholder rows for the
 * account-actions popup features that have no flow yet, and the logout
 * action (ghost destructive + confirm). Logout clears the session via
 * authStore; the screen re-gates to AuthLocked automatically.
 */
export function SettingsSection({ onLogout }: { onLogout: () => Promise<void> }) {
  const colors = useColors();
  const toast = useToast();
  const qc = useQueryClient();

  const confirmLogout = () => {
    Alert.alert('Log out?', 'You can sign back in anytime.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: () => {
          void onLogout().then(() => {
            qc.invalidateQueries({ queryKey: ['profile'] });
          });
        },
      },
    ]);
  };

  const placeholderRows: { icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
    // TODO(Phase 2): wire each to its flow — Account Actions popup (spec §8.1),
    // push-notification preferences, security/2FA (auth-service endpoints exist).
    { icon: 'person-outline', label: 'Account' },
    { icon: 'notifications-outline', label: 'Notifications' },
    { icon: 'shield-checkmark-outline', label: 'Privacy & Security' },
  ];

  return (
    <GlassCard accessibilityLabel="Settings">
      <Text style={[styles.heading, { color: colors.text }]}>⚙️ Settings</Text>
      {placeholderRows.map((row, i) => (
        <Pressable
          key={row.label}
          onPress={() => {
            // TODO(Phase 2): no flow yet — see placeholderRows comment.
            toast.show(`${row.label} settings are coming soon`);
          }}
          accessibilityRole="button"
          accessibilityLabel={row.label}
          style={({ pressed }) => [
            styles.row,
            i > 0 && { borderTopWidth: 1, borderTopColor: colors.border },
            pressed && { opacity: 0.8 },
          ]}
        >
          <Ionicons name={row.icon} size={18} color={colors.textMuted} />
          <Text style={[styles.rowLabel, { color: colors.text }]}>{row.label}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </Pressable>
      ))}
      <PillButton
        variant="ghost"
        label="Log Out"
        onPress={confirmLogout}
        accessibilityLabel="Log out of BGSC"
        style={styles.logout}
      />
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontFamily: FONTS.heading,
    fontSize: 20,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
  },
  rowLabel: {
    flex: 1,
    fontFamily: FONTS.medium,
    fontSize: 14,
  },
  logout: {
    marginTop: 10,
  },
});
