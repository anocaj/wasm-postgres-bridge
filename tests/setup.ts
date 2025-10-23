/**
 * Jest test setup file
 * Global test configuration and utilities
 */

// Set test timeout
jest.setTimeout(10000);

// Global test utilities
global.console = {
  ...console,
  // Suppress console.log in tests unless explicitly needed
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: console.warn,
  error: console.error,
};

// Test environment setup
beforeAll(async () => {
  // Global setup for all tests
  console.info('Setting up test environment...');
});

afterAll(async () => {
  // Global cleanup for all tests
  console.info('Cleaning up test environment...');
});

export {};