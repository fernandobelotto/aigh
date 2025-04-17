import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { execa } from 'execa';
import chalk from 'chalk';

/**
 * Opens the provided content in the user's default editor.
 * Waits for the editor to close and returns the edited content.
 *
 * @param initialContent The initial content to populate the editor with.
 * @param fileExtension Optional file extension for the temporary file (e.g., '.md').
 * @returns The content of the file after editing.
 */
export async function openInEditor(initialContent: string, fileExtension = '.txt'): Promise<string> {
  const editor = process.env.VISUAL || process.env.EDITOR;
  if (!editor) {
    throw new Error(
      'Neither VISUAL nor EDITOR environment variables are set. Please configure your default editor.',
    );
  }

  const tmpDir = os.tmpdir();
  const prefix = 'aigh-edit-';
  let tempFilePath: string | undefined;

  try {
    // Create a unique temporary directory
    const tempDir = await fs.mkdtemp(path.join(tmpDir, prefix));
    tempFilePath = path.join(tempDir, `edit${fileExtension}`);

    // Write the initial content to the temporary file
    await fs.writeFile(tempFilePath, initialContent);

    console.log(chalk.blue(`Opening editor (${editor}) for file: ${tempFilePath}`));

    // Special handling for VS Code to wait for the file to be closed
    const editorArgs = editor.includes('code') ? ['--wait', tempFilePath] : [tempFilePath];
    const editorCommand = editor.includes('code') ? editor.split(' ')[0] : editor;

    // Launch the editor as a subprocess, inheriting stdio
    await execa(editorCommand, editorArgs, {
      stdio: 'inherit', // Allows interaction with the editor (e.g., vim)
    });

    // Read the potentially modified content back
    const editedContent = await fs.readFile(tempFilePath, 'utf-8');

    // Clean up the temporary file and directory
    await fs.unlink(tempFilePath);
    await fs.rmdir(tempDir);

    return editedContent;
  } catch (error) {
    console.error(chalk.red('Error opening or reading from editor:'), error);
    // Attempt cleanup even if there was an error
    if (tempFilePath) {
      try {
        const tempDir = path.dirname(tempFilePath);
        await fs.unlink(tempFilePath);
        await fs.rmdir(tempDir);
      } catch (cleanupError) {
        console.error(chalk.yellow('Failed to cleanup temporary editor file:'), cleanupError);
      }
    }
    throw error; // Re-throw the original error
  }
} 