#include <unistd.h>
#include <stdio.h>

int main(int argc, char *argv[]) {
    // Path to the real aapt2 (aarch64 version from termux)
    const char *real_aapt2 = "/data/data/com.termux/files/usr/bin/aapt2";
    execv(real_aapt2, argv);
    // If execv returns, it failed
    perror("execv failed");
    return 1;
}