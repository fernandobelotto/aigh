import { vi, beforeEach, afterEach } from 'vitest';

// Mock console methods to reduce noise in tests
beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

// Set test environment
process.env.NODE_ENV = 'test';
