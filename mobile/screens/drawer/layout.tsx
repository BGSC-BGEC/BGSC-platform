import * as React from 'react';
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  DrawerItem,
  type DrawerContentComponentProps,
} from '@react-navigation/drawer';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import BottomTabsLayout from './bottom-tabs-layout';
import { useAuth } from '../../store/auth';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useConfirmLogout } from '../../src/hooks/useConfirmLogout';
import { Spinner } from '../../src/feedback/Spinner';

import LoginScreen from '../login/login';
import RegisterScreen from '../login/register';
import OtpScreen from '../login/otp';
import CompleteProfileScreen from '../login/complete-profile';
import ForgotPassword from '../login/forgot-password';
import EventDetails from '../events/event-details';
import EventRegistration from '../events/registration';
import Auction from '../events/auction';
import EditProfile from '../profile/edit-profile';
import History from '../profile/history';
import EventLeaderboard from '../events/event-leaderboard';
import MediaViewer from '../media/media-viewer';
import HallOfFameDetail from '../hall-of-fame/hall-of-fame-detail';

const Stack = createNativeStackNavigator();
const Drawer = createDrawerNavigator();

const ACTIVE_TINT = '#FF6B35';
const INACTIVE_TINT = '#6E665D';
const LOGOUT_TINT = '#D32F2F';

// Every drawer entry opens a tab inside MainTabs, so the highlight has to follow
// the focused tab rather than the drawer route (which is always MainTabs).
const DRAWER_ITEMS: Array<{ label: string; tab: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = [
  { label: 'Home', tab: 'HomeTab', icon: 'home-outline' },
  { label: 'Announcements', tab: 'AnnouncementsTab', icon: 'megaphone-outline' },
  { label: 'Hall of Fame', tab: 'HallOfFameTab', icon: 'star-outline' },
  { label: 'Media', tab: 'MediaTab', icon: 'images-outline' },
  { label: 'Feedback', tab: 'FeedbackTab', icon: 'chatbox-outline' },
];

function focusedTab(state: DrawerContentComponentProps['state']): string {
  const main = state.routes.find((r) => r.name === 'MainTabs');
  const tabs = main?.state;
  if (!tabs || tabs.index == null) return 'HomeTab';
  return tabs.routes[tabs.index]?.name ?? 'HomeTab';
}

function DrawerContent(props: DrawerContentComponentProps) {
  const confirmLogout = useConfirmLogout();
  const current = focusedTab(props.state);

  return (
    <DrawerContentScrollView {...props}>
      {DRAWER_ITEMS.map((item) => (
        <DrawerItem
          key={item.tab}
          label={item.label}
          focused={current === item.tab}
          activeTintColor={ACTIVE_TINT}
          inactiveTintColor={INACTIVE_TINT}
          icon={({ color, size }) => <Ionicons name={item.icon} size={size} color={color} />}
          onPress={() => {
            props.navigation.navigate('MainTabs', { screen: item.tab });
            props.navigation.closeDrawer();
          }}
        />
      ))}
      <DrawerItem
        label="Logout"
        labelStyle={{ color: LOGOUT_TINT, fontWeight: '700' }}
        activeTintColor={LOGOUT_TINT}
        inactiveTintColor={LOGOUT_TINT}
        icon={({ color, size }) => <Ionicons name="log-out-outline" size={size} color={color} />}
        onPress={() => {
          props.navigation.closeDrawer();
          void confirmLogout();
        }}
      />
    </DrawerContentScrollView>
  );
}

function DrawerWithTabs() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerActiveTintColor: ACTIVE_TINT,
        drawerInactiveTintColor: INACTIVE_TINT,
        drawerType: 'front',
      }}
    >
      <Drawer.Screen name="MainTabs" component={BottomTabsLayout} />
    </Drawer.Navigator>
  );
}

// Defined at module level so auth-state re-renders do not remount the whole stack.
function LoggedInStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="App" component={DrawerWithTabs} />
      <Stack.Screen name="EventDetails" component={EventDetails} />
      <Stack.Screen name="EventRegistration" component={EventRegistration} />
      <Stack.Screen name="EventLeaderboard" component={EventLeaderboard} />
      <Stack.Screen name="Auction" component={Auction} />
      <Stack.Screen name="MediaViewer" component={MediaViewer} options={{ animation: 'fade', presentation: 'fullScreenModal' }} />
      <Stack.Screen name="HallOfFameDetail" component={HallOfFameDetail} />
      <Stack.Screen name="EditProfile" component={EditProfile} />
      <Stack.Screen name="History" component={History} />
    </Stack.Navigator>
  );
}

function BootSplash() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
      <Spinner size="large" />
    </View>
  );
}

function DrawerLayout() {
  const { isLoggedIn, isBootstrapping } = useAuth();

  if (isBootstrapping) return <BootSplash />;

  return (
    <NavigationContainer>
      {isLoggedIn ? (
        <LoggedInStack />
      ) : (
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            animation: 'fade',
          }}
        >
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="OTP" component={OtpScreen} />
          <Stack.Screen name="CompleteProfile" component={CompleteProfileScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPassword} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}

export default DrawerLayout;