#!/usr/bin/env node
import dotenv from 'dotenv';

// Load environment variables FIRST!
// This ensures process.env is populated before other modules load.
dotenv.config();

import meow from 'meow';
import chalk from 'chalk';
import { handleCommit } from './commands/commit.js';
import { handlePrNew } from './commands/pr.js';

const cli = meow(
  `
  Usage
    $ ghp <command> [options]

  Commands
    commit           Generate AI commit message for staged changes
    pr new           Create a new draft PR with AI-generated description

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

  Examples
    $ ghp commit
    $ ghp commit -e
    $ ghp pr new
    $ ghp pr new --base develop --no-draft --web
    $ ghp pr new -e
`,
  {
    importMeta: import.meta,
    // Specify flag types for meow to parse correctly
    flags: {
      base: {
        type: 'string',
      },
      draft: {
        // meow automatically handles --no-draft to set draft=false
        type: 'boolean',
        default: true,
      },
      web: {
        type: 'boolean',
        default: false,
      },
      editor: {
        type: 'boolean',
        shortFlag: 'e',
        default: false,
      },
    },
  },
);

// Define a type for the parsed flags
interface CliFlags {
  base?: string;
  draft?: boolean;
  web?: boolean;
  editor?: boolean;
  [key: string]: unknown; // Allow other unknown flags potentially
}

async function run(cliInput: string[], cliFlags: CliFlags) {
  const command = cliInput[0];

  if (!command) {
    cli.showHelp();
    return;
  }

  try {
    switch (command) {
      case 'commit':
        // Pass relevant flags if commit command needs them later
        await handleCommit({ editor: cliFlags.editor });
        break;

      case 'pr':
        if (cliInput[1] === 'new') {
          // Pass the parsed flags to the handler
          await handlePrNew({
            base: cliFlags.base,
            draft: cliFlags.draft,
            web: cliFlags.web,
            editor: cliFlags.editor,
          });
        } else {
          console.error(chalk.red(`Unknown pr subcommand: ${cliInput[1]}`));
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
      // Optionally log stack trace in dev mode
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