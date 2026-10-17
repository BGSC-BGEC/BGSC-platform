import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '../../src/components/AppHeader';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Checkbox } from '../../src/forms/Checkbox';
import { Select } from '../../src/forms/Select';
import { TextInput } from '../../src/forms/TextInput';
import {
  DynamicFormField,
  isFieldVisible,
  serializeAnswer,
  validateField,
  type FormValues,
} from '../../src/forms/DynamicFormField';
import { Alert } from '../../src/feedback/Alert';
import { ErrorState } from '../../src/feedback/ErrorState';
import { Skeleton } from '../../src/feedback/Skeleton';
import { Typography } from '../../src/typography/Typography';
import { useTheme } from '../../src/theme/ThemeProvider';
import { usePopup } from '../../src/popups/PopupProvider';
import { TermsPopup } from '../../src/popups/TermsPopup';
import { EventRegistrationPopup } from '../../src/popups/EventRegistrationPopup';
import { useAsyncResource } from '../../src/hooks/useAsyncResource';
import { eventsRepository } from '../../src/repositories/EventsRepository';
import { registrationRepository, type UploadedFormFile } from '../../src/repositories/RegistrationRepository';
import { ApiError, getErrorMessage, getFieldErrors } from '../../src/api/client';
import type { RegistrationRole } from '../../src/api/types';
import { formatDateTime } from '../../src/utils/format';

type TeamRole = 'member' | 'captain';

export default function EventRegistration() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const popup = usePopup();
  const eventRef: string = route.params?.eventId;

  const [values, setValues] = useState<FormValues>({});
  const [files, setFiles] = useState<Record<string, UploadedFormFile>>({});
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [role, setRole] = useState<TeamRole>('member');
  const [teamId, setTeamId] = useState<string | undefined>();
  const [newTeamName, setNewTeamName] = useState('');
  const [terms, setTerms] = useState(false);
  const [termsVisible, setTermsVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [attempted, setAttempted] = useState(false);

  const { data, loading, error, reload } = useAsyncResource(async () => {
    const event = await eventsRepository.get(eventRef);
    const formId = event.registration.form_id;
    const [form, teams] = await Promise.all([
      formId ? registrationRepository.getForm(formId) : Promise.resolve(null),
      event.teaming.is_teamed ? registrationRepository.teamsForEvent(event._id).catch(() => []) : Promise.resolve([]),
    ]);
    return { event, form, teams };
  }, [eventRef]);

  const event = data?.event;
  const form = data?.form;
  const isTeamEvent = Boolean(event?.teaming.is_teamed);
  const isCaptain = isTeamEvent && role === 'captain';

  const fields = useMemo(
    () => (form?.fields ?? []).filter((f) => isFieldVisible(f, values)).sort((a, b) => a.order - b.order),
    [form, values],
  );

  const joinableTeams = useMemo(
    () => (data?.teams ?? []).filter((t) => t.join_policy === 'open' && (t.status === 'forming' || t.status === 'complete')),
    [data],
  );

  const fieldErrors = useMemo(() => {
    const errs: Record<string, string> = {};
    for (const field of fields) {
      const msg = validateField(field, values[field.key], files[field.key]);
      if (msg) errs[field.key] = msg;
    }
    if (isCaptain && !newTeamName.trim()) errs.__team = 'Enter a name for your new team.';
    if (!terms) errs.__terms = 'Accept the event rules to continue.';
    return errs;
  }, [fields, values, files, isCaptain, newTeamName, terms]);

  const setValue = (key: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (serverErrors[key]) setServerErrors((prev) => ({ ...prev, [key]: '' }));
  };

  const errorFor = (key: string) => (attempted ? serverErrors[key] || fieldErrors[key] : serverErrors[key] || undefined);

  const review = () => {
    setAttempted(true);
    if (Object.keys(fieldErrors).length > 0) {
      void popup.warning('Check your details', 'Some required fields are missing or invalid.');
      return;
    }
    setConfirmVisible(true);
  };

  const submit = async () => {
    if (!event || !form) return;
    setSubmitting(true);
    const answers: Record<string, unknown> = {};
    for (const field of fields) {
      if (field.type === 'file') continue;
      const serialized = serializeAnswer(field, values[field.key]);
      if (serialized !== undefined) answers[field.key] = serialized;
    }
    const regRole: RegistrationRole = isTeamEvent ? role : 'solo';

    try {
      const registration = await registrationRepository.submit({
        formId: form._id,
        eventId: event._id,
        answers,
        files: Object.values(files),
        role: regRole,
        teamVisibility: isCaptain ? 'open' : undefined,
      });

      // Team follow-up: captains create their team, members join the one they picked.
      let teamNote = '';
      if (isCaptain) {
        try {
          await registrationRepository.createTeam(event._id, newTeamName.trim());
          teamNote = ` Your team "${newTeamName.trim()}" has been created.`;
        } catch {
          teamNote = ` Once your captain application is approved you can create "${newTeamName.trim()}" from this event.`;
        }
      } else if (isTeamEvent && teamId) {
        const teamName = joinableTeams.find((t) => t._id === teamId)?.name ?? 'the team';
        try {
          await registrationRepository.joinTeam(teamId);
          teamNote = ` You have joined ${teamName}.`;
        } catch (err) {
          teamNote = ` We could not add you to ${teamName} (${getErrorMessage(err)}).`;
        }
      }

      setConfirmVisible(false);
      const status = registration.status;
      const title =
        status === 'confirmed' ? 'You are registered!' : status === 'waitlisted' ? 'Added to the waitlist' : 'Registration submitted';
      const message =
        (form.settings.confirmation_message ??
          (status === 'confirmed'
            ? `Your place in ${event.title} is reserved.`
            : status === 'waitlisted'
              ? `${event.title} is full. You are #${registration.waitlist_position ?? '—'} on the waitlist.`
              : `Your registration for ${event.title} is waiting for admin approval.`)) + teamNote;
      await popup.success(title, message);
      navigation.goBack();
    } catch (err) {
      setConfirmVisible(false);
      if (err instanceof ApiError && err.code === 'validation_failed') {
        setServerErrors(getFieldErrors(err));
        setAttempted(true);
      }
      await popup.error('Registration failed', getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || error || !event) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['left', 'right']}>
        <AppHeader title="Registration" showBackButton showMenuButton={false} />
        {loading ? (
          <View style={styles.content}>
            <Skeleton width="70%" height={36} />
            <Skeleton.Card />
            <Skeleton.Card />
          </View>
        ) : (
          <ErrorState title="Could not load the form" message={error ?? undefined} onRetry={() => void reload()} />
        )}
      </SafeAreaView>
    );
  }

  const summary = [
    { label: 'Event', value: event.title },
    { label: 'Starts', value: formatDateTime(event.start_at) },
    ...(isTeamEvent ? [{ label: 'Role', value: isCaptain ? 'Team captain' : 'Team member' }] : []),
    ...(isCaptain ? [{ label: 'New team', value: newTeamName.trim() }] : []),
    ...(!isCaptain && isTeamEvent && teamId
      ? [{ label: 'Team', value: joinableTeams.find((t) => t._id === teamId)?.name ?? '' }]
      : []),
  ];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['left', 'right']}>
      <AppHeader title="Registration" showBackButton showMenuButton={false} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Typography variant="displayTitle">{event.title}</Typography>
        <Typography variant="body" color="textMuted">
          {form?.description ??
            (isTeamEvent ? 'Join an existing team or register a new team as captain.' : 'Tell us a little about your participation.')}
        </Typography>

        {!form ? (
          <Alert variant="warning" title="Registration form not published" description="The organisers have not opened the registration form yet. Please check back later." />
        ) : (
          <>
            {event.registration.requires_approval ? (
              <Alert variant="info" title="Admin approval required" description="Your place is confirmed once an organiser approves your registration." />
            ) : null}

            {isTeamEvent ? (
              <Card variant="solid">
                <Typography variant="h3">Your team</Typography>
                <Select
                  label="REGISTRATION ROLE"
                  placeholder="Choose your role"
                  value={role}
                  onChange={(value) => setRole(value as TeamRole)}
                  options={[
                    { label: 'Join as a team member', value: 'member', subtitle: 'Join a team that is already registered' },
                    {
                      label: 'Register as team captain',
                      value: 'captain',
                      subtitle: event.teaming.captain_application_required ? 'Captains are approved by the admins' : 'Create a new team',
                    },
                  ]}
                />
                {isCaptain ? (
                  <View style={styles.teamFields}>
                    <TextInput
                      label="NEW TEAM NAME"
                      value={newTeamName}
                      onChangeText={setNewTeamName}
                      placeholder="Enter a team name"
                      maxLength={60}
                      error={errorFor('__team')}
                    />
                    <Typography variant="caption" color="textMuted">
                      {event.teaming.captain_application_required
                        ? 'Your captain application will be sent to the admins for approval.'
                        : 'Your team is created as soon as your registration is confirmed.'}
                    </Typography>
                  </View>
                ) : joinableTeams.length > 0 ? (
                  <Select
                    label="TEAM (OPTIONAL)"
                    placeholder="Choose a team to join"
                    value={teamId}
                    onChange={(value) => setTeamId(value as string)}
                    options={joinableTeams.map((team) => ({
                      label: team.name,
                      value: team._id,
                      subtitle: `${team.members.length}${team.size_max ? `/${team.size_max}` : ''} members`,
                    }))}
                    searchable
                  />
                ) : (
                  <Typography variant="caption" color="textMuted">
                    No open teams yet — you can join one later with the code your captain shares.
                  </Typography>
                )}
              </Card>
            ) : null}

            {fields.length > 0 ? (
              <Card variant="solid">
                {form.title ? <Typography variant="h3">{form.title}</Typography> : null}
                {fields.map((field) => (
                  <DynamicFormField
                    key={field.key}
                    field={field}
                    value={values[field.key]}
                    file={files[field.key]}
                    error={errorFor(field.key)}
                    onChange={(value) => setValue(field.key, value)}
                    onUploadFile={async (asset) => {
                      try {
                        const uploaded = await registrationRepository.uploadFile({
                          formId: form._id,
                          fieldKey: field.key,
                          uri: asset.uri,
                          name: asset.name,
                          mimeType: asset.mimeType,
                        });
                        setFiles((prev) => ({ ...prev, [field.key]: uploaded }));
                      } catch (err) {
                        await popup.error('Upload failed', getErrorMessage(err));
                      }
                    }}
                  />
                ))}
              </Card>
            ) : null}

            <Card variant="solid">
              <Checkbox checked={terms} onChange={setTerms} label="I agree to the event rules and attendance policy" />
              <Pressable onPress={() => setTermsVisible(true)} accessibilityRole="link" hitSlop={8}>
                <Typography variant="button" color="accent">Read the rules</Typography>
              </Pressable>
              {attempted && fieldErrors.__terms ? <Typography variant="bodySmall" color="danger">{fieldErrors.__terms}</Typography> : null}
            </Card>
          </>
        )}

        <Button label="Review & submit" fullWidth disabled={!form || submitting} onPress={review} />
        <Button label="Cancel" variant="ghost" fullWidth disabled={submitting} onPress={() => navigation.goBack()} />
      </ScrollView>

      <TermsPopup
        visible={termsVisible}
        title={`${event.title} rules`}
        terms={event.rules_summary?.split(/\n+/).map((l) => l.trim()).filter(Boolean) || undefined}
        onAccept={() => {
          setTerms(true);
          setTermsVisible(false);
        }}
        onClose={() => setTermsVisible(false)}
      />
      <EventRegistrationPopup
        visible={confirmVisible}
        eventTitle={event.title}
        summary={summary}
        note={event.registration.requires_approval ? 'An organiser will review your registration.' : undefined}
        submitting={submitting}
        onConfirm={() => void submit()}
        onCancel={() => setConfirmVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  teamFields: { gap: 8 },
});
