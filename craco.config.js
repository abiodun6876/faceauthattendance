// craco.config.js
module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Add resolve fallbacks
      webpackConfig.resolve.fallback = {
        ...webpackConfig.resolve.fallback,
        "fs": false,
        "path": false,
        "os": false,
        "crypto": false,
        "stream": false
      };

      return webpackConfig;
    }
  }
};