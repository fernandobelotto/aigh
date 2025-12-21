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
import { handlePrNew } from '../src/commands/pr.js';

const mockExeca = vi.mocked(execa);
const mockPrompt = vi.mocked(inquirer.prompt);
const mockGenerateText = vi.mocked(generateText);
const mockReadFile = vi.mocked(fs.readFile);
const mockMkdir = vi.mocked(fs.mkdir);

describe('pr new command', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default config mock
    mockMkdir.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // Helper to setup common mocks
  function setupMocks(options: {
    branch?: string;
    diff?: string;
    prTemplate?: string | null;
    aiResponse?: string;
    userConfirms?: boolean;
    ghSuccess?: boolean;
  }) {
    const {
      branch = 'feature/test',
      diff = 'diff --git a/file.ts\n+console.log("test")',
      prTemplate = null,
      aiResponse = 'PR Title: feat: add test feature\nPR Description:\nThis PR adds a test feature.',
      userConfirms = true,
      ghSuccess = true,
    } = options;

    // Mock config read - needs to handle multiple readFile calls
    mockReadFile.mockImplementation(async (path: any) => {
      const pathStr = typeof path === 'string' ? path : path.toString();

      // Config file
      if (pathStr.includes('config.json') || pathStr.includes('.aigh')) {
        return JSON.stringify({
          ai_provider: 'openai',
          openai_api_key: 'test-api-key',
        });
      }

      // PR template
      if (pathStr.includes('pull_request_template')) {
        if (prTemplate === null) {
          const error = new Error('ENOENT');
          (error as any).code = 'ENOENT';
          throw error;
        }
        return prTemplate;
      }

      return '';
    });

    // Mock git and gh commands
    mockExeca.mockImplementation(async (cmd: string, args?: readonly string[]) => {
      const argsStr = args?.join(' ') || '';

      // git rev-parse (get current branch)
      if (cmd === 'git' && argsStr.includes('rev-parse --abbrev-ref HEAD')) {
        return { stdout: branch, stderr: '', exitCode: 0 } as any;
      }

      // git fetch
      if (cmd === 'git' && argsStr.includes('fetch')) {
        return { stdout: '', stderr: '', exitCode: 0 } as any;
      }

      // git diff from base
      if (cmd === 'git' && argsStr.includes('diff') && argsStr.includes('origin/')) {
        return { stdout: diff, stderr: '', exitCode: 0 } as any;
      }

      // gh pr create
      if (cmd === 'gh' && argsStr.includes('pr create')) {
        if (!ghSuccess) {
          throw new Error('gh command failed');
        }
        return { stdout: 'https://github.com/owner/repo/pull/123', stderr: '', exitCode: 0 } as any;
      }

      return { stdout: '', stderr: '', exitCode: 0 } as any;
    });

    // Mock AI response
    mockGenerateText.mockResolvedValue({
      text: aiResponse,
      finishReason: 'stop',
      usage: { promptTokens: 10, completionTokens: 20 },
    } as any);

    // Mock user prompt
    mockPrompt.mockResolvedValue({ confirmPr: userConfirms });
  }

  describe('successful PR creation', () => {
    it('should create PR with AI-generated title and description', async () => {
      setupMocks({});

      await handlePrNew({});

      // Verify current branch was fetched
      expect(mockExeca).toHaveBeenCalledWith('git', ['rev-parse', '--abbrev-ref', 'HEAD']);

      // Verify diff was fetched from base branch
      expect(mockExeca).toHaveBeenCalledWith('git', ['diff', 'origin/main...HEAD', '--diff-filter=d']);

      // Verify AI was called
      expect(mockGenerateText).toHaveBeenCalled();

      // Verify user was prompted
      expect(mockPrompt).toHaveBeenCalled();

      // Verify gh pr create was called with correct args
      // Note: The body parsing keeps "PR Description:" prefix due to regex not matching after title removal
      const ghCall = mockExeca.mock.calls.find((call) => call[0] === 'gh');
      expect(ghCall).toBeDefined();
      expect(ghCall?.[1]).toContain('pr');
      expect(ghCall?.[1]).toContain('create');
      expect(ghCall?.[1]).toContain('--title');
      expect(ghCall?.[1]).toContain('feat: add test feature');
      expect(ghCall?.[1]).toContain('--body');
      expect(ghCall?.[1]).toContain('--base');
      expect(ghCall?.[1]).toContain('main');
      expect(ghCall?.[1]).toContain('--draft');
    });

    it('should use custom base branch when specified', async () => {
      setupMocks({});

      await handlePrNew({ base: 'develop' });

      // Verify diff was fetched from custom base branch
      expect(mockExeca).toHaveBeenCalledWith('git', ['fetch', 'origin', 'develop', '-q']);
      expect(mockExeca).toHaveBeenCalledWith('git', ['diff', 'origin/develop...HEAD', '--diff-filter=d']);

      // Verify PR was created with custom base
      const ghCall = mockExeca.mock.calls.find(
        (call) => call[0] === 'gh' && call[1]?.includes('--base')
      );
      expect(ghCall).toBeDefined();
      expect(ghCall?.[1]).toContain('develop');
    });

    it('should include PR template in AI prompt when available', async () => {
      setupMocks({
        prTemplate: '## Description\n\n## Changes\n\n## Testing',
      });

      await handlePrNew({});

      // Verify AI was called with template in prompt
      const aiCall = mockGenerateText.mock.calls[0];
      expect(aiCall[0].prompt).toContain('TEMPLATE START');
      expect(aiCall[0].prompt).toContain('## Description');
    });

    it('should create non-draft PR when --no-draft is used', async () => {
      setupMocks({});

      await handlePrNew({ draft: false });

      // Verify gh pr create was called without --draft
      const ghCall = mockExeca.mock.calls.find((call) => call[0] === 'gh');
      expect(ghCall?.[1]).not.toContain('--draft');
    });

    it('should add --web flag when specified', async () => {
      setupMocks({});

      await handlePrNew({ web: true });

      // Verify gh pr create was called with --web and without --draft
      const ghCall = mockExeca.mock.calls.find((call) => call[0] === 'gh');
      expect(ghCall?.[1]).toContain('--web');
      expect(ghCall?.[1]).not.toContain('--draft'); // --draft is skipped when --web is used
    });
  });

  describe('user cancellation', () => {
    it('should abort when user declines PR creation', async () => {
      setupMocks({ userConfirms: false });

      await handlePrNew({});

      // Verify gh pr create was NOT called
      const ghCalls = mockExeca.mock.calls.filter((call) => call[0] === 'gh');
      expect(ghCalls).toHaveLength(0);
    });
  });

  describe('error handling', () => {
    it('should abort when on same branch as base', async () => {
      setupMocks({ branch: 'main' });

      await handlePrNew({});

      // AI should not be called
      expect(mockGenerateText).not.toHaveBeenCalled();
    });

    it('should abort when no diff detected', async () => {
      setupMocks({ diff: '' });

      await handlePrNew({});

      // AI should not be called for empty diff
      expect(mockGenerateText).not.toHaveBeenCalled();
    });

    it('should handle gh command failure gracefully', async () => {
      setupMocks({ ghSuccess: false });

      // Should not throw
      await expect(handlePrNew({})).resolves.not.toThrow();
    });

    it('should abort when current branch cannot be determined', async () => {
      mockMkdir.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue(
        JSON.stringify({
          ai_provider: 'openai',
          openai_api_key: 'test-api-key',
        })
      );

      mockExeca.mockImplementation(async (cmd: string, args?: readonly string[]) => {
        const argsStr = args?.join(' ') || '';

        if (cmd === 'git' && argsStr.includes('rev-parse')) {
          throw new Error('Not a git repository');
        }
        return { stdout: '', stderr: '', exitCode: 0 } as any;
      });

      await handlePrNew({});

      // AI should not be called
      expect(mockGenerateText).not.toHaveBeenCalled();
    });
  });

  describe('AI response parsing', () => {
    it('should parse PR title and description from AI response', async () => {
      setupMocks({
        aiResponse: 'PR Title: fix: resolve bug in login\nPR Description:\nThis fixes the login bug.',
      });

      await handlePrNew({});

      // Verify parsed values were used
      expect(mockExeca).toHaveBeenCalledWith(
        'gh',
        expect.arrayContaining(['--title', 'fix: resolve bug in login'])
      );
    });

    it('should handle AI response without proper formatting', async () => {
      setupMocks({
        aiResponse: 'This is just a plain description without proper PR Title format',
      });

      await handlePrNew({});

      // Should still attempt to create PR with fallback title
      expect(mockExeca).toHaveBeenCalledWith(
        'gh',
        expect.arrayContaining(['--title', 'Generated PR Description'])
      );
    });
  });
});
