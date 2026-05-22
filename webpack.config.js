const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = (env, argv) => {
  const mode = argv.mode || 'production';

  const createConfig = (browser) => ({
    name: browser,
    mode: mode,
    devtool: mode === 'development' ? 'inline-source-map' : false,
    entry: {
      background: mode === 'development' 
        ? ['./src/hot-reload.js', './src/background.js'] 
        : './src/background.js',
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
      // Custom plugin to generate a timestamp file for auto-reloading
      {
        apply: (compiler) => {
          compiler.hooks.emit.tap('AutoReloadPlugin', (compilation) => {
            if (mode === 'development') {
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
