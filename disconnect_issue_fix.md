# BLE Disconnect Issue Fix

## Problem
React Native apps using `react-native-ble-plx` crash on Android when BLE devices disconnect. The app exits instead of returning to the scanning screen.

## Root Cause
The library has a bug where `Promise.reject(null)` is called in native Android code, which crashes React Native 0.81+.

## Solution

### Step 1: Install patch-package
```bash
npm install --save-dev patch-package
```

### Step 2: Add postinstall script
Add to `package.json`:
```json
{
  "scripts": {
    "postinstall": "patch-package"
  }
}
```

### Step 3: Apply the fix
Run this PowerShell script to fix the native code:

```powershell
$filePath = "node_modules\react-native-ble-plx\android\src\main\java\com\bleplx\BlePlxModule.java"
$content = Get-Content $filePath -Raw
$content = $content -replace 'safePromise\.reject\(null, errorConverter\.toJs\(error\)\);', 'safePromise.reject(error.errorCode.name(), errorConverter.toJs(error));'
$content = $content -replace 'promise\.reject\(null, errorConverter\.toJs\(error\)\);', 'promise.reject(error.errorCode.name(), errorConverter.toJs(error));'
$content = $content -replace 'promise\.reject\(null, errorConverter\.toJs\(bleError\)\);', 'promise.reject(bleError.errorCode.name(), errorConverter.toJs(bleError));'
Set-Content $filePath $content -NoNewline
Write-Host "BLE fix applied successfully!"
```

Save as `apply-ble-fix.ps1` and run:
```bash
powershell -ExecutionPolicy Bypass -File apply-ble-fix.ps1
```

### Step 4: Create patch file
```bash
# Remove build folder to avoid path length issues
rmdir /s /q node_modules\react-native-ble-plx\android\build

# Create the patch
npx patch-package react-native-ble-plx
```

### Step 5: Clean and rebuild
```bash
cd android
gradlew clean
cd ..
npx react-native run-android
```

## Fix Disconnect Function

Ensure your disconnect function properly calls the BLE disconnect:

```javascript
const cleanup = async () => {
  try {
    if (subscription) {
      subscription.remove();
    }
    if (device?.id) {
      await BleService.disconnectDevice(device.id);
    }
  } catch (error) {
    console.error('Cleanup error:', error);
  }
};

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
```

## Verification
- Connect to a BLE device
- Click disconnect button
- App should navigate back to scanning screen without crashing
- Device should be properly disconnected

## Compatibility
- ✅ React Native 0.81+
- ✅ react-native-ble-plx 3.5.0
- ✅ Android
- ✅ iOS (no changes needed)

## References
- GitHub Issue: https://github.com/dotintent/react-native-ble-plx/issues/1303
- GitHub PR: https://github.com/dotintent/react-native-ble-plx/pull/1304
