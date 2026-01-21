#!/bin/bash
#
# Merge Package JSON Files
# Combines multiple device exports into a single packages.json
# Handles new format from Android app: { device: {...}, packages: [...] }
# Merges OEM arrays for packages found on multiple devices
#
# Usage: ./merge-packages.sh
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="$SCRIPT_DIR/../data"
OUTPUT_FILE="$DATA_DIR/packages.json"

# Check for jq
if ! command -v jq &> /dev/null; then
    echo -e "${RED}Error: jq is required for merging JSON files.${NC}"
    echo "Install with: brew install jq (macOS) or apt install jq (Linux)"
    exit 1
fi

# Find all package JSON files (excluding the merged output)
JSON_FILES=$(find "$DATA_DIR" -name "packages-*.json" -type f 2>/dev/null | sort)

if [ -z "$JSON_FILES" ]; then
    echo -e "${RED}No package files found in $DATA_DIR${NC}"
    echo "Export packages from the Android app first."
    exit 1
fi

echo -e "${GREEN}Found package files:${NC}"
for f in $JSON_FILES; do
    # Handle both old format (array) and new format (object with device/packages)
    IS_NEW_FORMAT=$(jq 'has("device")' "$f")
    if [ "$IS_NEW_FORMAT" = "true" ]; then
        OEM=$(jq -r '.device.manufacturer' "$f")
        MODEL=$(jq -r '.device.model' "$f")
        COUNT=$(jq '.packages | length' "$f")
        SYSTEM_COUNT=$(jq '[.packages[] | select(.system == true)] | length' "$f")
        echo -e "  ${YELLOW}$(basename "$f")${NC} - $OEM $MODEL ($SYSTEM_COUNT system / $COUNT total)"
    else
        COUNT=$(jq 'length' "$f")
        echo -e "  ${YELLOW}$(basename "$f")${NC} ($COUNT packages, old format)"
    fi
done
echo ""

echo -e "${GREEN}Merging packages (system apps + OEM apps)...${NC}"

# Process each file: extract packages, add OEM, filter system only
# Then merge all together
jq -s '
  # Process each input file
  map(
    # Check if new format (has device object) or old format (array)
    if type == "object" and has("device") then
      # New format: extract OEM and map packages
      .device.manufacturer as $oem |
      .packages | map(
        select(.system == true or .category == "samsung") |
        {
          package: .package,
          name: .name,
          description: (.description // ""),
          system: true,
          oems: [$oem],
          category: (.category // "other"),
          playStore: (if .package | test("^com\\.google\\.android\\.apps\\.") then true elif .package | test("^com\\.android\\.chrome") then true else false end)
        }
      )
    else
      # Old format: already an array with oems
      map(select(.system == true))
    end
  ) |
  # Flatten all arrays into one
  flatten |
  # Group by package name
  group_by(.package) |
  # For each group, merge the entries
  map({
    package: .[0].package,
    name: (map(select(.name != .package)) | if length > 0 then .[0].name else .[0].name end),
    description: (map(select(.description != null and .description != "")) | if length > 0 then .[0].description else "" end),
    system: true,
    oems: (map(.oems) | flatten | unique | sort),
    category: (map(select(.category != null and .category != "other")) | if length > 0 then .[0].category else .[0].category end),
    playStore: (map(.playStore) | any)
  }) |
  # Sort by package name
  sort_by(.package)
' $JSON_FILES > "$OUTPUT_FILE"

TOTAL=$(jq 'length' "$OUTPUT_FILE")
OEMS=$(jq -r '[.[].oems] | flatten | unique | sort | join(", ")' "$OUTPUT_FILE")
PLAY_STORE=$(jq '[.[] | select(.playStore == true)] | length' "$OUTPUT_FILE")

echo -e "${GREEN}Done!${NC}"
echo ""
echo -e "Merged output: ${YELLOW}$OUTPUT_FILE${NC}"
echo -e "Total unique system packages: ${YELLOW}$TOTAL${NC}"
echo -e "OEMs included: ${YELLOW}$OEMS${NC}"
echo -e "With Play Store links: ${YELLOW}$PLAY_STORE${NC}"
