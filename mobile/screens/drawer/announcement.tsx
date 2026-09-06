import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge } from '../../src/components/Badge';
import { Card } from '../../src/components/Card';
import { SectionHeader } from '../../src/components/SectionHeader';
import { Typography } from '../../src/typography/Typography';
import { useTheme } from '../../src/theme/ThemeProvider';

export default function Announcement() {
  const { colors } = useTheme();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Typography variant="displayTitle">Announcements</Typography>
        <SectionHeader title="Latest updates" badge={2} />
        <Card variant="solid">
          <Card.Header title="Season registration is open" subtitle="Today · BGSC Admin" rightAction={<Badge label="New" variant="primary" />} />
          <Card.Body><Typography variant="body" color="textMuted">Register for this season’s tournaments before Sunday midnight.</Typography></Card.Body>
        </Card>
        <Card variant="solid">
          <Card.Header title="Points system updated" subtitle="Yesterday · BGSC Admin" />
          <Card.Body><Typography variant="body" color="textMuted">Participation and volunteering points are now visible in your profile.</Typography></Card.Body>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ safeArea: { flex: 1 }, content: { padding: 20, gap: 16 } });