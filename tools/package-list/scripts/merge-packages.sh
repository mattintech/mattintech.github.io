#!/bin/bash
#
# Merge Package JSON Files
# Combines multiple device exports into a single packages.json
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
    echo "Run ./collect-packages.sh first to collect packages from a device."
    exit 1
fi

echo -e "${GREEN}Found package files:${NC}"
for f in $JSON_FILES; do
    COUNT=$(jq 'length' "$f")
    echo -e "  ${YELLOW}$(basename "$f")${NC} ($COUNT packages)"
done
echo ""

echo -e "${GREEN}Merging packages...${NC}"

# Merge all JSON files, combining OEMs for duplicate packages
jq -s '
  flatten |
  group_by(.package) |
  map({
    package: .[0].package,
    name: (if (map(select(.name != .package)) | length) > 0 then (map(select(.name != .package)) | .[0].name) else .[0].name end),
    description: (if (map(select(.description != "")) | length) > 0 then (map(select(.description != "")) | .[0].description) else "" end),
    system: (map(.system) | any),
    oems: (map(.oems) | flatten | unique | sort),
    category: .[0].category,
    playStore: (map(.playStore) | any)
  }) |
  sort_by(.package)
' $JSON_FILES > "$OUTPUT_FILE"

TOTAL=$(jq 'length' "$OUTPUT_FILE")
OEMS=$(jq '[.[].oems] | flatten | unique | sort' "$OUTPUT_FILE")

echo -e "${GREEN}Done!${NC}"
echo ""
echo -e "Merged output: ${YELLOW}$OUTPUT_FILE${NC}"
echo -e "Total unique packages: ${YELLOW}$TOTAL${NC}"
echo -e "OEMs included: ${YELLOW}$OEMS${NC}"
echo ""
echo "Review the merged file and:"
echo "  1. Fill in missing descriptions"
echo "  2. Verify playStore flags"
echo "  3. Check app names are correct"
