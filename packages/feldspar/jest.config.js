import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// The bridge package name lives in one place: its package.json.
const bridge = JSON.parse(readFileSync(new URL('../feldspar-bridge/package.json', import.meta.url), 'utf-8'))
const bridgeSource = fileURLToPath(new URL('../feldspar-bridge/src/index.ts', import.meta.url))
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  // Resolve the bridge package from its source, so tests do not need a build first.
  moduleNameMapper: {
    [`^${escapeRegExp(bridge.name)}$`]: '<rootDir>/../feldspar-bridge/src/index.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      useESM: true,
      // Inline compilerOptions are merged over tsconfig.json. Type-check the bridge from its
      // source too, as package.json `types` points to dist, which only exists after a build.
      tsconfig: { paths: { [bridge.name]: [bridgeSource] } },
    }],
  },
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
};
