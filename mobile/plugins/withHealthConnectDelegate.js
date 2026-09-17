const { withMainActivity } = require('@expo/config-plugins');

/**
 * Expo Config Plugin to register HealthConnectPermissionDelegate in MainActivity.kt
 * This is required by react-native-health-connect to initialize the ActivityResultLauncher
 * for requestPermission() so it can display the native "Allow SOMNiA to access your fitness and wellness data?" dialog.
 */
const withHealthConnectDelegate = (config) => {
  return withMainActivity(config, (config) => {
    let contents = config.modResults.contents;

    // 1. Inject import
    if (!contents.includes('dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate')) {
      contents = contents.replace(
        /package [^\n]+/,
        (match) => `${match}\n\nimport dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate`
      );
    }

    // 2. Inject delegate registration in onCreate
    if (!contents.includes('HealthConnectPermissionDelegate.setPermissionDelegate')) {
      contents = contents.replace(
        /super\.onCreate\([^\)]*\)/,
        (match) => `${match}\n    HealthConnectPermissionDelegate.setPermissionDelegate(this)`
      );
    }

    config.modResults.contents = contents;
    return config;
  });
};

module.exports = withHealthConnectDelegate;
