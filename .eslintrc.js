module.exports = {
    "root": true,
    "env": {
        "browser": true,
        "es2020": true,
        "greasemonkey": true,
    },
    "extends": [
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended",
        "plugin:@typescript-eslint/recommended-requiring-type-checking",
    ],
    "parser": "@typescript-eslint/parser",
    "parserOptions": {
        "ecmaVersion": 2020,
        "sourceType": "module",
        "tsconfigRootDir": __dirname,
        "project": ["./tsconfig.json"],
    },
    "plugins": [
        "@typescript-eslint"
    ],
    "rules": {
        "indent": ["error", 4],
        "quotes": ["error", "double"],
        "semi": ["error", "always"],
        "@typescript-eslint/no-unused-vars": "warn",
    },
    "reportUnusedDisableDirectives": true,
};
