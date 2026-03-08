# Permissions and Features Update

## New Features Added

### 1. Permissions Screen
- **Location**: New screen that checks Bluetooth and Location permissions on app boot
- **Flow**: Splash → Permissions → Scanning
- **Features**:
  - Shows tick (✓) or cross (✗) for each permission status
  - "Grant Permissions" button to request permissions
  - "Proceed" button appears when all permissions are granted
  - "Refresh Status" button to recheck permissions

### 2. Navigation Changes

#### Scanning Screen
- Back button now navigates to Permissions screen instead of exiting app
- Shows confirmation dialog: "Do you really want to exit?"

#### Connection Screen (Logs Page)
- **Exit Button**: Red button on top-left to exit to Permissions screen
  - Shows warning dialog before disconnecting
  - Properly cleans up connection before navigation
  
- **Save Logs Button**: Disk icon (💾) in app bar
  - Saves logs to Downloads folder
  - File format: `BLE_Logs_YYYY-MM-DD-HH-MM-SS.txt`
  - Includes timestamp and log type for each entry
  
- **Back Button Behavior**: Shows warning instead of disconnecting
  - Message: "You are currently connected to a device. Please use the Exit button or Disconnect button."
  - Prevents accidental disconnection

### 3. Permissions Added
- `ACCESS_FINE_LOCATION` (no maxSdkVersion limit)
- `ACCESS_COARSE_LOCATION` (no maxSdkVersion limit)
- `WRITE_EXTERNAL_STORAGE` (for saving logs)
- `READ_EXTERNAL_STORAGE` (for file operations)
- `BLUETOOTH_SCAN`
- `BLUETOOTH_CONNECT`

### 4. New Dependencies
- `react-native-fs`: For file system operations (saving logs)

## File Changes

### New Files
- `src/screens/PermissionsScreen.jsx`: Permission check and request screen

### Modified Files
- `src/navigation/AppNavigator.jsx`: Added Permissions screen to navigation
- `src/screens/SplashScreen.jsx`: Navigate to Permissions instead of Scanning
- `src/screens/ScanningScreen.jsx`: Back button navigates to Permissions
- `src/screens/ConnectionScreen.jsx`: 
  - Added Exit button
  - Added Save logs functionality
  - Updated back button behavior
- `android/app/src/main/AndroidManifest.xml`: Added storage and location permissions
- `package.json`: Added react-native-fs dependency

## Usage

### First Launch
1. App shows splash screen (3 seconds)
2. Navigates to Permissions screen
3. User grants Bluetooth and Location permissions
4. User clicks "Proceed" to go to Scanning screen

### From Scanning Screen
- Press back button → Shows exit dialog → Goes to Permissions screen

### From Connection Screen
- Press back button → Shows warning (no action)
- Press "Exit" button → Shows confirmation → Disconnects → Goes to Permissions screen
- Press "Disconnect" button → Shows confirmation → Disconnects → Goes back to Scanning
- Press save icon (💾) → Saves logs to Downloads folder

## Build Instructions

After pulling these changes:

```bash
# Install new dependencies
npm install

# For Android
cd android
./gradlew clean
cd ..
npm run android
```

## Notes
- Permissions are checked on every app launch
- Logs are saved in plain text format with timestamps
- Exit button has red background for visibility
- All navigation properly cleans up BLE connections
