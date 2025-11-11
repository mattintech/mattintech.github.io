#!/usr/bin/env python3
"""Test if Android SDK tools can be found"""

import subprocess
import os
from pathlib import Path
import platform

# ANSI colors
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
RESET = '\033[0m'

def setup_android_sdk_path():
    """Setup Android SDK paths in environment"""
    is_mac = platform.system() == 'Darwin'

    # Common Android SDK locations
    sdk_paths = []

    # Check environment variables
    android_home = os.environ.get('ANDROID_HOME')
    android_sdk_root = os.environ.get('ANDROID_SDK_ROOT')

    if android_home:
        sdk_paths.append(Path(android_home))
    if android_sdk_root:
        sdk_paths.append(Path(android_sdk_root))

    # Check common locations
    home = Path.home()
    if is_mac:
        sdk_paths.extend([
            home / 'Library' / 'Android' / 'sdk',
            Path('/usr/local/share/android-sdk'),
            Path('/opt/android-sdk')
        ])
    else:
        sdk_paths.extend([
            home / 'Android' / 'Sdk',
            home / 'android-sdk',
            Path('/opt/android-sdk')
        ])

    # Find the first existing SDK path
    sdk_path = None
    for path in sdk_paths:
        if path.exists():
            sdk_path = path
            print(f"{GREEN}✓ Found Android SDK at: {sdk_path}{RESET}")
            break

    if not sdk_path:
        print(f"{RED}✗ Android SDK not found in common locations{RESET}")
        return False

    # Check for SDK subdirectories
    dirs_to_check = {
        'emulator': sdk_path / 'emulator',
        'platform-tools': sdk_path / 'platform-tools',
        'cmdline-tools': sdk_path / 'cmdline-tools' / 'latest' / 'bin',
        'tools': sdk_path / 'tools' / 'bin'
    }

    paths_to_add = []
    for name, path in dirs_to_check.items():
        if path.exists():
            print(f"  {GREEN}✓ Found {name} at: {path}{RESET}")
            paths_to_add.append(str(path))
        else:
            print(f"  {YELLOW}⚠ {name} not found at: {path}{RESET}")

    # Update PATH
    if paths_to_add:
        current_path = os.environ.get('PATH', '')
        new_path = os.pathsep.join(paths_to_add + [current_path])
        os.environ['PATH'] = new_path

        # Set ANDROID_HOME if not set
        if not android_home:
            os.environ['ANDROID_HOME'] = str(sdk_path)

        return True

    return False

def test_command(cmd, name):
    """Test if a command can be found and executed"""
    try:
        result = subprocess.run(
            [cmd, '--version'] if cmd != 'adb' else [cmd, 'version'],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0:
            print(f"{GREEN}✓ {name}: Found and working{RESET}")
            return True
        else:
            print(f"{RED}✗ {name}: Found but returned error{RESET}")
            return False
    except FileNotFoundError:
        print(f"{RED}✗ {name}: Not found in PATH{RESET}")
        return False
    except Exception as e:
        print(f"{RED}✗ {name}: Error - {e}{RESET}")
        return False

def main():
    print("=== Android SDK Path Test ===\n")

    # Test before setup
    print("Before PATH setup:")
    tools = {
        'adb': 'ADB',
        'emulator': 'Emulator',
        'avdmanager': 'AVD Manager',
        'sdkmanager': 'SDK Manager'
    }

    before_results = {}
    for cmd, name in tools.items():
        before_results[cmd] = test_command(cmd, name)

    print("\n" + "="*30 + "\n")

    # Setup paths
    print("Setting up Android SDK paths...")
    if setup_android_sdk_path():
        print(f"\n{GREEN}✓ PATH setup completed{RESET}\n")
    else:
        print(f"\n{YELLOW}⚠ PATH setup incomplete{RESET}\n")

    # Test after setup
    print("After PATH setup:")
    after_results = {}
    for cmd, name in tools.items():
        after_results[cmd] = test_command(cmd, name)

    # Summary
    print("\n" + "="*30)
    print("Summary:")
    improved = []
    still_missing = []

    for cmd in tools:
        if not before_results[cmd] and after_results[cmd]:
            improved.append(cmd)
        elif not after_results[cmd]:
            still_missing.append(cmd)

    if improved:
        print(f"{GREEN}✓ Now working: {', '.join(improved)}{RESET}")

    if still_missing:
        print(f"{RED}✗ Still missing: {', '.join(still_missing)}{RESET}")
        print(f"\n{YELLOW}To fix missing tools:{RESET}")
        print("1. Install Android Studio and Android SDK")
        print("2. Set ANDROID_HOME environment variable")
        print("3. Install missing SDK components via Android Studio SDK Manager")
    else:
        print(f"{GREEN}✓ All tools are working!{RESET}")

if __name__ == '__main__':
    main()