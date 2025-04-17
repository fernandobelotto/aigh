import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';

// Function to read the PR template file
export async function readPrTemplate(): Promise<string | null> {
  const templatePath = path.join('.github', 'pull_request_template.md');
  try {
    const templateContent = await fs.readFile(templatePath, 'utf-8');
    console.log(chalk.blue('Found and read PR template file.'));
    return templateContent;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.log(chalk.yellow('No PR template file found at .github/pull_request_template.md'));
    } else {
      console.error(
        chalk.red('Error reading PR template file:'),
        error instanceof Error ? error.message : error,
      );
    }
    return null;
  }
} 