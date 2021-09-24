const path = require('path');

const environment = process.env.NODE_ENV;
const isProduction = environment === 'production';

module.exports = {
  mode: environment || 'development',
  devtool: isProduction ? undefined : 'inline-source-map',
  devServer: {
    host: '0.0.0.0',
    contentBase: path.join(__dirname, 'public'),
    port: 8082
  }
}