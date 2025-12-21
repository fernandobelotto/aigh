# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

```bash
npm run build          # Production build with esbuild (minified, no sourcemaps)
npm run build:dev      # Development build (with inline sourcemaps)
npm run watch          # Watch mode for development
npm run build:link     # Build and npm link for local testing

npm run lint           # ESLint with zero warnings allowed
npm run lint:fix       # ESLint with auto-fix
npm run format         # Check formatting with Prettier
npm run format:fix     # Fix formatting with Prettier
npm run typecheck      # TypeScript type checking only

npm run start          # Run the built CLI
npm run dev            # Run with source maps enabled
```

## Architecture

This is an AI-powered CLI tool (`aigh`) that wraps git/gh commands with AI-generated content. Built with TypeScript + esbuild, distributed as an ESM package.

### Entry Point and Commands

- `src/cli.ts` - Main entry point using `meow` for CLI parsing. Routes to command handlers.
- `src/commands/commit.ts` - `aigh commit`: Gets staged diff, generates AI commit message, prompts for confirmation
- `src/commands/pr.ts` - `aigh pr new`: Gets diff from base branch, optionally reads PR template, generates AI title/description
- `src/commands/config.ts` - `aigh config get/set`: Manages user configuration

### Utilities

- `src/utils/ai.ts` - AI provider abstraction supporting OpenAI and Google Gemini. Contains `generateCommitMessage()` and `generatePrDescription()`
- `src/utils/config.ts` - Configuration management stored at `~/.aigh/config.json`, with env var fallbacks
- `src/utils/git.ts` - Git operations via execa
- `src/utils/gh.ts` - GitHub CLI (`gh`) operations via execa
- `src/utils/editor.ts` - External editor support for editing generated content
- `src/utils/fs.ts` - File system utilities (e.g., reading PR templates)

### Configuration System

Config is loaded from `~/.aigh/config.json` with fallbacks to environment variables (`OPENAI_API_KEY`, `GOOGLE_API_KEY`). Key settings:
- `ai_provider`: "openai" or "gemini"
- `openai_api_key`, `openai_model` (default: gpt-4o-mini)
- `google_api_key`, `gemini_model` (default: gemini-1.5-flash)

### Build System

Uses esbuild (`build.mjs`) with external dependencies (openai, @google/genai, dotenv, chalk, inquirer, execa, ora). Output is a single bundled `dist/cli.js` file.
