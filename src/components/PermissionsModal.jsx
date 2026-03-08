import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  PermissionsAndroid,
  Platform,
  Linking,
  NativeModules,
  Image,
} from 'react-native';
import { BleManager } from 'react-native-ble-plx';
import SystemSetting from 'react-native-system-setting';

const bleManager = new BleManager();

const PermissionsModal = ({ visible, onPermissionsGranted }) => {
  const [bluetoothEnabled, setBluetoothEnabled] = useState(false);
  const [locationPermission, setLocationPermission] = useState(false);
  const [locationEnabled, setLocationEnabled] = useState(false);

  useEffect(() => {
    if (visible) {
      checkPermissions();
      const interval = setInterval(checkPermissions, 1000);
      return () => clearInterval(interval);
    }
  }, [visible]);

  const checkPermissions = async () => {
    let btEnabled = false;
    let locPermission = false;
    let locEnabled = false;

    try {
      const state = await bleManager.state();
      btEnabled = state === 'PoweredOn';
      setBluetoothEnabled(btEnabled);
    } catch (error) {
      setBluetoothEnabled(false);
    }

    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        locPermission = granted;
        setLocationPermission(granted);

        if (granted) {
          try {
            locEnabled = await SystemSetting.isLocationEnabled();
            setLocationEnabled(locEnabled);
          } catch (e) {
            console.log('GPS check error:', e);
            locEnabled = false;
            setLocationEnabled(false);
          }
        } else {
          setLocationEnabled(false);
        }
      } catch (error) {
        setLocationPermission(false);
        setLocationEnabled(false);
      }
    } else {
      locPermission = true;
      locEnabled = true;
      setLocationPermission(true);
      setLocationEnabled(true);
    }

    // Auto-close modal if all permissions granted
    if (btEnabled && locPermission && locEnabled && visible) {
      onPermissionsGranted();
    }
  };

  const requestLocationPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ]);
      } catch (error) {
        console.error('Permission request error:', error);
      }
    }
  };

  const enableLocation = async () => {
    if (Platform.OS === 'android') {
      try {
        await SystemSetting.switchLocation(() => {
          console.log('Location prompt shown');
        });
      } catch (error) {
        console.log('GPS enable error:', error);
        Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS');
      }
    }
  };

  const enableBluetooth = async () => {
    if (Platform.OS === 'android') {
      try {
        await Linking.sendIntent('android.settings.BLUETOOTH_SETTINGS');
      } catch (error) {
        Linking.openSettings();
      }
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={() => {}}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>Permissions Required</Text>
          <Text style={styles.subtitle}>Tap on items to enable</Text>

          <View style={styles.permissionsContainer}>
            <TouchableOpacity
              style={[
                styles.permissionItem,
                bluetoothEnabled ? styles.permissionEnabled : styles.permissionDisabled
              ]}
              onPress={!bluetoothEnabled ? enableBluetooth : null}
              activeOpacity={bluetoothEnabled ? 1 : 0.7}
            >
              <View style={styles.iconContainer}>
                <Image 
                  source={bluetoothEnabled ? require('../assets/tick.png') : require('../assets/fail.png')} 
                  style={styles.permissionIcon}
                />
              </View>
              <View style={styles.permissionTextContainer}>
                <Text style={styles.permissionTitle}>Bluetooth</Text>
                <Text style={styles.permissionStatus}>
                  {bluetoothEnabled ? 'Enabled' : 'Tap to enable'}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.permissionItem,
                locationPermission ? styles.permissionEnabled : styles.permissionDisabled
              ]}
              onPress={!locationPermission ? requestLocationPermission : null}
              activeOpacity={locationPermission ? 1 : 0.7}
            >
              <View style={styles.iconContainer}>
                <Image 
                  source={locationPermission ? require('../assets/tick.png') : require('../assets/fail.png')} 
                  style={styles.permissionIcon}
                />
              </View>
              <View style={styles.permissionTextContainer}>
                <Text style={styles.permissionTitle}>Location Permission</Text>
                <Text style={styles.permissionStatus}>
                  {locationPermission ? 'Granted' : 'Tap to grant'}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.permissionItem,
                locationEnabled ? styles.permissionEnabled : styles.permissionDisabled
              ]}
              onPress={!locationEnabled ? enableLocation : null}
              activeOpacity={locationEnabled ? 1 : 0.7}
            >
              <View style={styles.iconContainer}>
                <Image 
                  source={locationEnabled ? require('../assets/tick.png') : require('../assets/fail.png')} 
                  style={styles.permissionIcon}
                />
              </View>
              <View style={styles.permissionTextContainer}>
                <Text style={styles.permissionTitle}>GPS / Location</Text>
                <Text style={styles.permissionStatus}>
                  {locationEnabled ? 'Enabled' : 'Tap to enable'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#1C1C1C',
    borderRadius: 20,
    padding: 25,
  },
  title: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    color: '#888',
    fontSize: 14,
    marginBottom: 30,
    textAlign: 'center',
  },
  permissionsContainer: {
    marginBottom: 10,
  },
  permissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
  },
  permissionEnabled: {
    backgroundColor: '#1A2F1A',
    borderColor: '#4CAF50',
  },
  permissionDisabled: {
    backgroundColor: '#2F1A1A',
    borderColor: '#F44336',
  },
  iconContainer: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  permissionIcon: {
    width: 26,
    height: 26,
  },
  permissionTextContainer: {
    flex: 1,
  },
  permissionTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 3,
  },
  permissionStatus: {
    color: '#AAA',
    fontSize: 12,
  },
});

export default PermissionsModal;
