import { BleManager } from 'react-native-ble-plx';

const bleManager = new BleManager();

let isInitialized = false;
let scanSubscription = null;
const devices = new Map();

// Nordic UART Service UUIDs
const NUS_SERVICE_UUID = '6E400001-B5A3-F393-E0A9-E50E24DCCA9E';
const NUS_RX_CHARACTERISTIC_UUID = '6E400002-B5A3-F393-E0A9-E50E24DCCA9E';
const NUS_TX_CHARACTERISTIC_UUID = '6E400003-B5A3-F393-E0A9-E50E24DCCA9E';

const initBle = async () => {
  if (!isInitialized) {
    try {
      const state = await bleManager.state();
      console.log('Current BLE state:', state);
      
      if (state === 'PoweredOn') {
        isInitialized = true;
        console.log('BLE initialized successfully');
      } else {
        console.error('BLE not powered on:', state);
        throw new Error(`Bluetooth is not enabled. Current state: ${state}`);
      }
    } catch (error) {
      console.error('BLE initialization failed:', error.message);
      throw error;
    }
  }
};

const startScan = async (onDeviceFound) => {
  try {
    // Initialize BLE if not already done
    await initBle();
    
    // Stop any existing scan
    // stopScan(); 
    devices.clear();

    console.log('Starting BLE scan for devices...');

    scanSubscription = bleManager.startDeviceScan(
      [NUS_SERVICE_UUID], // Filter for Nordic UART Service
      { 
        allowDuplicates: false,
        scanMode: 1, // Balanced mode
        callbackType: 1, // All matches
      },
      (error, device) => {
        if (error) {
          console.error('Scan error:', error.message);
          // Continue scanning despite errors
          return;
        }
        
        if (device && device.id) {
          console.log('Found device:', {
            name: device.name || 'Unknown',
            id: device.id,
            rssi: device.rssi,
            isConnectable: device.isConnectable
          });
        
          if (!devices.has(device.id)) {
            const deviceInfo = {
              id: device.id,
              name: device.name || null,
              rssi: device.rssi || null,
              isConnectable: device.isConnectable,
              serviceUUIDs: device.serviceUUIDs || []
            };
            
            devices.set(device.id, deviceInfo);
            onDeviceFound(Array.from(devices.values()));
          }
        }
      }
    );
  } catch (error) {
    console.error('Failed to start scan:', error);
    throw error;
  }
};

const stopScan = () => {
  try {
    bleManager.stopDeviceScan();
    if (scanSubscription) {
      scanSubscription = null;
    }
    console.log('BLE scan stopped');
  } catch (error) {
    console.error('Error stopping scan:', error);
  }
};

const connectToDevice = async (deviceId) => {
  try {
    console.log('Attempting to connect to device:', deviceId);
    
    // First check if device is already connected
    const connectedDevices = await bleManager.connectedDevices([NUS_SERVICE_UUID]);
    const alreadyConnected = connectedDevices.find(d => d.id === deviceId);
    
    if (alreadyConnected) {
      console.log('Device already connected:', deviceId);
      return alreadyConnected;
    }

    // Connect with timeout
    const device = await bleManager.connectToDevice(deviceId, {
      requestMTU: 512,
      timeout: 10000, // 10 second timeout
    });
    
    console.log('Connected to device:', device.id);
    
    // Discover services and characteristics
    const deviceWithServices = await device.discoverAllServicesAndCharacteristics();
    console.log('Services discovered for device:', deviceId);
    
    return deviceWithServices;
    
  } catch (error) {
    console.error('Connection failed for device:', deviceId, error.message);
    throw new Error(`Failed to connect: ${error.message}`);
  }
};

const disconnectDevice = async (deviceId) => {
  try {
    await bleManager.cancelDeviceConnection(deviceId);
    console.log('Disconnected from device:', deviceId);
  } catch (error) {
    console.error('Disconnect error:', error.message);
    throw error;
  }
};

const getDeviceServices = async (device) => {
  try {
    const services = await device.services();
    console.log('Services found:', services.length);
    return services;
  } catch (error) {
    console.error('Failed to get services:', error.message);
    throw error;
  }
};

const readCharacteristic = async (device, serviceUUID, characteristicUUID) => {
  try {
    console.log('Reading characteristic:', characteristicUUID);
    const characteristic = await device.readCharacteristicForService(
      serviceUUID,
      characteristicUUID
    );
    
    if (characteristic && characteristic.value) {
      const data = atob(characteristic.value);
      console.log('Read data:', data);
      return data;
    }
    
    return null;
  } catch (error) {
    console.error('Read characteristic failed:', error.message);
    throw new Error(`Read failed: ${error.message}`);
  }
};

const writeCharacteristic = async (device, serviceUUID, characteristicUUID, data) => {
  try {
    if (!device || !serviceUUID || !characteristicUUID || !data) {
      throw new Error('Invalid parameters for write operation');
    }
    
    await device.writeCharacteristicWithResponseForService(
      serviceUUID,
      characteristicUUID,
      data
    );
  } catch (error) {
    console.error('Write characteristic failed:', error.message);
    throw new Error(`Write failed: ${error.message}`);
  }
};

const monitorCharacteristic = (device, serviceUUID, characteristicUUID, callback) => {
  try {
    console.log('Setting up monitoring for characteristic:', characteristicUUID);
    
    const subscription = device.monitorCharacteristicForService(
      serviceUUID,
      characteristicUUID,
      (error, characteristic) => {
        if (error) {
          console.error('Monitor error:', error.message);
          callback(error, null);
          return;
        }
        
        if (characteristic && characteristic.value) {
          try {
            const data = atob(characteristic.value);
            console.log('Received data:', data);
            callback(null, data);
          } catch (decodeError) {
            console.error('Failed to decode received data:', decodeError);
            callback(decodeError, null);
          }
        }
      }
    );
    
    console.log('Monitoring setup complete');
    return subscription;
    
  } catch (error) {
    console.error('Failed to setup monitoring:', error.message);
    throw error;
  }
};

const getConnectedDevices = async () => {
  try {
    const connected = await bleManager.connectedDevices([NUS_SERVICE_UUID]);
    console.log('Connected devices:', connected.length);
    return connected;
  } catch (error) {
    console.error('Failed to get connected devices:', error);
    return [];
  }
};

const getDevices = () => Array.from(devices.values());

// Cleanup function
const cleanup = async () => {
  try {
    stopScan();
    const connectedDevices = await getConnectedDevices();
    
    for (const device of connectedDevices) {
      await disconnectDevice(device.id);
    }
    
    devices.clear();
    isInitialized = false;
    console.log('BLE cleanup completed');
  } catch (error) {
    console.error('Cleanup error:', error);
  }
};

export default {
  bleManager,
  initBle,
  startScan,
  stopScan,
  connectToDevice,
  disconnectDevice,
  getDeviceServices,
  readCharacteristic,
  writeCharacteristic,
  monitorCharacteristic,
  getConnectedDevices,
  getDevices,
  cleanup,
  // Export UUIDs
  NUS_SERVICE_UUID,
  NUS_RX_CHARACTERISTIC_UUID,
  NUS_TX_CHARACTERISTIC_UUID,
};
