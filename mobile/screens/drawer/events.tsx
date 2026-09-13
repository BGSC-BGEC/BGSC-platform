import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge } from '../../src/components/Badge';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { SectionHeader } from '../../src/components/SectionHeader';
import { AppHeader } from '../../src/components/AppHeader';
import { SearchInput } from '../../src/forms/SearchInput';
import { Typography } from '../../src/typography/Typography';
import { useTheme } from '../../src/theme/ThemeProvider';
import { MOCK_EVENTS } from '../../src/mock/events';
import type { EventCategory } from '../../src/types/event';

const CATEGORIES: Array<'All' | EventCategory> = ['All', 'Football', 'Cricket', 'Esports', 'Fitness', 'Community'];

export default function Events() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'All' | EventCategory>('All');
  const [refreshing, setRefreshing] = useState(false);

  const events = useMemo(() => {
    const query = search.trim().toLowerCase();
    return MOCK_EVENTS.filter((event) => {
      const matchesCategory = category === 'All' || event.category === category;
      const matchesSearch = !query || `${event.title} ${event.location} ${event.category}`.toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [category, search]);

  const refresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['left', 'right']}>
      <AppHeader title="Events" />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}
      >
        <SearchInput value={search} onChangeText={setSearch} placeholder="Search events" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {CATEGORIES.map((item) => (
            <Pressable
              key={item}
              onPress={() => setCategory(item)}
              style={[styles.filter, { backgroundColor: category === item ? colors.accent : colors.surface, borderColor: colors.border }]}
            >
              <Typography variant="caption" color={category === item ? 'textOnAccent' : 'text'}>{item}</Typography>
            </Pressable>
          ))}
        </ScrollView>
        <SectionHeader title="Upcoming" badge={events.length} />
        {events.length === 0 ? (
          <Card variant="inner">
            <Typography variant="h3">No events found</Typography>
            <Typography variant="body" color="textMuted">Try another search or category.</Typography>
          </Card>
        ) : events.map((event) => (
          <Card key={event.id} variant="solid" onPress={() => navigation.navigate('EventDetails', { eventId: event.id })} accessibilityLabel={`Open ${event.title}`}>
            <Card.Header title={event.title} subtitle={`${event.dateLabel} · ${event.location}`} rightAction={<Badge label={event.status} variant={event.status === 'Open' ? 'success' : event.status === 'Full' ? 'warning' : 'slate'} />} />
            <Card.Body><Typography variant="body" color="textMuted">{event.category} · {event.capacityLabel}</Typography></Card.Body>
            <Card.Footer><Button label={event.status === 'Open' ? 'Register' : 'View details'} size="sm" variant={event.status === 'Open' ? 'primary' : 'outline'} onPress={() => navigation.navigate('EventDetails', { eventId: event.id })} /></Card.Footer>
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { padding: 20, gap: 16, paddingBottom: 32 },
  filters: { gap: 8, paddingVertical: 2 },
  filter: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9 },
});