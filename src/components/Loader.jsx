import React from 'react';
import { View, ActivityIndicator, Image, StyleSheet } from 'react-native';

const Loader = () => (
    <View style={styles.container}>
        <Image source={require('../assets/logo.png')} style={styles.logo} />
        <ActivityIndicator size="large" color="#0000ff" />
    </View>
);

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
    logo: { width: 100, height: 100, marginBottom: 20 },
});

export default Loader;