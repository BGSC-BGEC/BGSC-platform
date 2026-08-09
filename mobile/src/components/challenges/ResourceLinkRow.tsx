import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { Pressable, StyleSheet, Text } from 'react-native';

import { GlassCard } from '@/components/GlassCard';
import { FONTS } from '@/core/theme/fonts';
import type { ChallengeResource } from '@/core/types';
import { useColors } from '@/hooks/use-colors';

export interface ResourceLinkRowProps {
  resources: ChallengeResource[];
}

/**
 * Resource links list (points spec §6.4) — opens URLs in the in-app browser.
 * Renders nothing when the challenge has no resources.
 */
export function ResourceLinkRow({ resources }: ResourceLinkRowProps) {
  const colors = useColors();
  if (resources.length === 0) return null;

  return (
    <GlassCard accessibilityLabel="Challenge resources">
      {resources.map((r, i) => (
        <Pressable
          key={r.url}
          onPress={() => {
            void WebBrowser.openBrowserAsync(r.url);
          }}
          accessibilityRole="link"
          accessibilityLabel={`Open resource ${r.name}`}
          style={({ pressed }) => [
            styles.row,
            i > 0 && { borderTopWidth: 1, borderTopColor: colors.border },
            pressed && { opacity: 0.8 },
          ]}
        >
          <Ionicons name="link-outline" size={18} color={colors.textMuted} />
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {r.name}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </Pressable>
      ))}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
  },
  name: {
    flex: 1,
    fontFamily: FONTS.medium,
    fontSize: 14,
  },
});
