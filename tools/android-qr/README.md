# Android Enterprise QR Code Generator

A web-based tool for generating QR codes to simplify Android Enterprise device provisioning.

## Overview

This tool lets you create QR codes for Android Enterprise device enrollment, supporting various Enterprise Mobility Management (EMM) systems. It simplifies the process of configuring devices for corporate use by generating standardized QR codes that can be scanned during device setup.

## Features

- **Pre-configured EMM Templates**: Select from a list of popular EMM providers with pre-filled configurations
- **Custom Configuration**: Easily modify any field to match your organization's requirements
- **Wi-Fi Setup Support**: Include Wi-Fi credentials directly in the provisioning QR code
- **JSON Export**: View and copy the raw JSON configuration data
- **Multiple Download Formats**: Save QR codes as SVG or PNG
- **No Server Dependency**: Runs entirely in the browser with no data sent to any server

## How It Works

1. Select your EMM provider from the dropdown menu
2. Customize the configuration fields as needed
3. Click "Generate QR" to create your QR code
4. Download the QR code or copy the JSON configuration

The QR code can be scanned during the Android setup process to automatically configure the device with your EMM solution.

## Technical Details

The tool uses:
- The standard Android Enterprise enrollment schema
- Cryptographic checksum for QR code validation
- Modern JavaScript with no external dependencies except for the QR code generator

## Data Structure

### EMM Configuration Format

The EMM configurations are stored in `data/emms.json` with the following structure:

```json
{
  "EMM_NAME": {
    "defaults": {
      "android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME": "com.example.admin/com.example.admin.DeviceAdminReceiver",
      "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION": "https://example.com/download/admin-app.apk",
      "android.app.extra.PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM": "a1b2c3d4e5f6..."
    }
  }
}
```

### Wi-Fi Security Types

Wi-Fi security types are defined in `data/wifi_security_types.json`:

```json
[
    { "label": "NONE", "value": "NONE" },
    { "label": "WEP", "value": "WEP" },
    { "label": "WPA/WPA2/WPA3", "value": "WPA" }
]
  
```

## License

This project is open source and available under the MIT License.

## Contributing

Contributions are welcome! Feel free to submit a pull request or open an issue if you have suggestions for improvements.