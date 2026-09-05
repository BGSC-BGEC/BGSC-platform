import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge } from '../../src/components/Badge';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { SectionHeader } from '../../src/components/SectionHeader';
import { Typography } from '../../src/typography/Typography';
import { useTheme } from '../../src/theme/ThemeProvider';

export default function Home() {
  const { colors } = useTheme();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Typography variant="displayTitle">BGSC Dashboard</Typography>
        <Typography variant="body" color="textMuted">Your campus activity at a glance.</Typography>
        <Card variant="accent">
          <Card.Header title="Season points" rightAction={<Badge label="Active" variant="success" />} />
          <Card.Body>
            <Typography variant="displayHero">1,250</Typography>
            <Typography variant="caption" color="textMuted">Points earned this season</Typography>
          </Card.Body>
          <Card.Footer>
            <Typography variant="caption" color="textMuted">Ranked in the top 10%</Typography>
            <Button label="Leaderboard" size="sm" onPress={() => {}} />
          </Card.Footer>
        </Card>
        <SectionHeader title="Next up" subtitle="Keep your BGSC profile active" />
        <Card variant="solid">
          <Card.Header title="Football Championship" subtitle="Saturday, 10:00 AM" rightAction={<Badge label="Open" variant="primary" />} />
          <Card.Body><Typography variant="body" color="textMuted">Registration closes Friday at midnight.</Typography></Card.Body>
          <Card.Footer><Button label="View event" variant="outline" size="sm" onPress={() => {}} /></Card.Footer>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { padding: 20, gap: 18 },
});