# ProGuard rules for GeoGive TWA
#
# Keep web-related classes used by android-browser-helper
-keep class com.google.androidbrowserhelper.** { *; }
-dontwarn com.google.androidbrowserhelper.**

# Keep classes that interact with the web view
-keep class androidx.browser.customtabs.** { *; }

# Supabase client (accessed via JS interface if needed)
-keep class com.supabase.** { *; }
