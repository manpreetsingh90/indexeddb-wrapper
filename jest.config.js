export default {
  preset: null,
  testEnvironment: 'node',
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
  testPathIgnorePatterns: [
    '<rootDir>/tests/browser/' // Exclude browser tests from Jest
  ],
};