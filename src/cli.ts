#!/usr/bin/env node
import dotenv from 'dotenv';

// Load environment variables FIRST!
// This ensures process.env is populated before other modules load.
dotenv.config();

import meow from 'meow';
import chalk from 'chalk';
import { handleCommit } from './commands/commit.js';
import { handlePrNew } from './commands/pr.js';
import { handleConfigGet, handleConfigSet } from './commands/config.js';

const cli = meow(
  `
  Usage
    $ ghp <command> [options]

  Commands
    commit           Generate AI commit message for staged changes
    pr new           Create a new draft PR with AI-generated description
    config get [key] Show current configuration (or specific key)
    config set <key> <value> Set a configuration key

  Options
    --help, -h       Show help
    --version, -v    Show version

  Commit Options:
    -e, --editor     Open generated message in editor before committing

  PR New Options:
    --base <branch>  Specify base branch for 'pr new' (default: main)
    --no-draft       Create the PR as ready for review instead of draft
    --web            Open the created PR in the web browser
    -e, --editor     Open generated title & body in editor before creating

  Config Keys:
    ai_provider      (openai | gemini)
    openai_api_key   (Your OpenAI API key)
    openai_model     (e.g., gpt-4o-mini)
    google_api_key   (Your Google API key for Gemini)
    gemini_model     (e.g., gemini-1.5-flash)

  Examples
    $ ghp commit
    $ ghp commit -e
    $ ghp pr new
    $ ghp pr new --base develop --no-draft --web -e
    $ ghp config get
    $ ghp config get ai_provider
    $ ghp config set ai_provider gemini
    $ ghp config set openai_api_key sk-...
`,
  {
    importMeta: import.meta,
    flags: {
      base: { type: 'string' },
      draft: { type: 'boolean', default: true },
      web: { type: 'boolean', default: false },
      editor: { type: 'boolean', shortFlag: 'e', default: false },
    },
    allowUnknownFlags: false,
  },
);

// Define a type for the parsed flags
interface CliFlags {
  base?: string;
  draft?: boolean;
  web?: boolean;
  editor?: boolean;
  [key: string]: unknown;
}

async function run(cliInput: string[], cliFlags: CliFlags) {
  const command = cliInput[0];
  const subCommand = cliInput[1];
  const args = cliInput.slice(2);

  if (!command) {
    cli.showHelp();
    return;
  }

  try {
    switch (command) {
      case 'commit':
        await handleCommit({ editor: cliFlags.editor });
        break;

      case 'pr':
        if (subCommand === 'new') {
          await handlePrNew({
            base: cliFlags.base,
            draft: cliFlags.draft,
            web: cliFlags.web,
            editor: cliFlags.editor,
          });
        } else {
          console.error(chalk.red(`Unknown pr subcommand: ${subCommand}`));
          cli.showHelp(1);
        }
        break;

      case 'config':
        if (subCommand === 'get') {
          await handleConfigGet(args[0]);
        } else if (subCommand === 'set') {
          if (args.length < 2) {
            console.error(chalk.red('Usage: ghp config set <key> <value>'));
            cli.showHelp(1);
          } else {
            await handleConfigSet(args[0], args[1]);
          }
        } else {
          console.error(chalk.red(`Unknown config subcommand: ${subCommand}`));
          cli.showHelp(1);
        }
        break;

      default:
        console.error(chalk.red(`Unknown command: ${command}`));
        cli.showHelp(1);
        break;
    }
  } catch (error: unknown) {
    console.error(chalk.red('\nAn unexpected error occurred:'));
    if (error instanceof Error) {
      console.error(chalk.red(error.message));
      if (process.env.NODE_ENV === 'development' && error.stack) {
        console.error(chalk.grey(error.stack));
      }
    } else {
      console.error(chalk.red(String(error)));
    }
    process.exit(1);
  }
}

run(cli.input, cli.flags as CliFlags); 