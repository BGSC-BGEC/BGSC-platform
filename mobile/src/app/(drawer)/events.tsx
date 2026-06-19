import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { EventRepository } from '@/core/repositories/EventRepository';
import type { EventStatus } from '@/core/types';
import { useColors } from '@/hooks/use-colors';

const STATUS_COLOR: Record<EventStatus, string> = {
  upcoming: '#2563eb',
  ongoing: '#16a34a',
  past: '#64748b',
};

export default function EventsScreen() {
  const colors = useColors();
  const { data, isPending, isError, error } = useQuery({
    queryKey: ['events'],
    queryFn: () => EventRepository.list(),
  });

  return (
    <Screen>
      <Text style={[styles.h1, { color: colors.text }]}>Events</Text>
      <Text style={[styles.note, { color: colors.textMuted }]}>
        Placeholder data — wired to the Event Service in Milestone 1.2.
      </Text>

      {isPending ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
      ) : isError ? (
        <Text style={{ color: '#dc2626', marginTop: 16 }}>
          Failed to load events: {(error as Error).message}
        </Text>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ gap: 12, paddingTop: 16 }}
          renderItem={({ item }) => (
            <View
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.cardHead}>
                <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
                <View style={[styles.badge, { backgroundColor: STATUS_COLOR[item.status] }]}>
                  <Text style={styles.badgeText}>{item.status}</Text>
                </View>
              </View>
              <Text style={[styles.meta, { color: colors.textMuted }]}>
                {item.type} · {item.startDate} → {item.endDate}
              </Text>
              {item.venue ? (
                <Text style={[styles.meta, { color: colors.textMuted }]}>📍 {item.venue}</Text>
              ) : null}
            </View>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 26, fontWeight: '700' },
  note: { fontSize: 13, marginTop: 4 },
  card: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 6 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 16, fontWeight: '600', flex: 1, marginRight: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  meta: { fontSize: 13 },
});
