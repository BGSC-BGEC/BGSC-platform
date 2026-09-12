import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '../../src/components/AppHeader';
import { Badge } from '../../src/components/Badge';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Typography } from '../../src/typography/Typography';
import { useTheme } from '../../src/theme/ThemeProvider';

export default function EventDetails() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const [registered, setRegistered] = useState(false);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['left', 'right']}>
      <AppHeader title="Event details" showBackButton showMenuButton={false} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { backgroundColor: colors.accentMuted }]}>
          <Badge label="Registration open" variant="success" />
          <Typography variant="displayTitle">Football Championship</Typography>
          <Typography variant="body" color="textMuted">Saturday, 10:00 AM · Main ground</Typography>
        </View>

        <Card variant="solid">
          <Card.Header title="About this event" />
          <Card.Body>
            <Typography variant="body" color="textMuted">
              Bring your team for the season opener. Matches are played in a league format with a knockout final.
            </Typography>
            <View style={styles.details}>
              <Typography variant="caption" color="textMuted">16 teams maximum</Typography>
              <Typography variant="caption" color="textMuted">Registration closes Friday midnight</Typography>
              <Typography variant="caption" color="textMuted">Open to all BGSC members</Typography>
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
              label={registered ? 'View registration' : 'Register now'}
              size="sm"
              variant="primary"
              onPress={() => {
                if (registered) return;
                navigation.navigate('EventRegistration');
              }}
            />
          </Card.Footer>
        </Card>

        <Button label="Back to events" variant="outline" fullWidth onPress={() => navigation.goBack()} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  hero: { padding: 20, borderRadius: 24, gap: 10 },
  details: { gap: 8, marginTop: 8 },
});
