import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
} from 'react-native';
import BleService from '../services/BleService';

const ConnectionScreen = ({ route, navigation }) => {
  const { device } = route.params;
  const [logs, setLogs] = useState([]);
  const [inputText, setInputText] = useState('');
  const [quickButtons, setQuickButtons] = useState(['Hi', 'Hello', 'AT']);
  const [isConnected, setIsConnected] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [isError, setIsError] = useState(false);
  const [connectedDevice, setConnectedDevice] = useState(null);

  useEffect(() => {
    const setupConnection = async () => {
      try {
        // Use the device passed from the previous screen (already connected)
        setConnectedDevice(device);
        setIsConnected(true);
        setLogs(prevLogs => [...prevLogs, { 
          type: 'info', 
          text: `Connected to ${device.name || 'Unknown Device'}` 
        }]);

        // Discover services and characteristics
        console.log('Discovering services for device:', device.id);
        await device.discoverAllServicesAndCharacteristics();
        
        setLogs(prevLogs => [...prevLogs, { 
          type: 'info', 
          text: 'Services discovered' 
        }]);

        // Setup notification on TX characteristic
        const sub = device.monitorCharacteristicForService(
          BleService.NUS_SERVICE_UUID,
          BleService.NUS_TX_CHARACTERISTIC_UUID,
          (error, characteristic) => {
            if (error) {
              console.error('Notification error:', error);
              setLogs(prevLogs => [...prevLogs, { 
                type: 'error', 
                text: `Notification error: ${error.message || 'Unknown error'}` 
              }]);
              return;
            }
            
            if (characteristic?.value) {
              try {
                const receivedData = atob(characteristic.value);
                console.log('Received data:', receivedData);
                setLogs(prevLogs => [...prevLogs, { 
                  type: 'received', 
                  text: receivedData.trim() 
                }]);
              } catch (decodeError) {
                console.error('Base64 decode error:', decodeError);
                setLogs(prevLogs => [...prevLogs, { 
                  type: 'error', 
                  text: 'Failed to decode received data' 
                }]);
              }
            } else {
              console.warn('Characteristic value is null');
            }
          }
        );
        
        setSubscription(sub);
        setLogs(prevLogs => [...prevLogs, { 
          type: 'info', 
          text: 'Notifications enabled' 
        }]);

      } catch (error) {
        console.error('Connection setup error:', error);
        setLogs(prevLogs => [...prevLogs, { 
          type: 'error', 
          text: `Setup failed: ${error.message || 'Unknown error'}` 
        }]);
        setIsError(true);
        
        // Don't navigate back immediately, let user see the error
        setTimeout(() => {
          Alert.alert('Connection Error', 
            `Failed to setup connection: ${error.message}`, 
            [{ text: 'OK', onPress: () => navigation.goBack() }]
          );
        }, 1000);
      }
    };

    setupConnection();

    return () => {
      cleanup();
    };
  }, [device.id, navigation]);

  const cleanup = async () => {
    try {
      if (subscription) {
        subscription.remove();
        setSubscription(null);
      }
      
      if (connectedDevice && isConnected) {
        console.log('Disconnecting from device...');
        await BleService.bleManager.cancelDeviceConnection(device.id);
        console.log('Device disconnected');
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  };

  const sendCommand = async (command) => {
    if (!isConnected || !connectedDevice) {
      Alert.alert('Error', 'Device is not connected');
      return;
    }

    if (!command || command.trim() === '') {
      Alert.alert('Error', 'Please enter a command');
      return;
    }

    try {
      const commandToSend = command.trim();
      const base64Data = btoa(commandToSend);
      
      console.log('Sending command:', commandToSend);
      
      await BleService.writeCharacteristic(
        connectedDevice,
        BleService.NUS_SERVICE_UUID,
        BleService.NUS_RX_CHARACTERISTIC_UUID,
        base64Data
      );
      
      setLogs(prevLogs => [...prevLogs, { 
        type: 'sent', 
        text: commandToSend 
      }]);
      setInputText('');
      
    } catch (error) {
      console.error('Send error:', error);
      setLogs(prevLogs => [...prevLogs, { 
        type: 'error', 
        text: `Send failed: ${error.message || 'Unknown error'}` 
      }]);
      Alert.alert('Send Error', error.message || 'Failed to send command');
    }
  };

const disconnect = () => {
  Alert.alert('Disconnect', 'Are you sure you want to disconnect?', [
    { text: 'Cancel' },
    { 
      text: 'Yes', 
      onPress: async () => {
        try {
          await cleanup(); // Perform cleanup
          setIsConnected(false); // Update connection state
          setLogs(prevLogs => [...prevLogs, { type: 'info', text: 'Disconnected' }]);
          navigation.replace('Scanning'); // Navigate to Scanning screen
        } catch (error) {
          console.error('Disconnect error:', error);
          setLogs(prevLogs => [...prevLogs, { type: 'error', text: `Disconnect failed: ${error.message}` }]);
          Alert.alert('Disconnect Error', 'Failed to disconnect properly.');
        }
      }
    },
  ]);
};

  const clearLogs = () => {
    setLogs([]);
  };

  const renderLog = ({ item, index }) => (
    <View key={index} style={styles.logItem}>
      <Text style={[styles.logText, 
        item.type === 'sent' ? styles.sentText : 
        item.type === 'received' ? styles.receivedText : 
        item.type === 'error' ? styles.errorText : 
        item.type === 'info' ? styles.infoText : styles.warningText
      ]}>
        [{new Date().toLocaleTimeString()}] {item.text}
      </Text>
    </View>
  );

  if (isError) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Connection Failed</Text>
          <Text style={styles.errorMessage}>
            Unable to establish proper connection with the device.
          </Text>
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            style={styles.backButton}
          >
            <Text style={styles.buttonText}>Back to Scanning</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.appBar}>
        <Text style={styles.deviceName}>
          {device.name || 'Connected Device'}
        </Text>
        <View style={styles.appBarButtons}>
          <TouchableOpacity onPress={clearLogs} style={styles.button}>
            <Text style={styles.buttonText}>Clear</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={disconnect} style={styles.button}>
            <Text style={styles.buttonText}>Disconnect</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.statusBar}>
        <Text style={[styles.statusText, isConnected ? styles.connectedStatus : styles.disconnectedStatus]}>
          {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
        </Text>
      </View>

      <FlatList
        data={[...logs].reverse()}
        renderItem={renderLog}
        keyExtractor={(item, index) => `log-${index}`}
        style={styles.logsContainer}
        contentContainerStyle={styles.logsContent}
        showsVerticalScrollIndicator={false}
      />

      <View style={styles.quickButtons}>
        {quickButtons.map((btn, index) => (
          <TouchableOpacity
            key={index}
            style={styles.quickButton}
            onPress={() => sendCommand(btn)}
            disabled={!isConnected}
          >
            <Text style={styles.quickButtonText}>{btn}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Enter command..."
          placeholderTextColor="#888"
          editable={isConnected && !isError}
          returnKeyType="send"
          onSubmitEditing={() => sendCommand(inputText)}
        />
        <TouchableOpacity 
          onPress={() => sendCommand(inputText)} 
          style={[styles.sendButton, (!isConnected || isError) && styles.disabledButton]}
          disabled={!isConnected || isError}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#1C1C1C',
    justifyContent: 'space-between',
    paddingTop: 50,
  },
  deviceName: { 
    color: 'white', 
    fontSize: 18, 
    fontWeight: 'bold',
    flex: 1
  },
  appBarButtons: {
    flexDirection: 'row',
  },
  button: { 
    padding: 8,
    marginLeft: 10,
    backgroundColor: '#333',
    borderRadius: 5,
  },
  buttonText: { color: 'white', fontSize: 12 },
  statusBar: {
    backgroundColor: '#2C2C2C',
    paddingVertical: 8,
    paddingHorizontal: 15,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  connectedStatus: { color: '#4CAF50' },
  disconnectedStatus: { color: '#F44336' },
  logsContainer: { 
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  logsContent: {
    padding: 10,
  },
  logItem: {
    marginBottom: 2,
  },
  logText: { 
    fontSize: 12,
    fontFamily: 'monospace',
  },
  sentText: { color: '#4CAF50' },
  receivedText: { color: '#2196F3' },
  errorText: { color: '#F44336' },
  infoText: { color: '#FFC107' },
  warningText: { color: '#FF9800' },
  quickButtons: { 
    flexDirection: 'row', 
    justifyContent: 'space-around', 
    padding: 10,
    backgroundColor: '#1C1C1C',
  },
  quickButton: { 
    backgroundColor: '#333', 
    padding: 12, 
    borderRadius: 5,
    minWidth: 60,
    alignItems: 'center',
  },
  quickButtonText: { color: 'white', fontSize: 14 },
  inputContainer: { 
    flexDirection: 'row', 
    padding: 10, 
    backgroundColor: '#1C1C1C' 
  },
  input: { 
    flex: 1, 
    backgroundColor: '#333', 
    color: 'white', 
    padding: 12, 
    borderRadius: 5,
    fontSize: 16,
  },
  sendButton: { 
    backgroundColor: '#007AFF', 
    padding: 12, 
    marginLeft: 10, 
    borderRadius: 5,
    minWidth: 60,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#555',
  },
  sendButtonText: { color: 'white', fontWeight: '600' },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    color: '#F44336',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  errorMessage: {
    color: '#CCC',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
  },
  backButton: { 
    backgroundColor: '#007AFF', 
    padding: 15, 
    borderRadius: 5,
    minWidth: 150,
    alignItems: 'center',
  },
});

export default ConnectionScreen;