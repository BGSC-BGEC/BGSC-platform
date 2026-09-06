import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge } from '../../src/components/Badge';
import { Card } from '../../src/components/Card';
import { SectionHeader } from '../../src/components/SectionHeader';
import { Typography } from '../../src/typography/Typography';
import { useTheme } from '../../src/theme/ThemeProvider';

export default function Leaderboard() {
  const { colors } = useTheme();
  const players = [['1', 'Aarav Sharma', '2,480'], ['2', 'Meera Das', '2,120'], ['3', 'Jeet Patel', '1,250']];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Typography variant="displayTitle">Leaderboard</Typography>
        <Typography variant="body" color="textMuted">Season rankings across all activities.</Typography>
        <Card variant="accent">
          <Card.Header title="Your position" rightAction={<Badge label="Top 10%" variant="success" />} />
          <Card.Body><Typography variant="displayHero">#3</Typography><Typography variant="caption" color="textMuted">1,250 total points</Typography></Card.Body>
        </Card>
        <SectionHeader title="Top players" />
        <Card variant="solid">
          {players.map(([rank, name, points]) => (
            <View key={rank} style={[styles.row, { borderBottomColor: colors.border }]}>
              <Typography variant="h3" color={rank === '3' ? 'accent' : 'text'}>{rank}</Typography>
              <Typography variant="body" style={styles.name}>{name}</Typography>
              <Typography variant="mono" color="textMuted">{points}</Typography>
            </View>
          ))}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ safeArea: { flex: 1 }, content: { padding: 20, gap: 16 }, row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth }, name: { flex: 1 } });