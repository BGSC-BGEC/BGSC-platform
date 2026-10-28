import * as React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { NavigationContainer, getStateFromPath } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import BottomTabsLayout from './bottom-tabs-layout';
import Events from './events';
import Leaderboard from './leaderboard';
import HallOfFame from './hall-of-fame';
import Media from './media';
import Feedback from './feedback';
import Profile from './profile';
import { useAuth } from '../../store/auth';
import { useTheme } from '../../src/theme/ThemeProvider';
import { DrawerContent } from '../../src/navigation/DrawerContent';

import SplashScreen from '../login/splash';
import LandingScreen from '../login/landing';
import LoginScreen from '../login/login';
import RegisterScreen from '../login/register';
import VerifyEmailScreen from '../login/verify-email';
import GetStartedScreen from '../login/get-started';
import RestoreAccountScreen from '../login/restore-account';
import ForgotPassword from '../login/forgot-password';
import EventDetails from '../events/event-details';
import EventRegistration from '../events/registration';
import Auction from '../events/auction';
import EditProfile from '../profile/edit-profile';
import History from '../profile/history';
import EventLeaderboard from '../events/event-leaderboard';
import MediaViewer from '../media/media-viewer';
import HallOfFameDetail from '../hall-of-fame/hall-of-fame-detail';
import AnnouncementDetailScreen from '../announcements/announcement-detail';
import TeamJoin from '../events/team-join';
import AuctionLots from '../events/auction-lots';
import MyBids from '../events/my-bids';

import Challenges from '../challenges/challenges';
import ChallengeDetail from '../challenges/challenge-detail';
import StravaConnect from '../strava/strava-connect';
import Match from '../events/match';
import Settings from '../profile/settings';
import DeleteAccount from '../profile/delete-account';
import Notifications from '../profile/notifications';
import PhoneOtp from '../profile/phone-otp';
import FeedbackSuccess from '../feedback/feedback-success';
import MyTickets from '../feedback/my-tickets';
import ContactFaq from '../feedback/contact-faq';

const linking = {
  prefixes: ['bgsc://app', 'bgsc://'],
  config: { screens: { StravaConnect: 'settings/integrations' } },
  // Google sign-in's redirect is read by the auth browser session, not routed.
  filter: (url: string) => !/^bgsc:\/\/auth\/callback/.test(url),
  getStateFromPath(path: string, options: any) {
    if (path.split(/[?#]/)[0].replace(/^\//, '') === 'settings/integrations') {
      return { routes: [{ name: 'App' }, { name: 'StravaConnect', params: { callbackUrl: path } }] };
    }
    return getStateFromPath(path, options);
  },
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
      <Drawer.Screen name="Challenges" component={Challenges} />
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
      <Stack.Screen name="AnnouncementDetail" component={AnnouncementDetailScreen} />

      {/* B · events & registration */}
      <Stack.Screen name="EventDetails" component={EventDetails} />
      <Stack.Screen name="EventRegistration" component={EventRegistration} />
      <Stack.Screen name="TeamJoin" component={TeamJoin} />

      {/* C · live auction */}
      <Stack.Screen name="Auction" component={Auction} />
      <Stack.Screen name="AuctionLots" component={AuctionLots} />
      <Stack.Screen name="MyBids" component={MyBids} />

      {/* D · leaderboards & brackets */}
      <Stack.Screen name="EventStandings" component={EventLeaderboard} />
      <Stack.Screen name="EventLeaderboard" component={EventLeaderboard} />
      <Stack.Screen name="Match" component={Match} />

      {/* E · points, challenges & Strava */}
      <Stack.Screen name="Points" component={History} />
      <Stack.Screen name="History" component={History} />
      <Stack.Screen name="ChallengeDetail" component={ChallengeDetail} />
      <Stack.Screen name="StravaConnect" component={StravaConnect} />

      {/* F · profile, settings & notifications */}
      <Stack.Screen name="Profile" component={Profile} />
      <Stack.Screen name="EditProfile" component={EditProfile} />
      <Stack.Screen name="Settings" component={Settings} />
      <Stack.Screen name="DeleteAccount" component={DeleteAccount} />
      <Stack.Screen name="Notifications" component={Notifications} />
      <Stack.Screen name="PhoneOtp" component={PhoneOtp} />

      {/* H · hall of fame, media & feedback */}
      <Stack.Screen name="HallOfFameDetail" component={HallOfFameDetail} />
      <Stack.Screen
        name="MediaViewer"
        component={MediaViewer}
        options={{ animation: 'fade', presentation: 'fullScreenModal' }}
      />
      <Stack.Screen name="FeedbackSuccess" component={FeedbackSuccess} />
      <Stack.Screen name="MyTickets" component={MyTickets} />
      <Stack.Screen name="ContactFaq" component={ContactFaq} />
    </Stack.Navigator>
  );
}

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="Landing" component={LandingScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="RestoreAccount" component={RestoreAccountScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPassword} />
    </Stack.Navigator>
  );
}

/** Signed in straight from sign-up: verify email, then pick interests, then the app. */
function OnboardingStack({ start }: { start: 'VerifyEmail' | 'GetStarted' }) {
  return (
    <Stack.Navigator initialRouteName={start} screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
      <Stack.Screen name="GetStarted" component={GetStartedScreen} />
    </Stack.Navigator>
  );
}

function DrawerLayout() {
  const { isLoggedIn, isBootstrapping, onboarding } = useAuth();

  if (isBootstrapping) return <SplashScreen />;

  return (
    <NavigationContainer linking={linking}>
      {!isLoggedIn ? (
        <AuthStack />
      ) : onboarding ? (
        <OnboardingStack start={onboarding === 'verify' ? 'VerifyEmail' : 'GetStarted'} />
      ) : (
        <LoggedInStack />
      )}
    </NavigationContainer>
  );
}

export default DrawerLayout;
