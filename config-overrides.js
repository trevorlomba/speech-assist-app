console.log('config-overrides.js is being executed');

const path = require('path');

module.exports = function override(config, env) {
    console.log('Overriding Webpack config...');
    config.resolve.fallback = {
        ...config.resolve.fallback,
        "zlib": false,
        "stream": require.resolve("stream-browserify"),
        "path": require.resolve("path-browserify"),
        "fs": false, 
        "http": require.resolve("stream-http"),
        "querystring": require.resolve("querystring-es3"),
        "url": require.resolve("url/"),
        "timers": require.resolve("timers-browserify"),
        "crypto": require.resolve("crypto-browserify"),
        "process": require.resolve("process/browser"), 
        "vm": require.resolve("vm-browserify")
    };
    console.log('Webpack config overridden:', config.resolve.fallback);
    return config;
};