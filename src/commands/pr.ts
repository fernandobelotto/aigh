import chalk from 'chalk';
import inquirer from 'inquirer';
import { getDiffFromBase, getCurrentBranch } from '../utils/git.js';
import { generatePrDescription } from '../utils/ai.js';
import { readPrTemplate } from '../utils/fs.js';
import { createGitHubPr } from '../utils/gh.js';
import { openInEditor } from '../utils/editor.js';

// Define expected flags, adding the editor flag
interface PrNewFlags {
  base?: string;
  draft?: boolean;
  web?: boolean;
  editor?: boolean; // Added editor flag
}

export async function handlePrNew(flags: PrNewFlags) {
  console.log(chalk.green('Starting PR creation process...'));

  const baseBranch = flags.base || 'main';
  const createDraft = flags.draft !== undefined ? flags.draft : true;
  const openInWeb = flags.web || false;

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

  const diff = await getDiffFromBase(baseBranch);
  if (diff === null) {
    console.error(chalk.red('Could not get diff from base branch. Aborting.'));
    return;
  }
  if (!diff) {
    console.log(chalk.yellow('No changes detected between current branch and base branch.'));
    return;
  }

  const template = await readPrTemplate();

  let { title, body } = await generatePrDescription(diff, template);

  if (
    title === 'chore: Failed to generate PR title' ||
    title === 'chore: OpenAI client not available'
  ) {
    console.error(chalk.red('Could not generate PR title/description. Aborting.'));
    return;
  }

  // Open in editor if the flag is set
  if (flags.editor) {
    try {
      console.log(chalk.blue('Opening generated PR title & description in editor...'));
      // Combine title and body for editing, using a standard format
      const initialEditorContent = `${title}\n\n${body}`;
      const editedContent = await openInEditor(initialEditorContent, '.md'); // Use .md extension
      
      // Parse the edited content back into title and body
      const lines = editedContent.split('\n');
      const editedTitle = lines[0].trim();
      const editedBody = lines.slice(1).join('\n').trim(); // Handle potential blank line after title

      if (!editedTitle) {
        console.error(chalk.red('Edited title is empty. Aborting PR creation.'));
        return;
      }
      // Allow empty body, but use the edited versions
      title = editedTitle;
      body = editedBody;
      console.log(chalk.green('Editor closed. Using edited title and description.'));
    } catch (error) {
      console.error(chalk.red('Failed to edit PR content:'), error);
      return; // Abort if editor fails
    }
  }

  console.log('\n------------------------------------');
  console.log(chalk.bold('PR Title:')); // Changed label for clarity
  console.log(chalk.yellow(title));
  console.log('\n' + chalk.bold('PR Description:')); // Changed label for clarity
  console.log(chalk.dim(body));
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