import chalk from 'chalk';
import inquirer from 'inquirer';
import { getDiffFromBase, getCurrentBranch } from '../utils/git.js';
import { generatePrDescription } from '../utils/ai.js';
import { readPrTemplate } from '../utils/fs.js';
import { createGitHubPr } from '../utils/gh.js';

// Define expected flags (if any) for type safety
interface PrNewFlags {
  base?: string; // Allow specifying a base branch
  draft?: boolean; // Override default draft status
  web?: boolean; // Open PR in web browser after creation
}

export async function handlePrNew(flags: PrNewFlags) {
  console.log(chalk.green('Starting PR creation process...'));

  const baseBranch = flags.base || 'main'; // Default to 'main' if not provided
  const createDraft = flags.draft !== undefined ? flags.draft : true; // Default to true
  const openInWeb = flags.web || false;

  // 1. Get current branch
  const currentBranch = await getCurrentBranch();
  if (!currentBranch) {
    console.error(chalk.red('Could not determine current branch. Aborting.'));
    return;
  }
  if (currentBranch === baseBranch) {
    console.error(chalk.red(`Cannot create PR from branch "${currentBranch}" to itself.`));
    return;
  }
  console.log(chalk.blue(`Current branch: ${currentBranch}`));
  console.log(chalk.blue(`Base branch: ${baseBranch}`));

  // 2. Get diff from base branch
  const diff = await getDiffFromBase(baseBranch);
  if (diff === null) {
    // Error occurred getting diff
    console.error(chalk.red('Could not get diff from base branch. Aborting.'));
    return;
  }
  if (!diff) {
    console.log(chalk.yellow('No changes detected between current branch and base branch.'));
    // Optional: Prompt user if they still want to create an empty PR?
    return;
  }

  // 3. Read PR template
  const template = await readPrTemplate();

  // 4. Generate PR title and description
  const { title, body } = await generatePrDescription(diff, template);

  if (
    title === 'chore: Failed to generate PR title' ||
    title === 'chore: OpenAI client not available'
  ) {
    console.error(chalk.red('Could not generate PR title/description. Aborting.'));
    return;
  }

  console.log('\n------------------------------------');
  console.log(chalk.bold('Generated PR Title:'));
  console.log(chalk.yellow(title));
  console.log('\n' + chalk.bold('Generated PR Description:'));
  console.log(chalk.dim(body)); // Use dim for potentially long body
  console.log('------------------------------------\n');

  const { confirmPr } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmPr',
      message: 'Create PR with this title and description?',
      default: true,
    },
  ]);

  if (!confirmPr) {
    console.log(chalk.yellow('PR creation aborted by user.'));
    return;
  }

  // 5. Execute gh pr create
  const prSuccess = await createGitHubPr({
    title,
    body,
    baseBranch,
    draft: createDraft,
    web: openInWeb,
  });

  if (prSuccess) {
    console.log(chalk.green.bold('Successfully created GitHub PR!'));
  } else {
    console.error(chalk.red('Failed to create GitHub PR.'));
  }
} 