"""
Emulator Management Module
Handles Android emulator lifecycle and configuration
"""

import asyncio
import logging
import subprocess
import json
import os
import platform
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime

logger = logging.getLogger(__name__)


@dataclass
class EmulatorInfo:
    """Information about an emulator instance"""
    name: str
    serial: str
    api_level: int
    status: str  # starting, running, stopping, stopped
    start_time: Optional[datetime] = None
    process_id: Optional[int] = None


class EmulatorManager:
    """Manages Android emulator lifecycle"""

    # Supported API levels (Android 12-16, skipping 32)
    SUPPORTED_API_LEVELS = [31, 33, 34, 35, 36]

    # API level to Android version mapping
    API_VERSION_MAP = {
        31: "12",
        33: "13",
        34: "14",
        35: "15",
        36: "16"
    }

    def __init__(self, config: Dict = None):
        """Initialize emulator manager"""
        self.config = config or {}
        self.emulators = {}  # Track active emulators
        self.headless = self.config.get('headless', True)
        self.memory = self.config.get('memory', 2048)
        self.gpu_mode = self.config.get('gpu_mode', 'auto')
        self.setup_android_sdk_path()

    def setup_android_sdk_path(self):
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
                logger.info(f"Android SDK found at: {sdk_path}")

            # Also set ANDROID_HOME if not set
            if not android_home:
                os.environ['ANDROID_HOME'] = str(sdk_path)
        else:
            logger.warning("Android SDK not found. Please set ANDROID_HOME environment variable.")

    async def check_prerequisites(self) -> Dict[str, bool]:
        """Check if all prerequisites are met"""
        checks = {
            'adb': False,
            'emulator': False,
            'avdmanager': False,
            'sdkmanager': False
        }

        # Get SDK path from environment
        sdk_path = Path(os.environ.get('ANDROID_HOME', ''))
        if not sdk_path.exists():
            sdk_path = Path.home() / 'Library' / 'Android' / 'sdk'

        # Check tools with their full paths
        tool_paths = {
            'adb': 'adb',  # Usually in PATH
            'emulator': str(sdk_path / 'emulator' / 'emulator'),
            'avdmanager': str(sdk_path / 'cmdline-tools' / 'latest' / 'bin' / 'avdmanager'),
            'sdkmanager': str(sdk_path / 'cmdline-tools' / 'latest' / 'bin' / 'sdkmanager')
        }

        for tool, path in tool_paths.items():
            try:
                # Try with full path first
                cmd = [path, '--version'] if tool != 'adb' else [path, 'version']
                result = subprocess.run(cmd, capture_output=True, timeout=5)
                checks[tool] = result.returncode == 0 or Path(path).exists()

                # If failed, try without path
                if not checks[tool] and tool in ['adb', 'sdkmanager']:
                    cmd = [tool, '--version'] if tool != 'adb' else [tool, 'version']
                    result = subprocess.run(cmd, capture_output=True, timeout=5)
                    checks[tool] = result.returncode == 0
            except Exception:
                # Check if the file at least exists
                if Path(path).exists():
                    checks[tool] = True
                else:
                    checks[tool] = False

        return checks

    async def download_system_image(self, api_level: int) -> bool:
        """Download system image for specified API level"""
        if api_level not in self.SUPPORTED_API_LEVELS:
            logger.error(f"Unsupported API level: {api_level}")
            return False

        system_image = f"system-images;android-{api_level};google_apis;arm64-v8a"
        logger.info(f"Downloading system image: {system_image}")

        try:
            # Accept licenses first
            accept_cmd = subprocess.Popen(
                ['yes'],
                stdout=subprocess.PIPE
            )

            # Use full path to sdkmanager
            sdk_path = Path(os.environ.get('ANDROID_HOME', Path.home() / 'Library' / 'Android' / 'sdk'))
            sdkmanager_path = sdk_path / 'cmdline-tools' / 'latest' / 'bin' / 'sdkmanager'

            result = subprocess.run(
                [str(sdkmanager_path), '--licenses'],
                stdin=accept_cmd.stdout,
                capture_output=True,
                timeout=30
            )

            # Download system image
            result = subprocess.run(
                [str(sdkmanager_path), system_image],
                capture_output=True,
                text=True,
                timeout=600  # 10 minutes timeout
            )

            if result.returncode == 0:
                logger.info(f"System image downloaded: {system_image}")
                return True
            else:
                if "already installed" in result.stderr.lower():
                    logger.info(f"System image already installed: {system_image}")
                    return True
                logger.error(f"Failed to download system image: {result.stderr}")
                return False

        except subprocess.TimeoutExpired:
            logger.error("Timeout downloading system image")
            return False
        except Exception as e:
            logger.error(f"Error downloading system image: {e}")
            return False

    async def create_avd(self,
                        name: str,
                        api_level: int,
                        device_type: str = "pixel_5") -> bool:
        """Create an Android Virtual Device"""
        if api_level not in self.SUPPORTED_API_LEVELS:
            logger.error(f"Unsupported API level: {api_level}")
            return False

        logger.info(f"Creating AVD: {name} (API {api_level})")

        # Ensure system image is available
        if not await self.download_system_image(api_level):
            return False

        # Create AVD command with full path
        sdk_path = Path(os.environ.get('ANDROID_HOME', Path.home() / 'Library' / 'Android' / 'sdk'))
        avdmanager_path = sdk_path / 'cmdline-tools' / 'latest' / 'bin' / 'avdmanager'

        cmd = [
            str(avdmanager_path), 'create', 'avd',
            '-n', name,
            '-k', f"system-images;android-{api_level};google_apis;arm64-v8a",
            '-d', device_type,
            '--force'
        ]

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                input='\n',  # Default hardware profile
                timeout=30
            )

            if result.returncode == 0:
                logger.info(f"AVD created: {name}")

                # Configure AVD properties
                await self._configure_avd(name)
                return True
            else:
                logger.error(f"Failed to create AVD: {result.stderr}")
                return False

        except Exception as e:
            logger.error(f"Error creating AVD: {e}")
            return False

    async def _configure_avd(self, name: str):
        """Configure AVD properties for testing"""
        avd_path = Path.home() / ".android" / "avd" / f"{name}.avd"
        config_file = avd_path / "config.ini"

        if not config_file.exists():
            logger.warning(f"AVD config file not found: {config_file}")
            return

        try:
            # Read current config
            with open(config_file, 'r') as f:
                lines = f.readlines()

            # Update config
            config_updates = {
                'hw.ramSize': str(self.memory),
                'hw.gpu.enabled': 'yes',
                'hw.gpu.mode': self.gpu_mode,
                'hw.keyboard': 'yes',
                'hw.accelerometer': 'yes',
                'hw.battery': 'yes',
                'hw.camera.back': 'virtualscene',
                'hw.camera.front': 'emulated',
                'showDeviceFrame': 'no' if self.headless else 'yes'
            }

            # Apply updates
            updated_lines = []
            updated_keys = set()

            for line in lines:
                if '=' in line:
                    key = line.split('=')[0].strip()
                    if key in config_updates:
                        updated_lines.append(f"{key}={config_updates[key]}\n")
                        updated_keys.add(key)
                    else:
                        updated_lines.append(line)
                else:
                    updated_lines.append(line)

            # Add missing configurations
            for key, value in config_updates.items():
                if key not in updated_keys:
                    updated_lines.append(f"{key}={value}\n")

            # Write updated config
            with open(config_file, 'w') as f:
                f.writelines(updated_lines)

            logger.info(f"AVD configured: {name}")

        except Exception as e:
            logger.error(f"Failed to configure AVD: {e}")

    async def delete_avd(self, name: str) -> bool:
        """Delete an AVD"""
        logger.info(f"Deleting AVD: {name}")

        try:
            # Use full path to avdmanager
            sdk_path = Path(os.environ.get('ANDROID_HOME', Path.home() / 'Library' / 'Android' / 'sdk'))
            avdmanager_path = sdk_path / 'cmdline-tools' / 'latest' / 'bin' / 'avdmanager'

            result = subprocess.run(
                [str(avdmanager_path), 'delete', 'avd', '-n', name],
                capture_output=True,
                text=True,
                timeout=30
            )

            if result.returncode == 0:
                logger.info(f"AVD deleted: {name}")
                return True
            else:
                logger.error(f"Failed to delete AVD: {result.stderr}")
                return False

        except Exception as e:
            logger.error(f"Error deleting AVD: {e}")
            return False

    async def list_avds(self) -> List[Dict[str, str]]:
        """List all available AVDs with details"""
        try:
            # Use full path to emulator
            sdk_path = Path(os.environ.get('ANDROID_HOME', Path.home() / 'Library' / 'Android' / 'sdk'))
            emulator_path = sdk_path / 'emulator' / 'emulator'

            result = subprocess.run(
                [str(emulator_path), '-list-avds'],
                capture_output=True,
                text=True,
                timeout=5
            )

            if result.returncode == 0:
                avd_names = [name.strip() for name in result.stdout.strip().split('\n') if name]

                avds = []
                for name in avd_names:
                    # Get AVD info
                    info = await self._get_avd_info(name)
                    if info:
                        avds.append(info)

                return avds
            return []

        except Exception as e:
            logger.error(f"Error listing AVDs: {e}")
            return []

    async def _get_avd_info(self, name: str) -> Optional[Dict[str, str]]:
        """Get detailed information about an AVD"""
        avd_path = Path.home() / ".android" / "avd" / f"{name}.avd"
        config_file = avd_path / "config.ini"

        if not config_file.exists():
            return None

        try:
            with open(config_file, 'r') as f:
                config = {}
                for line in f:
                    if '=' in line:
                        key, value = line.strip().split('=', 1)
                        config[key] = value

            # Extract API level from image path
            image_path = config.get('image.sysdir.1', '')
            api_level = None
            if 'android-' in image_path:
                try:
                    api_level = int(image_path.split('android-')[1].split('/')[0])
                except Exception:
                    pass

            return {
                'name': name,
                'path': str(avd_path),
                'api_level': api_level,
                'android_version': self.API_VERSION_MAP.get(api_level, 'Unknown'),
                'ram': config.get('hw.ramSize', 'Unknown'),
                'device': config.get('hw.device.name', 'Unknown')
            }

        except Exception as e:
            logger.error(f"Error reading AVD info: {e}")
            return None

    async def start_emulator(self,
                           avd_name: str,
                           port: Optional[int] = None,
                           snapshot: Optional[str] = None) -> Optional[EmulatorInfo]:
        """Start an emulator instance"""
        logger.info(f"Starting emulator: {avd_name}")

        # Check if AVD exists
        avds = await self.list_avds()
        avd_info = next((avd for avd in avds if avd['name'] == avd_name), None)

        if not avd_info:
            logger.error(f"AVD not found: {avd_name}")
            return None

        # Build emulator command with full path
        sdk_path = Path(os.environ.get('ANDROID_HOME', Path.home() / 'Library' / 'Android' / 'sdk'))
        emulator_path = sdk_path / 'emulator' / 'emulator'
        cmd = [str(emulator_path), '-avd', avd_name]

        if self.headless:
            cmd.extend(['-no-window', '-no-audio', '-no-boot-anim'])

        if port:
            cmd.extend(['-port', str(port)])

        if snapshot:
            cmd.extend(['-snapshot', snapshot])

        # Additional optimizations
        cmd.extend([
            '-no-snapshot-save',  # Don't save snapshot on exit
            '-noaudio',
            '-no-boot-anim',
            '-accel', 'on',
            '-gpu', self.gpu_mode,
            '-memory', str(self.memory)
        ])

        try:
            # Get current devices before starting
            devices_before = await self._get_connected_devices()

            # Start emulator process
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )

            # Wait for emulator to appear
            serial = await self._wait_for_new_device(devices_before, timeout=120)

            if serial:
                emulator = EmulatorInfo(
                    name=avd_name,
                    serial=serial,
                    api_level=avd_info.get('api_level', 0),
                    status='starting',
                    start_time=datetime.now(),
                    process_id=process.pid
                )

                self.emulators[serial] = emulator

                # Wait for boot
                if await self._wait_for_boot(serial):
                    emulator.status = 'running'
                    logger.info(f"Emulator started: {serial}")
                    return emulator
                else:
                    logger.error(f"Emulator failed to boot: {serial}")
                    await self.stop_emulator(serial)
                    return None
            else:
                logger.error("Timeout waiting for emulator to start")
                process.terminate()
                return None

        except Exception as e:
            logger.error(f"Error starting emulator: {e}")
            return None

    async def _get_connected_devices(self) -> List[str]:
        """Get list of connected device serials"""
        try:
            result = subprocess.run(
                ['adb', 'devices'],
                capture_output=True,
                text=True,
                timeout=5
            )

            devices = []
            if result.returncode == 0:
                lines = result.stdout.strip().split('\n')[1:]  # Skip header
                for line in lines:
                    if line and '\t' in line:
                        serial, state = line.split('\t')
                        if state == 'device':
                            devices.append(serial)

            return devices

        except Exception as e:
            logger.error(f"Error getting devices: {e}")
            return []

    async def _wait_for_new_device(self,
                                  devices_before: List[str],
                                  timeout: int = 120) -> Optional[str]:
        """Wait for a new device to appear"""
        check_interval = 2
        waited = 0

        while waited < timeout:
            await asyncio.sleep(check_interval)
            waited += check_interval

            current_devices = await self._get_connected_devices()
            new_devices = set(current_devices) - set(devices_before)

            if new_devices:
                return list(new_devices)[0]

        return None

    async def _wait_for_boot(self, serial: str, timeout: int = 120) -> bool:
        """Wait for device to fully boot"""
        logger.info(f"Waiting for {serial} to boot...")

        check_interval = 3
        waited = 0

        while waited < timeout:
            # Check boot completed
            result = subprocess.run(
                ['adb', '-s', serial, 'shell', 'getprop', 'sys.boot_completed'],
                capture_output=True,
                text=True,
                timeout=5
            )

            if result.returncode == 0 and result.stdout.strip() == '1':
                # Also check if package manager is ready
                result = subprocess.run(
                    ['adb', '-s', serial, 'shell', 'pm', 'list', 'packages'],
                    capture_output=True,
                    timeout=5
                )

                if result.returncode == 0:
                    logger.info(f"Device {serial} booted successfully")
                    return True

            await asyncio.sleep(check_interval)
            waited += check_interval

        logger.error(f"Timeout waiting for {serial} to boot")
        return False

    async def stop_emulator(self, serial: str) -> bool:
        """Stop an emulator"""
        logger.info(f"Stopping emulator: {serial}")

        try:
            # Try graceful shutdown
            result = subprocess.run(
                ['adb', '-s', serial, 'emu', 'kill'],
                capture_output=True,
                timeout=10
            )

            if serial in self.emulators:
                emulator = self.emulators[serial]
                emulator.status = 'stopped'

                # Kill process if still running
                if emulator.process_id:
                    try:
                        subprocess.run(['kill', str(emulator.process_id)])
                    except Exception:
                        pass

                del self.emulators[serial]

            logger.info(f"Emulator stopped: {serial}")
            return True

        except Exception as e:
            logger.error(f"Error stopping emulator: {e}")
            return False

    async def stop_all_emulators(self):
        """Stop all running emulators"""
        serials = list(self.emulators.keys())
        for serial in serials:
            await self.stop_emulator(serial)

    async def take_snapshot(self, serial: str, name: str) -> bool:
        """Take a snapshot of emulator state"""
        logger.info(f"Taking snapshot: {name} for {serial}")

        try:
            result = subprocess.run(
                ['adb', '-s', serial, 'emu', 'avd', 'snapshot', 'save', name],
                capture_output=True,
                text=True,
                timeout=30
            )

            if result.returncode == 0:
                logger.info(f"Snapshot saved: {name}")
                return True
            else:
                logger.error(f"Failed to save snapshot: {result.stderr}")
                return False

        except Exception as e:
            logger.error(f"Error saving snapshot: {e}")
            return False

    async def restore_snapshot(self, serial: str, name: str) -> bool:
        """Restore emulator from snapshot"""
        logger.info(f"Restoring snapshot: {name} for {serial}")

        try:
            result = subprocess.run(
                ['adb', '-s', serial, 'emu', 'avd', 'snapshot', 'load', name],
                capture_output=True,
                text=True,
                timeout=30
            )

            if result.returncode == 0:
                logger.info(f"Snapshot restored: {name}")
                return True
            else:
                logger.error(f"Failed to restore snapshot: {result.stderr}")
                return False

        except Exception as e:
            logger.error(f"Error restoring snapshot: {e}")
            return False

    async def cleanup_test_avds(self, prefix: str = "test_android_"):
        """Clean up test AVDs"""
        logger.info("Cleaning up test AVDs...")

        avds = await self.list_avds()
        for avd in avds:
            if avd['name'].startswith(prefix):
                await self.delete_avd(avd['name'])

        logger.info("Cleanup complete")

    def get_emulator_info(self, serial: str) -> Optional[EmulatorInfo]:
        """Get information about a running emulator"""
        return self.emulators.get(serial)

    def list_running_emulators(self) -> List[EmulatorInfo]:
        """List all running emulators"""
        return list(self.emulators.values())