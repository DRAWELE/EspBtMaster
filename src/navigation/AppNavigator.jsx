import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import Splash from '../screens/SplashScreen';
import Scanning from '../screens/ScanningScreen';
import Connection from '../screens/ConnectionScreen';

const Stack = createStackNavigator();

const AppNavigator = () => (
  <NavigationContainer>
    <Stack.Navigator initialRouteName="Splash" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Splash" component={Splash} />
      <Stack.Screen name="Scanning" component={Scanning} />
      <Stack.Screen name="Connection" component={Connection} />
    </Stack.Navigator>
  </NavigationContainer>
);

export default AppNavigator;