const path = require('path');

const environment = process.env.NODE_ENV;
const isProduction = environment === 'production';

module.exports = {
  mode: environment || 'development',
  devtool: isProduction ? undefined : 'inline-source-map',
  devServer: {
    host: '0.0.0.0',
    static: path.join(__dirname, 'public'),
    port: 8082
  },
  resolve: {
    fallback: {
      // these packages are needed by cap-ts
      // as it's built for node-js environments
      "stream": require.resolve('stream-browserify'),
      "timers": require.resolve('timers-browserify'),
      "buffer": require.resolve('buffer'),
    },
  },
  module: {
    rules: [
      {
        test: /\.m?js/,
        resolve: {
          fullySpecified: false
        }
      }
    ]
  }
}