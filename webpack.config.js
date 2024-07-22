// eslint-disable-next-line no-undef
const webpack = require('webpack');
module.exports = {
    resolve: {
        extensions: [".ts", ".tsx", ".js", ".jsx"],
        fallback: {
            "crypto": require.resolve("crypto-browserify"),
            "http": require.resolve("stream-http"),
            "https": require.resolve("https-browserify"),
            "vm": require.resolve("vm-browserify"),
            "buffer": require.resolve("buffer"),
            "querystring": require.resolve("querystring-es3"),
            "stream": require.resolve("stream-browserify"),
            "url": require.resolve("url")

        }
    },
    plugins: [
        new webpack.ProvidePlugin({
            process: "process/browser",
            Buffer: ["buffer", "Buffer"]
        })

    ],
    mode: "production",
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
