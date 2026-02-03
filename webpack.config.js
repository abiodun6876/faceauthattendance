// If using Create React App, create a config-overrides.js file
const path = require('path');

module.exports = function override(config, env) {
  // Add fallback for Node.js core modules
  config.resolve.fallback = {
    ...config.resolve.fallback,
    "fs": false,
    "path": false,
    "os": false,
    "crypto": false,
    "stream": false,
    "http": false,
    "https": false,
    "zlib": false,
    "net": false,
    "tls": false,
    "child_process": false,
    "worker_threads": false
  };

  // Add externals to ignore these modules
  config.externals = config.externals || [];
  config.externals.push({
    'fs': 'commonjs fs',
    'path': 'commonjs path'
  });

  return config;
};