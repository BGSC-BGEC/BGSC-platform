import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '../../src/components/AppHeader';
import { Badge } from '../../src/components/Badge';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { ListRow } from '../../src/components/ListRow';
import { SearchInput } from '../../src/forms/SearchInput';
import { Typography } from '../../src/typography/Typography';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useResponsive } from '../../src/responsive/useResponsive';

const COORDINATORS = [
  { role: 'Overall Coordinator', team: 'BGSC Core Council', scope: 'General enquiries, partnerships & escalations' },
  { role: 'Sports & FitSoc Head', team: 'Athletics & Leagues', scope: 'Tournaments, fixtures, refereeing & Strava' },
  { role: 'Esports & Tech Head', team: 'BGEC & Dev', scope: 'Esports lobbies, brackets, challenges & app support' },
  { role: 'Events & Logistics Head', team: 'Operations', scope: 'Registrations, venues, teams & media moderation' },
] as const;

const FAQ = [
  ['How do I earn points?', 'Join events and complete challenges. Open Points to see earning opportunities and the source of every transaction.'],
  ['Can I switch teams after registering?', 'Team changes depend on the event rules, registration deadline and whether the roster has been locked. Open your event registration to see the available actions.'],
  ['Why is my upload still pending?', 'Member uploads are reviewed before appearing in the gallery. Pending uploads are visible only to you and authorised moderators.'],
  ['How does the player auction work?', 'Approved captains bid with their team purse while a lot is live. Follow the auction from your event page; the server confirms the winning bid.'],
  ['Where can I find an anonymous ticket?', 'Keep the ticket number shown after sending. Anonymous tickets do not appear in My tickets. Anyone holding that number can view the ticket.'],
];
export default function ContactFaq() {
  const { colors } = useTheme();
  const { gutter } = useResponsive();
  const navigation = useNavigation<any>();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<string | null>(FAQ[0][0]);
  const visible = FAQ.filter(([q, a]) => `${q} ${a}`.toLowerCase().includes(search.toLowerCase()));
  return <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['left', 'right']}>
    <AppHeader title="Help" showBackButton showMenuButton={false} />
    <ScrollView contentContainerStyle={[styles.content, { paddingHorizontal: gutter, paddingTop: gutter }]} keyboardShouldPersistTaps="handled">
      <Typography variant="displayTitle">How can we help?</Typography>
      <SearchInput value={search} onSearch={setSearch} placeholder="Search questions" />
      <Typography variant="h2">Coordinators</Typography>
      <Card>
        {COORDINATORS.map((coord) => (
          <ListRow
            key={coord.role}
            icon="users"
            title={coord.role}
            subtitle={`${coord.team} · ${coord.scope}`}
            trailing={<Badge label="Message" variant="muted" />}
            onPress={() => navigation.navigate('App', { screen: 'Feedback', params: { kind: 'contact' } })}
          />
        ))}
      </Card>
      <Typography variant="h2">FAQ</Typography>
      {visible.map(([question, answer]) => <Card key={question}>
        <Pressable onPress={() => setOpen(open === question ? null : question)} accessibilityRole="button" accessibilityState={{ expanded: open === question }} style={styles.row}>
          <Typography variant="h4" style={styles.flex}>{question}</Typography><Typography color="accent">{open === question ? '−' : '+'}</Typography>
        </Pressable>
        {open === question ? <Typography color="textMuted">{answer}</Typography> : null}
      </Card>)}
      {!visible.length ? <Typography color="textMuted">No matching questions. Send us a message below.</Typography> : null}
      <Typography variant="h2">Talk to the team</Typography>
      <Card><Typography color="textMuted">Send a message through Feedback & contact. Your ticket keeps the conversation and response in one place.</Typography><Button label="Contact the team" onPress={() => navigation.navigate('App', { screen: 'Feedback', params: { kind: 'contact' } })} /></Card>
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({ root: { flex: 1 }, content: { padding: 20, paddingBottom: 40, gap: 16, width: '100%', maxWidth: 720, alignSelf: 'center' }, row: { flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: 12 }, flex: { flex: 1 } });
