const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Add support for assets in node_modules
config.resolver.assetExts.push('png');
config.resolver.sourceExts.push('mjs', 'cjs');

// Configure the app root
config.resolver.extraNodeModules = {
  'expo-router': path.resolve(__dirname, 'node_modules/expo-router'),
};

// Ensure node_modules is properly watched
config.watchFolders = [
  __dirname,
  path.resolve(__dirname, 'node_modules'),
  path.resolve(__dirname, 'src/app')
];

module.exports = config; 