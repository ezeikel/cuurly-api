module.exports = {
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  extends: ["airbnb-base", "plugin:prettier/recommended"],
  env: {
    node: true,
    mongo: true,
    jest: true,
  },
  rules: {
    "valid-typeof": "error",
  },
  overrides: [
    {
      files: "**/*.ts",
      parser: "@typescript-eslint/parser",
      parserOptions: {
        project: "./tsconfig.json",
      },
      plugins: ["@typescript-eslint/eslint-plugin"],
      extends: [
        "airbnb-base",
        "airbnb-typescript/base",
        "plugin:prettier/recommended",
      ],
    },
    {
      files: ["**/__tests__/**"],
      settings: {
        "import/resolver": {
          jest: {
            jestConfigFile: "./test/jest-config.js",
          },
        },
      },
    },
  ],
};
