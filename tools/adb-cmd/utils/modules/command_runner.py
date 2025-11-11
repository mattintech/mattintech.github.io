"""
Command Runner Module
Executes ADB commands and captures output
"""

import asyncio
import logging
import subprocess
import time
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime
import re

logger = logging.getLogger(__name__)


@dataclass
class CommandResult:
    """Result of command execution"""
    command: str
    success: bool
    stdout: str
    stderr: str
    return_code: int
    execution_time: float
    timestamp: datetime
    device_serial: str
    api_level: Optional[int] = None
    screenshot_path: Optional[str] = None


class CommandRunner:
    """Executes ADB commands and captures results"""

    def __init__(self, timeout: int = 30, retry_attempts: int = 2):
        """Initialize command runner"""
        self.timeout = timeout
        self.retry_attempts = retry_attempts
        self.command_history = []

    async def execute_command(self,
                             command: str,
                             serial: str,
                             timeout: Optional[int] = None,
                             capture_screenshot: bool = False) -> CommandResult:
        """Execute a single ADB command"""
        timeout = timeout or self.timeout

        # Ensure command is properly formatted
        command = self._format_command(command, serial)

        logger.debug(f"Executing: {command}")

        # Try execution with retries
        for attempt in range(self.retry_attempts):
            result = await self._run_command(command, serial, timeout)

            if result.success or attempt == self.retry_attempts - 1:
                break

            logger.warning(f"Command failed (attempt {attempt + 1}/{self.retry_attempts}): {command}")
            await asyncio.sleep(2)  # Wait before retry

        # Capture screenshot if requested
        if capture_screenshot:
            screenshot_path = await self.capture_screenshot(serial)
            result.screenshot_path = screenshot_path

        # Store in history
        self.command_history.append(result)

        return result

    def _format_command(self, command: str, serial: str) -> str:
        """Format ADB command with device serial"""
        # Remove any existing 'adb' prefix
        if command.startswith('adb '):
            command = command[4:]

        # Check if serial is already specified
        if '-s' in command:
            return f"adb {command}"

        # Add serial specification
        return f"adb -s {serial} {command}"

    async def _run_command(self,
                          command: str,
                          serial: str,
                          timeout: int) -> CommandResult:
        """Run command and capture output"""
        start_time = time.time()

        try:
            # Run command
            if isinstance(command, str):
                process = await asyncio.create_subprocess_shell(
                    command,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
            else:
                process = await asyncio.create_subprocess_exec(
                    *command,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )

            # Wait for completion with timeout
            try:
                stdout, stderr = await asyncio.wait_for(
                    process.communicate(),
                    timeout=timeout
                )
            except asyncio.TimeoutError:
                process.kill()
                await process.communicate()
                raise subprocess.TimeoutExpired(command, timeout)

            execution_time = time.time() - start_time

            return CommandResult(
                command=command,
                success=(process.returncode == 0),
                stdout=stdout.decode('utf-8', errors='replace'),
                stderr=stderr.decode('utf-8', errors='replace'),
                return_code=process.returncode,
                execution_time=execution_time,
                timestamp=datetime.now(),
                device_serial=serial
            )

        except subprocess.TimeoutExpired:
            execution_time = time.time() - start_time
            return CommandResult(
                command=command,
                success=False,
                stdout="",
                stderr=f"Command timeout after {timeout} seconds",
                return_code=-1,
                execution_time=execution_time,
                timestamp=datetime.now(),
                device_serial=serial
            )

        except Exception as e:
            execution_time = time.time() - start_time
            return CommandResult(
                command=command,
                success=False,
                stdout="",
                stderr=str(e),
                return_code=-1,
                execution_time=execution_time,
                timestamp=datetime.now(),
                device_serial=serial
            )

    async def execute_shell_command(self,
                                  shell_command: str,
                                  serial: str,
                                  as_root: bool = False) -> CommandResult:
        """Execute a shell command on the device"""
        if as_root:
            command = f"shell su -c '{shell_command}'"
        else:
            command = f"shell {shell_command}"

        return await self.execute_command(command, serial)

    async def get_device_info(self, serial: str) -> Dict[str, str]:
        """Get comprehensive device information"""
        info = {
            'serial': serial,
            'model': '',
            'manufacturer': '',
            'android_version': '',
            'api_level': '',
            'build_id': '',
            'screen_resolution': '',
            'screen_density': ''
        }

        # Device properties to query
        props = {
            'model': 'ro.product.model',
            'manufacturer': 'ro.product.manufacturer',
            'android_version': 'ro.build.version.release',
            'api_level': 'ro.build.version.sdk',
            'build_id': 'ro.build.id'
        }

        for key, prop in props.items():
            result = await self.execute_command(
                f"shell getprop {prop}",
                serial
            )
            if result.success:
                info[key] = result.stdout.strip()

        # Get screen info
        result = await self.execute_command(
            "shell wm size",
            serial
        )
        if result.success and 'Physical size:' in result.stdout:
            info['screen_resolution'] = result.stdout.split('Physical size:')[1].strip()

        result = await self.execute_command(
            "shell wm density",
            serial
        )
        if result.success and 'Physical density:' in result.stdout:
            info['screen_density'] = result.stdout.split('Physical density:')[1].strip()

        return info

    async def check_command_availability(self,
                                        command: str,
                                        serial: str) -> bool:
        """Check if a command is available on the device"""
        # For shell commands, check if binary exists
        if command.startswith('shell '):
            binary = command.split()[1]
            result = await self.execute_command(
                f"shell which {binary}",
                serial
            )
            return result.success and result.stdout.strip()

        # For other commands, try help or version flag
        test_command = command.split()[0]
        for flag in ['--help', '-h', '--version', '-v']:
            result = await self.execute_command(
                f"{test_command} {flag}",
                serial
            )
            if result.success:
                return True

        return False

    async def capture_screenshot(self, serial: str) -> Optional[str]:
        """Capture a screenshot from the device"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        screenshot_path = f"/tmp/screenshot_{serial}_{timestamp}.png"

        try:
            # Capture screenshot on device
            device_path = f"/sdcard/screenshot_{timestamp}.png"
            result = await self.execute_command(
                f"shell screencap -p {device_path}",
                serial
            )

            if result.success:
                # Pull screenshot to host
                result = await self.execute_command(
                    f"pull {device_path} {screenshot_path}",
                    serial
                )

                if result.success:
                    # Clean up device screenshot
                    await self.execute_command(
                        f"shell rm {device_path}",
                        serial
                    )
                    logger.info(f"Screenshot captured: {screenshot_path}")
                    return screenshot_path

        except Exception as e:
            logger.error(f"Failed to capture screenshot: {e}")

        return None

    async def install_apk(self,
                         apk_path: str,
                         serial: str,
                         replace: bool = True) -> CommandResult:
        """Install an APK on the device"""
        flags = "-r" if replace else ""
        return await self.execute_command(
            f"install {flags} {apk_path}",
            serial
        )

    async def uninstall_package(self,
                               package_name: str,
                               serial: str) -> CommandResult:
        """Uninstall a package from the device"""
        return await self.execute_command(
            f"uninstall {package_name}",
            serial
        )

    async def list_packages(self,
                          serial: str,
                          system_only: bool = False,
                          third_party_only: bool = False) -> List[str]:
        """List installed packages"""
        flags = ""
        if system_only:
            flags = "-s"
        elif third_party_only:
            flags = "-3"

        result = await self.execute_command(
            f"shell pm list packages {flags}",
            serial
        )

        packages = []
        if result.success:
            for line in result.stdout.split('\n'):
                if line.startswith('package:'):
                    packages.append(line.replace('package:', '').strip())

        return packages

    async def push_file(self,
                       local_path: str,
                       device_path: str,
                       serial: str) -> CommandResult:
        """Push a file to the device"""
        return await self.execute_command(
            f"push {local_path} {device_path}",
            serial
        )

    async def pull_file(self,
                       device_path: str,
                       local_path: str,
                       serial: str) -> CommandResult:
        """Pull a file from the device"""
        return await self.execute_command(
            f"pull {device_path} {local_path}",
            serial
        )

    async def forward_port(self,
                         local_port: int,
                         device_port: int,
                         serial: str) -> CommandResult:
        """Forward a port from host to device"""
        return await self.execute_command(
            f"forward tcp:{local_port} tcp:{device_port}",
            serial
        )

    async def reverse_port(self,
                          device_port: int,
                          local_port: int,
                          serial: str) -> CommandResult:
        """Reverse a port from device to host"""
        return await self.execute_command(
            f"reverse tcp:{device_port} tcp:{local_port}",
            serial
        )

    async def get_logcat(self,
                        serial: str,
                        lines: int = 100,
                        filter_spec: Optional[str] = None) -> CommandResult:
        """Get logcat output"""
        command = f"logcat -d -t {lines}"
        if filter_spec:
            command += f" {filter_spec}"

        return await self.execute_command(command, serial)

    async def clear_logcat(self, serial: str) -> CommandResult:
        """Clear logcat buffer"""
        return await self.execute_command("logcat -c", serial)

    async def set_property(self,
                          prop_name: str,
                          prop_value: str,
                          serial: str) -> CommandResult:
        """Set a system property"""
        return await self.execute_shell_command(
            f"setprop {prop_name} {prop_value}",
            serial,
            as_root=True
        )

    async def get_property(self,
                          prop_name: str,
                          serial: str) -> Optional[str]:
        """Get a system property value"""
        result = await self.execute_shell_command(
            f"getprop {prop_name}",
            serial
        )

        if result.success:
            return result.stdout.strip()
        return None

    async def reboot_device(self,
                          serial: str,
                          mode: str = "") -> CommandResult:
        """Reboot the device"""
        if mode:
            return await self.execute_command(f"reboot {mode}", serial)
        return await self.execute_command("reboot", serial)

    async def get_battery_info(self, serial: str) -> Dict[str, str]:
        """Get battery information"""
        result = await self.execute_shell_command(
            "dumpsys battery",
            serial
        )

        battery_info = {}
        if result.success:
            for line in result.stdout.split('\n'):
                if ':' in line:
                    key, value = line.split(':', 1)
                    battery_info[key.strip()] = value.strip()

        return battery_info

    async def simulate_battery_level(self,
                                   level: int,
                                   serial: str) -> CommandResult:
        """Simulate battery level (for testing)"""
        return await self.execute_shell_command(
            f"dumpsys battery set level {level}",
            serial
        )

    async def get_network_info(self, serial: str) -> Dict[str, str]:
        """Get network information"""
        result = await self.execute_shell_command(
            "dumpsys connectivity",
            serial
        )

        network_info = {
            'wifi_connected': False,
            'mobile_connected': False,
            'airplane_mode': False
        }

        if result.success:
            if 'Wi-Fi is enabled' in result.stdout:
                network_info['wifi_connected'] = True
            if 'Mobile network is available' in result.stdout:
                network_info['mobile_connected'] = True

        # Check airplane mode
        airplane = await self.get_property(
            'persist.radio.airplane_mode_on',
            serial
        )
        network_info['airplane_mode'] = airplane == '1'

        return network_info

    async def toggle_wifi(self,
                         enable: bool,
                         serial: str) -> CommandResult:
        """Toggle WiFi on/off"""
        action = "enable" if enable else "disable"
        return await self.execute_shell_command(
            f"svc wifi {action}",
            serial,
            as_root=True
        )

    async def input_text(self,
                        text: str,
                        serial: str) -> CommandResult:
        """Input text to the device"""
        # Escape special characters
        escaped_text = text.replace(' ', '%s').replace("'", "\\'")
        return await self.execute_shell_command(
            f"input text '{escaped_text}'",
            serial
        )

    async def input_tap(self,
                       x: int,
                       y: int,
                       serial: str) -> CommandResult:
        """Simulate a tap at coordinates"""
        return await self.execute_shell_command(
            f"input tap {x} {y}",
            serial
        )

    async def input_swipe(self,
                         x1: int, y1: int,
                         x2: int, y2: int,
                         duration: int,
                         serial: str) -> CommandResult:
        """Simulate a swipe gesture"""
        return await self.execute_shell_command(
            f"input swipe {x1} {y1} {x2} {y2} {duration}",
            serial
        )

    async def input_keyevent(self,
                           keycode: str,
                           serial: str) -> CommandResult:
        """Send a key event to the device"""
        return await self.execute_shell_command(
            f"input keyevent {keycode}",
            serial
        )

    def get_command_history(self) -> List[CommandResult]:
        """Get command execution history"""
        return self.command_history

    def clear_history(self):
        """Clear command execution history"""
        self.command_history.clear()

    async def verify_output_pattern(self,
                                  command: str,
                                  serial: str,
                                  expected_pattern: str) -> Tuple[bool, str]:
        """Execute command and verify output matches expected pattern"""
        result = await self.execute_command(command, serial)

        if not result.success:
            return False, f"Command failed: {result.stderr}"

        # Check if pattern is found in output
        if re.search(expected_pattern, result.stdout, re.IGNORECASE):
            return True, "Pattern matched"

        return False, f"Pattern not found. Output: {result.stdout[:200]}..."