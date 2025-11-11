#!/usr/bin/env python3
"""
Script to update commands.json structure with verification fields
"""

import json
from pathlib import Path
from datetime import datetime

def add_verification_structure(commands):
    """Add verification structure to all commands"""
    updated_commands = []

    for cmd in commands:
        # Skip if already has verification (commands 1-3 already updated)
        if cmd['id'] <= 3:
            updated_commands.append(cmd)
            continue

        # Handle multiVersion commands
        if cmd.get('multiVersion'):
            # Add verification to each version
            if 'versions' in cmd:
                for version in cmd['versions']:
                    if 'verification' not in version:
                        version['verification'] = {
                            "verified": False,
                            "lastTested": None,
                            "testedVersions": {}
                        }

            # Add overall verification
            if 'verification' not in cmd:
                cmd['verification'] = {
                    "verified": False,
                    "lastTested": None,
                    "overallStatus": "untested"
                }
        else:
            # Standard command - add simple verification
            if 'verification' not in cmd:
                cmd['verification'] = {
                    "verified": False,
                    "lastTested": None,
                    "testedVersions": {}
                }

        updated_commands.append(cmd)

    return updated_commands

def create_backup(file_path):
    """Create timestamped backup of commands.json"""
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_dir = file_path.parent / 'backups'
    backup_dir.mkdir(exist_ok=True)

    backup_file = backup_dir / f'commands_{timestamp}.json'

    with open(file_path, 'r') as f:
        content = f.read()

    with open(backup_file, 'w') as f:
        f.write(content)

    print(f"Backup created: {backup_file}")
    return backup_file

def main():
    # Path to commands.json
    commands_file = Path(__file__).parent.parent / 'data' / 'commands.json'

    if not commands_file.exists():
        print(f"Error: {commands_file} not found")
        return

    # Create backup first
    backup_file = create_backup(commands_file)

    # Load current commands
    with open(commands_file, 'r') as f:
        commands = json.load(f)

    # Add verification structure
    updated_commands = add_verification_structure(commands)

    # Save updated commands
    with open(commands_file, 'w') as f:
        json.dump(updated_commands, f, indent=2)

    print(f"✓ Updated {len(updated_commands)} commands with verification structure")
    print(f"✓ Original backed up to: {backup_file}")

    # Show summary
    standard_count = sum(1 for cmd in updated_commands if not cmd.get('multiVersion'))
    multi_count = sum(1 for cmd in updated_commands if cmd.get('multiVersion'))
    print(f"\nCommand Summary:")
    print(f"  - Standard commands: {standard_count}")
    print(f"  - Multi-version commands: {multi_count}")
    print(f"  - Total: {len(updated_commands)}")

if __name__ == '__main__':
    main()