$filePath = "node_modules\react-native-ble-plx\android\src\main\java\com\bleplx\BlePlxModule.java"
$content = Get-Content $filePath -Raw
$content = $content -replace 'safePromise\.reject\(null, errorConverter\.toJs\(error\)\);', 'safePromise.reject(error.errorCode.name(), errorConverter.toJs(error));'
$content = $content -replace 'promise\.reject\(null, errorConverter\.toJs\(error\)\);', 'promise.reject(error.errorCode.name(), errorConverter.toJs(error));'
$content = $content -replace 'promise\.reject\(null, errorConverter\.toJs\(bleError\)\);', 'promise.reject(bleError.errorCode.name(), errorConverter.toJs(bleError));'
Set-Content $filePath $content -NoNewline
Write-Host "BLE fix applied successfully!"
