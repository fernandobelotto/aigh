import { execa, ExecaError } from 'execa';
import chalk from 'chalk';

// Placeholder for getting staged git diff
export async function getStagedDiff(): Promise<string | null> {
  console.log(chalk.blue('Getting staged diff...'));
  try {
    // Using --diff-filter=d to ignore deleted files in diff, which might cause issues
    const { stdout } = await execa('git', ['diff', '--staged', '--diff-filter=d']);
    return stdout.trim() || null;
  } catch (error: unknown) {
    // Handle cases where git is not installed, not in a repo, or no staged changes
    if (error instanceof Error && (error as ExecaError).exitCode === 1 && (error as ExecaError).stdout === '' && (error as ExecaError).stderr === '') {
      // No staged changes, not an error
      console.log(chalk.yellow('No staged changes detected.'));
      return null;
    }
    console.error(
      chalk.red('Error getting staged diff:'),
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

// Placeholder for committing changes
export async function commitChanges(message: string): Promise<boolean> {
  console.log(chalk.blue(`Committing with message: "${message}"`));
  try {
    await execa('git', ['commit', '-m', message]);
    console.log(chalk.green('Changes committed successfully.'));
    return true;
  } catch (error: unknown) {
    console.error(
      chalk.red('Error committing changes:'),
      error instanceof Error ? error.message : error,
    );
    return false;
  }
}

// Placeholder for getting diff from base branch
export async function getDiffFromBase(baseBranch = 'main'): Promise<string | null> {
  console.log(chalk.blue(`Getting diff from base branch (${baseBranch})...`));
  try {
    // Fetch the base branch quietly
    await execa('git', ['fetch', 'origin', baseBranch, '-q']);
    // Get diff ignoring deleted files
    const { stdout } = await execa('git', [
      'diff',
      `origin/${baseBranch}...HEAD`,
      '--diff-filter=d'
    ]);
    return stdout.trim() || null;
  } catch (error: unknown) {
    console.error(
      chalk.red(`Error getting diff from base branch (${baseBranch}):`),
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

// Placeholder for getting current branch name
export async function getCurrentBranch(): Promise<string | null> {
  console.log(chalk.blue('Getting current branch name...'));
  try {
    const { stdout } = await execa('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
    return stdout.trim();
  } catch (error: unknown) {
    console.error(
      chalk.red('Error getting current branch:'),
      error instanceof Error ? error.message : error,
    );
    return null;
  }
} 