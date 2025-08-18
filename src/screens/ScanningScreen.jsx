import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import BleService from '../services/BleService';

const ScanningScreen = () => {
  const navigation = useNavigation();
  const [devices, setDevices] = useState([]);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    requestPermissions();
    return () => {
      BleService.stopScan();
    };
  }, []);

  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ]);

        const allGranted = Object.values(granted).every(
          permission => permission === PermissionsAndroid.RESULTS.GRANTED
        );

        if (allGranted) {
          startScanning();
        } else {
          Alert.alert('Permissions Required', 'Please grant all permissions to scan for devices');
        }
      } catch (err) {
        console.warn(err);
      }
    } else {
      startScanning();
    }
  };

  const startScanning = () => {
  setIsScanning(true);
  setDevices([]);
 
  BleService.startScan((foundDevices) => {
    console.log('Devices found:', foundDevices.length);
    setDevices(foundDevices);
  });

  
  setTimeout(() => {
    console.log('Stopping scan...');
    BleService.stopScan();
    setIsScanning(false);
  }, 10000);
};

  const handleDevicePress = async (device) => {
    try {
      BleService.stopScan();
      setIsScanning(false);
      const connectedDevice = await BleService.connectToDevice(device.id);
      navigation.navigate('Connection', { device: connectedDevice });
    } catch (error) {
      Alert.alert('Error', 'Failed to connect to device: ' + error.message);
    }
  };

  const renderDevice = ({ item }) => (
    <TouchableOpacity style={styles.deviceItem} onPress={() => handleDevicePress(item)}>
      <View style={styles.deviceInfo}>
        <Text style={styles.deviceName}>{item.name || `Device ${item.id.substring(0, 8)}`}</Text>
        <Text style={styles.deviceId}>ID: {item.id}</Text>
        <Text style={styles.deviceRssi}>Signal: {item.rssi || 'N/A'} dBm</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>BLE Device Scanner</Text>
        <TouchableOpacity
          style={[styles.scanButton, isScanning && styles.scanButtonDisabled]}
          onPress={startScanning}
          disabled={isScanning}
        >
          {isScanning ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.scanButtonText}>Scan Devices</Text>
          )}
        </TouchableOpacity>
      </View>

      {isScanning && (
        <View style={styles.scanningIndicator}>
          <ActivityIndicator size="small" color="#007AFF" />
          <Text style={styles.scanningText}>Scanning for devices...</Text>
        </View>
      )}

      <FlatList
        data={devices}
        keyExtractor={(item) => item.id}
        renderItem={renderDevice}
        contentContainerStyle={styles.deviceList}
        ListEmptyComponent={
          !isScanning ? (
            <Text style={styles.emptyText}>No devices found. Tap "Scan Devices" to start.</Text>
          ) : null
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F9FC' },
  header: {
    padding: 20,
    paddingTop: 50,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1C2526', marginBottom: 15 },
  scanButton: { backgroundColor: '#007AFF', padding: 12, borderRadius: 8, alignItems: 'center' },
  scanButtonDisabled: { backgroundColor: '#A0A0A0' },
  scanButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  scanningIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  scanningText: { marginLeft: 10, fontSize: 14, color: '#666' },
  deviceList: { padding: 20 },
  deviceItem: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  deviceInfo: { flex: 1 },
  deviceName: { fontSize: 18, fontWeight: '600', color: '#1C2526', marginBottom: 4 },
  deviceId: { fontSize: 12, color: '#666', marginBottom: 2 },
  deviceRssi: { fontSize: 12, color: '#666' },
  emptyText: { textAlign: 'center', fontSize: 16, color: '#666', marginTop: 50 },
});

export default ScanningScreen;