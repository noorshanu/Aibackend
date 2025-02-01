import globals from "globals";
import pluginJs from "@eslint/js";
import pluginReact from "eslint-plugin-react";

/** @type {import('eslint').Linter.Config[]} */
export default [
  {files: ["**/*.{js,mjs,cjs,jsx}"]},
  {
    languageOptions: {
      globals: {
        ...globals.browser, // Keep browser globals for frontend code
        ...globals.node, // Add node globals for backend code
      },
    },
  },
  pluginJs.configs.recommended,
  pluginReact.configs.flat.recommended,
];

module.exports = {
  env: {
    node: true, // This tells ESLint that you're in a Node.js environment
    es2020: true, // Enable ECMAScript 2020 features
  },
  // other rules and configurations...
};
