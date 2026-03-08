import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  BackHandler,
  StyleSheet,
  Modal,
  PermissionsAndroid,
  Platform,
  Image,
  Animated,
} from 'react-native';
import  BleService from '../services/BleService';
import  bleManager from '../services/BleService';
import RNFS from 'react-native-fs';



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
  const [disconnectModalVisible, setDisconnectModalVisible] = useState(false);
  const [exitModalVisible, setExitModalVisible] = useState(false);
  const [clearModalVisible, setClearModalVisible] = useState(false);
  const [backWarningVisible, setBackWarningVisible] = useState(false);
  const blinkAnim = React.useRef(new Animated.Value(1)).current;

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
    if (isConnected) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(blinkAnim, {
            toValue: 0.3,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(blinkAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      blinkAnim.setValue(1);
    }
  }, [isConnected]);

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
              // Ignore "Operation was cancelled" errors (happens during disconnect)
              if (error.message && error.message.includes('cancelled')) {
                return;
              }
              console.error('Notification error:', error);
              if (error.message && error.message.includes('disconnected')) {
                setIsConnected(false);
              }
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
          navigation.goBack();
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
        // Wait a bit for subscription to clean up
        await new Promise(resolve => setTimeout(resolve, 100));
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
      return;
    }

    if (!command || command.trim() === '') {
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
    }
  };


  useEffect(() => {
    const backAction = () => {
      setDisconnectModalVisible(true);
      return true;
    };

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      backAction
    );

    return () => backHandler.remove();
  }, []);

const disconnect = () => {
  setDisconnectModalVisible(true);
};

  const clearLogs = () => {
    setClearModalVisible(true);
  };

  const saveLogs = async () => {
    if (logs.length === 0) {
      return;
    }

    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          return;
        }
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `BLE_Logs_${timestamp}.txt`;
      const path = `${RNFS.DownloadDirectoryPath}/${fileName}`;
      
      const logContent = logs.map(log => `[${log.timestamp}] [${log.type.toUpperCase()}] ${log.text}`).join('\n');
      
      await RNFS.writeFile(path, logContent, 'utf8');
      
      setLogs(prev => [...prev, { 
        type: 'info', 
        text: `Logs saved to Downloads/${fileName}`,
        timestamp: new Date().toLocaleTimeString()
      }]);
    } catch (error) {
      console.error('Save logs error:', error);
      setLogs(prev => [...prev, { 
        type: 'error', 
        text: `Save failed: ${error.message}`,
        timestamp: new Date().toLocaleTimeString()
      }]);
    }
  };

  const exitToPermissions = () => {
    setExitModalVisible(true);
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

  return (
    <View style={styles.container}>
      {/* Disconnect Modal */}
      <Modal visible={disconnectModalVisible} transparent animationType="fade" onRequestClose={() => setDisconnectModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setDisconnectModalVisible(false)}>
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <View style={styles.dialogBox}>
              <Text style={styles.dialogTitle}>Disconnect</Text>
              <Text style={styles.dialogMessage}>Are you sure you want to disconnect?</Text>
              <View style={styles.dialogButtons}>
                <TouchableOpacity style={styles.dialogButton} onPress={() => setDisconnectModalVisible(false)}>
                  <Text style={styles.dialogButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.dialogButton, styles.dialogButtonPrimary]} onPress={async () => {
                  setDisconnectModalVisible(false);
                  await cleanup();
                  navigation.goBack();
                }}>
                  <Text style={styles.dialogButtonText}>Yes</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Exit Modal */}
      <Modal visible={exitModalVisible} transparent animationType="fade" onRequestClose={() => setExitModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setExitModalVisible(false)}>
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <View style={styles.dialogBox}>
              <Text style={styles.dialogTitle}>Exit App</Text>
              <Text style={styles.dialogMessage}>Are you sure you want to disconnect and exit?</Text>
              <View style={styles.dialogButtons}>
                <TouchableOpacity style={styles.dialogButton} onPress={() => setExitModalVisible(false)}>
                  <Text style={styles.dialogButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.dialogButton, styles.dialogButtonDanger]} onPress={async () => {
                  setExitModalVisible(false);
                  await cleanup();
                  BackHandler.exitApp();
                }}>
                  <Text style={styles.dialogButtonText}>Exit</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Clear Logs Modal */}
      <Modal visible={clearModalVisible} transparent animationType="fade" onRequestClose={() => setClearModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setClearModalVisible(false)}>
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <View style={styles.dialogBox}>
              <Text style={styles.dialogTitle}>Clear Logs</Text>
              <Text style={styles.dialogMessage}>Are you sure you want to clear all logs?</Text>
              <View style={styles.dialogButtons}>
                <TouchableOpacity style={styles.dialogButton} onPress={() => setClearModalVisible(false)}>
                  <Text style={styles.dialogButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.dialogButton, styles.dialogButtonPrimary]} onPress={() => {
                  setClearModalVisible(false);
                  setLogs([]);
                }}>
                  <Text style={styles.dialogButtonText}>Clear</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Edit CMD Modal */}
      <Modal
        visible={editModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setEditModalVisible(false)}>
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
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
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <View style={styles.appBar}>
        <View style={styles.deviceInfo}>
          <Text style={styles.deviceName}>
            {device.name || 'Connected Device'}
          </Text>
          <Text style={styles.deviceId}>{device.id}</Text>
        </View>
        <View style={styles.appBarButtons}>
          <TouchableOpacity onPress={saveLogs} style={styles.button}>
            <Image source={require('../assets/save.png')} style={styles.buttonIcon} />
          </TouchableOpacity>
          <TouchableOpacity onPress={clearLogs} style={styles.button}>
            <Image source={require('../assets/delete.png')} style={styles.buttonIcon} />
          </TouchableOpacity>
          <TouchableOpacity onPress={disconnect} style={styles.button}>
            <Image source={require('../assets/disconnect.png')} style={styles.buttonIcon} />
          </TouchableOpacity>
          <TouchableOpacity onPress={exitToPermissions} style={styles.exitButton}>
            <Image source={require('../assets/cross.png')} style={styles.exitButtonIcon} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.statusBar}>
        <View style={{flexDirection: 'row', alignItems: 'center'}}>
          <Animated.Text style={[styles.statusDot, isConnected ? styles.connectedDot : styles.disconnectedDot, { opacity: isConnected ? blinkAnim : 1 }]}>
            ●
          </Animated.Text>
          <Text style={[styles.statusText, isConnected ? styles.connectedStatus : styles.disconnectedStatus]}>
            {isConnected ? ' Connected' : ' Disconnected'}
          </Text>
        </View>
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
  exitButton: {
    backgroundColor: '#F44336',
    padding: 8,
    marginLeft: 15,
    borderRadius: 5,
    minWidth: 40,
    alignItems: 'center',
  },
  exitButtonIcon: {
    width: 20,
    height: 20,
    tintColor: 'white',
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: { 
    color: 'white', 
    fontSize: 18, 
    fontWeight: 'bold',
  },
  deviceId: {
    color: '#888',
    fontSize: 11,
    marginTop: 2,
  },
  appBarButtons: {
    flexDirection: 'row',
  },
  button: { 
    padding: 8,
    marginLeft: 10,
    backgroundColor: '#333',
    borderRadius: 5,
    minWidth: 40,
    alignItems: 'center',
  },
  buttonIcon: { 
    width: 20,
    height: 20,
    tintColor: 'white',
  },
  statusBar: {
    backgroundColor: '#2C2C2C',
    paddingVertical: 8,
    paddingHorizontal: 15,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  statusDot: {
    fontSize: 14,
    fontWeight: '500',
  },
  connectedStatus: { color: '#4CAF50' },
  disconnectedStatus: { color: '#F44336' },
  connectedDot: { color: '#4CAF50' },
  disconnectedDot: { color: '#F44336' },
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
  dialogBox: {
    backgroundColor: '#1C1C1C',
    borderRadius: 12,
    padding: 20,
    width: '80%',
    maxWidth: 400,
  },
  dialogTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  dialogMessage: {
    color: '#CCC',
    fontSize: 16,
    marginBottom: 20,
    lineHeight: 22,
  },
  dialogButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  dialogButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 6,
    backgroundColor: '#555',
  },
  dialogButtonPrimary: {
    backgroundColor: '#007AFF',
  },
  dialogButtonDanger: {
    backgroundColor: '#F44336',
  },
  dialogButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default ConnectionScreen;
