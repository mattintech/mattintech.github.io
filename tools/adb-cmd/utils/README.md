# ADB Command Verification Tools

Tools for testing, verifying, and adding ADB commands to the command database.

## Tools Available

1. **manual_verify.py** - Test and verify existing commands
2. **add_command.py** - Add new commands with required verification

## Quick Start

### Prerequisites

1. **Install Android SDK tools**:
   ```bash
   # macOS
   brew install android-platform-tools

   # Verify installation
   adb version
   ```

2. **Create test AVDs** (one-time setup):
   ```bash
   # For API 36 (Android 16)
   sdkmanager "system-images;android-36;google_apis;arm64-v8a"
   avdmanager create avd -n test_android_36 -k "system-images;android-36;google_apis;arm64-v8a"

   # For API 35 (Android 15)
   sdkmanager "system-images;android-35;google_apis;arm64-v8a"
   avdmanager create avd -n test_android_35 -k "system-images;android-35;google_apis;arm64-v8a"

   # For API 34 (Android 14)
   sdkmanager "system-images;android-34;google_apis;arm64-v8a"
   avdmanager create avd -n test_android_34 -k "system-images;android-34;google_apis;arm64-v8a"

   # For API 33 (Android 13)
   sdkmanager "system-images;android-33;google_apis;arm64-v8a"
   avdmanager create avd -n test_android_33 -k "system-images;android-33;google_apis;arm64-v8a"

   # For API 31 (Android 12)
   sdkmanager "system-images;android-31;google_apis;arm64-v8a"
   avdmanager create avd -n test_android_31 -k "system-images;android-31;google_apis;arm64-v8a"
   ```

## Usage

### Basic Testing

Test all unverified commands on API 36:
```bash
python utils/manual_verify.py --api 36
```

### Test Specific Category

Test only connection-related commands:
```bash
python utils/manual_verify.py --api 36 --category connection
```

Categories available:
- `connection` - Device connection and wireless debugging
- `installation` - APK installation and package management
- `deviceinfo` - Device information and properties
- `troubleshooting` - Debugging and troubleshooting commands

### Test ALL Commands

Test all commands, even if already verified:
```bash
python utils/manual_verify.py --api 36 --all
```

### Resume Testing

If you stopped at command 15, resume from there:
```bash
python utils/manual_verify.py --api 36 --start-from 15
```

## Testing Workflow

1. **Script starts emulator** automatically
2. **Command executes** on the emulator
3. **You see the output** (stdout, stderr, return code)
4. **You verify** the result:
   - `[p]` Pass - Command worked as expected
   - `[f]` Fail - Command failed or unexpected output
   - `[s]` Skip - Skip this command
   - `[r]` Retry - Run command again
   - `[o]` Paste Output - Manually provide expected output
   - `[q]` Quit - Save and exit

5. **Progress is saved** after each command (with your permission)

## Features

### Automatic Backups
- Creates timestamped backups in `data/backups/` before modifications
- Disable with `--no-backup` flag

### Smart Testing
- By default, only tests unverified commands
- Re-tests previously failed commands
- Skips commands already passing for the API level

### Multi-Version Support
- Automatically selects correct command variant for Android version
- Tests appropriate syntax for each API level
- Updates verification per version

### Session Tracking
- Shows progress and statistics
- Allows saving after each command
- Resume capability for long sessions

## Output Structure

Verification results are saved in `commands.json`:

```json
{
  "id": 1,
  "title": "List Connected Devices",
  "verification": {
    "verified": true,
    "lastTested": "2025-11-10",
    "testedVersions": {
      "36": {
        "status": "pass",
        "date": "2025-11-10",
        "output": "List of devices attached\nemulator-5554\tdevice",
        "notes": null
      }
    }
  }
}
```

## Tips

1. **Start with latest Android** (API 36) - most commands will work there
2. **Test older versions** only for commands that might vary
3. **Use categories** to test related commands together
4. **Save frequently** - you can resume anytime
5. **Paste output** option is useful for commands with dynamic output

## Troubleshooting

### Emulator won't start
```bash
# Check if AVD exists
emulator -list-avds

# Start manually to see errors
emulator -avd test_android_36
```

### ADB not found
```bash
# Add to PATH
export PATH=$PATH:~/Android/sdk/platform-tools
```

### Permission errors
```bash
# Make script executable
chmod +x utils/manual_verify.py
```

## Adding New Commands

Use `add_command.py` to add new ADB commands with mandatory verification:

### Basic Usage

```bash
python utils/add_command.py
```

### Process

1. **Enter Command Details**
   - Title and description
   - Category (connection, installation, deviceinfo, troubleshooting)
   - Command syntax for Mac/Linux and Windows
   - Android version compatibility

2. **Multi-Version Support**
   - Script asks if command varies by Android version
   - Add different syntax for different Android ranges
   - Each version can be tested separately

3. **Mandatory Testing**
   - Connect a device or start an emulator
   - Script automatically tests the command
   - You verify if output is correct
   - Command is only added if test passes

4. **Automatic Updates**
   - commands.json is backed up
   - New command added with verification status
   - Ready for web display with verification badge

### Example Session

```bash
$ python utils/add_command.py

=== Basic Command Information ===
Command title: Get Build Fingerprint
Description: Shows the unique build identifier
Category: deviceinfo

=== Command Syntax ===
Mac/Linux command: adb shell getprop ro.build.fingerprint
Is the Windows command different? [Y/n]: n

=== Command Testing ===
Testing command: adb shell getprop ro.build.fingerprint
STDOUT: google/sdk_gphone64_arm64/emu64a:14/UE1A.230829.030/...

Did the command work as expected? y
✓ Command tested successfully!
✓ Command added to commands.json
```

## API Level Reference

| API Level | Android Version | Year |
|-----------|----------------|------|
| 36        | Android 16     | 2025 |
| 35        | Android 15     | 2024 |
| 34        | Android 14     | 2023 |
| 33        | Android 13     | 2022 |
| 31        | Android 12     | 2021 |