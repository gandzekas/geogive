#!/data/data/com.termux/files/usr/bin/bash
# aapt2 wrapper that delegates to the system aarch64 aapt2
LOG_FILE=/tmp/aapt2_wrapper.log
echo "Wrapper called with args: $@" >> $LOG_FILE
echo "REAL_AAPT2: $REAL_AAPT2" >> $LOG_FILE

# Find the real aapt2 binary (Termux aarch64 version)
REAL_AAPT2="/data/data/com.termux/files/usr/bin/aapt2"

# If the real aapt2 doesn't exist, fall back to any aapt2 in PATH
if [[ ! -x "$REAL_AAPT2" ]]; then
    REAL_AAPT2=$(command -v aapt2 2>/dev/null | head -1)
fi

# Execute the real aapt2 with all arguments
exec "$REAL_AAPT2" "$@"