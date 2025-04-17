import chalk from 'chalk';
import inquirer from 'inquirer';
import { getStagedDiff, commitChanges } from '../utils/git.js';
import { generateCommitMessage } from '../utils/ai.js';
import { openInEditor } from '../utils/editor.js';

// Define flags expected by handleCommit
interface CommitFlags {
  editor?: boolean;
}

// Placeholder function for commit command logic
export async function handleCommit(flags: CommitFlags) {
  console.log(chalk.green('Starting commit process...'));

  // 1. Get staged diff
  const diff = await getStagedDiff();

  if (diff === null) {
    // Error occurred or no changes staged, handled in getStagedDiff
    return;
  }

  if (!diff) {
    console.log(chalk.yellow('No staged changes to commit.'));
    return;
  }

  // 2. Generate commit message
  let commitMessage = await generateCommitMessage(diff);

  if (
    !commitMessage ||
    commitMessage === 'chore: Failed to generate commit message' ||
    commitMessage === 'chore: OpenAI client not available'
  ) {
    console.error(chalk.red('Could not generate commit message. Aborting commit.'));
    return;
  }

  // Open in editor if the flag is set
  if (flags.editor) {
    try {
      console.log(chalk.blue('Opening generated message in editor...'));
      const editedMessage = await openInEditor(commitMessage, '.gitcommit');
      // Basic validation: check if the user deleted everything
      if (!editedMessage.trim()) {
        console.error(chalk.red('Edited message is empty. Aborting commit.'));
        return;
      }
      commitMessage = editedMessage.trim(); // Use the edited message
      console.log(chalk.green('Editor closed. Using edited message.'));
    } catch (error) {
      console.error(chalk.red('Failed to edit commit message:'), error);
      return; // Abort if editor fails
    }
  }

  console.log('\n------------------------------------');
  console.log(chalk.bold('Commit Message:'));
  console.log(chalk.yellow(commitMessage));
  console.log('------------------------------------\n');

  const { confirmCommit } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmCommit',
      message: 'Use this commit message?',
      default: true,
    },
  ]);

  if (!confirmCommit) {
    console.log(chalk.yellow('Commit aborted by user.'));
    return;
  }

  // 3. Execute git commit
  const commitSuccess = await commitChanges(commitMessage);

  if (commitSuccess) {
    console.log(chalk.green.bold('Successfully committed changes!'));
  } else {
    console.error(chalk.red('Failed to commit changes.'));
  }
} 