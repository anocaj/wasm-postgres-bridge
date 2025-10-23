/**
 * Jest test setup file
 * Global test configuration and utilities
 */

import * as dotenv from 'dotenv';

// Load environment variables for tests
dotenv.config();

// Set test timeout for database operations
jest.setTimeout(15000);

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
  
  // Verify database environment variables
  const requiredEnvVars = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.warn(`Missing environment variables: ${missingVars.join(', ')}`);
    console.warn('Using default values for testing');
  }
});

afterAll(async () => {
  // Global cleanup for all tests
  console.info('Cleaning up test environment...');
});

export {};