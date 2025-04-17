import { execa } from 'execa';
import chalk from 'chalk';

interface PrOptions {
  title: string;
  body: string;
  baseBranch?: string; // Optional: Defaults to repo default
  draft?: boolean;
  web?: boolean; // Optional: Open in web browser
}

// Placeholder for creating a GitHub PR using gh cli
export async function createGitHubPr(options: PrOptions): Promise<boolean> {
  const { title, body, baseBranch, draft = true, web = false } = options;

  console.log(chalk.blue('Creating GitHub PR...'));

  const args = [
    'pr',
    'create',
    '--title',
    title,
    '--body',
    body,
  ];

  if (baseBranch) {
    args.push('--base', baseBranch);
  }

  // Only add --draft if --web is not being used
  if (draft && !web) {
    args.push('--draft');
  }

  if (web) {
    args.push('--web');
  }

  try {
    // Run gh pr create
    const { stdout, stderr } = await execa('gh', args);
    console.log(chalk.green('Successfully created PR:'));
    console.log(stdout); // Output the PR URL
    if (stderr) {
        console.warn(chalk.yellow('gh command stderr:'), stderr);
    }
    return true;
  } catch (error: unknown) {
    console.error(
      chalk.red('Error creating GitHub PR:'),
      error instanceof Error ? error.message : error,
    );
    // Optionally log the full error output
    // if (error instanceof Error && (error as any).stderr) {
    //   console.error(chalk.red((error as any).stderr));
    // }
    return false;
  }
} 