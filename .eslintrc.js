module.exports = {
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  extends: ["eslint:recommended", "airbnb-base", "eslint-config-prettier"],
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
        "plugin:@typescript-eslint/eslint-recommended",
        "plugin:@typescript-eslint/recommended",
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
