import * as React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View } from 'react-native';

import BottomTabsLayout from './bottom-tabs-layout';
import Events from './events';
import Leaderboard from './leaderboard';
import HallOfFame from './hall-of-fame';
import Media from './media';
import Feedback from './feedback';
import Profile from './profile';
import { useAuth } from '../../store/auth';
import { useTheme } from '../../src/theme/ThemeProvider';
import { Spinner } from '../../src/feedback/Spinner';
import { DrawerContent } from '../../src/navigation/DrawerContent';
import { placeholder } from '../placeholder';

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

// Route names and params are the contract in docs/mobile-v2-build-split.md §3.
// Placeholders keep every route navigable until its v2 screen lands — swap them for the real component.

const Stub = {
  Challenges: placeholder('Challenges', { drawerRoot: true }),
  Announcement: placeholder('Announcement'),
  JoinATeam: placeholder('Join a team'),
  Players: placeholder('Players'),
  MyBids: placeholder('My bids'),
  Match: placeholder('Match'),
  Points: placeholder('Points'),
  Challenge: placeholder('Challenge'),
  Strava: placeholder('Strava'),
  Settings: placeholder('Settings'),
  DeleteAccount: placeholder('Delete account'),
  Notifications: placeholder('Notifications'),
  VerifyPhone: placeholder('Verify phone'),
  FeedbackSent: placeholder('Feedback sent'),
  MyTickets: placeholder('My tickets'),
  Help: placeholder('Help'),
  Welcome: placeholder('Welcome'),
  RestoreAccount: placeholder('Restore account'),
};

const Stack = createNativeStackNavigator();
const Drawer = createDrawerNavigator();

/** Sections reachable from the sidebar; each shows the menu button in its header. */
function AppDrawer() {
  const { colors } = useTheme();
  return (
    <Drawer.Navigator
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: 'front',
        drawerStyle: {
          width: 312,
          backgroundColor: colors.surface,
          borderTopRightRadius: 24,
          borderBottomRightRadius: 24,
          overflow: 'hidden',
        },
        overlayColor: 'rgba(0, 0, 0, 0.62)',
      }}
    >
      <Drawer.Screen name="MainTabs" component={BottomTabsLayout} />
      <Drawer.Screen name="Events" component={Events} />
      <Drawer.Screen name="Leaderboard" component={Leaderboard} />
      <Drawer.Screen name="Challenges" component={Stub.Challenges} />
      <Drawer.Screen name="HallOfFame" component={HallOfFame} />
      <Drawer.Screen name="Media" component={Media} />
      <Drawer.Screen name="Feedback" component={Feedback} />
    </Drawer.Navigator>
  );
}

// Defined at module level so auth-state re-renders do not remount the whole stack.
function LoggedInStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="App" component={AppDrawer} />

      {/* A · home & announcements */}
      <Stack.Screen name="AnnouncementDetail" component={Stub.Announcement} />

      {/* B · events & registration */}
      <Stack.Screen name="EventDetails" component={EventDetails} />
      <Stack.Screen name="EventRegistration" component={EventRegistration} />
      <Stack.Screen name="TeamJoin" component={Stub.JoinATeam} />

      {/* C · live auction */}
      <Stack.Screen name="Auction" component={Auction} />
      <Stack.Screen name="AuctionLots" component={Stub.Players} />
      <Stack.Screen name="MyBids" component={Stub.MyBids} />

      {/* D · leaderboards & brackets */}
      <Stack.Screen name="EventLeaderboard" component={EventLeaderboard} />
      <Stack.Screen name="Match" component={Stub.Match} />

      {/* E · points, challenges & Strava */}
      <Stack.Screen name="Points" component={Stub.Points} />
      <Stack.Screen name="History" component={History} />
      <Stack.Screen name="ChallengeDetail" component={Stub.Challenge} />
      <Stack.Screen name="StravaConnect" component={Stub.Strava} />

      {/* F · profile, settings & notifications */}
      <Stack.Screen name="Profile" component={Profile} />
      <Stack.Screen name="EditProfile" component={EditProfile} />
      <Stack.Screen name="Settings" component={Stub.Settings} />
      <Stack.Screen name="DeleteAccount" component={Stub.DeleteAccount} />
      <Stack.Screen name="Notifications" component={Stub.Notifications} />
      <Stack.Screen name="PhoneOtp" component={Stub.VerifyPhone} />

      {/* H · hall of fame, media & feedback */}
      <Stack.Screen name="HallOfFameDetail" component={HallOfFameDetail} />
      <Stack.Screen
        name="MediaViewer"
        component={MediaViewer}
        options={{ animation: 'fade', presentation: 'fullScreenModal' }}
      />
      <Stack.Screen name="FeedbackSuccess" component={Stub.FeedbackSent} />
      <Stack.Screen name="MyTickets" component={Stub.MyTickets} />
      <Stack.Screen name="ContactFaq" component={Stub.Help} />
    </Stack.Navigator>
  );
}

function AuthStack() {
  return (
    // TODO(G2): initial route becomes Landing once the v2 landing screen is built.
    <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="Landing" component={Stub.Welcome} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="VerifyEmail" component={OtpScreen} />
      <Stack.Screen name="GetStarted" component={CompleteProfileScreen} />
      <Stack.Screen name="RestoreAccount" component={Stub.RestoreAccount} />
      <Stack.Screen name="ForgotPassword" component={ForgotPassword} />
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

  return <NavigationContainer>{isLoggedIn ? <LoggedInStack /> : <AuthStack />}</NavigationContainer>;
}

export default DrawerLayout;
