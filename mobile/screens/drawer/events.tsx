import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
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

export default function Events() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const [search, setSearch] = useState('');

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['left', 'right']}>
      <AppHeader title="Events" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SearchInput value={search} onChangeText={setSearch} placeholder="Search events" />
        <SectionHeader title="Upcoming" badge={2} />
        <Card variant="solid">
          <Card.Header title="Football Championship" subtitle="Saturday, 10:00 AM" rightAction={<Badge label="Open" variant="success" />} />
          <Card.Body><Typography variant="body" color="textMuted">Main ground · 16 teams</Typography></Card.Body>
          <Card.Footer><Button label="Register" size="sm" onPress={() => navigation.navigate('EventRegistration')} /></Card.Footer>
        </Card>
        <Card variant="solid">
          <Card.Header title="BGEC Esports Championship" subtitle="Next Wednesday, 6:00 PM" rightAction={<Badge label="Soon" variant="slate" />} />
          <Card.Body><Typography variant="body" color="textMuted">Student activity centre · Valorant</Typography></Card.Body>
          <Card.Footer><Button label="View details" size="sm" variant="outline" onPress={() => navigation.navigate('EventDetails')} /></Card.Footer>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ safeArea: { flex: 1 }, content: { padding: 20, gap: 16 } });