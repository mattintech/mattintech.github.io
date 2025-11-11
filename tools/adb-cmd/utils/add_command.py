#!/usr/bin/env python3
"""
Add New ADB Command Tool
Interactive tool for adding and verifying new ADB commands
"""

import json
import sys
import subprocess
import platform
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Any
import shutil

# ANSI color codes
class Colors:
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    WHITE = '\033[97m'
    BOLD = '\033[1m'
    RESET = '\033[0m'

class CommandAdder:
    def __init__(self):
        self.commands_file = Path(__file__).parent.parent / 'data' / 'commands.json'
        self.backup_dir = self.commands_file.parent / 'backups'
        self.commands = self.load_commands()
        self.is_mac = platform.system() == 'Darwin'
        self.new_command = {}
        self.test_device = None

    def load_commands(self) -> List[Dict]:
        """Load existing commands"""
        with open(self.commands_file, 'r') as f:
            return json.load(f)

    def save_commands(self):
        """Save commands with backup"""
        # Create backup
        self.backup_dir.mkdir(exist_ok=True)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_file = self.backup_dir / f'commands_{timestamp}.json'
        shutil.copy2(self.commands_file, backup_file)
        print(f"{Colors.GREEN}✓ Backup created: {backup_file.name}{Colors.RESET}")

        # Save updated commands
        with open(self.commands_file, 'w') as f:
            json.dump(self.commands, f, indent=2)
        print(f"{Colors.GREEN}✓ commands.json updated{Colors.RESET}")

    def get_next_id(self) -> int:
        """Get the next available command ID"""
        if not self.commands:
            return 1
        return max(cmd['id'] for cmd in self.commands) + 1

    def prompt_input(self, prompt: str, required: bool = True, default: str = None) -> str:
        """Get input from user with optional default"""
        if default:
            prompt_text = f"{Colors.CYAN}{prompt} [{default}]: {Colors.RESET}"
        else:
            prompt_text = f"{Colors.CYAN}{prompt}: {Colors.RESET}"

        while True:
            value = input(prompt_text).strip()

            if not value and default:
                return default

            if value or not required:
                return value

            print(f"{Colors.RED}This field is required!{Colors.RESET}")

    def prompt_choice(self, prompt: str, choices: List[str], default: str = None) -> str:
        """Get choice from user"""
        print(f"\n{Colors.CYAN}{prompt}{Colors.RESET}")
        for i, choice in enumerate(choices, 1):
            if default and choice == default:
                print(f"  [{i}] {choice} (default)")
            else:
                print(f"  [{i}] {choice}")

        while True:
            value = input(f"{Colors.CYAN}Enter choice (1-{len(choices)}): {Colors.RESET}").strip()

            if not value and default:
                return default

            try:
                idx = int(value) - 1
                if 0 <= idx < len(choices):
                    return choices[idx]
            except ValueError:
                # Check if they typed the choice directly
                if value in choices:
                    return value

            print(f"{Colors.RED}Invalid choice!{Colors.RESET}")

    def prompt_yes_no(self, prompt: str, default: bool = True) -> bool:
        """Get yes/no answer"""
        default_text = "Y/n" if default else "y/N"
        while True:
            value = input(f"{Colors.CYAN}{prompt} [{default_text}]: {Colors.RESET}").lower().strip()

            if not value:
                return default

            if value in ['y', 'yes']:
                return True
            elif value in ['n', 'no']:
                return False

            print(f"{Colors.RED}Please enter yes or no{Colors.RESET}")

    def get_basic_info(self):
        """Get basic command information"""
        print(f"\n{Colors.BOLD}{Colors.GREEN}=== Basic Command Information ==={Colors.RESET}")

        self.new_command['id'] = self.get_next_id()
        print(f"Command ID: {self.new_command['id']}")

        self.new_command['title'] = self.prompt_input("Command title (e.g., 'Get Device Properties')")
        self.new_command['description'] = self.prompt_input("Description (what does this command do?)")

        # Category
        categories = ['connection', 'installation', 'deviceinfo', 'troubleshooting']
        self.new_command['category'] = self.prompt_choice("Category", categories)

    def get_command_syntax(self):
        """Get command syntax for different platforms"""
        print(f"\n{Colors.BOLD}{Colors.GREEN}=== Command Syntax ==={Colors.RESET}")

        # Check if multi-version command
        is_multiversion = self.prompt_yes_no("Does this command have different syntax for different Android versions?", False)

        if is_multiversion:
            self.new_command['multiVersion'] = True
            self.new_command['versions'] = []
            self.get_multiversion_commands()
        else:
            # Single version command
            self.get_single_version_command()

    def get_single_version_command(self):
        """Get command for single version"""
        print(f"\n{Colors.CYAN}Enter the ADB command (including 'adb' prefix):{Colors.RESET}")

        # Get Mac/Linux version
        mac_cmd = self.prompt_input("Mac/Linux command")
        self.new_command['mac'] = mac_cmd

        # Check if Windows is different
        if self.prompt_yes_no("Is the Windows command different?", False):
            win_cmd = self.prompt_input("Windows command")
            self.new_command['windows'] = win_cmd
        else:
            self.new_command['windows'] = mac_cmd

        # Android version support
        print(f"\n{Colors.CYAN}Android Version Support:{Colors.RESET}")
        min_version = self.prompt_input("Minimum Android version (e.g., '4.0', '6.0', or 'All')", default="All")
        max_version = self.prompt_input("Maximum Android version (e.g., '14.0', or 'All')", default="All")
        notes = self.prompt_input("Notes about version compatibility", required=False)

        self.new_command['androidVersions'] = {
            'min': min_version,
            'max': max_version,
            'notes': notes if notes else None
        }

    def get_multiversion_commands(self):
        """Get multiple versions of command"""
        print(f"\n{Colors.YELLOW}Adding version-specific commands...{Colors.RESET}")
        print("Add versions from oldest to newest Android version")

        version_count = 1
        while True:
            print(f"\n{Colors.CYAN}Version {version_count}:{Colors.RESET}")

            version = {}

            # Get version range
            version['range'] = self.prompt_input("Version range (e.g., '4.0 - 10.0', '11+', 'All')")

            # Get commands
            mac_cmd = self.prompt_input("Mac/Linux command")
            version['mac'] = mac_cmd

            if self.prompt_yes_no("Is the Windows command different?", False):
                win_cmd = self.prompt_input("Windows command")
                version['windows'] = win_cmd
            else:
                version['windows'] = mac_cmd

            # Notes
            notes = self.prompt_input("Notes about this version", required=False)
            if notes:
                version['notes'] = notes

            # Initialize verification structure
            version['verification'] = {
                'verified': False,
                'lastTested': None,
                'testedVersions': {}
            }

            self.new_command['versions'].append(version)
            version_count += 1

            if not self.prompt_yes_no("Add another version?", False):
                break

        # Add overall verification for multi-version
        self.new_command['verification'] = {
            'verified': False,
            'lastTested': None,
            'overallStatus': 'untested'
        }

    def test_command(self) -> bool:
        """Test the new command on a device"""
        print(f"\n{Colors.BOLD}{Colors.GREEN}=== Command Testing ==={Colors.RESET}")
        print(f"{Colors.YELLOW}The command must be tested on at least one Android version before adding.{Colors.RESET}")

        # Check for connected devices
        result = subprocess.run(['adb', 'devices'], capture_output=True, text=True)
        lines = result.stdout.strip().split('\n')[1:]
        devices = []

        for line in lines:
            if '\t' in line and 'device' in line:
                device_serial = line.split('\t')[0]
                devices.append(device_serial)

        if not devices:
            print(f"{Colors.RED}No devices connected!{Colors.RESET}")
            print("Please connect a device or start an emulator:")
            print("  emulator -avd test_android_36")
            return False

        # Select device if multiple
        if len(devices) == 1:
            self.test_device = devices[0]
            print(f"Using device: {self.test_device}")
        else:
            print(f"\n{Colors.CYAN}Multiple devices found:{Colors.RESET}")
            for i, device in enumerate(devices, 1):
                print(f"  [{i}] {device}")
            choice = int(self.prompt_input(f"Select device (1-{len(devices)})")) - 1
            self.test_device = devices[choice]

        # Get device API level
        api_result = subprocess.run(
            ['adb', '-s', self.test_device, 'shell', 'getprop', 'ro.build.version.sdk'],
            capture_output=True,
            text=True
        )
        api_level = api_result.stdout.strip()
        print(f"Device API level: {api_level}")

        # Get Android version
        ver_result = subprocess.run(
            ['adb', '-s', self.test_device, 'shell', 'getprop', 'ro.build.version.release'],
            capture_output=True,
            text=True
        )
        android_version = ver_result.stdout.strip()
        print(f"Android version: {android_version}")

        # Determine which command to test
        if self.new_command.get('multiVersion'):
            # Find appropriate version
            test_version = None
            for version in self.new_command['versions']:
                print(f"  Checking version: {version['range']}")
                # Simple check - you might want to expand this
                if version['range'] == 'All' or '+' in version['range']:
                    test_version = version
                    break
            if not test_version:
                test_version = self.new_command['versions'][-1]  # Use latest

            command = test_version['mac'] if self.is_mac else test_version['windows']
            version_obj = test_version
        else:
            command = self.new_command['mac'] if self.is_mac else self.new_command['windows']
            version_obj = None

        # Test the command
        print(f"\n{Colors.CYAN}Testing command: {Colors.WHITE}{command}{Colors.RESET}")

        # Replace 'adb' with 'adb -s device_serial'
        if command.startswith('adb '):
            test_command = f"adb -s {self.test_device} {command[4:]}"
        else:
            test_command = command

        print(f"Executing: {test_command}")
        print(f"\n{Colors.YELLOW}{'='*70}{Colors.RESET}")

        # Execute
        result = subprocess.run(
            test_command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=30
        )

        # Show results
        if result.stdout:
            print(f"{Colors.GREEN}STDOUT:{Colors.RESET}")
            lines = result.stdout.split('\n')
            if len(lines) > 20:
                print('\n'.join(lines[:20]))
                print(f"{Colors.YELLOW}... ({len(lines)-20} more lines){Colors.RESET}")
            else:
                print(result.stdout)

        if result.stderr:
            print(f"{Colors.RED}STDERR:{Colors.RESET}")
            print(result.stderr)

        print(f"\n{Colors.CYAN}Return code: {result.returncode}{Colors.RESET}")
        print(f"{Colors.YELLOW}{'='*70}{Colors.RESET}")

        # Get verification
        print(f"\n{Colors.BOLD}Did the command work as expected?{Colors.RESET}")
        print(f"  [{Colors.GREEN}y{Colors.RESET}] Yes - Command worked correctly")
        print(f"  [{Colors.RED}n{Colors.RESET}] No - Command failed")
        print(f"  [{Colors.CYAN}r{Colors.RESET}] Retry - Test again")
        print(f"  [{Colors.CYAN}e{Colors.RESET}] Edit - Modify the command")

        while True:
            choice = input(f"\n{Colors.CYAN}Your choice: {Colors.RESET}").lower().strip()

            if choice == 'y':
                # Record successful test
                self.record_test_result(api_level, 'pass', result.stdout, version_obj)
                return True
            elif choice == 'n':
                print(f"{Colors.RED}Command must work to be added!{Colors.RESET}")
                notes = input("What went wrong? ")
                self.record_test_result(api_level, 'fail', error=result.stderr, notes=notes, version_obj=version_obj)
                return False
            elif choice == 'r':
                return self.test_command()
            elif choice == 'e':
                # Allow editing the command
                if version_obj:
                    new_cmd = self.prompt_input("Enter corrected command", default=command)
                    version_obj['mac'] = new_cmd
                    if not self.prompt_yes_no("Same for Windows?", True):
                        version_obj['windows'] = self.prompt_input("Windows command")
                    else:
                        version_obj['windows'] = new_cmd
                else:
                    new_cmd = self.prompt_input("Enter corrected command", default=command)
                    self.new_command['mac'] = new_cmd
                    if not self.prompt_yes_no("Same for Windows?", True):
                        self.new_command['windows'] = self.prompt_input("Windows command")
                    else:
                        self.new_command['windows'] = new_cmd
                return self.test_command()

    def record_test_result(self, api_level: str, status: str, output: str = None,
                          error: str = None, notes: str = None, version_obj: Dict = None):
        """Record the test result"""
        test_result = {
            'status': status,
            'date': datetime.now().strftime('%Y-%m-%d'),
            'output': output if status == 'pass' else None,
            'error': error if status == 'fail' else None,
            'notes': notes if notes else None
        }

        if version_obj:
            # Multi-version command
            if 'verification' not in version_obj:
                version_obj['verification'] = {
                    'verified': False,
                    'lastTested': None,
                    'testedVersions': {}
                }
            version_obj['verification']['testedVersions'][api_level] = test_result
            version_obj['verification']['verified'] = status == 'pass'
            version_obj['verification']['lastTested'] = datetime.now().strftime('%Y-%m-%d')

            # Update overall
            self.new_command['verification']['verified'] = status == 'pass'
            self.new_command['verification']['lastTested'] = datetime.now().strftime('%Y-%m-%d')
            self.new_command['verification']['overallStatus'] = 'tested'
        else:
            # Single version command
            if 'verification' not in self.new_command:
                self.new_command['verification'] = {
                    'verified': False,
                    'lastTested': None,
                    'testedVersions': {}
                }
            self.new_command['verification']['testedVersions'][api_level] = test_result
            self.new_command['verification']['verified'] = status == 'pass'
            self.new_command['verification']['lastTested'] = datetime.now().strftime('%Y-%m-%d')

    def preview_command(self):
        """Show preview of the new command"""
        print(f"\n{Colors.BOLD}{Colors.GREEN}=== Command Preview ==={Colors.RESET}")
        print(json.dumps(self.new_command, indent=2))

    def add_command(self):
        """Main flow for adding a new command"""
        print(f"{Colors.BOLD}{Colors.CYAN}=== Add New ADB Command ==={Colors.RESET}")

        # Get command details
        self.get_basic_info()
        self.get_command_syntax()

        # Preview
        self.preview_command()

        # Test the command
        if not self.prompt_yes_no("\nReady to test the command?", True):
            print(f"{Colors.YELLOW}Command not added (testing required){Colors.RESET}")
            return False

        if not self.test_command():
            if not self.prompt_yes_no("Testing failed. Try again?", True):
                print(f"{Colors.RED}Command not added (must pass testing){Colors.RESET}")
                return False
            # Retry
            return self.add_command()

        # Confirm addition
        print(f"\n{Colors.GREEN}✓ Command tested successfully!{Colors.RESET}")
        self.preview_command()

        if not self.prompt_yes_no("\nAdd this command to commands.json?", True):
            print(f"{Colors.YELLOW}Command not added{Colors.RESET}")
            return False

        # Add to commands list
        self.commands.append(self.new_command)

        # Save
        self.save_commands()

        print(f"\n{Colors.GREEN}✓ Command added successfully!{Colors.RESET}")
        print(f"  ID: {self.new_command['id']}")
        print(f"  Title: {self.new_command['title']}")
        print(f"  Verified on API: {list(self.new_command['verification']['testedVersions'].keys())}")

        return True

    def interactive_mode(self):
        """Interactive mode for adding multiple commands"""
        while True:
            self.new_command = {}

            if self.add_command():
                print(f"\n{Colors.GREEN}Command added!{Colors.RESET}")
            else:
                print(f"\n{Colors.YELLOW}Command not added{Colors.RESET}")

            if not self.prompt_yes_no("\nAdd another command?", False):
                break

        print(f"\n{Colors.CYAN}Total commands: {len(self.commands)}{Colors.RESET}")

def main():
    import argparse

    parser = argparse.ArgumentParser(
        description='Add new ADB commands with verification',
        epilog="""
This tool helps you add new ADB commands to commands.json.
Each command must be tested on at least one Android version before being added.

Example workflow:
1. Run the script
2. Enter command details
3. Test on connected device/emulator
4. Command is added if test passes
        """
    )

    parser.add_argument('--quick', action='store_true',
                       help='Quick mode - skip some optional fields')

    args = parser.parse_args()

    print(f"{Colors.BOLD}{Colors.CYAN}ADB Command Addition Tool{Colors.RESET}")

    # Check for ADB
    try:
        result = subprocess.run(['adb', 'version'], capture_output=True, text=True)
        if result.returncode != 0:
            print(f"{Colors.RED}Error: ADB not found!{Colors.RESET}")
            print("Please install Android SDK platform-tools")
            sys.exit(1)
    except FileNotFoundError:
        print(f"{Colors.RED}Error: ADB not found!{Colors.RESET}")
        print("Please install Android SDK platform-tools")
        sys.exit(1)

    adder = CommandAdder()

    try:
        adder.interactive_mode()
    except KeyboardInterrupt:
        print(f"\n{Colors.YELLOW}Interrupted by user{Colors.RESET}")
    except Exception as e:
        print(f"{Colors.RED}Error: {e}{Colors.RESET}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()