/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: [
    "<rootDir>/example/snippets/",
    "<rootDir>/src/",
    "<rootDir>/test/",
  ],
  modulePaths: ['<rootDir>'],
};