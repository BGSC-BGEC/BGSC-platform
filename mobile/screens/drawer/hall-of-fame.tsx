import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge } from '../../src/components/Badge';
import { Card } from '../../src/components/Card';
import { Typography } from '../../src/typography/Typography';
import { useTheme } from '../../src/theme/ThemeProvider';

export default function HallOfFame() {
  const { colors } = useTheme();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Typography variant="displayTitle">Hall of Fame</Typography>
        <Typography variant="body" color="textMuted">Celebrating the people who define BGSC.</Typography>
        <Card variant="accent">
          <Card.Header title="Athlete of the month" rightAction={<Badge label="2026" variant="primary" />} />
          <Card.Body><Typography variant="displayTitle">Riya Kapoor</Typography><Typography variant="body" color="textMuted">Basketball · 3 tournament wins</Typography></Card.Body>
        </Card>
        <Card variant="solid">
          <Card.Header title="Community champions" subtitle="Recognised for contribution and leadership" />
          <Card.Body><Typography variant="body">Aarav Sharma</Typography><Typography variant="caption" color="textMuted">Sports coordinator · 2025</Typography></Card.Body>
          <Card.Footer><Typography variant="body">Meera Das</Typography><Typography variant="caption" color="textMuted">Volunteer of the year · 2025</Typography></Card.Footer>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ safeArea: { flex: 1 }, content: { padding: 20, gap: 16 } });