import { useState } from 'react';
import { Alert, ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '../../src/components/AppHeader';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Select } from '../../src/forms/Select';
import { TextInput } from '../../src/forms/TextInput';
import { Typography } from '../../src/typography/Typography';
import { useTheme } from '../../src/theme/ThemeProvider';

export default function EditProfile() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const [username, setUsername] = useState('Jeet');
  const [email, setEmail] = useState('jeet@example.com');
  const [sport, setSport] = useState<string | undefined>('football');

  const save = () => {
    Alert.alert('Profile saved', 'Your profile changes are saved locally for this demo.', [
      { text: 'Done', onPress: () => navigation.goBack() },
    ]);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['left', 'right']}>
      <AppHeader title="Edit profile" showBackButton showMenuButton={false} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Typography variant="body" color="textMuted">Keep your player card up to date.</Typography>
        <Card variant="solid">
          <TextInput label="USERNAME" value={username} onChangeText={setUsername} placeholder="Your username" />
          <TextInput label="EMAIL" value={email} onChangeText={setEmail} placeholder="Your email" keyboardType="email-address" autoCapitalize="none" />
          <TextInput label="CONTACT" value="+91 98765 43210" onChangeText={() => {}} placeholder="Your phone number" keyboardType="phone-pad" />
          <Select
            label="FAVOURITE SPORT"
            value={sport}
            onChange={(value) => setSport(value as string)}
            options={[
              { label: 'Football', value: 'football' },
              { label: 'Basketball', value: 'basketball' },
              { label: 'Badminton', value: 'badminton' },
              { label: 'Esports', value: 'esports' },
            ]}
          />
        </Card>
        <Button label="Save changes" fullWidth onPress={save} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
});
