#!/bin/bash
#
# Android Package Collector
# Collects preloaded system packages from connected Android device
# Outputs JSON for the package-list tool
#
# Usage: ./collect-packages.sh [oem-name]
# Example: ./collect-packages.sh pixel
#          ./collect-packages.sh samsung
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check for ADB
if ! command -v adb &> /dev/null; then
    echo -e "${RED}Error: ADB not found. Please install Android SDK platform-tools.${NC}"
    exit 1
fi

# Check for connected device
DEVICE_COUNT=$(adb devices | grep -c "device$" || true)
if [ "$DEVICE_COUNT" -eq 0 ]; then
    echo -e "${RED}Error: No Android device connected.${NC}"
    echo "Please connect a device with USB debugging enabled."
    exit 1
elif [ "$DEVICE_COUNT" -gt 1 ]; then
    echo -e "${YELLOW}Multiple devices detected. Using first device.${NC}"
    echo "For specific device, use: ANDROID_SERIAL=<device_id> ./collect-packages.sh"
fi

# Get device info
echo -e "${GREEN}Collecting device information...${NC}"
MANUFACTURER=$(adb shell getprop ro.product.manufacturer 2>/dev/null | tr -d '\r\n' | tr '[:upper:]' '[:lower:]')
MODEL=$(adb shell getprop ro.product.model 2>/dev/null | tr -d '\r\n')
ANDROID_VERSION=$(adb shell getprop ro.build.version.release 2>/dev/null | tr -d '\r\n')
BUILD_ID=$(adb shell getprop ro.build.id 2>/dev/null | tr -d '\r\n')

# OEM override from argument
OEM_NAME="${1:-$MANUFACTURER}"
OEM_NAME=$(echo "$OEM_NAME" | tr '[:upper:]' '[:lower:]')

echo -e "  Manufacturer: ${YELLOW}$MANUFACTURER${NC}"
echo -e "  Model: ${YELLOW}$MODEL${NC}"
echo -e "  Android: ${YELLOW}$ANDROID_VERSION${NC}"
echo -e "  Build: ${YELLOW}$BUILD_ID${NC}"
echo -e "  OEM Tag: ${YELLOW}$OEM_NAME${NC}"
echo ""

# Output file
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_DIR="$SCRIPT_DIR/../data"
OUTPUT_FILE="$OUTPUT_DIR/packages-${OEM_NAME}-$(date +%Y%m%d).json"
TEMP_FILE=$(mktemp)

# Check for aapt2 (for extracting app labels)
AAPT2_PATH=""
if command -v aapt2 &> /dev/null; then
    AAPT2_PATH="aapt2"
elif [ -n "$ANDROID_HOME" ] && [ -f "$ANDROID_HOME/build-tools/$(ls -1 $ANDROID_HOME/build-tools 2>/dev/null | tail -1)/aapt2" ]; then
    AAPT2_PATH="$ANDROID_HOME/build-tools/$(ls -1 $ANDROID_HOME/build-tools | tail -1)/aapt2"
fi

if [ -n "$AAPT2_PATH" ]; then
    echo -e "${GREEN}Found aapt2 - will extract app labels${NC}"
else
    echo -e "${YELLOW}aapt2 not found - will use package names as labels${NC}"
    echo "To get proper app names, install Android SDK build-tools"
fi
echo ""

# Get system packages (preloaded only, excludes user-installed)
echo -e "${GREEN}Collecting system packages...${NC}"
PACKAGES=$(adb shell pm list packages -s 2>/dev/null | sed 's/package://' | tr -d '\r' | sort)
PACKAGE_COUNT=$(echo "$PACKAGES" | wc -l | tr -d ' ')
echo -e "  Found ${YELLOW}$PACKAGE_COUNT${NC} system packages"
echo ""

# Function to get app label from APK
get_app_label() {
    local pkg="$1"
    local label=""

    if [ -n "$AAPT2_PATH" ]; then
        # Get APK path
        local apk_path=$(adb shell pm path "$pkg" 2>/dev/null | head -1 | sed 's/package://' | tr -d '\r')

        if [ -n "$apk_path" ]; then
            # Pull APK to temp location
            local temp_apk=$(mktemp).apk
            if adb pull "$apk_path" "$temp_apk" &>/dev/null; then
                # Extract label using aapt2
                label=$("$AAPT2_PATH" dump badging "$temp_apk" 2>/dev/null | grep "application-label:" | head -1 | sed "s/application-label:'//" | sed "s/'$//" | tr -d '\r')
                rm -f "$temp_apk"
            fi
        fi
    fi

    # Fallback: create readable name from package
    if [ -z "$label" ]; then
        # com.google.android.apps.photos -> Photos
        label=$(echo "$pkg" | rev | cut -d'.' -f1 | rev)
        # Capitalize first letter
        label="$(tr '[:lower:]' '[:upper:]' <<< ${label:0:1})${label:1}"
    fi

    echo "$label"
}

# Function to determine category from package name
get_category() {
    local pkg="$1"

    if [[ "$pkg" == com.google.* ]]; then
        echo "google"
    elif [[ "$pkg" == com.android.* ]]; then
        echo "android"
    elif [[ "$pkg" == com.samsung.* ]]; then
        echo "samsung"
    elif [[ "$pkg" == com.sec.* ]]; then
        echo "samsung"
    elif [[ "$pkg" == com.oneplus.* ]]; then
        echo "oneplus"
    elif [[ "$pkg" == com.xiaomi.* ]] || [[ "$pkg" == com.miui.* ]]; then
        echo "xiaomi"
    elif [[ "$pkg" == com.motorola.* ]]; then
        echo "motorola"
    elif [[ "$pkg" == com.qualcomm.* ]] || [[ "$pkg" == com.qti.* ]]; then
        echo "qualcomm"
    else
        echo "other"
    fi
}

# Check if app is likely on Play Store
has_play_store() {
    local pkg="$1"

    # These prefixes typically have Play Store listings
    if [[ "$pkg" == com.google.android.apps.* ]] || \
       [[ "$pkg" == com.google.android.gms* ]] || \
       [[ "$pkg" == com.android.chrome* ]] || \
       [[ "$pkg" == com.google.android.youtube* ]]; then
        echo "true"
    else
        echo "false"
    fi
}

# Build JSON
echo -e "${GREEN}Processing packages...${NC}"
echo "[" > "$TEMP_FILE"

COUNTER=0
TOTAL=$PACKAGE_COUNT

for pkg in $PACKAGES; do
    COUNTER=$((COUNTER + 1))

    # Progress indicator
    printf "\r  Processing: %d/%d - %s                    " "$COUNTER" "$TOTAL" "$pkg"

    # Get app details
    APP_LABEL=$(get_app_label "$pkg")
    CATEGORY=$(get_category "$pkg")
    PLAY_STORE=$(has_play_store "$pkg")

    # Add comma for all but first entry
    if [ "$COUNTER" -gt 1 ]; then
        echo "," >> "$TEMP_FILE"
    fi

    # Write JSON object
    cat >> "$TEMP_FILE" << EOF
  {
    "package": "$pkg",
    "name": "$APP_LABEL",
    "description": "",
    "system": true,
    "oems": ["$OEM_NAME"],
    "category": "$CATEGORY",
    "playStore": $PLAY_STORE
  }
EOF

done

echo "" # New line after progress
echo "]" >> "$TEMP_FILE"

# Move to output
mv "$TEMP_FILE" "$OUTPUT_FILE"

echo ""
echo -e "${GREEN}Done!${NC}"
echo -e "Output: ${YELLOW}$OUTPUT_FILE${NC}"
echo ""
echo "Next steps:"
echo "  1. Review the JSON and fill in descriptions for important apps"
echo "  2. Adjust 'playStore' flags for apps with Play Store listings"
echo "  3. Run on other devices to collect more OEM packages"
echo "  4. Merge JSON files using: ./merge-packages.sh"
