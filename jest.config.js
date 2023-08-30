module.exports = {
  "roots": [
    "src",
    "test"
  ],
  moduleNameMapper: {
    '^@pyroscope/nodejs$': '<rootDir>/src',
      "./express.js": "<rootDir>/src/express.ts",
      "./index.js": "<rootDir>/src/index.ts"
  },
  preset: "ts-jest",
  testEnvironment: "node",
  collectCoverage: true,
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "test/**/*.{ts,js}",
    "!**/node_modules/**",
    "!**/vendor/**"
  ],
  transform: {
    "^.+\\.tsx?$": "ts-jest",
  },
  globals: {
    fetch: global.fetch,
    'ts-jest': {
      tsconfig: './config/tsconfig.jest.json',
    },
  },
  "extensionsToTreatAsEsm": [".ts"]
}
