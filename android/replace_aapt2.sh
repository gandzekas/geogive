#!/data/data/com.termux/files/usr/bin/bash
# Replace all x86_64 aapt2 binaries in Gradle cache with aarch64 version from Termux

AAPT2_SRC="/data/data/com.termux/files/usr/bin/aapt2"
CACHE_DIRS=(
    "/data/data/com.termux/files/home/.gradle/caches"
)

echo "Scanning for aapt2 binaries in Gradle cache..."

for CACHE_DIR in "${CACHE_DIRS[@]}"; do
    if [[ -d "$CACHE_DIR" ]]; then
        find "$CACHE_DIR" -name "aapt2" -type f -executable 2>/dev/null | while read -r AAPT2_FILE; do
            if file "$AAPT2_FILE" | grep -q "x86-64"; then
                echo "Replacing x86_64 aapt2: $AAPT2_FILE"
                cp "$AAPT2_SRC" "$AAPT2_FILE"
                chmod +x "$AAPT2_FILE"
            fi
        done
    fi
done

echo "aapt2 replacement complete."