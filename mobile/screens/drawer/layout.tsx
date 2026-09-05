import * as React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { NavigationContainer } from '@react-navigation/native';
import { View, Text } from 'react-native';
import HallOfFame from './hall-of-fame';
import Feedback from './feedback';
import Events from './events';
import Announcement from './announcement';
import Home from './home';
import Leaderboard from './leaderboard';
import { AuthProvider } from '../../store/auth';

const Drawer = createDrawerNavigator();

function App(){
    return(
        <AuthProvider>
            <NavigationContainer> 
                <Drawer.Navigator>
                    <Drawer.Screen name="Home" component={Home} />
                    <Drawer.Screen name="Announcement" component={Announcement} />
                    <Drawer.Screen name="Events" component={Events} />
                    <Drawer.Screen name="Feedback" component={Feedback} />
                    <Drawer.Screen name="Hall of Fame" component={HallOfFame} />
                    <Drawer.Screen name="Leaderboard" component={Leaderboard} />
                </Drawer.Navigator>
            </NavigationContainer>
        </AuthProvider>
    )
}

export default App;