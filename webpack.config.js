'use strict'

const path = require('path')
const webpack = require('webpack')
const FriendlyErrorsPlugin = require('friendly-errors-webpack-plugin')
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer')
	.BundleAnalyzerPlugin
const CopyWebpackPlugin = require('copy-webpack-plugin')
const ZipPlugin = require('zip-webpack-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const ScriptExtHtmlWebpackPlugin = require('script-ext-html-webpack-plugin')
const HtmlWebpackIncludeAssetsPlugin = require('html-webpack-include-assets-plugin')
const HtmlWebpackHarddiskPlugin = require('html-webpack-harddisk-plugin')
const UglifyJSPlugin = require('uglifyjs-webpack-plugin')
// const ButternutWebpackPlugin = require('butternut-webpack-plugin').default
// const BabiliPlugin = require('babili-webpack-plugin')
const WriteFilePlugin = require('write-file-webpack-plugin')
// const PrepackWebpackPlugin = require('prepack-webpack-plugin').default

const ENV = process.env.NODE_ENV
const isProd = ENV === 'production'

// by using min versions we speed up HMR
function getMin(module) {
	return path.resolve(__dirname, `node_modules/${module}/dist/${module}.min.js`)
}
const preactCompat = isProd ? 'preact-compat' : getMin('preact-compat') // if we take the min build in prod we also include prop-types

var html = {
	title: 'Improved Layout for Instagram',
	template: 'index.ejs',
	alwaysWriteToDisk: true
}

if (isProd) {
	html.minify = {}
	html.hash = true
}

var plugins = [
	new webpack.DefinePlugin({
		'process.env': JSON.stringify({ NODE_ENV: ENV }), // Preact checkks for `!process.env`
		'process.env.NODE_ENV': JSON.stringify(ENV),
		'typeof window': JSON.stringify('object'),
		'typeof process': JSON.stringify('0'), // Preact checks for `type process === 'undefined'`
		POLYFILL_OBJECT_ASSIGN: false,
		POLYFILL_OBJECT_VALUES: false,
		POLYFILL_PROMISES: false,
		POLYFILL_FETCH: false,
		POLYFILL_URL: false
	}),
	new HtmlWebpackPlugin(html),
	new CopyWebpackPlugin([
		{ from: '../node_modules/bootstrap/dist/css/bootstrap.min.css' },
		{ from: '*.html' },
		{ from: '*.json' },
		{ from: 'img/*.png' },
		{ from: 'content/*' },
		{ from: '_locales/**' }
	]),
	new HtmlWebpackHarddiskPlugin(),
	new ScriptExtHtmlWebpackPlugin({
		defaultAttribute: 'async',
		preload: ['.js', '.css']
	})
]

if (isProd) {
	plugins.push(
		new HtmlWebpackIncludeAssetsPlugin({
			assets: ['bootstrap.min.css'],
			append: false,
			hash: true
		}),
		new webpack.LoaderOptionsPlugin({
			minimize: true,
			debug: false
		}),
		new webpack.NormalModuleReplacementPlugin(/process/, path.resolve(__dirname, 'noop.js')),
		// new webpack.optimize.ModuleConcatenationPlugin(), // @todo: Soon available in webpack
		new UglifyJSPlugin(), // doesn't support "async", so watch out
		// new ButternutWebpackPlugin(), // slightly larger than uglify
		// new BabiliPlugin(),
		// new PrepackWebpackPlugin({ prepack: { delayUnsupportedRequires: true } }), // doesn't support `class` yet
		new BundleAnalyzerPlugin({
			analyzerMode: 'static',
			openAnalyzer: false,
			reportFilename: '../report.html'
		}),
		new ZipPlugin({ filename: 'dist.zip', path: '../' })
	)
} else {
	plugins.push(
		new FriendlyErrorsPlugin(),
		new webpack.NamedModulesPlugin(),
		new WriteFilePlugin({
			test: /(content\/|manifest.json)/,
			useHashIndex: true
		}),
		new HtmlWebpackIncludeAssetsPlugin({
			assets: ['bootstrap.min.css'],
			append: false
		})
	)
}

module.exports = {
	context: path.join(__dirname, 'src'),

	entry: isProd ? './' : [
		'webpack/hot/only-dev-server',
		// bundle the client for hot reloading
		// only- means to only hot reload for successful updates
		'./'
	],

	target: 'web',
	output: {
		path: path.join(__dirname, 'dist'),
		publicPath: isProd ? '/' : 'http://localhost:8080/',
		filename: 'bundle.js'
	},

	module: {
		rules: [
			{
				test: /\.jsx?$/i,
				exclude: /(node_modules|bower_components)/,
				loader: 'babel-loader',
				options: {
					presets: [
						['env', {
							modules: false,
							targets: isProd ? { chrome: 55 } : {
								browsers: 'last 2 Chrome versions'
							},
							loose: true,
							useBuiltIns: false
						}],
						'stage-1'
					],
					plugins: isProd ? [
						['transform-react-jsx', { pragma: 'h', useBuiltIns: true }],
						['transform-imports', {
							reactstrap: {
								transform: 'reactstrap/lib/${member}',
								preventFullImport: true
							},
							history: {
								transform: 'history/es/${member}',
								preventFullImport: true
							}
						}],
						'transform-react-constant-elements',
						['transform-react-remove-prop-types', { removeImport: true, additionalLibraries: ['react-immutable-proptypes'] }],

						// 'module:fast-async', - enabled from Chrome 55
						'loop-optimizer',
						'closure-elimination',
						['transform-es2015-block-scoping', { throwIfClosureRequired: true }],
						'./pure-plugin.js'
					] : [
							['transform-react-jsx', { pragma: 'h', useBuiltIns: true }]
							// 'runtyper'
						],
					cacheDirectory: true
				}
			}
		],
		noParse: [ // faster HMR
			new RegExp(getMin('preact-compat')),
			new RegExp('proptypes/disabled')
		]
	},

	resolve: {
		alias: {
			react: preactCompat,
			'react-dom': preactCompat,
			'preact-compat': preactCompat,
			'react-addons-css-transition-group': isProd ? 'preact-css-transition-group' : getMin('preact-css-transition-group'),
			'react-addons-transition-group': isProd ? 'preact-transition-group' : getMin('preact-transition-group'),
			'prop-types$': isProd ? 'proptypes/disabled' : 'prop-types'
		}
	},

	devtool: isProd ? false /*'cheap-module-source-map'*/ : 'cheap-module-inline-source-map',

	devServer: {
		contentBase: path.join(__dirname, 'dist/'),
		compress: true,
		historyApiFallback: true,
		hot: true,
		// hotOnly: true,
		publicPath: '/',
		overlay: true,
		watchContentBase: true,
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
			'Access-Control-Allow-Headers': 'X-Requested-With, content-type, Authorization'
		}
	},

	plugins
}
