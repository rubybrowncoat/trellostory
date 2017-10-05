const path = require('path')
const webpack = require('webpack')

const ExtractTextPlugin = require('extract-text-webpack-plugin')

const NotifierPlugin = require('./utility/webpack/notifier/notifier-plugin')

const ExtractCss = new ExtractTextPlugin({
  filename: 'index.css',
  allChunks: true,
})

const plugins = [
  ExtractCss,

  new webpack.optimize.ModuleConcatenationPlugin(),
  new webpack.NamedModulesPlugin(),

  new NotifierPlugin(),
]

module.exports = function webpackStuff(env) {
  const nodeEnv = env && env.prod ? 'production' : 'development'
  const isProd = nodeEnv === 'production'

  plugins.push(
    new webpack.DefinePlugin({
      'process.env': { NODE_ENV: JSON.stringify(nodeEnv) },
    }),
  )

  if (isProd) {
    //
  }

  return {
    devtool: isProd ? '' : 'eval',
    entry: ['babel-polyfill', './src/index.js', './src/index.scss'],

    output: {
      filename: 'index.js',
      path: path.resolve(__dirname, './dist'),
    },

    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /(node_modules|bower_components)/,
          use: {
            loader: 'babel-loader',
          },
        },
        {
          test: /\.s?(c|a)ss$/,
          use: ExtractCss.extract({
            fallback: 'style-loader',
            use: 'css-loader!sass-loader',
          }),
        },
      ],
    },

    devServer: {
      contentBase: 'dist/',
    },

    resolve: {
      extensions: ['.webpack-loader.js', '.web-loader.js', '.loader.js', '.js'],
      modules: [path.resolve(__dirname, 'node_modules')],
      alias: {
        '@src': path.join(__dirname, './src'),
      },
    },

    node: {
      fs: 'empty',
    },

    plugins,
  }
}
