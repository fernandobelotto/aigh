import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock modules before importing the code under test
vi.mock('execa', () => ({
  execa: vi.fn(),
  ExecaError: class ExecaError extends Error {
    exitCode?: number;
    stdout?: string;
    stderr?: string;
  },
}));

vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn(),
  },
}));

vi.mock('ai', () => ({
  generateText: vi.fn(),
}));

vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
  },
}));

vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
  })),
}));

import { execa } from 'execa';
import inquirer from 'inquirer';
import { generateText } from 'ai';
import fs from 'fs/promises';
import { handleCommit } from '../src/commands/commit.js';

const mockExeca = vi.mocked(execa);
const mockPrompt = vi.mocked(inquirer.prompt);
const mockGenerateText = vi.mocked(generateText);
const mockReadFile = vi.mocked(fs.readFile);
const mockMkdir = vi.mocked(fs.mkdir);

describe('commit command', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default config mock
    mockMkdir.mockResolvedValue(undefined);
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        ai_provider: 'openai',
        openai_api_key: 'test-api-key',
      })
    );
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('successful commit flow', () => {
    it('should generate commit message and commit when user confirms', async () => {
      // Setup: staged diff exists
      mockExeca.mockImplementation(async (cmd: string, args?: readonly string[]) => {
        const argsStr = args?.join(' ') || '';

        if (cmd === 'git' && argsStr.includes('diff --staged')) {
          return { stdout: 'diff --git a/file.ts\n+console.log("hello")', stderr: '', exitCode: 0 } as any;
        }
        if (cmd === 'git' && argsStr.includes('commit -m')) {
          return { stdout: '', stderr: '', exitCode: 0 } as any;
        }
        return { stdout: '', stderr: '', exitCode: 0 } as any;
      });

      // AI generates commit message
      mockGenerateText.mockResolvedValue({
        text: 'feat: add hello world logging',
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 5 },
      } as any);

      // User confirms
      mockPrompt.mockResolvedValue({ confirmCommit: true });

      await handleCommit({});

      // Verify git diff was called
      expect(mockExeca).toHaveBeenCalledWith('git', ['diff', '--staged', '--diff-filter=d']);

      // Verify AI was called
      expect(mockGenerateText).toHaveBeenCalled();

      // Verify user was prompted
      expect(mockPrompt).toHaveBeenCalled();

      // Verify commit was executed
      expect(mockExeca).toHaveBeenCalledWith('git', ['commit', '-m', 'feat: add hello world logging']);
    });

    it('should abort when user declines', async () => {
      // Setup: staged diff exists
      mockExeca.mockImplementation(async (cmd: string, args?: readonly string[]) => {
        const argsStr = args?.join(' ') || '';

        if (cmd === 'git' && argsStr.includes('diff --staged')) {
          return { stdout: 'diff --git a/file.ts', stderr: '', exitCode: 0 } as any;
        }
        return { stdout: '', stderr: '', exitCode: 0 } as any;
      });

      // AI generates commit message
      mockGenerateText.mockResolvedValue({
        text: 'feat: some change',
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 5 },
      } as any);

      // User declines
      mockPrompt.mockResolvedValue({ confirmCommit: false });

      await handleCommit({});

      // Verify commit was NOT executed (only diff call, no commit call)
      const commitCalls = mockExeca.mock.calls.filter(
        (call) => call[0] === 'git' && call[1]?.includes('commit')
      );
      expect(commitCalls).toHaveLength(0);
    });
  });

  describe('no staged changes', () => {
    it('should exit early when no staged changes', async () => {
      // Setup: no staged diff
      mockExeca.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 } as any);

      await handleCommit({});

      // AI should not be called
      expect(mockGenerateText).not.toHaveBeenCalled();

      // User should not be prompted
      expect(mockPrompt).not.toHaveBeenCalled();
    });
  });

  describe('AI failure handling', () => {
    it('should show fallback message when AI fails and still prompt user', async () => {
      // Setup: staged diff exists
      mockExeca.mockImplementation(async (cmd: string, args?: readonly string[]) => {
        const argsStr = args?.join(' ') || '';

        if (cmd === 'git' && argsStr.includes('diff --staged')) {
          return { stdout: 'diff --git a/file.ts', stderr: '', exitCode: 0 } as any;
        }
        if (cmd === 'git' && argsStr.includes('commit -m')) {
          return { stdout: '', stderr: '', exitCode: 0 } as any;
        }
        return { stdout: '', stderr: '', exitCode: 0 } as any;
      });

      // AI fails - the function catches this and returns fallback message
      mockGenerateText.mockRejectedValue(new Error('API Error'));

      // User declines the fallback message
      mockPrompt.mockResolvedValue({ confirmCommit: false });

      await handleCommit({});

      // User should still be prompted (with the fallback message)
      // because generateCommitMessage returns a fallback rather than throwing
      expect(mockPrompt).toHaveBeenCalled();
    });

    it('should abort when AI returns empty response', async () => {
      mockExeca.mockImplementation(async (cmd: string, args?: readonly string[]) => {
        const argsStr = args?.join(' ') || '';

        if (cmd === 'git' && argsStr.includes('diff --staged')) {
          return { stdout: 'diff --git a/file.ts', stderr: '', exitCode: 0 } as any;
        }
        return { stdout: '', stderr: '', exitCode: 0 } as any;
      });

      // AI returns empty text - will throw "AI did not return a message"
      mockGenerateText.mockResolvedValue({
        text: '',
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 0 },
      } as any);

      // User declines
      mockPrompt.mockResolvedValue({ confirmCommit: false });

      await handleCommit({});

      // Since AI returns empty, catch block runs and fallback is returned
      // The fallback message is shown to user for confirmation
      expect(mockPrompt).toHaveBeenCalled();
    });
  });

  describe('git failure handling', () => {
    it('should handle git diff failure gracefully', async () => {
      // Setup: git diff fails
      mockExeca.mockRejectedValue(new Error('git not found'));

      await handleCommit({});

      // AI should not be called
      expect(mockGenerateText).not.toHaveBeenCalled();
    });

    it('should handle commit failure gracefully', async () => {
      // Setup: staged diff exists
      mockExeca.mockImplementation(async (cmd: string, args?: readonly string[]) => {
        const argsStr = args?.join(' ') || '';

        if (cmd === 'git' && argsStr.includes('diff --staged')) {
          return { stdout: 'diff --git a/file.ts', stderr: '', exitCode: 0 } as any;
        }
        if (cmd === 'git' && argsStr.includes('commit -m')) {
          throw new Error('Commit failed');
        }
        return { stdout: '', stderr: '', exitCode: 0 } as any;
      });

      // AI generates message
      mockGenerateText.mockResolvedValue({
        text: 'feat: change',
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 5 },
      } as any);

      // User confirms
      mockPrompt.mockResolvedValue({ confirmCommit: true });

      // Should not throw
      await expect(handleCommit({})).resolves.not.toThrow();
    });
  });

  describe('commit message cleaning', () => {
    it('should clean markdown code blocks from AI response', async () => {
      mockExeca.mockImplementation(async (cmd: string, args?: readonly string[]) => {
        const argsStr = args?.join(' ') || '';

        if (cmd === 'git' && argsStr.includes('diff --staged')) {
          return { stdout: 'diff --git a/file.ts', stderr: '', exitCode: 0 } as any;
        }
        if (cmd === 'git' && argsStr.includes('commit -m')) {
          return { stdout: '', stderr: '', exitCode: 0 } as any;
        }
        return { stdout: '', stderr: '', exitCode: 0 } as any;
      });

      // AI returns message wrapped in code block
      mockGenerateText.mockResolvedValue({
        text: '```\nfeat: clean message\n```',
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 5 },
      } as any);

      mockPrompt.mockResolvedValue({ confirmCommit: true });

      await handleCommit({});

      // Verify the cleaned message was used
      expect(mockExeca).toHaveBeenCalledWith('git', ['commit', '-m', 'feat: clean message']);
    });

    it('should extract only the first line of multi-line commit message', async () => {
      mockExeca.mockImplementation(async (cmd: string, args?: readonly string[]) => {
        const argsStr = args?.join(' ') || '';

        if (cmd === 'git' && argsStr.includes('diff --staged')) {
          return { stdout: 'diff --git a/file.ts', stderr: '', exitCode: 0 } as any;
        }
        if (cmd === 'git' && argsStr.includes('commit -m')) {
          return { stdout: '', stderr: '', exitCode: 0 } as any;
        }
        return { stdout: '', stderr: '', exitCode: 0 } as any;
      });

      // AI returns multi-line message
      mockGenerateText.mockResolvedValue({
        text: 'feat: main change\n\nThis is a longer description\nthat spans multiple lines',
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 5 },
      } as any);

      mockPrompt.mockResolvedValue({ confirmCommit: true });

      await handleCommit({});

      // Only first line should be used
      expect(mockExeca).toHaveBeenCalledWith('git', ['commit', '-m', 'feat: main change']);
    });
  });
});
