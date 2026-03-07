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
  BackHandler,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import BleService from '../services/BleService';

const ScanningScreen = () => {
  const navigation = useNavigation();
  const [devices, setDevices] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectingDeviceId, setConnectingDeviceId] = useState(null);

  useEffect(() => {
    requestPermissions();
    
    const backAction = () => {
      Alert.alert(
        "Exit App",
        "Do you really want to exit?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Yes", onPress: () => BackHandler.exitApp() }
        ]
      );
      return true;
    };

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      backAction
    );

    return () => {
      BleService.stopScan();
      backHandler.remove();
    };
  }, []);

  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        const permissions = [
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
        ];

        // Add Bluetooth permissions for Android 12+
        if (Platform.Version >= 31) {
          permissions.push(
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
          );
        }

        const granted = await PermissionsAndroid.requestMultiple(permissions);

        const allGranted = Object.values(granted).every(
          permission => permission === PermissionsAndroid.RESULTS.GRANTED
        );

        if (allGranted) {
          console.log('All permissions granted');
          // Auto-start scanning
          startScanning();
        } else {
          Alert.alert(
            'Permissions Required', 
            'Please grant all permissions to scan for devices',
            [
              { text: 'OK', onPress: () => console.log('Permissions denied') }
            ]
          );
        }
      } catch (err) {
        console.warn('Permission request error:', err);
        Alert.alert('Error', 'Failed to request permissions');
      }
    } else {
      // iOS - start scanning directly
      startScanning();
    }
  };

  const startScanning = async () => {
    if (isScanning) return;

    try {
      setIsScanning(true);
      
      setDevices([]);
      console.log('Starting device scan...');

      await BleService.startScan((foundDevices) => {
        console.log('Devices found:', foundDevices.length);
        setDevices(foundDevices);
      });

      // Auto-stop scan after 15 seconds
      setTimeout(() => { 
          console.log('Auto-stopping scan after 15 seconds...');
          stopScanning(); 
      }, 15000);

    } catch (error) {
      console.error('Scan start error:', error);
      Alert.alert('Scan Error', `Failed to start scanning: ${error.message}`);
      setIsScanning(false);
    }
  };

  const stopScanning = () => {
    console.log('Stopping scan...');
    BleService.stopScan();
    setIsScanning(false);
  };

  const handleDevicePress = async (device) => {
    if (isConnecting) {
      Alert.alert('Please Wait', 'Already connecting to a device...');
      return;
    }

    try {
      // Stop scanning first
      // stopScanning();
      
      setIsConnecting(true);
      setConnectingDeviceId(device.id);
      
      console.log('Attempting to connect to device:', device.name || device.id);

      // Connect to the device
      const connectedDevice = await BleService.connectToDevice(device.id);
      
      console.log('Successfully connected, navigating to Connection screen');
      
      // Navigate to connection screen with the connected device
      navigation.navigate('Connection', { 
        device: connectedDevice,
        deviceInfo: device // Also pass original device info
      });

    } catch (error) {
      console.error('Connection error:', error);
      Alert.alert(
        'Connection Failed', 
        `Failed to connect to ${device.name || 'device'}: ${error.message}`,
        [{ text: 'OK' }]
      );
    } finally {
      setIsConnecting(false);
      setConnectingDeviceId(null);
    }
  };

  const renderDevice = ({ item }) => {
    const isConnectingToThis = connectingDeviceId === item.id;
    
    return (
      <TouchableOpacity 
        style={[
          styles.deviceItem,
          isConnectingToThis && styles.deviceItemConnecting
        ]} 
        onPress={() => handleDevicePress(item)}
        disabled={isConnecting}
      >
        <View style={styles.deviceInfo}>
          <Text style={styles.deviceName}>
            {item.name || `Device ${item.id.substring(0, 8)}`}
          </Text>
          <Text style={styles.deviceId}>ID: {item.id}</Text>
          <Text style={styles.deviceRssi}>
            Signal: {item.rssi !== null ? `${item.rssi} dBm` : 'Unknown'}
          </Text>
         
        </View>
        
        {isConnectingToThis && (
          <View style={styles.connectingIndicator}>
            <ActivityIndicator size="small" color="#007AFF" />
            <Text style={styles.connectingText}>Connecting...</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>BLE Scanner</Text>
        <Text style={styles.subtitle}>
          Find and connect to nearby BLE devices
        </Text>
        
        <TouchableOpacity
          style={[
            styles.scanButton, 
            (isScanning || isConnecting) && styles.scanButtonDisabled
          ]}
          onPress={isScanning ? stopScanning : startScanning}
          disabled={isConnecting}
        >
          {isScanning ? (
            <Text style={styles.scanButtonText}>Stop Scan</Text>
          ) : (
            <Text style={styles.scanButtonText}>
              Scan for devices
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {isScanning && (
        <View style={styles.scanningIndicator}>
          <ActivityIndicator size="small" color="#007AFF" />
          <Text style={styles.scanningText}>
            Scanning for BLE devices...
          </Text>
        </View>
      )}

      <FlatList
        data={devices}
        keyExtractor={(item) => item.id}
        renderItem={renderDevice}
        contentContainerStyle={styles.deviceList}
        ListEmptyComponent={
          !isScanning ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {devices.length === 0 
                  ? 'Tap "Start Scan" to search for devices.' 
                  : 'No devices found'
                }
              </Text>
            </View>
          ) : null
        }
      />
      
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {devices.length} device{devices.length !== 1 ? 's' : ''} Found
        </Text>
        {devices.length > 0 && (
          <Text style={styles.footerHint}>
            Tap a device to connect
          </Text>
        )}
      </View>
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  title: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    color: '#1C2526', 
    marginBottom: 5 
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
  },
  scanButton: { 
    backgroundColor: '#007AFF', 
    padding: 15, 
    borderRadius: 8, 
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  scanButtonDisabled: { backgroundColor: '#A0A0A0' },
  scanButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scanButtonText: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: '600',
    marginLeft: 8,
  },
  scanningIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    backgroundColor: '#E3F2FD',
    marginHorizontal: 20,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  scanningText: { 
    marginLeft: 10, 
    fontSize: 14, 
    color: '#1976D2',
    fontWeight: '500',
  },
  connectingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    backgroundColor: '#FFF3E0',
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  connectingText: { 
    marginLeft: 10, 
    fontSize: 14, 
    color: '#F57C00',
    fontWeight: '500',
  },
  deviceList: { 
    padding: 20,
    flexGrow: 1,
  },
  deviceItem: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  deviceItemConnecting: {
    borderLeftColor: '#FF9800',
    backgroundColor: '#FFF8E1',
  },
  deviceInfo: { flex: 1 },
  deviceName: { 
    fontSize: 18, 
    fontWeight: '600', 
    color: '#1C2526', 
    marginBottom: 6 
  },
  deviceId: { 
    fontSize: 12, 
    color: '#666', 
    marginBottom: 4,
    fontFamily: 'monospace',
  },
  deviceRssi: { 
    fontSize: 12, 
    color: '#666',
    marginBottom: 4,
  },
  deviceConnectable: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 50,
  },
  emptyText: { 
    textAlign: 'center', 
    fontSize: 16, 
    color: '#666', 
    lineHeight: 24,
  },
  footer: {
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  footerHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
});

export default ScanningScreen;
