import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  BackHandler,
  StyleSheet,
  Alert,
  Modal,
} from 'react-native';
import  BleService from '../services/BleService';
import  bleManager from '../services/BleService';



const ConnectionScreen = ({ route, navigation }) => {
  const { device } = route.params;
  const [logs, setLogs] = useState([]);
  const [inputText, setInputText] = useState('');
  const [quickButtons, setQuickButtons] = useState(['CMD-1', 'CMD-2', 'CMD-3']);
  const [isConnected, setIsConnected] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [isError, setIsError] = useState(false);
  const [connectedDevice, setConnectedDevice] = useState(null);
  const scrollViewRef = React.useRef(null);
  const lastReceivedRef = React.useRef({ data: '', timestamp: 0 });
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editIndex, setEditIndex] = useState(0);
  const [editText, setEditText] = useState('');

  const handleLongPress = (index) => {
    setEditIndex(index);
    setEditText(quickButtons[index]);
    setEditModalVisible(true);
  };

  const saveEdit = () => {
    if (editText && editText.trim()) {
      const newButtons = [...quickButtons];
      newButtons[editIndex] = editText.trim();
      setQuickButtons(newButtons);
    }
    setEditModalVisible(false);
  };

  useEffect(() => {
    const setupConnection = async () => {
      try {
        setConnectedDevice(device);
        setIsConnected(true);
        setLogs([{ 
          type: 'info', 
          text: `Connected to ${device.name || 'Unknown Device'}`,
          timestamp: new Date().toLocaleTimeString()
        }]);

        console.log('Discovering services for device:', device.id);
        await device.discoverAllServicesAndCharacteristics();
        
        setLogs(prev => [...prev, { 
          type: 'info', 
          text: 'Services discovered',
          timestamp: new Date().toLocaleTimeString()
        }]);

        const sub = device.monitorCharacteristicForService(
          BleService.NUS_SERVICE_UUID,
          BleService.NUS_TX_CHARACTERISTIC_UUID,
          (error, characteristic) => {
            if (error) {
              console.error('Notification error:', error);
              return;
            }
            
            if (characteristic?.value) {
              try {
                const receivedData = atob(characteristic.value);
                const now = Date.now();
                
                // Skip if same data received within 100ms
                if (lastReceivedRef.current.data === receivedData && 
                    now - lastReceivedRef.current.timestamp < 100) {
                  return;
                }
                
                lastReceivedRef.current = { data: receivedData, timestamp: now };
                console.log('Received data:', receivedData);
                setLogs(prev => {
                  const newLogs = [...prev, { 
                    type: 'received', 
                    text: receivedData.trim(),
                    timestamp: new Date().toLocaleTimeString()
                  }];
                  setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
                  return newLogs;
                });
              } catch (decodeError) {
                console.error('Base64 decode error:', decodeError);
              }
            }
          }
        );
        
        setSubscription(sub);
        setLogs(prev => [...prev, { 
          type: 'info', 
          text: 'Notifications enabled',
          timestamp: new Date().toLocaleTimeString()
        }]);

      } catch (error) {
        console.error('Connection setup error:', error);
        setLogs(prev => [...prev, { 
          type: 'error', 
          text: `Setup failed: ${error.message || 'Unknown error'}`,
          timestamp: new Date().toLocaleTimeString()
        }]);
        setIsError(true);
        
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
      if (subscription) {
        subscription.remove();
      }
    };
  }, []);

  
  const cleanup = async () => {
    try {
      if (subscription) {
        subscription.remove();
        setSubscription(null);
      }
      if (device?.id) {
        await BleService.disconnectDevice(device.id);
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
      
      setLogs(prevLogs => {
        const newLogs = [...prevLogs, { 
          type: 'sent', 
          text: commandToSend,
          timestamp: new Date().toLocaleTimeString()
        }];
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
        return newLogs;
      });
      
      const base64Data = btoa(commandToSend);
      await BleService.writeCharacteristic(
        connectedDevice,
        BleService.NUS_SERVICE_UUID,
        BleService.NUS_RX_CHARACTERISTIC_UUID,
        base64Data
      );
      
    } catch (error) {
      console.error('Send error:', error);
      setLogs(prevLogs => [...prevLogs, { 
        type: 'error', 
        text: `Send failed: ${error.message || 'Unknown error'}`,
        timestamp: new Date().toLocaleTimeString()
      }]);
      Alert.alert('Send Error', error.message || 'Failed to send command');
    }
  };


  useEffect(() => {
    const backAction = () => {
      Alert.alert(
        "Disconnect",
        "Are you sure you want to disconnect and go back?",
        [
          {
            text: "Cancel",
            onPress: () => null,
            style: "cancel"
          },
          {
            text: "YES",
            onPress: async () => {
              await cleanup();
              navigation.goBack();
            }
          }
        ]
      );
      return true;
    };

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      backAction
    );

    return () => backHandler.remove();
  }, []);

 


const disconnect = () => {
  Alert.alert('Disconnect', 'Are you sure you want to disconnect?', [
    { text: 'Cancel' },
    { 
      text: 'Yes', 
      onPress: async () => {
        await cleanup();
        navigation.goBack();
      }
    },
  ]);
};

  const clearLogs = () => {
    setLogs([]);
  };

  const renderLog = ({ item, index }) => (
    <View style={styles.logItem}>
      <Text style={[styles.logText, 
        item.type === 'sent' ? styles.sentText : 
        item.type === 'received' ? styles.receivedText : 
        item.type === 'error' ? styles.errorText : 
        item.type === 'info' ? styles.infoText : styles.warningText
      ]}>
        [{item.timestamp}] {item.text}
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
      <Modal
        visible={editModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit CMD-{editIndex + 1}</Text>
            <TextInput
              style={styles.modalInput}
              value={editText}
              onChangeText={setEditText}
              placeholder="Enter command"
              placeholderTextColor="#888"
              autoFocus={true}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={saveEdit}
              >
                <Text style={styles.modalButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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

      <ScrollView
        ref={scrollViewRef}
        style={styles.logsContainer}
        contentContainerStyle={styles.logsContent}
        showsVerticalScrollIndicator={false}
      >
        <Text selectable={true}>
          {logs.map((item, index) => (
            <Text key={index} style={[
              styles.logText,
              item.type === 'sent' ? styles.sentText : 
              item.type === 'received' ? styles.receivedText : 
              item.type === 'error' ? styles.errorText : 
              item.type === 'info' ? styles.infoText : styles.warningText
            ]}>
              [{item.timestamp}] {item.text}{"\n"}
            </Text>
          ))}
        </Text>
      </ScrollView>

      <View style={styles.quickButtonsContainer}>
        <Text style={styles.quickButtonsHint}>Long press to edit</Text>
        <View style={styles.quickButtons}>
          {quickButtons.map((btn, index) => (
            <TouchableOpacity
              key={index}
              style={styles.quickButton}
              onPress={() => sendCommand(btn)}
              onLongPress={() => handleLongPress(index)}
              disabled={!isConnected}
            >
              <Text style={styles.quickButtonText}>CMD-{index + 1}</Text>
            </TouchableOpacity>
          ))}
        </View>
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
    paddingBottom: 20,
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
  quickButtonsContainer: {
    backgroundColor: '#1C1C1C',
    paddingTop: 5,
  },
  quickButtonsHint: {
    color: '#888',
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 5,
  },
  quickButtons: { 
    flexDirection: 'row', 
    justifyContent: 'space-around', 
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  quickButton: { 
    backgroundColor: '#333', 
    padding: 12, 
    borderRadius: 5,
    minWidth: 80,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1C1C1C',
    borderRadius: 10,
    padding: 20,
    width: '80%',
  },
  modalTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  modalInput: {
    backgroundColor: '#333',
    color: 'white',
    padding: 12,
    borderRadius: 5,
    fontSize: 16,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 5,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#555',
  },
  saveButton: {
    backgroundColor: '#007AFF',
  },
  modalButtonText: {
    color: 'white',
    fontWeight: '600',
  },
});

export default ConnectionScreen;
