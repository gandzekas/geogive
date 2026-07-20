#!/data/data/com.termux/files/usr/bin/bash
# Continuously replace x86_64 aapt2 binaries in Gradle cache with aarch64 version

AAPT2_SRC="/data/data/com.termux/files/usr/bin/aapt2"
CACHE_DIR="/data/data/com.termux/files/home/.gradle/caches"

echo "Starting aapt2 replacement daemon..."
echo "Watching: $CACHE_DIR"
echo "Source aapt2: $AAPT2_SRC"

while true; do
    find "$CACHE_DIR" -name "aapt2" -type f -executable 2>/dev/null | while read -r AAPT2_FILE; do
        if file "$AAPT2_FILE" 2>/dev/null | grep -q "x86-64"; then
            echo "[$(date '+%H:%M:%S')] Replacing x86_64 aapt2: $AAPT2_FILE"
            cp "$AAPT2_SRC" "$AAPT2_FILE"
            chmod +x "$AAPT2_FILE"
        fi
    done
    sleep 0.5
done