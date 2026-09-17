const { withMainActivity, withAndroidManifest } = require('@expo/config-plugins');

/**
 * Expo Config Plugin to:
 * 1. Register HealthConnectPermissionDelegate in MainActivity.kt
 *    This initializes the ActivityResultLauncher required by react-native-health-connect
 *    so the native "Allow SOMNiA to access your fitness and wellness data?" dialog displays.
 * 2. Ensure AndroidManifest.xml includes Health Connect package visibility queries
 *    and the Android 14+ VIEW_PERMISSION_USAGE intent filter.
 */
const withHealthConnectDelegate = (config) => {
  // 1. Configure MainActivity.kt
  config = withMainActivity(config, (config) => {
    let contents = config.modResults.contents;

    // Inject imports
    if (!contents.includes('dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate')) {
      contents = contents.replace(
        /package [^\n]+/,
        (match) => `${match}\n\nimport android.os.Bundle\nimport dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate`
      );
    }

    // Inject delegate registration
    if (!contents.includes('HealthConnectPermissionDelegate.setPermissionDelegate')) {
      if (/super\.onCreate\s*\([^\)]*\)/.test(contents)) {
        contents = contents.replace(
          /super\.onCreate\s*\([^\)]*\)/,
          (match) => `${match}\n    HealthConnectPermissionDelegate.setPermissionDelegate(this)`
        );
      } else {
        contents = contents.replace(
          /class MainActivity[^{]*{/,
          (match) => `${match}\n  override fun onCreate(savedInstanceState: Bundle?) {\n    super.onCreate(savedInstanceState)\n    HealthConnectPermissionDelegate.setPermissionDelegate(this)\n  }\n`
        );
      }
    }

    config.modResults.contents = contents;
    return config;
  });

  // 2. Configure AndroidManifest.xml
  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    // Ensure <queries> contains com.google.android.apps.healthdata for Android 11-13 visibility
    if (!manifest.queries) {
      manifest.queries = [];
    }
    const hasHealthDataQuery = manifest.queries.some((q) =>
      q.package && q.package.some((p) => p.$ && p.$['android:name'] === 'com.google.android.apps.healthdata')
    );
    if (!hasHealthDataQuery) {
      manifest.queries.push({
        package: [{ $: { 'android:name': 'com.google.android.apps.healthdata' } }],
      });
    }

    // Ensure main activity has VIEW_PERMISSION_USAGE intent filter for Android 14+
    const mainActivity = manifest.application?.[0]?.activity?.[0];
    if (mainActivity) {
      if (!mainActivity['intent-filter']) {
        mainActivity['intent-filter'] = [];
      }
      const hasUsageFilter = mainActivity['intent-filter'].some(
        (f) =>
          f.action &&
          f.action.some((a) => a.$ && a.$['android:name'] === 'android.intent.action.VIEW_PERMISSION_USAGE')
      );
      if (!hasUsageFilter) {
        mainActivity['intent-filter'].push({
          action: [{ $: { 'android:name': 'android.intent.action.VIEW_PERMISSION_USAGE' } }],
          category: [{ $: { 'android:name': 'android.intent.category.HEALTH_PERMISSIONS' } }],
        });
      }
    }

    return config;
  });

  return config;
};

module.exports = withHealthConnectDelegate;
