// rollup.config.cjs
const { babel } = require('@rollup/plugin-babel');
const commonjs = require('@rollup/plugin-commonjs');
const resolve = require('@rollup/plugin-node-resolve');
const path = require('path');

module.exports = {
    input: 'src/index.js',
    output: [
        // UMD格式：浏览器全局使用
        {
            file: 'dist/monitor-sdk.umd.js',
            format: 'umd',
            name: 'MonitorSDK',
            sourcemap: true,
            sourcemapFile: path.resolve(__dirname, 'dist/monitor-sdk.umd.js.map'),
            globals: {
                // 无外部依赖，留空（React由用户项目提供，不打包进SDK）
            },
        },
        // ES模块格式：React/Vue项目import导入
        {
            file: 'dist/monitor-sdk.esm.js',
            format: 'es',
            sourcemap: true,
            sourcemapFile: path.resolve(__dirname, 'dist/monitor-sdk.esm.js.map'),
        },
    ],
    plugins: [
        resolve({
            browser: true,
            preferBuiltins: false,
        }),
        commonjs(),
        babel({
            babelHelpers: 'bundled',
            presets: [
                ['@babel/preset-react', { runtime: 'automatic' }], // 自动处理React导入
                ['@babel/preset-env', { targets: 'last 2 versions, > 1%, not dead' }] // 兼容主流浏览器
            ],
            exclude: 'node_modules/**',
        }),
    ],
    external: [], // SDK不依赖外部库，所有依赖由用户项目提供
};