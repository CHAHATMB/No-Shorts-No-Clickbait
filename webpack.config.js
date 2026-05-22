const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = (env) => {
  const browser = env.browser || 'chrome';

  return {
    mode: 'production',
    entry: {
      background: './src/background.js',
      content: './src/content.js',
      popup: './src/popup.js',
    },
    output: {
      path: path.resolve(__dirname, 'dist', browser),
      filename: '[name].js',
      clean: true,
    },
    optimization: {
      minimize: false, // Keep it readable for now
    },
    plugins: [
      new CopyPlugin({
        patterns: [
          {
            from: `manifest.${browser}.json`,
            to: 'manifest.json',
          },
          { from: 'src/styles.css', to: 'styles.css' },
          { from: 'src/popup.html', to: 'popup.html' },
          { from: 'src/index.html', to: 'index.html' },
          { from: 'src/icons', to: 'icons' },
        ],
      }),
    ],
  };
};
