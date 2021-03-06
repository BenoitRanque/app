const
  fs = require('fs'),
  path = require('path'),
  chalk = require('chalk'),
  webpack = require('webpack'),
  ProgressBarPlugin = require('progress-bar-webpack-plugin'),
  HtmlWebpackPlugin = require('html-webpack-plugin')

const
  appPaths = require('./app-paths'),
  cssUtils = require('./get-css-utils')

function getHeadScripts (cfg) {
  let output = ''
  if (cfg.ctx.mode.electron && cfg.ctx.dev) {
    output += `
      <script>
        require('module').globalPaths.push('${appPaths.resolve.app('node_modules').replace(/\\/g, '\\\\')}')
      </script>
    `
  }
  return output
}

function getBodyScripts (cfg) {
  let output = ''
  if (cfg.ctx.mode.cordova) {
    output += `<script type="text/javascript" src="cordova.js"></script>`
  }
  if (cfg.ctx.dev) {
    output += `
      <script>
        console.info('[Quasar] Running ${cfg.ctx.modeName.toUpperCase()} with ${cfg.ctx.themeName.toUpperCase()} theme.')
      </script>
    `
  }
  if (cfg.ctx.mode.pwa) {
    if (cfg.ctx.dev) {
      output += `
        <script>
          ${fs.readFileSync(appPaths.resolve.pwa('service-worker-dev.js'), 'utf-8')}
        </script>
      `
    }
    else {
      const load = cfg.build.minify
        ? require('./load-minified')
        : file => fs.readFileSync(file, 'utf-8')

      output += `
        <script>
          ${load(appPaths.resolve.pwa('service-worker-prod.js'))}
        </script>
      `
    }
  }
  if (cfg.ctx.mode.electron && cfg.ctx.prod) {
    // set statics path in production;
    // the reason we add this is here is because the folder path
    // needs to be evaluated at runtime
    output += `
      <script>
        window.__statics = require('path').join(__dirname, 'statics').replace(/\\\\/g, '\\\\')
      </script>
    `
  }
  return output
}

module.exports = function (cfg) {
  const webpackConfig = {
    entry: {
      app: [ appPaths.entryFile ]
    },
    devtool: cfg.build.sourceMap ? cfg.build.devtool : false,
    resolve: {
      extensions: [
        '.js', '.vue', '.json'
      ],
      modules: [
        appPaths.resolve.app('node_modules'),
        appPaths.resolve.cli('node_modules')
      ],
      alias: {
        quasar: appPaths.resolve.cli(`node_modules/quasar-framework/dist/quasar.${cfg.ctx.themeName}.esm.js`),
        'quasar-styl': appPaths.resolve.cli(`node_modules/quasar-framework/dist/quasar.${cfg.ctx.themeName}.styl`),
        variables: appPaths.resolve.src(`themes/app.variables.styl`),
        '~': appPaths.srcDir,
        '@': appPaths.resolve.src(`components`),
        layouts: appPaths.resolve.src(`layouts`),
        pages: appPaths.resolve.src(`pages`),
        assets: appPaths.resolve.src(`assets`)
      }
    },
    resolveLoader: {
      modules: [
        appPaths.resolve.app('node_modules'),
        appPaths.resolve.cli('node_modules')
      ]
    },
    module: {
      rules: [
        {
          test: /\.vue$/,
          loader: 'vue-loader',
          options: {
            loaders: cssUtils.cssLoaders({
              sourceMap: cfg.build.sourceMap,
              extract: cfg.build.extractCSS,
              minimize: cfg.build.minify
            }),
            transformToRequire: {
              video: 'src',
              source: 'src',
              img: 'src',
              image: 'xlink:href'
            }
          }
        },
        {
          test: /\.js$/,
          loader: 'babel-loader',
          include: [
            appPaths.srcDir,
            appPaths.entryFile
          ]
        },
        {
          test: /\.json$/,
          loader: 'json-loader'
        },
        {
          test: /\.(png|jpe?g|gif|svg)(\?.*)?$/,
          loader: 'url-loader',
          options: {
            limit: 10000,
            name: 'img/[name].[hash:7].[ext]'
          }
        },
        {
          test: /\.(woff2?|eot|ttf|otf)(\?.*)?$/,
          loader: 'url-loader',
          options: {
            limit: 10000,
            name: 'fonts/[name].[hash:7].[ext]'
          }
        },
        {
          test: /\.(mp4|webm|ogg|mp3|wav|flac|aac)(\?.*)?$/,
          loader: 'url-loader',
          options: {
            limit: 10000,
            name: 'media/[name].[hash:7].[ext]'
          }
        }
      ]
    },
    plugins: [
      new webpack.DefinePlugin(cfg.build.env),
      new ProgressBarPlugin({
        format: ` [:bar] ${chalk.bold(':percent')} (:msg)`
      }),
      // https://github.com/ampedandwired/html-webpack-plugin
      new HtmlWebpackPlugin({
        filename: cfg.ctx.dev
          ? 'index.html'
          : path.join(appPaths.resolve.app(cfg.build.distDir), cfg.build.htmlFilename),
        template: appPaths.resolve.src(`index.template.html`),
        minify: cfg.build.minify
          ? {
            removeComments: true,
            collapseWhitespace: true,
            removeAttributeQuotes: true
            // more options:
            // https://github.com/kangax/html-minifier#options-quick-reference
          }
          : undefined,
        // necessary to consistently work with multiple chunks via CommonsChunkPlugin
        chunksSortMode: cfg.ctx.prod ? 'dependency' : undefined,
        // inject script tags for bundle
        inject: true,

        // custom ones
        ctx: cfg.ctx,
        appBase: cfg.build.appBase,
        pwaManifest: cfg.pwa.manifest,
        headScripts: getHeadScripts(cfg),
        bodyScripts: getBodyScripts(cfg)
      })
    ],
    performance: {
      hints: false,
      maxAssetSize: 500000
    }
  }

  // inject CSS loaders for outside of .vue
  webpackConfig.module.rules = webpackConfig.module.rules.concat(
    cssUtils.styleLoaders({
      sourceMap: cfg.build.sourceMap,
      extract: cfg.build.extractCSS,
      minimize: cfg.build.minify
    })
  )

  if (cfg.ctx.mode.electron) {
    webpackConfig.node = {
      __dirname: cfg.ctx.dev,
      __filename: cfg.ctx.dev
    }
    webpackConfig.resolve.extensions.push('.node')
    webpackConfig.target = 'electron-renderer'
  }

  // DEVELOPMENT build
  if (cfg.ctx.dev) {
    const FriendlyErrorsPlugin = require('friendly-errors-webpack-plugin')

    webpackConfig.plugins.push(
      new webpack.NoEmitOnErrorsPlugin(),
      new FriendlyErrorsPlugin({
        compilationSuccessInfo: ['spa', 'pwa'].includes(cfg.ctx.modeName) ? {
          messages: [
            `App [${chalk.red(cfg.ctx.modeName.toUpperCase())} with ${chalk.red(cfg.ctx.themeName.toUpperCase())} theme] at ${cfg.build.APP_URL}\n`
          ],
        } : undefined,
        onErrors: cfg.build.useNotifier
          ? (severity, errors) => {
            if (severity !== 'error') {
              return
            }

            const error = errors[0]
            require('../helpers/notifier')({
              message: `${severity}:${error.name}`,
              subtitle: error.file.split('!').pop()
            })
          }
          : undefined,
        clearConsole: true
      })
    )

    if (cfg.devServer.hot) {
      require('webpack-dev-server').addDevServerEntrypoints(webpackConfig, cfg.devServer)
      webpackConfig.plugins.push(
        new webpack.NamedModulesPlugin(), // HMR shows filenames in console on update
        new webpack.HotModuleReplacementPlugin()
      )
    }
  }
  // PRODUCTION build
  else {
    const
      vendorAdd = cfg.vendor && cfg.vendor.add ? cfg.vendor.add.filter(v => v) : false,
      vendorRemove = cfg.vendor && cfg.vendor.remove ? cfg.vendor.remove.filter(v => v) : false

    // generate dist files
    webpackConfig.output = {
      path: appPaths.resolve.app(cfg.build.distDir),
      publicPath: cfg.build.publicPath,
      filename: `js/[name]${cfg.build.webpackManifest ? '' : '.[chunkhash]'}.js`,
      chunkFilename: 'js/[id].[chunkhash].js',
      libraryTarget: cfg.ctx.mode.electron
        ? 'commonjs2'
        : undefined
    }

    webpackConfig.plugins.push(
      // keep module.id stable when vendor modules does not change
      new webpack.HashedModuleIdsPlugin(),

      // split vendor js into its own file
      new webpack.optimize.CommonsChunkPlugin({
        name: 'vendor',
        minChunks (module) {
          if (vendorAdd && module.resource && vendorAdd.some(v => module.resource.indexOf(v) > -1)) {
            return true
          }
          if (vendorRemove && module.resource && vendorRemove.some(v => module.resource.indexOf(v) > -1)) {
            return false
          }
          // A module is extracted into the vendor chunk when...
          return (
            // It's a JS file
            /\.js$/.test(module.resource) &&
            (
              // If it's inside node_modules
              /node_modules/.test(module.context) ||
              // or it's Quasar internals (while developing)
              /\/quasar\//.test(module.resource)
            )
          )
        }
      })
    )

    // extract webpack runtime and module manifest to its own file in order to
    // prevent vendor hash = require(being updated whenever app bundle is updated
    if (cfg.build.webpackManifest) {
      webpackConfig.plugins.push(
        new webpack.optimize.CommonsChunkPlugin({
          name: 'manifest',
          chunks: ['vendor']
        })
      )
    }

    // copy statics to dist folder
    const CopyWebpackPlugin = require('copy-webpack-plugin')
    webpackConfig.plugins.push(
      new CopyWebpackPlugin([
        {
          from: appPaths.resolve.src(`statics`),
          to: path.join(appPaths.resolve.app(cfg.build.distDir), 'statics'),
          ignore: ['.*']
        }
      ])
    )

    // Scope hoisting ala Rollupjs
    // https://webpack.js.org/plugins/module-concatenation-plugin/
    if (cfg.build.scopeHoisting) {
      webpackConfig.plugins.push(new webpack.optimize.ModuleConcatenationPlugin())
    }

    if (cfg.build.minify) {
      const UglifyJSPlugin = require('uglifyjs-webpack-plugin')

      webpackConfig.plugins.push(
        new UglifyJSPlugin({
          parallel: true,
          sourceMap: cfg.build.sourceMap
        })
      )
    }

    // configure CSS extraction & optimize
    if (cfg.build.extractCSS) {
      const ExtractTextPlugin = require('extract-text-webpack-plugin')

      // extract css into its own file
      webpackConfig.plugins.push(
        new ExtractTextPlugin({
          filename: '[name].[contenthash].css'
        })
      )

      // dedupe CSS & minimize only if minifying
      if (cfg.build.minify) {
        const OptimizeCSSPlugin = require('optimize-css-assets-webpack-plugin')

        webpackConfig.plugins.push(
          // Compress extracted CSS. We are using this plugin so that possible
          // duplicated CSS = require(different components) can be deduped.
          new OptimizeCSSPlugin({
            cssProcessorOptions: cfg.build.sourceMap
              ? { safe: true, map: { inline: false } }
              : { safe: true }
          })
        )
      }
    }

    if (cfg.ctx.mode.pwa) {
      const SWPrecacheWebpackPlugin = require('sw-precache-webpack-plugin')

      webpackConfig.plugins.push(
        // service worker caching
        new SWPrecacheWebpackPlugin({
          cacheId: cfg.pwa.cacheId,
          filename: cfg.pwa.filename,
          staticFileGlobs: [`${cfg.build.distDir}/**/*.{${cfg.pwa.cacheExt}}`],
          minify: cfg.build.minify,
          stripPrefix: cfg.build.distDir + '/'
        }),

        // write manifest.json file
        {
          apply (compiler) {
            compiler.plugin('emit', (compilation, callback) => {
              const source = JSON.stringify(cfg.pwa.manifest)

              compilation.assets['manifest.json'] = {
                source: () => new Buffer(source),
                size: () => Buffer.byteLength(source)
              }

              callback()
            })
          }
        }
      )
    }

    // also produce a gzipped version
    if (cfg.build.gzip) {
      const CompressionWebpackPlugin = require('compression-webpack-plugin')

      webpackConfig.plugins.push(
        new CompressionWebpackPlugin(cfg.build.gzip)
      )
    }

    if (cfg.build.analyze) {
      const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin
      webpackConfig.plugins.push(
        new BundleAnalyzerPlugin(Object.assign({}, cfg.build.analyze))
      )
    }
  }

  return webpackConfig
}
