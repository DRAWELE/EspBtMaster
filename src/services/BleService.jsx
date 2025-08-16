import BleManager from 'react-native-ble-plx';

const bleManager = new BleManager();
let isInitialized = false;

const initBle = async () => {
  if (!isInitialized) {
    try {
      await bleManager.state();
      isInitialized = true;
      console.log('BLE initialized');
    } catch (error) {
      console.error('BLE initialization failed:', error);
    }
  }
};

export default { bleManager, initBle };