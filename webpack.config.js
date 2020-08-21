module.exports = {
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx']
    },
    mode: 'development', // TODO: switch to production
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/
        },
        {
          test: /\.less$/,
          use: [
            {
              loader: 'style-loader', // CommonJs -> style nodes
            },
            {
              loader: 'css-loader', // CSS -> CommonJS
            },
            {
              loader: 'less-loader', //  Less -> CSS
            }
          ],
          exclude: /node_modules/
        }
      ]
    }
};