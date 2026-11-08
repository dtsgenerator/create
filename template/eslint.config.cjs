const dtsgenerator = require("@dtsgenerator/eslint-config");

module.exports = [
  ...dtsgenerator,
  {
    rules: {
      "@typescript-eslint/require-await": "off",
    },
  },
  {
    files: ["**/*_test.ts"],
    rules: {
      "@typescript-eslint/no-floating-promises": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
    },
  },
];
