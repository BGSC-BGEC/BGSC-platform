import React from 'react';
import { ScrollView, StyleSheet, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { Typography } from '../../src/typography/Typography';
import { Card } from '../../src/components/Card';
import { Badge } from '../../src/components/Badge';
import { Button } from '../../src/components/Button';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useAuth } from '../../store/auth';

export default function Profile() {
  const { colors } = useTheme();
  const { user, logout } = useAuth();
  const navigation = useNavigation();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Typography variant="displayHero" style={{ color: '#FFF' }}>
              {user?.username?.charAt(0).toUpperCase() || 'U'}
            </Typography>
          </View>
          <Typography variant="displayTitle" style={styles.username}>
            {user?.username || 'User'}
          </Typography>
          <Typography variant="body" color="textMuted">
            {user?.email || 'user@example.com'}
          </Typography>
          <Badge label={user?.role || 'Member'} variant="primary" style={styles.roleBadge} />
        </View>

        {/* Player Card */}
        <Card variant="accent">
          <Card.Header
            title="Player Stats"
            rightAction={<Ionicons name="trophy" size={24} color={colors.primary} />}
          />
          <Card.Body>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Typography variant="displayTitle">1,250</Typography>
                <Typography variant="caption" color="textMuted">Total Points</Typography>
              </View>
              <View style={styles.statItem}>
                <Typography variant="displayTitle">12</Typography>
                <Typography variant="caption" color="textMuted">Events Joined</Typography>
              </View>
              <View style={styles.statItem}>
                <Typography variant="displayTitle">#8</Typography>
                <Typography variant="caption" color="textMuted">Rank</Typography>
              </View>
            </View>
          </Card.Body>
        </Card>

        {/* Events History */}
        <Card variant="solid">
          <Card.Header title="Recent Events" />
          <Card.Body>
            <View style={styles.eventItem}>
              <Typography variant="bodyBold">Football Championship</Typography>
              <Typography variant="caption" color="textMuted">Completed • +150 pts</Typography>
            </View>
            <View style={styles.eventItem}>
              <Typography variant="bodyBold">Coding Workshop</Typography>
              <Typography variant="caption" color="textMuted">Completed • +100 pts</Typography>
            </View>
            <View style={styles.eventItem}>
              <Typography variant="bodyBold">Cricket League</Typography>
              <Typography variant="caption" color="textMuted">Registered</Typography>
            </View>
          </Card.Body>
          <Card.Footer>
            <Button label="View all history" variant="outline" size="sm" onPress={() => {}} />
          </Card.Footer>
        </Card>

        {/* Settings/Actions */}
        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              { backgroundColor: colors.surface },
              pressed && styles.actionPressed
            ]}
            onPress={() => {}}
          >
            <Ionicons name="settings-outline" size={20} color={colors.text} />
            <Typography variant="body">Account Settings</Typography>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              { backgroundColor: colors.surface },
              pressed && styles.actionPressed
            ]}
            onPress={() => {}}
          >
            <Ionicons name="help-circle-outline" size={20} color={colors.text} />
            <Typography variant="body">Help & Support</Typography>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              styles.logoutButton,
              pressed && styles.actionPressed
            ]}
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={20} color="#D32F2F" />
            <Typography variant="body" style={{ color: '#D32F2F' }}>Logout</Typography>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1
  },
  content: {
    padding: 20,
    gap: 20,
    paddingBottom: 40,
  },
  profileHeader: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  username: {
    marginTop: 4,
  },
  roleBadge: {
    marginTop: 8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
  },
  statItem: {
    alignItems: 'center',
    gap: 4,
  },
  eventItem: {
    paddingVertical: 8,
    gap: 4,
  },
  actions: {
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
  },
  actionPressed: {
    opacity: 0.7,
  },
  logoutButton: {
    backgroundColor: '#FFEBEE',
  },
});
