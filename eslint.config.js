import {defineConfig, globalIgnores } from "eslint/config";
import eslint from "@eslint/js";
import tsEslint from "typescript-eslint";

export default defineConfig([
    globalIgnores(["dist/", "node_modules/"]),
    {
        files: ["**/*.{js,ts}"],
        languageOptions: {
            parserOptions: {
                ecmaVersion: "latest",
                sourceType: "module"
            },
            globals: {
                // add any globals you use (e.g. browser, node) if needed
            },
        },
        extends: [
            eslint.configs.recommended,
            tsEslint.configs.recommended
        ],
        rules: {
            "@typescript-eslint/no-explicit-any":  "off"
        }
    }
]);
