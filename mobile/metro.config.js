const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add support for .bin files (TensorFlow.js model weights)
config.resolver.assetExts.push('bin');

module.exports = config;
