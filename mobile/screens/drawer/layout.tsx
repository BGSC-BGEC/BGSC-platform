import * as React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HallOfFame from './hall-of-fame';
import Feedback from './feedback';
import Events from './events';
import Announcement from './announcement';
import Home from './home';
import Leaderboard from './leaderboard';
import { useAuth } from '../../store/auth';
import LoginScreen from '../login/login';

const Stack = createNativeStackNavigator();

const Drawer = createDrawerNavigator();

function App(){
    const {isLoggedIn} = useAuth();
    return(
        
        <NavigationContainer>
            {isLoggedIn ? (
                <Drawer.Navigator>
                <Drawer.Screen name="Home" component={Home} />
                <Drawer.Screen name="Announcement" component={Announcement} />
                <Drawer.Screen name="Events" component={Events} />
                <Drawer.Screen name="Feedback" component={Feedback} />
                <Drawer.Screen name="Hall of Fame" component={HallOfFame} />
                <Drawer.Screen name="Leaderboard" component={Leaderboard} />
            </Drawer.Navigator>):(
                <Stack.Navigator>
                    <Stack.Screen name="Login" component={LoginScreen} />
                </Stack.Navigator>
            )}
            
        </NavigationContainer>
        
    )
}

export default App;