/* eslint-disable */
const webpack = require('webpack');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

// Set to 'server' to open interactive report, 'static' to generate HTML, or null to disable
const analyzeBundle = process.env.ANALYZE === 'true';

module.exports = {
    resolve: {
        extensions: [".ts", ".tsx", ".js", ".jsx"]
    },
    plugins: [
        // Bundle analyzer (enable with ANALYZE=true)
        ...(analyzeBundle ? [new BundleAnalyzerPlugin({
            analyzerMode: 'static',
            openAnalyzer: false,
            reportFilename: 'bundle-report.html'
        })] : [])
    ],
    mode: "production",
    optimization: {
        minimize: true,
        usedExports: true,
        sideEffects: false
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: "ts-loader",
                exclude: /node_modules/
            },
            {
                test: /\.less$/,
                use: [
                    {
                        loader: "style-loader", // CommonJs -> style nodes
                    },
                    {
                        loader: "css-loader", // CSS -> CommonJS
                    },
                    {
                        loader: "less-loader", //  Less -> CSS
                    }
                ],
                exclude: /node_modules/
            }
        ]
    }
};
