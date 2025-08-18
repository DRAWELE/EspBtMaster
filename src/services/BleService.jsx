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
      if (state === 'PoweredOn') {
        isInitialized = true;
        console.log('BLE initialized');
      } else {
        console.error('BLE not powered on:', state);
        throw new Error('Bluetooth is not enabled');
      }
    } catch (error) {
      console.error('BLE initialization failed:', error.message);
      throw error;
    }
  }
};

const startScan = (onDeviceFound) => {
  stopScan(); 
  devices.clear();

  scanSubscription = bleManager.startDeviceScan(
    [NUS_SERVICE_UUID], // Keep the Nordic service filter
    { allowDuplicates: false },
    (error, device) => {
      if (error) {
        console.error('Scan error:', error.message);
        return;
      }
      if (device) {
        console.log('Found Nordic device:', device.name || 'Unknown', device.id);
      
        if (!devices.has(device.id)) {
          devices.set(device.id, device);
          onDeviceFound(Array.from(devices.values()));
        }
      }
    }
  );
};

const stopScan = () => {
  bleManager.stopDeviceScan();
  scanSubscription = null;
  console.log('Scan stopped');
};

const connectToDevice = async (deviceId) => {
  try {
    const device = await bleManager.connectToDevice(deviceId);
    await device.discoverAllServicesAndCharacteristics();
    return device;
  } catch (error) {
    console.error('Connection failed:', error.message);
    throw error;
  }
};

const getDeviceServices = async (device) => {
  try {
    const services = await device.services();
    return services;
  } catch (error) {
    console.error('Failed to get services:', error.message);
    throw error;
  }
};

const readCharacteristic = async (device, serviceUUID, characteristicUUID) => {
  try {
    const characteristic = await device.readCharacteristicForService(
      serviceUUID,
      characteristicUUID
    );
    return characteristic.value;
  } catch (error) {
    console.error('Read characteristic failed:', error.message);
    throw error;
  }
};

const writeCharacteristic = async (device, serviceUUID, characteristicUUID, data) => {
  try {
    await device.writeCharacteristicWithResponseForService(
      serviceUUID,
      characteristicUUID,
      data
    );
  } catch (error) {
    console.error('Write characteristic failed:', error.message);
    throw error;
  }
};

const getDevices = () => Array.from(devices.values());

export default {
  bleManager,
  initBle,
  startScan,
  stopScan,
  connectToDevice,
  getDeviceServices,
  readCharacteristic,
  writeCharacteristic,
  getDevices,
  NUS_SERVICE_UUID,
  NUS_RX_CHARACTERISTIC_UUID,
  NUS_TX_CHARACTERISTIC_UUID,
};