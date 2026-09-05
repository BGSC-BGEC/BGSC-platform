import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from './theme/ThemeProvider';
import { PALETTE } from './theme/colors';
import { useResponsive } from './responsive/useResponsive';
import {
  Typography,
  Heading,
  Text,
  Label,
  Mono,
} from './typography/Typography';
import { IconButton } from './icons/IconButton';
import { Button } from './components/Button';
import { ButtonGroup } from './components/ButtonGroup';
import { Card } from './components/Card';
import { SectionHeader } from './components/SectionHeader';
import { Badge } from './components/Badge';
import { TextInput } from './forms/TextInput';
import { TextArea } from './forms/TextArea';
import { SearchInput } from './forms/SearchInput';
import { Select } from './forms/Select';
import { Checkbox } from './forms/Checkbox';
import { Switch } from './forms/Switch';
import { RadioGroup } from './forms/RadioGroup';
import { Skeleton } from './feedback/Skeleton';
import { Alert } from './feedback/Alert';
import { ErrorState } from './feedback/ErrorState';
import { EmptyState } from './feedback/EmptyState';

export function UIShowcase() {
  const { colors, mode, setMode } = useTheme();
  const responsive = useResponsive();

  // Form states
  const [text, setText] = useState('');
  const [password, setPassword] = useState('');
  const [textarea, setTextarea] = useState('');
  const [search, setSearch] = useState('');
  const [selectedSport, setSelectedSport] = useState('football');
  const [selectedInterests, setSelectedInterests] = useState<string[]>(['esports', 'badminton']);
  const [checked, setChecked] = useState(true);
  const [switchVal, setSwitchVal] = useState(true);
  const [tab, setTab] = useState<'components' | 'typography' | 'forms'>('components');
  const [radioVal, setRadioVal] = useState('opt1');

  const sportOptions = [
    { label: 'Football', value: 'football', subtitle: 'BITS Goa Premier League', icon: 'sparkles' as const },
    { label: 'Basketball', value: 'basketball', subtitle: 'Airball Tournament', icon: 'trophy' as const },
    { label: 'Badminton', value: 'badminton', subtitle: 'Deuce League', icon: 'star' as const },
    { label: 'Valorant', value: 'esports', subtitle: 'BGEC Esports Championship', icon: 'star' as const },
  ];

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header & Theme Switcher */}
        <View style={styles.topBar}>
          <View>
            <Typography variant="h1" color="text">
              BGSC UI System
            </Typography>
            <Typography variant="caption" color="textMuted">
              Modern • Non-Vibe Coded • Uxintace Palette
            </Typography>
          </View>

          <IconButton
            icon={mode === 'dark' ? 'sparkles' : 'star'}
            variant="glass"
            size="md"
            accessibilityLabel="Toggle Theme"
            onPress={() => setMode(mode === 'dark' ? 'light' : 'dark')}
          />
        </View>

        {/* Palette Swatches */}
        <SectionHeader title="Color Palette" subtitle="Extracted from mobile/color" />
        <View style={styles.paletteGrid}>
          {[
            { name: 'Forest', hex: PALETTE.forest, desc: 'Dark Canvas' },
            { name: 'Moss', hex: PALETTE.moss, desc: 'Elevated Surface' },
            { name: 'Sage', hex: PALETTE.sage, desc: 'Secondary Green' },
            { name: 'Mint', hex: PALETTE.mint, desc: 'Borders & Frost' },
            { name: 'Cream', hex: PALETTE.cream, desc: 'Primary Ink/Base' },
            { name: 'Orange', hex: PALETTE.orange, desc: 'Primary CTA' },
            { name: 'Slate', hex: PALETTE.slate, desc: 'Accent Slate' },
          ].map((item, i) => (
            <View key={i} style={[styles.swatchItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.colorBlock, { backgroundColor: item.hex }]} />
              <Typography variant="labelSmall" color="text">
                {item.name}
              </Typography>
              <Typography variant="caption" color="textSubtle" style={styles.monoHex}>
                {item.hex}
              </Typography>
            </View>
          ))}
        </View>

        {/* Responsive Info Badge */}
        <SectionHeader title="Responsive Info" />
        <Card variant="glass">
          <Card.Body>
            <View style={styles.responsiveGrid}>
              <Badge label={`Breakpoint: ${responsive.breakpoint}`} variant="accent" />
              <Badge label={`Device: ${responsive.deviceType}`} variant="secondary" />
              <Badge label={`Orientation: ${responsive.orientation}`} variant="slate" />
            </View>
            <Typography variant="caption" color="textMuted" style={styles.dimText}>
              Screen Dimensions: {Math.round(responsive.width)} × {Math.round(responsive.height)} dp
            </Typography>
          </Card.Body>
        </Card>

        {/* Section Tabs */}
        <ButtonGroup
          value={tab}
          onChange={setTab}
          options={[
            { label: 'Components', value: 'components', icon: 'sparkles' },
            { label: 'Typography', value: 'typography', icon: 'edit' },
            { label: 'Forms', value: 'forms', icon: 'search' },
          ]}
          style={styles.tabBar}
        />

        {/* Tab 1: Components */}
        {tab === 'components' && (
          <View style={styles.sectionGap}>
            {/* Buttons */}
            <SectionHeader title="Buttons & Actions" />
            <View style={styles.buttonRow}>
              <Button label="Primary Action" variant="primary" onPress={() => {}} fullWidth />
              <Button label="Secondary (Moss)" variant="secondary" onPress={() => {}} fullWidth />
              <Button label="Glass Button" variant="glass" leftIcon="sparkles" onPress={() => {}} fullWidth />
              <Button label="Outline Button" variant="outline" onPress={() => {}} fullWidth />
              <Button label="Loading State" variant="primary" loading onPress={() => {}} fullWidth />
              <Button label="Disabled Button" variant="primary" disabled onPress={() => {}} fullWidth />
            </View>

            {/* Icon Buttons */}
            <SectionHeader title="Icon Buttons" />
            <View style={styles.iconButtonsRow}>
              <IconButton icon="bell" variant="glass" badge={3} accessibilityLabel="Notifications" onPress={() => {}} />
              <IconButton icon="heart" variant="primary" accessibilityLabel="Like" onPress={() => {}} />
              <IconButton icon="share" variant="secondary" accessibilityLabel="Share" onPress={() => {}} />
              <IconButton icon="settings" variant="outline" accessibilityLabel="Settings" onPress={() => {}} />
              <IconButton icon="trash" variant="ghost" accessibilityLabel="Delete" onPress={() => {}} />
            </View>

            {/* Badges */}
            <SectionHeader title="Badges & Tags" />
            <View style={styles.badgesWrap}>
              <Badge label="Primary Orange" variant="primary" />
              <Badge label="Moss Green" variant="secondary" />
              <Badge label="Ocean Slate" variant="slate" />
              <Badge label="Success" variant="success" icon="check-circle" />
              <Badge label="Warning" variant="warning" icon="warning" />
              <Badge label="Danger" variant="danger" icon="alert-circle" />
              <Badge label="Outlined" variant="accent" outlined />
            </View>

            {/* Cards */}
            <SectionHeader title="Cards" />
            <Card variant="glass" selected>
              <Card.Header
                title="Glass Card (Selected)"
                subtitle="Frosted glass with sage border and accent glow"
                rightAction={<Badge label="Active" variant="accent" />}
              />
              <Card.Body>
                <Typography variant="body" color="text">
                  This card utilizes BlurView with experimental fast rendering and fallback support.
                </Typography>
              </Card.Body>
              <Card.Footer>
                <Typography variant="caption" color="textMuted">
                  Updated 5m ago
                </Typography>
                <Button label="Explore" size="sm" variant="glass" onPress={() => {}} />
              </Card.Footer>
            </Card>

            {/* Feedback & States */}
            <SectionHeader title="Alerts & Feedback" />
            <Alert
              variant="info"
              title="Season Registration Open"
              description="Sign up for BGEC and FitSoc tournaments before Sunday midnight."
            />
            <Alert
              variant="success"
              title="Points Credited"
              description="You earned 150 points for winning the basketball match."
            />

            {/* Loading & Skeletons */}
            <SectionHeader title="Skeleton Shimmer" />
            <Skeleton.Card />

            {/* Error & Empty States */}
            <SectionHeader title="Empty & Error States" />
            <Card variant="glass">
              <EmptyState
                icon="trophy"
                title="No Events Found"
                description="There are no upcoming events in this category yet. Check back soon!"
                actionLabel="Browse All Events"
                onAction={() => {}}
              />
            </Card>

            <Card variant="glass">
              <ErrorState
                title="Failed to Load Matches"
                message="Unable to connect to the backend server. Please verify your connection."
                onRetry={() => {}}
              />
            </Card>
          </View>
        )}

        {/* Tab 2: Typography */}
        {tab === 'typography' && (
          <View style={styles.sectionGap}>
            <SectionHeader title="Strict Typography Scale" subtitle="No ad-hoc vibe coding" />

            <Card variant="glass">
              <Card.Body style={styles.typeList}>
                <View style={styles.typeItem}>
                  <Label>Display Hero (Bebas Neue 54sp)</Label>
                  <Typography variant="displayHero" color="text">
                    CHAMPIONS
                  </Typography>
                </View>

                <View style={styles.typeItem}>
                  <Label>Display Title (Barlow Condensed 34sp)</Label>
                  <Typography variant="displayTitle" color="text">
                    TOURNAMENT LEADERBOARD
                  </Typography>
                </View>

                <View style={styles.typeItem}>
                  <Label>Heading 1 (Barlow Condensed 28sp)</Label>
                  <Heading level={1}>Bits Goa Esports Championship</Heading>
                </View>

                <View style={styles.typeItem}>
                  <Label>Heading 2 (Barlow Condensed 22sp)</Label>
                  <Heading level={2}>Upcoming Fixtures & Brackets</Heading>
                </View>

                <View style={styles.typeItem}>
                  <Label>Heading 3 (Inter Bold 18sp)</Label>
                  <Heading level={3}>Team Registration Rules</Heading>
                </View>

                <View style={styles.typeItem}>
                  <Label>Heading 4 (Inter SemiBold 16sp)</Label>
                  <Heading level={4}>Participant Eligibility Criteria</Heading>
                </View>

                <View style={styles.typeItem}>
                  <Label>Body Large (Inter 16sp)</Label>
                  <Typography variant="bodyLarge" color="text">
                    All matches will follow the official university guidelines and bracket seeds.
                  </Typography>
                </View>

                <View style={styles.typeItem}>
                  <Label>Body (Inter 14sp)</Label>
                  <Text color="text">
                    Points are automatically credited to your profile wallet upon match verification.
                  </Text>
                </View>

                <View style={styles.typeItem}>
                  <Label>Body Small (Inter 12sp)</Label>
                  <Typography variant="bodySmall" color="textMuted">
                    Terms & conditions apply. Disputes must be submitted within 2 hours of match completion.
                  </Typography>
                </View>

                <View style={styles.typeItem}>
                  <Label>Monospace Tabular (JetBrains Mono 13sp)</Label>
                  <Mono color="text">
                    TRANSACTION ID: #BGSC-9024-8192 | 02:45.89
                  </Mono>
                </View>
              </Card.Body>
            </Card>
          </View>
        )}

        {/* Tab 3: Forms */}
        {tab === 'forms' && (
          <View style={styles.sectionGap}>
            <SectionHeader title="Form Controls" subtitle="Glass surfaces with validation" />

            <TextInput
              label="Student Email"
              placeholder="f20230000@goa.bits-pilani.ac.in"
              leftIcon="mail"
              allowClear
              value={text}
              onChangeText={setText}
            />

            <TextInput
              label="Password"
              placeholder="Enter secure password"
              leftIcon="lock"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            <SearchInput
              placeholder="Search challenges, players, matches..."
              value={search}
              onChangeText={setSearch}
            />

            <Select
              label="Primary Sport (Single Select)"
              options={sportOptions}
              value={selectedSport}
              onChange={(val) => setSelectedSport(val as string)}
              searchable
            />

            <Select
              label="Interests (Multi Select)"
              options={sportOptions}
              value={selectedInterests}
              onChange={(val) => setSelectedInterests(val as string[])}
              multiple
              searchable
            />

            <TextArea
              label="Match Notes & Summary"
              placeholder="Describe event highlights or issues..."
              value={textarea}
              onChangeText={setTextarea}
              showCharCount
              maxLength={200}
            />

            <SectionHeader title="Toggles & Options" />
            <Card variant="glass">
              <Card.Body style={styles.toggleGroup}>
                <Checkbox
                  checked={checked}
                  onChange={setChecked}
                  label="Agree to tournament regulations"
                  subtitle="Must be accepted by all active team captains"
                />

                <View style={styles.switchRow}>
                  <View style={styles.switchDetails}>
                    <Typography variant="body" color="text">
                      Push Notifications
                    </Typography>
                    <Typography variant="caption" color="textMuted">
                      Receive instant match score updates
                    </Typography>
                  </View>
                  <Switch value={switchVal} onValueChange={setSwitchVal} />
                </View>

                <View style={styles.divider} />

                <RadioGroup
                  value={radioVal}
                  onChange={setRadioVal}
                  options={[
                    { label: 'Standard Registration', value: 'opt1', subtitle: 'Free entry with student ID' },
                    { label: 'Priority VIP Pass', value: 'opt2', subtitle: 'Reserved courtside seating & merch' },
                  ]}
                />
              </Card.Body>
            </Card>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  paletteGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  swatchItem: {
    width: '31%',
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    gap: 4,
  },
  colorBlock: {
    width: '100%',
    height: 36,
    borderRadius: 8,
  },
  monoHex: {
    fontSize: 10,
    fontFamily: 'JetBrainsMono_500Medium',
  },
  responsiveGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dimText: {
    marginTop: 8,
  },
  tabBar: {
    marginVertical: 4,
  },
  sectionGap: {
    gap: 16,
  },
  buttonRow: {
    gap: 10,
  },
  iconButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  badgesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeList: {
    gap: 14,
  },
  typeItem: {
    gap: 4,
  },
  toggleGroup: {
    gap: 16,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  switchDetails: {
    flex: 1,
    gap: 2,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(174, 195, 176, 0.15)',
    marginVertical: 4,
  },
});

