import { ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '../../src/components/AppHeader';
import { Badge } from '../../src/components/Badge';
import { Card } from '../../src/components/Card';
import { Typography } from '../../src/typography/Typography';
import { useTheme } from '../../src/theme/ThemeProvider';

const history = [
  ['Football Championship', 'Completed · May 2026', '+150 pts'],
  ['Coding Workshop', 'Completed · April 2026', '+100 pts'],
  ['Cricket League', 'Registered · March 2026', 'Upcoming'],
];

export default function History() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['left', 'right']}>
      <AppHeader title="Event history" showBackButton showMenuButton={false} />
      <ScrollView contentContainerStyle={styles.content}>
        <Typography variant="body" color="textMuted">Your participation and points from past events.</Typography>
        {history.map(([title, subtitle, result]) => (
          <Card key={title} variant="solid">
            <Card.Header title={title} subtitle={subtitle} rightAction={<Badge label={result} variant={result.startsWith('+') ? 'success' : 'secondary'} />} />
            <Card.Body><Typography variant="caption" color="textMuted">Player card activity recorded</Typography></Card.Body>
          </Card>
        ))}
        <Typography variant="caption" color="textMuted" align="center" style={styles.note}>Mock history will sync with your account when the service is connected.</Typography>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  note: { marginTop: 8 },
});
