module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "google",
  ],
  rules: {
    quotes: ["error", "double"],
    indent: ["error", 2], // Enforce 2-space indentation
    "max-len": ["error", {code: 120}], // Corrected: 'code' property is no longer quoted
    "no-unused-vars": "warn", // Warn for unused variables
    "comma-dangle": ["error", "always-multiline"], // Allows trailing commas for cleaner diffs
    "object-curly-spacing": ["error", "never"], // Ensure no spaces within curly braces.
    "quote-props": ["error", "as-needed"], // Prefer unquoted properties when valid.
  },
  parserOptions: {
    ecmaVersion: 2020, // Allows parsing of modern JavaScript features
  },
};
