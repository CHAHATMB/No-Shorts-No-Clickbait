const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const webpack = require('webpack');

module.exports = (env = {}, argv = {}) => {
  const mode = argv.mode || 'production';
  const isDev = mode === 'development';

  const createConfig = (browser) => ({
    name: browser,
    mode: mode,
    devtool: isDev ? 'inline-source-map' : false,
    entry: {
      background: isDev 
        ? ['./src/hot-reload.js', './src/background.js'] 
        : './src/background.js',
      content: './src/content.js',
      popup: './src/popup.js',
      'productivity-content': './src/productivity-content.js',
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
      new webpack.DefinePlugin({
        __DEV__: JSON.stringify(isDev),
      }),
      new CopyPlugin({
        patterns: [
          {
            from: `manifest.${browser}.json`,
            to: 'manifest.json',
          },
          { from: 'src/styles.css', to: 'styles.css' },
          { from: 'src/modules/mascot/mascot-styles.css', to: 'mascot-styles.css' },
          {
            from: 'src/popup.html',
            to: 'popup.html',
            transform(content) {
              if (!isDev) {
                // Strip dev-only blocks in production builds
                return content
                  .toString()
                  .replace(/<!--\s*DEV_ONLY_START\s*-->[\s\S]*?<!--\s*DEV_ONLY_END\s*-->/g, '');
              }
              return content;
            },
          },
          { from: 'src/index.html', to: 'index.html' },
          { from: 'src/icons', to: 'icons' },
          { from: 'mascots/walk_animation_asset', to: 'mascots/finn' },
          { from: 'mascots/shime1.png', to: 'mascots/shime1.png' },
          { from: 'mascots/shime2.png', to: 'mascots/shime2.png' },
          { from: 'mascots/shime3.png', to: 'mascots/shime3.png' },
        ],
      }),
      // Custom plugin to generate a timestamp file for auto-reloading
      {
        apply: (compiler) => {
          compiler.hooks.emit.tap('AutoReloadPlugin', (compilation) => {
            if (isDev) {
              const json = JSON.stringify({ lastBuild: Date.now() });
              compilation.assets['updated.json'] = {
                source: () => json,
                size: () => json.length,
              };
            }
          });
        },
      },
    ],
  });

  if (env.browser) {
    return createConfig(env.browser);
  }

  // Build both by default if no browser env is specified
  return [createConfig('chrome'), createConfig('firefox')];
};
