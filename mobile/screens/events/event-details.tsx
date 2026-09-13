import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '../../src/components/AppHeader';
import { Badge } from '../../src/components/Badge';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Typography } from '../../src/typography/Typography';
import { useTheme } from '../../src/theme/ThemeProvider';
import { getMockEvent, hasMockRegistration } from '../../src/mock/events';

export default function EventDetails() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const event = getMockEvent(route.params?.eventId);
  const [registered, setRegistered] = useState(() => hasMockRegistration(event.id));

  useFocusEffect(() => {
    setRegistered(hasMockRegistration(event.id));
  });

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['left', 'right']}>
      <AppHeader title="Event details" showBackButton showMenuButton={false} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { backgroundColor: colors.accentMuted }]}>
          <Badge label={event.status} variant={event.status === 'Open' ? 'success' : event.status === 'Full' ? 'warning' : 'slate'} />
          <Typography variant="displayTitle">{event.title}</Typography>
          <Typography variant="body" color="textMuted">{event.dateLabel} · {event.location}</Typography>
        </View>

        <Card variant="solid">
          <Card.Header title="About this event" />
          <Card.Body>
            <Typography variant="body" color="textMuted">
              {event.description}
            </Typography>
            <View style={styles.tags}>
              {event.tags.map((tag) => (
                <Badge key={tag} label={tag} variant="slate" />
              ))}
            </View>
            <View style={styles.details}>
              <Typography variant="body" color="textMuted">Capacity: {event.capacityLabel}</Typography>
              <Typography variant="body" color="textMuted">Deadline: {event.deadlineLabel}</Typography>
              <Typography variant="body" color="textMuted">Category: {event.category}</Typography>
            </View>
          </Card.Body>
        </Card>

        <Card variant="accent">
          <Card.Header title="Your registration" rightAction={<Badge label={registered ? 'Submitted' : 'Required'} variant={registered ? 'success' : 'warning'} />} />
          <Card.Body>
            <Typography variant="body" color="textMuted">
              {registered ? 'You are on the participant list. We will share the fixture here soon.' : 'Reserve your place by completing the short registration form.'}
            </Typography>
          </Card.Body>
          <Card.Footer>
            <Button
              label={registered ? 'View registration' : event.status === 'Open' ? 'Register now' : event.status === 'Full' ? 'Event is full' : 'Registration opens soon'}
              size="sm"
              variant="primary"
              onPress={() => {
                if (registered) return;
                navigation.navigate('EventRegistration', { eventId: event.id });
              }}
              disabled={event.status !== 'Open'}
            />
          </Card.Footer>
        </Card>

        {event.hasAuction ? (
          <Card variant="solid">
            <Card.Header title="Live auction" rightAction={<Badge label="Live" variant="success" />} />
            <Card.Body>
              <Typography variant="body" color="textMuted">Watch approved captains draft registered players during the live auction.</Typography>
            </Card.Body>
            <Card.Footer>
              <Button label="View live auction" size="sm" variant="outline" onPress={() => navigation.navigate('Auction')} />
            </Card.Footer>
          </Card>
        ) : null}

        <Button label="Back to events" variant="outline" fullWidth onPress={() => navigation.goBack()} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  hero: { padding: 20, borderRadius: 24, gap: 10 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  details: { gap: 8, marginTop: 8 },
});
