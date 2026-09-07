const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Allow bundling TFLite model files as binary assets
config.resolver.assetExts.push('tflite');

// NativeWind 4.2 — pass output: 'native' explicitly for React Native targets
module.exports = withNativeWind(config, {
  input: './global.css',
  output: 'native',
});
