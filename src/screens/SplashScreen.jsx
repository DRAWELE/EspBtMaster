import React, { useEffect } from 'react';
import { View } from 'react-native';
import Loader from '../components/Loader';
// Remove: import SplashScreen from 'react-native-splash-screen';

const Splash = ({ navigation }) => {
  useEffect(() => {
    setTimeout(() => {
      navigation.replace('Scanning');
      // Remove: SplashScreen.hide();
    }, 3000);
  }, [navigation]);

  return (
    <View style={{ flex: 1 }}>
      <Loader />
    </View>
  );
};

export default Splash;