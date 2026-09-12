import * as React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';

import Home from './home';
import Events from './events';
import Leaderboard from './leaderboard';
import Profile from './profile';
import Announcement from './announcement';
import HallOfFame from './hall-of-fame';
import Feedback from './feedback';
import { useTheme } from '../../src/theme/ThemeProvider';

const Tab = createBottomTabNavigator();

export default function BottomTabsLayout() {
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 85 : 65,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 25 : 10,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={Home}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="EventsTab"
        component={Events}
        options={{
          tabBarLabel: 'Events',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="LeaderboardTab"
        component={Leaderboard}
        options={{
          tabBarLabel: 'Leaderboard',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="trophy" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={Profile}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
      {/* Hidden tabs for drawer screens - accessible via drawer but with bottom nav */}
      <Tab.Screen
        name="AnnouncementsTab"
        component={Announcement}
        options={{
          tabBarButton: () => null, // Hide from bottom tabs
          tabBarLabel: 'Announcements',
        }}
      />
      <Tab.Screen
        name="HallOfFameTab"
        component={HallOfFame}
        options={{
          tabBarButton: () => null, // Hide from bottom tabs
          tabBarLabel: 'Hall of Fame',
        }}
      />
      <Tab.Screen
        name="FeedbackTab"
        component={Feedback}
        options={{
          tabBarButton: () => null, // Hide from bottom tabs
          tabBarLabel: 'Feedback',
        }}
      />
    </Tab.Navigator>
  );
}
