/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  extensionsToTreatAsEsm: ['.ts'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.spec.json', useESM: true }] },
  collectCoverageFrom: ['**/*.ts', '!main.ts', '!**/*.module.ts', '!**/dto/**'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
};
