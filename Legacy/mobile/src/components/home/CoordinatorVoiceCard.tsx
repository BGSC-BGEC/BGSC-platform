import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/GlassCard';
import type { Announcement } from '@/core/types';
import { FONTS } from '@/core/theme/fonts';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { useColors } from '@/hooks/use-colors';
import { clampText, relativeTime } from './utils';

export interface CoordinatorVoiceCardProps {
  announcement: Announcement;
  onPress: () => void;
}

/**
 * Editorial coordinator quote card (home-page.md §6.3): portrait, name/role,
 * announcement preview quote, timestamp. Whole card opens the linked
 * announcement (H3); portrait routes to profile or the H9 login gate.
 */
export function CoordinatorVoiceCard({ announcement, onPress }: CoordinatorVoiceCardProps) {
  const colors = useColors();
  const requireAuth = useRequireAuth();

  const openProfile = () => {
    if (requireAuth('Log in to view profiles.')) {
      router.push('/profile');
    }
  };

  return (
    <GlassCard onPress={onPress} accessibilityLabel={`Open announcement: ${announcement.title}`}>
      <View style={styles.header}>
        <Pressable
          onPress={openProfile}
          accessibilityRole="button"
          accessibilityLabel={`View ${announcement.author.name}'s profile`}
          hitSlop={6}
        >
          <View
            style={[
              styles.avatar,
              { backgroundColor: announcement.author.avatarColor ?? colors.accent },
            ]}
          >
            <Text style={[styles.avatarText, { color: colors.accentText }]}>
              {announcement.author.avatarInitial}
            </Text>
          </View>
        </Pressable>
        <View style={styles.identity}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {announcement.author.name}
          </Text>
          <Text style={[styles.role, { color: colors.textMuted }]} numberOfLines={1}>
            {announcement.author.role}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </View>

      <Text style={[styles.quote, { color: colors.text }]} numberOfLines={3}>
        “{clampText(announcement.body, 110)}”
      </Text>

      <Text style={[styles.time, { color: colors.textMuted }]}>
        {relativeTime(announcement.createdAt)}
      </Text>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: FONTS.bold,
    fontSize: 18,
  },
  identity: {
    flex: 1,
  },
  name: {
    fontFamily: FONTS.semibold,
    fontSize: 16,
  },
  role: {
    fontFamily: FONTS.body,
    fontSize: 12,
    marginTop: 1,
  },
  quote: {
    fontFamily: FONTS.body,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 12,
  },
  time: {
    fontFamily: FONTS.body,
    fontSize: 12,
    marginTop: 8,
  },
});
