// config-overrides.js in project root
const path = require('path');

module.exports = function override(config, env) {
  // Add resolve fallbacks
  config.resolve.fallback = {
    ...config.resolve.fallback,
    "fs": false,
    "path": false,
    "os": false,
    "crypto": false,
    "stream": false,
    "http": false,
    "https": false,
    "zlib": false
  };

  // Add externals to prevent bundling
  config.externals = config.externals || [];
  config.externals.push('fs');
  config.externals.push('path');
  config.externals.push('os');

  return config;
};