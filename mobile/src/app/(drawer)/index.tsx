import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { useAuthStore } from '@/core/stores/authStore';
import { useColors } from '@/hooks/use-colors';

export default function HomeScreen() {
  const colors = useColors();
  const user = useAuthStore((s) => s.user);

  return (
    <Screen>
      <Text style={[styles.h1, { color: colors.text }]}>
        {user ? `Welcome back, ${user.username}` : 'Welcome to BGSC'}
      </Text>
      <Text style={[styles.lead, { color: colors.textMuted }]}>
        The digital hub for BITS Goa sports & esports — events, points, sponsors,
        and community, all in one place.
      </Text>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Frontend shell</Text>
        <Text style={[styles.cardBody, { color: colors.textMuted }]}>
          This is the Milestone 0.4 skeleton: side drawer, dynamic status bar,
          theme switching, and live auth wired to the gateway. Feature screens
          arrive in Phase 1.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 26, fontWeight: '700', marginBottom: 8 },
  lead: { fontSize: 15, lineHeight: 22, marginBottom: 24 },
  card: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 6 },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  cardBody: { fontSize: 14, lineHeight: 20 },
});
