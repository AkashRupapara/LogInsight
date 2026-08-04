/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  testPathIgnorePatterns: process.env.RUN_INTEGRATION_TESTS
    ? []
    : ['<rootDir>/tests/integration/'],
};
