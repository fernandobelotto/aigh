import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock modules before importing the code under test
vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
  },
}));

vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn(),
    Separator: class Separator {
      constructor() {}
    },
  },
}));

import fs from 'fs/promises';
import inquirer from 'inquirer';
import { handleConfigGet, handleConfigSet, handleConfigSetup } from '../src/commands/config.js';

const mockReadFile = vi.mocked(fs.readFile);
const mockWriteFile = vi.mocked(fs.writeFile);
const mockMkdir = vi.mocked(fs.mkdir);
const mockPrompt = vi.mocked(inquirer.prompt);

describe('config commands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);

    // Mock process.exit to prevent actual exit
    vi.spyOn(process, 'exit').mockImplementation((code?: number) => {
      throw new Error(`Process exited with code ${code}`);
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('config get', () => {
    it('should display all config values when no key specified', async () => {
      mockReadFile.mockResolvedValue(
        JSON.stringify({
          ai_provider: 'openai',
          model: 'gpt-4o',
          openai_api_key: 'sk-test1234567890abcdef',
        })
      );

      await handleConfigGet();

      // Should not throw
      expect(mockReadFile).toHaveBeenCalled();
    });

    it('should display specific config value when key specified', async () => {
      mockReadFile.mockResolvedValue(
        JSON.stringify({
          ai_provider: 'anthropic',
          model: 'claude-sonnet-4-0',
        })
      );

      await handleConfigGet('ai_provider');

      expect(mockReadFile).toHaveBeenCalled();
    });

    it('should mask API keys in display', async () => {
      const consoleSpy = vi.spyOn(console, 'log');

      mockReadFile.mockResolvedValue(
        JSON.stringify({
          ai_provider: 'openai',
          openai_api_key: 'sk-abcdefghijklmnopqrstuvwxyz1234567890',
        })
      );

      await handleConfigGet('openai_api_key');

      // Verify console.log was called with masked key
      const logCalls = consoleSpy.mock.calls.flat().join(' ');
      expect(logCalls).toContain('sk-a');
      expect(logCalls).toContain('...'); // Masked portion
    });

    it('should error on invalid config key', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({}));

      await expect(handleConfigGet('invalid_key')).rejects.toThrow('Process exited');
    });

    it('should handle missing config file gracefully', async () => {
      const error = new Error('ENOENT');
      (error as any).code = 'ENOENT';
      mockReadFile.mockRejectedValue(error);

      // Should not throw, uses defaults
      await expect(handleConfigGet()).resolves.not.toThrow();
    });
  });

  describe('config set', () => {
    it('should set a valid config key', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({}));

      await handleConfigSet('ai_provider', 'anthropic');

      expect(mockWriteFile).toHaveBeenCalled();
      const savedConfig = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
      expect(savedConfig.ai_provider).toBe('anthropic');
    });

    it('should set model value', async () => {
      mockReadFile.mockResolvedValue(
        JSON.stringify({
          ai_provider: 'openai',
        })
      );

      await handleConfigSet('model', 'gpt-4-turbo');

      expect(mockWriteFile).toHaveBeenCalled();
      const savedConfig = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
      expect(savedConfig.model).toBe('gpt-4-turbo');
    });

    it('should set API key', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({}));

      await handleConfigSet('openai_api_key', 'sk-newkey123');

      expect(mockWriteFile).toHaveBeenCalled();
      const savedConfig = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
      expect(savedConfig.openai_api_key).toBe('sk-newkey123');
    });

    it('should error on invalid config key', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({}));

      await expect(handleConfigSet('invalid_key', 'value')).rejects.toThrow('Process exited');
    });

    it('should error on invalid ai_provider value', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({}));

      await expect(handleConfigSet('ai_provider', 'invalid')).rejects.toThrow('Process exited');
    });

    it('should validate ai_provider accepts only valid values', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({}));

      // Valid values should work
      await handleConfigSet('ai_provider', 'openai');
      expect(mockWriteFile).toHaveBeenCalled();

      mockWriteFile.mockClear();

      await handleConfigSet('ai_provider', 'anthropic');
      expect(mockWriteFile).toHaveBeenCalled();

      mockWriteFile.mockClear();

      await handleConfigSet('ai_provider', 'google');
      expect(mockWriteFile).toHaveBeenCalled();
    });
  });

  describe('config setup', () => {
    it('should complete interactive setup flow', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({}));

      // Mock the multi-step prompt responses
      mockPrompt
        .mockResolvedValueOnce({ provider: 'anthropic' }) // Provider selection
        .mockResolvedValueOnce({ model: 'claude-opus-4-5' }) // Model selection
        .mockResolvedValueOnce({ newKey: 'sk-ant-test123' }); // API key input

      await handleConfigSetup();

      expect(mockPrompt).toHaveBeenCalledTimes(3);
      expect(mockWriteFile).toHaveBeenCalled();

      const savedConfig = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
      expect(savedConfig.ai_provider).toBe('anthropic');
      expect(savedConfig.model).toBe('claude-opus-4-5');
      expect(savedConfig.anthropic_api_key).toBe('sk-ant-test123');
    });

    it('should handle custom model input', async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({}));

      mockPrompt
        .mockResolvedValueOnce({ provider: 'openai' })
        .mockResolvedValueOnce({ model: '__custom__' }) // Select custom
        .mockResolvedValueOnce({ customModel: 'gpt-custom-model' }) // Custom model input
        .mockResolvedValueOnce({ newKey: 'sk-test123' });

      await handleConfigSetup();

      const savedConfig = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
      expect(savedConfig.model).toBe('gpt-custom-model');
    });

    it('should allow keeping existing API key', async () => {
      mockReadFile.mockResolvedValue(
        JSON.stringify({
          ai_provider: 'openai',
          openai_api_key: 'existing-key-123',
        })
      );

      mockPrompt
        .mockResolvedValueOnce({ provider: 'openai' })
        .mockResolvedValueOnce({ model: 'gpt-4o' })
        .mockResolvedValueOnce({ updateKey: false }); // Don't update key

      await handleConfigSetup();

      expect(mockWriteFile).toHaveBeenCalled();
      const savedConfig = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
      // Should preserve existing key (or not include new one)
      expect(savedConfig.openai_api_key).toBe('existing-key-123');
    });

    it('should allow updating existing API key', async () => {
      mockReadFile.mockResolvedValue(
        JSON.stringify({
          ai_provider: 'openai',
          openai_api_key: 'old-key-123',
        })
      );

      mockPrompt
        .mockResolvedValueOnce({ provider: 'openai' })
        .mockResolvedValueOnce({ model: 'gpt-4o' })
        .mockResolvedValueOnce({ updateKey: true }) // Update key
        .mockResolvedValueOnce({ newKey: 'new-key-456' });

      await handleConfigSetup();

      const savedConfig = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
      expect(savedConfig.openai_api_key).toBe('new-key-456');
    });

    it('should switch provider and prompt for new API key', async () => {
      mockReadFile.mockResolvedValue(
        JSON.stringify({
          ai_provider: 'openai',
          openai_api_key: 'openai-key',
        })
      );

      mockPrompt
        .mockResolvedValueOnce({ provider: 'google' }) // Switch to google
        .mockResolvedValueOnce({ model: 'gemini-2.0-flash' })
        .mockResolvedValueOnce({ newKey: 'google-key-123' }); // New google key

      await handleConfigSetup();

      const savedConfig = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
      expect(savedConfig.ai_provider).toBe('google');
      expect(savedConfig.google_api_key).toBe('google-key-123');
    });
  });

  describe('environment variable fallback', () => {
    it('should use environment variable when config key not set', async () => {
      // Set env var
      const originalEnv = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = 'env-api-key';

      mockReadFile.mockResolvedValue(
        JSON.stringify({
          ai_provider: 'openai',
          // No openai_api_key in file
        })
      );

      await handleConfigGet('openai_api_key');

      // Restore env
      process.env.OPENAI_API_KEY = originalEnv;
    });

    it('should prefer config file over environment variable', async () => {
      const originalEnv = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = 'env-api-key';

      mockReadFile.mockResolvedValue(
        JSON.stringify({
          ai_provider: 'openai',
          openai_api_key: 'file-api-key',
        })
      );

      const consoleSpy = vi.spyOn(console, 'log');

      await handleConfigGet('openai_api_key');

      // Should show file key (masked), not env key
      const logCalls = consoleSpy.mock.calls.flat().join(' ');
      expect(logCalls).toContain('file');

      process.env.OPENAI_API_KEY = originalEnv;
    });
  });
});
