import { useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '../../src/components/AppHeader';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Checkbox } from '../../src/forms/Checkbox';
import { Select } from '../../src/forms/Select';
import { TextInput } from '../../src/forms/TextInput';
import { Typography } from '../../src/typography/Typography';
import { useTheme } from '../../src/theme/ThemeProvider';
import { getMockEvent, MOCK_TEAMS, submitMockRegistration } from '../../src/mock/events';

export default function EventRegistration() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const event = getMockEvent(route.params?.eventId);
  const [name, setName] = useState('Jeet Patel');
  const [role, setRole] = useState<'member' | 'captain'>(event.registrationMode === 'team' ? 'member' : 'member');
  const [teamId, setTeamId] = useState<string | undefined>();
  const [newTeamName, setNewTeamName] = useState('');
  const [position, setPosition] = useState<string | undefined>();
  const [terms, setTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [confirmation, setConfirmation] = useState<{ title: string; message: string } | null>(null);

  const isTeamEvent = event.registrationMode === 'team';
  const isAuctionPlayer = event.auctionRegistration === 'player';
  const isCreatingTeam = role === 'captain';
  const teams = useMemo(
    () => MOCK_TEAMS.filter((team) => team.eventId === event.id),
    [event.id],
  );

  const errors = {
    name: !name.trim() ? 'Enter your full name.' : undefined,
    team: isTeamEvent && !isCreatingTeam && !teamId ? 'Choose a team to join.' : undefined,
    newTeam: isTeamEvent && isCreatingTeam && !newTeamName.trim() ? 'Enter a name for your new team.' : undefined,
    position: event.hasPositions && !position ? 'Choose your playing position.' : undefined,
    terms: !terms ? 'Accept the event rules to continue.' : undefined,
  };

  const submit = () => {
    setAttempted(true);
    if (Object.values(errors).some(Boolean)) {
      return;
    }
    setSubmitting(true);
    setTimeout(() => {
      const teamName = isCreatingTeam
        ? newTeamName.trim()
        : teams.find((team) => team.id === teamId)?.name;
      submitMockRegistration(event.id, { role, teamName });
      setSubmitting(false);
      if (isCreatingTeam) {
        setConfirmation({
          title: 'Team sent for approval',
          message: `${teamName} has been sent to the admins. You will be added once it is approved.`,
        });
      } else if (isTeamEvent) {
        setConfirmation({
          title: 'Team registration submitted',
          message: `Your request to join ${teamName} has been sent for ${event.title}.`,
        });
      } else {
        setConfirmation({
          title: 'Registration submitted',
          message: `Your place in ${event.title} is reserved.`,
        });
      }
    }, 500);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['left', 'right']}>
      <AppHeader title="Registration" showBackButton showMenuButton={false} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Typography variant="displayTitle">{event.title}</Typography>
        <Typography variant="body" color="textMuted">
          {isTeamEvent ? 'Join an existing team or register a new team as captain.' : 'Tell us a little about your participation.'}
        </Typography>
        <Card variant="solid">
          <TextInput label="FULL NAME" value={name} onChangeText={setName} placeholder="Your name" error={attempted ? errors.name : undefined} />
          {isAuctionPlayer ? (
            <>
              <Typography variant="h3">Player registration</Typography>
              <Typography variant="body" color="textMuted">Your registration will be reviewed before you are added to the auction pool.</Typography>
              <Select
                label="PLAYER ROLE"
                placeholder="Choose your role"
                value={position}
                onChange={(value) => setPosition(value as string)}
                error={attempted ? errors.position : undefined}
                options={[
                  { label: 'Batter', value: 'batter' },
                  { label: 'Bowler', value: 'bowler' },
                  { label: 'All-rounder', value: 'all-rounder' },
                  { label: 'Wicketkeeper', value: 'wicketkeeper' },
                ]}
              />
              <TextInput label="STARTING PRICE" value="100 credits" editable={false} helperText="The admin will confirm the final base price." />
            </>
          ) : isTeamEvent ? (
            <>
              <Select
                label="REGISTRATION ROLE"
                placeholder="Choose your role"
                value={role}
                onChange={(value) => setRole(value as 'member' | 'captain')}
                options={[
                  { label: 'Join as a team member', value: 'member', subtitle: 'Choose a team already registered' },
                  { label: 'Register as team captain', value: 'captain', subtitle: 'Create a new team for admin approval' },
                ]}
              />
              {isCreatingTeam ? (
                <View style={styles.teamFields}>
                  <TextInput
                    label="NEW TEAM NAME"
                    value={newTeamName}
                    onChangeText={setNewTeamName}
                    placeholder="Enter a team name"
                    error={attempted ? errors.newTeam : undefined}
                  />
                  <Typography variant="caption" color="textMuted">Your team will be sent to the admins for approval.</Typography>
                </View>
              ) : (
                <Select
                  label="TEAM"
                  placeholder="Choose a team to join"
                  value={teamId}
                  onChange={(value) => setTeamId(value as string)}
                  error={attempted ? errors.team : undefined}
                  options={teams.map((team) => ({ label: team.name, value: team.id }))}
                  searchable
                />
              )}
            </>
          ) : null}
          {event.hasPositions && !isAuctionPlayer ? (
            <Select
              label="PLAYING POSITION"
              placeholder="Choose a position"
              value={position}
              onChange={(value) => setPosition(value as string)}
              error={attempted ? errors.position : undefined}
              options={[
                { label: 'Goalkeeper', value: 'goalkeeper' },
                { label: 'Defender', value: 'defender' },
                { label: 'Midfielder', value: 'midfielder' },
                { label: 'Forward', value: 'forward' },
              ]}
            />
          ) : null}
          <Checkbox checked={terms} onChange={setTerms} label="I agree to the event rules and attendance policy" />
          {attempted && errors.terms ? <Typography variant="bodySmall" color="danger">{errors.terms}</Typography> : null}
        </Card>
        <Button label="Submit registration" fullWidth loading={submitting} disabled={submitting} onPress={submit} />
        <Button label="Cancel" variant="ghost" fullWidth disabled={submitting} onPress={() => navigation.goBack()} />
      </ScrollView>
      <Modal visible={confirmation !== null} transparent animationType="fade" onRequestClose={() => setConfirmation(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.confirmation, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Typography variant="h2">{confirmation?.title}</Typography>
            <Typography variant="body" color="textMuted">{confirmation?.message}</Typography>
            <Button label="Done" fullWidth onPress={() => { setConfirmation(null); navigation.goBack(); }} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  teamFields: { gap: 8 },
  modalBackdrop: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(0, 0, 0, 0.45)' },
  confirmation: { borderWidth: 1, borderRadius: 24, padding: 24, gap: 16 },
});
