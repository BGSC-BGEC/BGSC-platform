import * as React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useReducedMotion } from 'react-native-reanimated';

import Home from './home';
import Events from './events';
import Announcement from './announcement';
import Profile from './profile';
import { TabBar } from '../../src/navigation/TabBar';

const Tab = createBottomTabNavigator();

/**
 * Bottom tab navigator for main app sections: Home, Events, Updates, and Profile.
 */
export default function BottomTabsLayout() {
  const reduceMotion = useReducedMotion();
  return (
    <Tab.Navigator
      tabBar={(props) => <TabBar {...props} />}
      // 'shift': the outgoing tab slides/fades a little toward the side the new one comes from.
      screenOptions={{ headerShown: false, animation: reduceMotion ? 'none' : 'shift' }}
    >
      <Tab.Screen name="HomeTab" component={Home} options={{ tabBarLabel: 'Home' }} />
      <Tab.Screen name="EventsTab" component={Events} options={{ tabBarLabel: 'Events' }} />
      <Tab.Screen name="AnnouncementsTab" component={Announcement} options={{ tabBarLabel: 'Updates' }} />
      <Tab.Screen name="ProfileTab" component={Profile} options={{ tabBarLabel: 'Profile' }} />
    </Tab.Navigator>
  );
}
