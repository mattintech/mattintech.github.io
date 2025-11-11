#!/usr/bin/env python3
"""
Command Analyzer and Optimizer
Analyzes commands.json to suggest optimal version groupings
"""

import json
from pathlib import Path
from typing import Dict, List, Tuple, Set
from collections import defaultdict

class CommandAnalyzer:
    def __init__(self, commands_file="../data/commands.json"):
        self.commands_file = Path(__file__).parent.parent / 'data' / 'commands.json'
        self.commands = self.load_commands()

        # API level mappings
        self.api_to_version = {
            14: '4.0', 15: '4.0.3', 16: '4.1', 17: '4.2', 18: '4.3', 19: '4.4',
            21: '5.0', 22: '5.1',
            23: '6.0',
            24: '7.0', 25: '7.1',
            26: '8.0', 27: '8.1',
            28: '9.0', 29: '10.0',
            30: '11.0', 31: '12.0', 32: '12L', 33: '13.0',
            34: '14.0', 35: '15.0', 36: '16.0',
        }

        self.version_to_api = {v: k for k, v in self.api_to_version.items()}
        # Add simplified versions
        self.version_to_api.update({
            '9': 28, '10': 29, '11': 30, '12': 31, '13': 33,
            '14': 34, '15': 35, '16': 36
        })

    def load_commands(self) -> List[Dict]:
        """Load commands from JSON file"""
        with open(self.commands_file, 'r') as f:
            return json.load(f)

    def analyze_multiversion_commands(self):
        """Analyze multi-version commands for optimization opportunities"""
        print("\n=== MULTI-VERSION COMMAND ANALYSIS ===\n")

        for cmd in self.commands:
            if not cmd.get('multiVersion'):
                continue

            print(f"Command: {cmd['title']} (ID: {cmd['id']})")
            print(f"Category: {cmd['category']}")

            versions = cmd.get('versions', [])
            if not versions:
                print("  No versions found!\n")
                continue

            # Analyze command similarity
            command_groups = self.group_similar_commands(versions)

            if len(command_groups) < len(versions):
                print(f"  Current: {len(versions)} separate version entries")
                print(f"  Could be: {len(command_groups)} groups\n")

                print("  Suggested groupings:")
                for group in command_groups:
                    ranges = [v['range'] for v in group['versions']]
                    consolidated_range = self.suggest_range(ranges)
                    print(f"    • {consolidated_range}:")
                    print(f"      Windows: {group['windows']}")
                    print(f"      Mac: {group['mac']}")

            else:
                print(f"  ✓ Already optimally grouped ({len(versions)} unique commands)\n")

    def group_similar_commands(self, versions: List[Dict]) -> List[Dict]:
        """Group versions with identical commands"""
        groups = []

        for version in versions:
            # Check if this command already exists in a group
            found = False
            for group in groups:
                if (group['windows'] == version.get('windows') and
                    group['mac'] == version.get('mac')):
                    group['versions'].append(version)
                    found = True
                    break

            if not found:
                # Create new group
                groups.append({
                    'windows': version.get('windows'),
                    'mac': version.get('mac'),
                    'versions': [version]
                })

        return groups

    def suggest_range(self, ranges: List[str]) -> str:
        """Suggest an optimal range string for grouped versions"""
        # Parse all ranges to get API levels
        api_levels = set()

        for range_str in ranges:
            if '+' in range_str:
                # e.g., "12+"
                base = range_str.replace('+', '')
                base_api = self.version_to_api.get(base, 0)
                # Add a range of APIs
                api_levels.update(range(base_api, 37))  # Up to API 36
            elif ' - ' in range_str:
                # e.g., "4.0 - 10.0"
                parts = range_str.split(' - ')
                start_api = self.version_to_api.get(parts[0], 0)
                end_api = self.version_to_api.get(parts[1], 36)
                api_levels.update(range(start_api, end_api + 1))
            else:
                # Single version
                api = self.version_to_api.get(range_str, 0)
                if api:
                    api_levels.add(api)

        if not api_levels:
            return " + ".join(ranges)

        # Convert back to version range
        min_api = min(api_levels)
        max_api = max(api_levels)

        # Check if it's continuous
        expected_apis = set(range(min_api, max_api + 1))
        if api_levels == expected_apis:
            # Continuous range
            min_ver = self.api_to_version.get(min_api, str(min_api))

            # Simplify version numbers
            min_ver = self.simplify_version(min_ver)

            if max_api == 36:  # Latest version
                return f"{min_ver}+"
            else:
                max_ver = self.api_to_version.get(max_api, str(max_api))
                max_ver = self.simplify_version(max_ver)
                return f"{min_ver} - {max_ver}"
        else:
            # Non-continuous, list them
            versions = []
            for api in sorted(api_levels):
                ver = self.api_to_version.get(api, str(api))
                versions.append(self.simplify_version(ver))
            return ", ".join(versions)

    def simplify_version(self, version: str) -> str:
        """Simplify version string (e.g., '12.0' -> '12')"""
        if version.endswith('.0') and len(version) > 3:
            return version[:-2]
        return version

    def check_command_consistency(self):
        """Check for potential issues in command definitions"""
        print("\n=== COMMAND CONSISTENCY CHECK ===\n")

        issues_found = False

        for cmd in self.commands:
            if cmd.get('multiVersion'):
                versions = cmd.get('versions', [])

                # Check for overlapping ranges
                for i, v1 in enumerate(versions):
                    for j, v2 in enumerate(versions[i+1:], i+1):
                        if self.ranges_overlap(v1['range'], v2['range']):
                            print(f"⚠ Overlapping ranges in '{cmd['title']}':")
                            print(f"  Version {i+1}: {v1['range']}")
                            print(f"  Version {j+1}: {v2['range']}")
                            issues_found = True

                # Check for gaps in coverage
                gaps = self.find_coverage_gaps(versions)
                if gaps:
                    print(f"⚠ Coverage gaps in '{cmd['title']}':")
                    print(f"  Missing Android versions: {', '.join(gaps)}")
                    issues_found = True

        if not issues_found:
            print("✓ No consistency issues found!")

    def ranges_overlap(self, range1: str, range2: str) -> bool:
        """Check if two version ranges overlap"""
        apis1 = self.parse_range_to_apis(range1)
        apis2 = self.parse_range_to_apis(range2)
        return bool(apis1 & apis2)

    def parse_range_to_apis(self, range_str: str) -> Set[int]:
        """Parse a range string to a set of API levels"""
        apis = set()

        if range_str == 'All':
            return set(range(14, 37))
        elif '+' in range_str:
            base = range_str.replace('+', '')
            base_api = self.version_to_api.get(base, 0)
            apis.update(range(base_api, 37))
        elif ' - ' in range_str:
            parts = range_str.split(' - ')
            start_api = self.version_to_api.get(parts[0], 0)
            end_api = self.version_to_api.get(parts[1], 36)
            apis.update(range(start_api, end_api + 1))
        else:
            api = self.version_to_api.get(range_str, 0)
            if api:
                apis.add(api)

        return apis

    def find_coverage_gaps(self, versions: List[Dict]) -> List[str]:
        """Find gaps in version coverage"""
        covered_apis = set()

        for version in versions:
            covered_apis.update(self.parse_range_to_apis(version['range']))

        # Check for gaps between API 14 (4.0) and 36 (16.0)
        all_apis = set(range(14, 37))
        missing_apis = all_apis - covered_apis

        # Convert to version strings
        missing_versions = []
        for api in sorted(missing_apis):
            ver = self.api_to_version.get(api, f"API {api}")
            missing_versions.append(self.simplify_version(ver))

        return missing_versions

    def suggest_consolidation(self):
        """Provide specific consolidation recommendations"""
        print("\n=== CONSOLIDATION RECOMMENDATIONS ===\n")

        for cmd in self.commands:
            if not cmd.get('multiVersion'):
                continue

            versions = cmd.get('versions', [])
            if len(versions) <= 2:
                continue

            # Group by command
            command_groups = self.group_similar_commands(versions)

            if len(command_groups) < len(versions):
                print(f"Command: {cmd['title']} (ID: {cmd['id']})")
                print(f"Current structure has {len(versions)} entries")
                print(f"Recommended structure with {len(command_groups)} entries:\n")

                print("  \"versions\": [")
                for i, group in enumerate(command_groups):
                    ranges = [v['range'] for v in group['versions']]
                    consolidated_range = self.suggest_range(ranges)

                    # Get the best notes
                    all_notes = [v.get('notes', '') for v in group['versions'] if v.get('notes')]
                    notes = all_notes[0] if all_notes else ""

                    print("    {")
                    print(f'      "range": "{consolidated_range}",')
                    print(f'      "windows": "{group["windows"]}",')
                    print(f'      "mac": "{group["mac"]}",')
                    print(f'      "notes": "{notes}"')

                    if i < len(command_groups) - 1:
                        print("    },")
                    else:
                        print("    }")
                print("  ]\n")

def main():
    analyzer = CommandAnalyzer()

    print("=" * 70)
    print("ADB COMMAND STRUCTURE ANALYZER")
    print("=" * 70)

    # Run analysis
    analyzer.analyze_multiversion_commands()
    analyzer.check_command_consistency()
    analyzer.suggest_consolidation()

    print("\n" + "=" * 70)
    print("Analysis complete!")

if __name__ == '__main__':
    main()