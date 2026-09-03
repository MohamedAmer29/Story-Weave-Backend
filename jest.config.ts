import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: [
    '**/*.(t|j)s',
    '!**/*.spec.ts',
    '!**/main.ts',
    '!**/*.module.ts',
    '!**/dto/**',
    '!**/config/*.config.ts',
    '!**/enums/**',
    '!**/interfaces/**',
    '!**/constants/**',
    '!**/decorators/**',
    '!**/*.entity.ts',
    '!app.controller.ts',
    '!app.service.ts',
  ],
  coverageDirectory: '../coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      statements: 60,
      branches: 50,
      functions: 60,
      lines: 60,
    },
  },
  testEnvironment: 'node',
};

export default config;
