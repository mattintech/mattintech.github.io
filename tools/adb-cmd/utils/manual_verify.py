#!/usr/bin/env python3
"""
Manual ADB Command Verifier
Interactive tool for testing and verifying ADB commands across Android versions
"""

import json
import sys
import subprocess
import platform
import argparse
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Any
import shutil
import os
import asyncio

# Import from local modules
from modules.emulator_manager import EmulatorManager

# ANSI color codes for terminal output
class Colors:
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    WHITE = '\033[97m'
    BOLD = '\033[1m'
    RESET = '\033[0m'

class ManualVerifier:
    def __init__(self, commands_file="../data/commands.json", auto_backup=True):
        self.commands_file = Path(__file__).parent.parent / 'data' / 'commands.json'
        self.backup_dir = self.commands_file.parent / 'backups'
        self.auto_backup = auto_backup
        self.is_mac = platform.system() == 'Darwin'  # Set this before setup_android_sdk_path
        self.commands = self.load_commands()
        self.setup_android_sdk_path()
        self.em = EmulatorManager()
        self.current_device = None
        self.current_api = None
        self.session_stats = {
            'tested': 0,
            'passed': 0,
            'failed': 0,
            'skipped': 0
        }

    def setup_android_sdk_path(self):
        """Setup Android SDK paths in environment"""
        # Common Android SDK locations
        sdk_paths = []

        # Check ANDROID_HOME and ANDROID_SDK_ROOT environment variables
        android_home = os.environ.get('ANDROID_HOME')
        android_sdk_root = os.environ.get('ANDROID_SDK_ROOT')

        if android_home:
            sdk_paths.append(Path(android_home))
        if android_sdk_root:
            sdk_paths.append(Path(android_sdk_root))

        # Check common locations
        home = Path.home()
        if self.is_mac:
            sdk_paths.extend([
                home / 'Library' / 'Android' / 'sdk',
                Path('/usr/local/share/android-sdk'),
                Path('/opt/android-sdk')
            ])
        else:  # Windows/Linux
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
                break

        if sdk_path:
            # Add SDK tools to PATH
            emulator_path = sdk_path / 'emulator'
            platform_tools = sdk_path / 'platform-tools'
            cmdline_tools = sdk_path / 'cmdline-tools' / 'latest' / 'bin'
            tools = sdk_path / 'tools' / 'bin'

            paths_to_add = []
            if emulator_path.exists():
                paths_to_add.append(str(emulator_path))
            if platform_tools.exists():
                paths_to_add.append(str(platform_tools))
            if cmdline_tools.exists():
                paths_to_add.append(str(cmdline_tools))
            if tools.exists():
                paths_to_add.append(str(tools))

            if paths_to_add:
                current_path = os.environ.get('PATH', '')
                new_path = os.pathsep.join(paths_to_add + [current_path])
                os.environ['PATH'] = new_path
                print(f"{Colors.GREEN}✓ Android SDK found at: {sdk_path}{Colors.RESET}")

            # Also set ANDROID_HOME if not set
            if not android_home:
                os.environ['ANDROID_HOME'] = str(sdk_path)
        else:
            print(f"{Colors.YELLOW}⚠ Android SDK not found. Please set ANDROID_HOME environment variable.{Colors.RESET}")

    def load_commands(self) -> List[Dict]:
        """Load commands from JSON file"""
        with open(self.commands_file, 'r') as f:
            return json.load(f)

    def save_commands(self, create_backup=True):
        """Save commands to JSON file with optional backup"""
        if create_backup and self.auto_backup:
            self.create_backup()

        with open(self.commands_file, 'w') as f:
            json.dump(self.commands, f, indent=2)

    def create_backup(self) -> Path:
        """Create timestamped backup of commands.json"""
        self.backup_dir.mkdir(exist_ok=True)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_file = self.backup_dir / f'commands_{timestamp}.json'

        shutil.copy2(self.commands_file, backup_file)
        print(f"{Colors.GREEN}✓ Backup created: {backup_file.name}{Colors.RESET}")
        return backup_file

    def start_emulator(self, api_level: int) -> bool:
        """Start emulator for testing using EmulatorManager"""
        print(f"\n{Colors.CYAN}Starting Android {api_level} emulator...{Colors.RESET}")
        self.current_api = api_level

        # Construct AVD name
        avd_name = f"test_android_{api_level}"

        async def start_emulator_async():
            # Check prerequisites
            prereqs = await self.em.check_prerequisites()
            if not all(prereqs.values()):
                missing = [tool for tool, found in prereqs.items() if not found]
                print(f"{Colors.RED}✗ Missing required tools: {', '.join(missing)}{Colors.RESET}")
                print(f"{Colors.YELLOW}Please install Android SDK and ensure tools are in PATH{Colors.RESET}")
                return None

            # Check if AVD exists, create if needed
            avds = await self.em.list_avds()
            avd_exists = any(avd['name'] == avd_name for avd in avds)

            if not avd_exists:
                print(f"{Colors.YELLOW}AVD '{avd_name}' not found. Creating it...{Colors.RESET}")
                success = await self.em.create_avd(avd_name, api_level)
                if not success:
                    print(f"{Colors.RED}✗ Failed to create AVD{Colors.RESET}")
                    return None

            # Start the emulator
            emulator_info = await self.em.start_emulator(avd_name)
            return emulator_info

        # Run async function
        try:
            emulator_info = asyncio.run(start_emulator_async())
            if emulator_info:
                self.current_device = emulator_info.serial
                print(f"{Colors.GREEN}✓ Emulator fully started: {self.current_device}{Colors.RESET}")
                return True
            else:
                return False
        except Exception as e:
            print(f"{Colors.RED}Error starting emulator: {e}{Colors.RESET}")
            return False

    def stop_emulator(self):
        """Stop the current emulator"""
        if self.current_device:
            print(f"\n{Colors.YELLOW}Stopping emulator...{Colors.RESET}")
            try:
                asyncio.run(self.em.stop_emulator(self.current_device))
                print(f"{Colors.GREEN}✓ Emulator stopped{Colors.RESET}")
            except Exception as e:
                print(f"{Colors.YELLOW}Warning: Could not stop emulator cleanly: {e}{Colors.RESET}")
                # Fallback to direct adb command
                subprocess.run(['adb', '-s', self.current_device, 'emu', 'kill'], capture_output=True)
            self.current_device = None

    def get_command_for_platform(self, cmd_data: Dict, version: Optional[Dict] = None) -> str:
        """Get the appropriate command for current platform"""
        if version:
            return version['mac'] if self.is_mac else version['windows']
        else:
            return cmd_data['mac'] if self.is_mac else cmd_data['windows']

    def execute_command(self, command: str) -> Dict[str, Any]:
        """Execute ADB command and return results"""
        if not self.current_device:
            return {
                'success': False,
                'stdout': '',
                'stderr': 'No device connected',
                'returncode': -1
            }

        # Replace 'adb' with 'adb -s device_serial' for specific device
        if command.startswith('adb '):
            command = f"adb -s {self.current_device} {command[4:]}"
        elif command == 'adb':
            command = f"adb -s {self.current_device}"

        try:
            result = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True,
                timeout=30
            )

            return {
                'success': result.returncode == 0,
                'stdout': result.stdout,
                'stderr': result.stderr,
                'returncode': result.returncode
            }
        except subprocess.TimeoutExpired:
            return {
                'success': False,
                'stdout': '',
                'stderr': 'Command timeout (30s)',
                'returncode': -1
            }
        except Exception as e:
            return {
                'success': False,
                'stdout': '',
                'stderr': str(e),
                'returncode': -1
            }

    def display_command_info(self, cmd_data: Dict, index: int, total: int):
        """Display command information"""
        print(f"\n{Colors.YELLOW}{'='*70}{Colors.RESET}")
        print(f"{Colors.BOLD}{Colors.CYAN}[{index}/{total}] Testing: {cmd_data['title']}{Colors.RESET}")
        print(f"{Colors.WHITE}Description: {cmd_data['description']}{Colors.RESET}")
        print(f"Category: {cmd_data['category']}")
        print(f"ID: {cmd_data['id']}")

        # Show existing verification status for this API level
        if 'verification' in cmd_data and 'testedVersions' in cmd_data['verification']:
            api_str = str(self.current_api)
            if api_str in cmd_data['verification']['testedVersions']:
                prev = cmd_data['verification']['testedVersions'][api_str]
                status_color = Colors.GREEN if prev['status'] == 'pass' else Colors.RED
                print(f"\n{Colors.YELLOW}Previous test on API {self.current_api}:{Colors.RESET}")
                print(f"  Status: {status_color}{prev['status']}{Colors.RESET}")
                print(f"  Date: {prev['date']}")
                if prev.get('notes'):
                    print(f"  Notes: {prev['notes']}")

    def test_command(self, cmd_data: Dict, index: int, total: int) -> Optional[Dict]:
        """Test a single command with manual verification"""
        self.display_command_info(cmd_data, index, total)

        # Handle multi-version commands
        if cmd_data.get('multiVersion'):
            return self.test_multiversion_command(cmd_data, index, total)
        else:
            return self.test_standard_command(cmd_data, index, total)

    def test_standard_command(self, cmd_data: Dict, index: int, total: int) -> Optional[Dict]:
        """Test a standard (non-multiversion) command"""
        command = self.get_command_for_platform(cmd_data)

        print(f"\n{Colors.CYAN}Command: {Colors.WHITE}{command}{Colors.RESET}")

        # Execute command
        print(f"\n{Colors.CYAN}Executing...{Colors.RESET}")
        result = self.execute_command(command)

        # Display results
        self.display_results(result)

        # Get user verification
        verdict = self.get_user_verdict()

        if verdict == 'skip':
            self.session_stats['skipped'] += 1
            return None
        elif verdict == 'retry':
            return self.test_standard_command(cmd_data, index, total)
        elif verdict == 'edit':
            # Allow user to edit the command
            print(f"\n{Colors.YELLOW}Current command: {Colors.RESET}{command}")
            new_command = input(f"{Colors.CYAN}Enter new command: {Colors.RESET}")
            if new_command.strip():
                # Update the command in the data structure
                if self.is_mac:
                    cmd_data['mac'] = new_command.strip()
                else:
                    cmd_data['windows'] = new_command.strip()
                print(f"{Colors.GREEN}✓ Command updated{Colors.RESET}")
            return self.test_standard_command(cmd_data, index, total)

        # Record result
        self.session_stats['tested'] += 1

        if verdict == 'pass':
            self.session_stats['passed'] += 1
            self.record_verification(cmd_data, 'pass', result['stdout'])
        elif verdict == 'fail':
            self.session_stats['failed'] += 1
            notes = input("Notes about failure (optional): ")
            self.record_verification(cmd_data, 'fail', error=result['stderr'], notes=notes)
        elif verdict == 'paste':
            print("Paste the expected output (end with '###' on new line):")
            lines = []
            while True:
                line = input()
                if line == '###':
                    break
                lines.append(line)
            output = '\n'.join(lines)
            self.session_stats['passed'] += 1
            self.record_verification(cmd_data, 'pass', output)

        return cmd_data

    def test_multiversion_command(self, cmd_data: Dict, index: int, total: int) -> Optional[Dict]:
        """Test a multi-version command"""
        print(f"\n{Colors.CYAN}Multi-version command detected:{Colors.RESET}")

        # Find the appropriate version for current API
        selected_version = None
        for i, version in enumerate(cmd_data.get('versions', [])):
            print(f"  [{i+1}] {version['range']}: {self.get_command_for_platform(cmd_data, version)}")

            # Check if this version applies to current API
            if self.version_applies_to_api(version['range'], self.current_api):
                selected_version = version
                print(f"  {Colors.GREEN}→ Using version {i+1} for API {self.current_api}{Colors.RESET}")

        if not selected_version:
            print(f"{Colors.YELLOW}No version found for API {self.current_api}{Colors.RESET}")
            return None

        command = self.get_command_for_platform(cmd_data, selected_version)
        print(f"\n{Colors.CYAN}Command: {Colors.WHITE}{command}{Colors.RESET}")

        # Execute command
        print(f"\n{Colors.CYAN}Executing...{Colors.RESET}")
        result = self.execute_command(command)

        # Display results
        self.display_results(result)

        # Get user verification
        verdict = self.get_user_verdict()

        if verdict == 'skip':
            self.session_stats['skipped'] += 1
            return None
        elif verdict == 'retry':
            return self.test_multiversion_command(cmd_data, index, total)
        elif verdict == 'edit':
            # Allow user to edit the command for this specific version
            print(f"\n{Colors.YELLOW}Current command for {selected_version['range']}: {Colors.RESET}{command}")
            new_command = input(f"{Colors.CYAN}Enter new command: {Colors.RESET}")
            if new_command.strip():
                # Update the command for this version
                if self.is_mac:
                    selected_version['mac'] = new_command.strip()
                else:
                    selected_version['windows'] = new_command.strip()
                print(f"{Colors.GREEN}✓ Command updated for version {selected_version['range']}{Colors.RESET}")
            return self.test_multiversion_command(cmd_data, index, total)

        # Record result for this version
        self.session_stats['tested'] += 1

        if verdict == 'pass':
            self.session_stats['passed'] += 1
            self.record_version_verification(selected_version, 'pass', result['stdout'])
            self.update_overall_verification(cmd_data)
        elif verdict == 'fail':
            self.session_stats['failed'] += 1
            notes = input("Notes about failure (optional): ")
            self.record_version_verification(selected_version, 'fail', error=result['stderr'], notes=notes)
            self.update_overall_verification(cmd_data)
        elif verdict == 'paste':
            print("Paste the expected output (end with '###' on new line):")
            lines = []
            while True:
                line = input()
                if line == '###':
                    break
                lines.append(line)
            output = '\n'.join(lines)
            self.session_stats['passed'] += 1
            self.record_version_verification(selected_version, 'pass', output)
            self.update_overall_verification(cmd_data)

        return cmd_data

    def version_applies_to_api(self, version_range: str, api_level: int) -> bool:
        """Check if a version range applies to given API level"""
        # Simple version mapping (extend as needed)
        version_to_api = {
            '4.0': 14, '4.1': 16, '4.2': 17, '4.3': 18, '4.4': 19,
            '5.0': 21, '5.1': 22,
            '6.0': 23,
            '7.0': 24, '7.1': 25,
            '8.0': 26, '8.1': 27,
            '9.0': 28, '9': 28,
            '10.0': 29, '10': 29,
            '11.0': 30, '11': 30,
            '12.0': 31, '12': 31, '12L': 32,
            '13.0': 33, '13': 33,
            '14.0': 34, '14': 34,
            '15.0': 35, '15': 35,
            '16.0': 36, '16': 36,
        }

        # Handle special cases
        if version_range == 'All':
            return True
        elif '+' in version_range:
            # e.g., "12+"
            min_version = version_range.replace('+', '')
            min_api = version_to_api.get(min_version, 0)
            return api_level >= min_api
        elif ' - ' in version_range:
            # e.g., "4.0 - 10.0"
            parts = version_range.split(' - ')
            min_api = version_to_api.get(parts[0], 0)
            max_api = version_to_api.get(parts[1], 99)
            return min_api <= api_level <= max_api
        else:
            # Single version
            target_api = version_to_api.get(version_range, 0)
            return api_level == target_api

    def display_results(self, result: Dict[str, Any]):
        """Display command execution results"""
        if result['stdout']:
            print(f"\n{Colors.GREEN}STDOUT:{Colors.RESET}")
            # Limit output display
            lines = result['stdout'].split('\n')
            if len(lines) > 20:
                print('\n'.join(lines[:20]))
                print(f"{Colors.YELLOW}... ({len(lines)-20} more lines){Colors.RESET}")
            else:
                print(result['stdout'])
        else:
            print(f"\n{Colors.GREEN}STDOUT:{Colors.RESET} (empty)")

        if result['stderr']:
            print(f"\n{Colors.RED}STDERR:{Colors.RESET}")
            print(result['stderr'])

        print(f"\n{Colors.CYAN}Return code: {result['returncode']}{Colors.RESET}")

    def get_user_verdict(self) -> str:
        """Get verification verdict from user"""
        print(f"\n{Colors.YELLOW}{'='*70}{Colors.RESET}")
        print("Verification Options:")
        print(f"  [{Colors.GREEN}p{Colors.RESET}] Pass - Command worked as expected")
        print(f"  [{Colors.RED}f{Colors.RESET}] Fail - Command failed or unexpected output")
        print(f"  [{Colors.YELLOW}s{Colors.RESET}] Skip - Skip this command")
        print(f"  [{Colors.CYAN}r{Colors.RESET}] Retry - Run command again")
        print(f"  [{Colors.CYAN}e{Colors.RESET}] Edit - Modify the command")
        print(f"  [{Colors.CYAN}o{Colors.RESET}] Paste Output - Manually provide expected output")
        print(f"  [{Colors.RED}q{Colors.RESET}] Quit - Save and exit")

        while True:
            choice = input(f"\n{Colors.CYAN}Your verdict: {Colors.RESET}").lower().strip()

            if choice in ['p', 'pass']:
                return 'pass'
            elif choice in ['f', 'fail']:
                return 'fail'
            elif choice in ['s', 'skip']:
                return 'skip'
            elif choice in ['r', 'retry']:
                return 'retry'
            elif choice in ['e', 'edit']:
                return 'edit'
            elif choice in ['o', 'output']:
                return 'paste'
            elif choice in ['q', 'quit']:
                print(f"\n{Colors.YELLOW}Saving progress and exiting...{Colors.RESET}")
                self.save_commands()
                self.display_session_summary()
                sys.exit(0)
            else:
                print(f"{Colors.RED}Invalid choice. Please try again.{Colors.RESET}")

    def record_verification(self, cmd_data: Dict, status: str, output: str = None, error: str = None, notes: str = None):
        """Record verification result for standard command"""
        if 'verification' not in cmd_data:
            cmd_data['verification'] = {
                'verified': False,
                'lastTested': None,
                'testedVersions': {}
            }

        api_str = str(self.current_api)
        cmd_data['verification']['testedVersions'][api_str] = {
            'status': status,
            'date': datetime.now().strftime('%Y-%m-%d'),
            'output': output if status == 'pass' else None,
            'error': error if status == 'fail' else None,
            'notes': notes if notes else None
        }

        cmd_data['verification']['lastTested'] = datetime.now().strftime('%Y-%m-%d')

        # Update overall verified flag
        any_passed = any(
            v['status'] == 'pass'
            for v in cmd_data['verification']['testedVersions'].values()
        )
        cmd_data['verification']['verified'] = any_passed

    def record_version_verification(self, version: Dict, status: str, output: str = None, error: str = None, notes: str = None):
        """Record verification result for a specific version of multi-version command"""
        if 'verification' not in version:
            version['verification'] = {
                'verified': False,
                'lastTested': None,
                'testedVersions': {}
            }

        api_str = str(self.current_api)
        version['verification']['testedVersions'][api_str] = {
            'status': status,
            'date': datetime.now().strftime('%Y-%m-%d'),
            'output': output if status == 'pass' else None,
            'error': error if status == 'fail' else None,
            'notes': notes if notes else None
        }

        version['verification']['lastTested'] = datetime.now().strftime('%Y-%m-%d')
        version['verification']['verified'] = status == 'pass'

    def update_overall_verification(self, cmd_data: Dict):
        """Update overall verification status for multi-version command"""
        if 'verification' not in cmd_data:
            cmd_data['verification'] = {
                'verified': False,
                'lastTested': None,
                'overallStatus': 'untested'
            }

        # Check if any version is verified
        any_verified = False
        for version in cmd_data.get('versions', []):
            if version.get('verification', {}).get('verified'):
                any_verified = True
                break

        cmd_data['verification']['verified'] = any_verified
        cmd_data['verification']['lastTested'] = datetime.now().strftime('%Y-%m-%d')
        cmd_data['verification']['overallStatus'] = 'partial' if any_verified else 'untested'

    def display_session_summary(self):
        """Display summary of testing session"""
        print(f"\n{Colors.GREEN}{'='*70}{Colors.RESET}")
        print(f"{Colors.BOLD}{Colors.CYAN}Session Summary{Colors.RESET}")
        print(f"  Commands tested: {self.session_stats['tested']}")
        print(f"  {Colors.GREEN}Passed: {self.session_stats['passed']}{Colors.RESET}")
        print(f"  {Colors.RED}Failed: {self.session_stats['failed']}{Colors.RESET}")
        print(f"  {Colors.YELLOW}Skipped: {self.session_stats['skipped']}{Colors.RESET}")

        if self.session_stats['tested'] > 0:
            pass_rate = (self.session_stats['passed'] / self.session_stats['tested']) * 100
            print(f"  Pass rate: {pass_rate:.1f}%")

    def analyze_for_consolidation(self, cmd_id: int):
        """Analyze a multi-version command for consolidation opportunities"""
        cmd = next((c for c in self.commands if c['id'] == cmd_id), None)
        if not cmd or not cmd.get('multiVersion'):
            return None

        versions = cmd.get('versions', [])
        if len(versions) <= 1:
            return None

        # Group versions by identical commands
        groups = []
        for version in versions:
            found = False
            for group in groups:
                if (group['windows'] == version.get('windows') and
                    group['mac'] == version.get('mac')):
                    group['versions'].append(version)
                    found = True
                    break

            if not found:
                groups.append({
                    'windows': version.get('windows'),
                    'mac': version.get('mac'),
                    'versions': [version]
                })

        # If we can consolidate
        if len(groups) < len(versions):
            return groups
        return None

    def suggest_version_consolidation(self, cmd_id: int):
        """Suggest consolidation for a multi-version command"""
        groups = self.analyze_for_consolidation(cmd_id)
        if not groups:
            return False

        cmd = next((c for c in self.commands if c['id'] == cmd_id), None)

        print(f"\n{Colors.YELLOW}{'='*70}{Colors.RESET}")
        print(f"{Colors.BOLD}{Colors.YELLOW}CONSOLIDATION OPPORTUNITY DETECTED{Colors.RESET}")
        print(f"Command: {cmd['title']}")
        print(f"\nCurrent: {len(cmd['versions'])} separate versions")
        print(f"Could be: {len(groups)} consolidated groups")

        print(f"\n{Colors.CYAN}Suggested consolidation:{Colors.RESET}")
        for i, group in enumerate(groups, 1):
            ranges = [v['range'] for v in group['versions']]
            print(f"\n  Group {i}: {', '.join(ranges)}")
            print(f"    Windows: {group['windows']}")
            print(f"    Mac: {group['mac']}")

        response = input(f"\n{Colors.YELLOW}Apply consolidation? [y/n]: {Colors.RESET}").lower()

        if response in ['y', 'yes']:
            self.apply_consolidation(cmd_id, groups)
            return True
        return False

    def apply_consolidation(self, cmd_id: int, groups):
        """Apply the consolidation to the command"""
        cmd = next((c for c in self.commands if c['id'] == cmd_id), None)
        if not cmd:
            return

        new_versions = []

        for group in groups:
            # Combine ranges
            ranges = [v['range'] for v in group['versions']]
            consolidated_range = self.consolidate_ranges(ranges)

            # Merge verification data
            merged_verification = {
                'verified': False,
                'lastTested': None,
                'testedVersions': {}
            }

            for version in group['versions']:
                if 'verification' in version and 'testedVersions' in version['verification']:
                    merged_verification['testedVersions'].update(version['verification']['testedVersions'])
                    if version['verification'].get('verified'):
                        merged_verification['verified'] = True
                        merged_verification['lastTested'] = version['verification'].get('lastTested')

            # Get the best notes
            all_notes = [v.get('notes', '') for v in group['versions'] if v.get('notes')]
            notes = all_notes[0] if all_notes else ""

            new_version = {
                'range': consolidated_range,
                'windows': group['windows'],
                'mac': group['mac'],
                'notes': notes,
                'verification': merged_verification
            }

            new_versions.append(new_version)

        cmd['versions'] = new_versions
        print(f"{Colors.GREEN}✓ Consolidation applied successfully{Colors.RESET}")

    def consolidate_ranges(self, ranges):
        """Consolidate multiple version ranges into one"""
        # Simple version mapping
        version_order = ['4.0', '4.1', '4.2', '4.3', '4.4', '5.0', '5.1', '6.0',
                        '7.0', '7.1', '8.0', '8.1', '9.0', '10.0', '11', '12',
                        '13', '14', '15', '16']

        # Parse ranges to find min and max
        all_versions = set()
        has_plus = False

        for range_str in ranges:
            if range_str == 'All':
                return 'All'
            elif '+' in range_str:
                has_plus = True
                base = range_str.replace('+', '')
                all_versions.add(base)
                # Add all versions after this one
                if base in version_order:
                    idx = version_order.index(base)
                    all_versions.update(version_order[idx:])
            elif ' - ' in range_str:
                parts = range_str.split(' - ')
                if parts[0] in version_order and parts[1] in version_order:
                    start_idx = version_order.index(parts[0])
                    end_idx = version_order.index(parts[1])
                    all_versions.update(version_order[start_idx:end_idx+1])
            else:
                all_versions.add(range_str)

        # Sort versions
        sorted_versions = []
        for v in version_order:
            if v in all_versions:
                sorted_versions.append(v)

        if not sorted_versions:
            return ' + '.join(ranges)

        # Check if continuous
        first_idx = version_order.index(sorted_versions[0])
        last_idx = version_order.index(sorted_versions[-1])
        expected = version_order[first_idx:last_idx+1]

        if sorted_versions == expected:
            # Continuous range
            if has_plus or last_idx == len(version_order) - 1:
                return f"{sorted_versions[0]}+"
            elif len(sorted_versions) == 1:
                return sorted_versions[0]
            else:
                return f"{sorted_versions[0]} - {sorted_versions[-1]}"
        else:
            # Non-continuous
            return ', '.join(sorted_versions)

    def get_save_permission(self) -> bool:
        """Ask user if they want to save changes"""
        while True:
            response = input(f"\n{Colors.YELLOW}Save changes to commands.json? [y/n]: {Colors.RESET}").lower()
            if response in ['y', 'yes']:
                return True
            elif response in ['n', 'no']:
                return False

    def run_verification(self, api_level: int, category: Optional[str] = None,
                         test_all: bool = False, start_from: int = 0):
        """Run the verification session"""
        # Start emulator
        if not self.start_emulator(api_level):
            return

        # Filter commands
        commands_to_test = self.commands

        if category:
            commands_to_test = [c for c in commands_to_test if c.get('category') == category]
            print(f"\n{Colors.CYAN}Testing category: {category}{Colors.RESET}")

        if not test_all:
            # Filter out already verified commands for this API
            unverified = []
            for cmd in commands_to_test:
                api_str = str(api_level)

                # Check standard commands
                if not cmd.get('multiVersion'):
                    if not cmd.get('verification', {}).get('testedVersions', {}).get(api_str):
                        unverified.append(cmd)
                    elif cmd.get('verification', {}).get('testedVersions', {}).get(api_str, {}).get('status') != 'pass':
                        unverified.append(cmd)  # Re-test failed commands
                else:
                    # For multi-version, check if any version needs testing
                    needs_test = True
                    for version in cmd.get('versions', []):
                        if self.version_applies_to_api(version['range'], api_level):
                            if version.get('verification', {}).get('testedVersions', {}).get(api_str, {}).get('status') == 'pass':
                                needs_test = False
                                break
                    if needs_test:
                        unverified.append(cmd)

            commands_to_test = unverified
            print(f"{Colors.CYAN}Found {len(commands_to_test)} unverified commands for API {api_level}{Colors.RESET}")

        if not commands_to_test:
            print(f"{Colors.GREEN}All commands already verified for API {api_level}!{Colors.RESET}")
            return

        total = len(commands_to_test)
        print(f"\n{Colors.GREEN}Ready to test {total} commands on API {api_level}{Colors.RESET}")
        input(f"{Colors.YELLOW}Press Enter to begin...{Colors.RESET}")

        # Test each command
        for i, cmd in enumerate(commands_to_test[start_from:], start=start_from + 1):
            result = self.test_command(cmd, i, total)

            if result:
                # Check for consolidation opportunities in multi-version commands
                if cmd.get('multiVersion'):
                    self.suggest_version_consolidation(cmd['id'])

                # Ask to save after each command
                if self.get_save_permission():
                    self.save_commands(create_backup=False)  # Don't backup every time
                    print(f"{Colors.GREEN}✓ Progress saved{Colors.RESET}")

            # Ask to continue
            if i < total:
                cont = input(f"\n{Colors.CYAN}Continue to next? [y/n/q]: {Colors.RESET}").lower()
                if cont in ['q', 'quit']:
                    break
                elif cont in ['n', 'no']:
                    print(f"{Colors.YELLOW}Paused at command {i}. Resume with --start-from {i}{Colors.RESET}")
                    break

        # Final save
        self.display_session_summary()
        if self.session_stats['tested'] > 0:
            if self.get_save_permission():
                self.save_commands()
                print(f"{Colors.GREEN}✓ All changes saved{Colors.RESET}")

        # Stop emulator
        self.stop_emulator()

def main():
    parser = argparse.ArgumentParser(
        description='Manual ADB Command Verifier',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python manual_verify.py --api 36                    # Test unverified commands on API 36
  python manual_verify.py --api 35 --all              # Test ALL commands on API 35
  python manual_verify.py --api 36 --category connection  # Test connection commands
  python manual_verify.py --api 36 --start-from 10    # Resume from command 10
        """
    )

    parser.add_argument('--api', type=int, required=True,
                       choices=[31, 33, 34, 35, 36],
                       help='API level to test (31=Android 12, 33=13, 34=14, 35=15, 36=16)')
    parser.add_argument('--category',
                       choices=['connection', 'installation', 'deviceinfo', 'troubleshooting'],
                       help='Test specific category only')
    parser.add_argument('--all', action='store_true',
                       help='Test all commands, even if already verified')
    parser.add_argument('--start-from', type=int, default=0,
                       help='Start from command index (for resuming)')
    parser.add_argument('--no-backup', action='store_true',
                       help='Disable automatic backups')

    args = parser.parse_args()

    print(f"{Colors.BOLD}{Colors.CYAN}ADB Command Manual Verifier{Colors.RESET}")
    print(f"{Colors.YELLOW}Testing on API Level {args.api}{Colors.RESET}")

    verifier = ManualVerifier(auto_backup=not args.no_backup)

    try:
        verifier.run_verification(
            api_level=args.api,
            category=args.category,
            test_all=args.all,
            start_from=args.start_from
        )
    except KeyboardInterrupt:
        print(f"\n{Colors.YELLOW}Interrupted by user{Colors.RESET}")
        verifier.display_session_summary()
        if verifier.session_stats['tested'] > 0:
            if verifier.get_save_permission():
                verifier.save_commands()
                print(f"{Colors.GREEN}✓ Progress saved{Colors.RESET}")
    except Exception as e:
        print(f"{Colors.RED}Error: {e}{Colors.RESET}")
        import traceback
        traceback.print_exc()
    finally:
        if verifier.current_device:
            verifier.stop_emulator()

if __name__ == '__main__':
    main()