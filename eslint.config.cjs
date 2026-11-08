const dtsgenerator = require("@dtsgenerator/eslint-config");

module.exports = [
  ...dtsgenerator,
  {
    rules: {
      "@typescript-eslint/prefer-promise-reject-errors": "off",
    },
  },
];
