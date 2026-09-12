import { ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge } from '../../src/components/Badge';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { SectionHeader } from '../../src/components/SectionHeader';
import { AppHeader } from '../../src/components/AppHeader';
import { Typography } from '../../src/typography/Typography';
import { useTheme } from '../../src/theme/ThemeProvider';

export default function Home() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['left', 'right']}>
      <AppHeader title="Home" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Typography variant="displayTitle">Dashboard</Typography>
        <Typography variant="body" color="textMuted">Your campus activity at a glance.</Typography>

        {/* Layered Card Example - Points Card */}
        <Card variant="layered">
          <Card.Header title="Season Points" rightAction={<Badge label="Active" variant="success" />} />
          {/* Inner layered card */}
          <Card variant="inner" style={styles.innerCard}>
            <Typography variant="displayHero">1,250</Typography>
            <Typography variant="caption" color="textMuted">Points earned this season</Typography>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Typography variant="h3">12</Typography>
                <Typography variant="caption" color="textMuted">Events</Typography>
              </View>
              <View style={styles.statItem}>
                <Typography variant="h3">#8</Typography>
                <Typography variant="caption" color="textMuted">Rank</Typography>
              </View>
            </View>
          </Card>
          <Button label="View Leaderboard" size="sm" variant="primary" onPress={() => navigation.navigate('MainTabs', { screen: 'LeaderboardTab' })} />
        </Card>

        <SectionHeader title="Upcoming Events" subtitle="Don't miss out" />

        {/* Event Cards */}
        <Card variant="solid">
          <Card.Header
            title="Football Championship"
            subtitle="Saturday, 10:00 AM"
            rightAction={<Badge label="Open" variant="primary" />}
          />
          <Card.Body>
            <Typography variant="body" color="textMuted">
              Main ground · 16 teams · Register before Friday midnight
            </Typography>
          </Card.Body>
          <Card.Footer>
            <Button label="Register Now" variant="primary" size="sm" onPress={() => navigation.navigate('EventRegistration')} />
          </Card.Footer>
        </Card>

        <Card variant="solid">
          <Card.Header
            title="BGEC Esports Tournament"
            subtitle="Next Wednesday, 6:00 PM"
            rightAction={<Badge label="Soon" variant="secondary" />}
          />
          <Card.Body>
            <Typography variant="body" color="textMuted">
              Student activity centre · Valorant · 32 player slots
            </Typography>
          </Card.Body>
          <Card.Footer>
            <Button label="View Details" variant="outline" size="sm" onPress={() => navigation.navigate('EventDetails')} />
          </Card.Footer>
        </Card>

        <SectionHeader title="Quick Actions" />

        {/* Quick Actions Grid */}
        <View style={styles.actionsGrid}>
          <Card variant="elevated" style={styles.actionCard}>
            <Typography variant="h3">🎯</Typography>
            <Typography variant="body">Challenges</Typography>
            <Typography variant="caption" color="textMuted">5 active</Typography>
          </Card>

          <Card variant="elevated" style={styles.actionCard}>
            <Typography variant="h3">⭐</Typography>
            <Typography variant="body">Rewards</Typography>
            <Typography variant="caption" color="textMuted">3 pending</Typography>
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { padding: 20, gap: 20, paddingBottom: 40 },
  innerCard: {
    marginTop: 0,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    gap: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  actionCard: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
});