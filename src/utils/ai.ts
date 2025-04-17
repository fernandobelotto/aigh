import OpenAI from 'openai';
import chalk from 'chalk';
import ora from 'ora';

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.error(
    chalk.red(
      'Error: OPENAI_API_KEY environment variable is not set. Please add it to your .env file or environment.',
    ),
  );
  // Optionally exit or handle this case differently depending on requirements
  // For now, we allow proceeding but OpenAI calls will fail.
}

// Initialize OpenAI client only if API key exists
const openai = apiKey ? new OpenAI({ apiKey }) : null;

const MODEL = 'gpt-4o-mini'; // Or choose another model

// Helper function to clean AI generated messages
function cleanAiMessage(message: string): string {
  // Remove leading/trailing ``` with optional language identifier and whitespace
  return message.replace(/^```(?:\w+)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
}

// Placeholder for generating commit message
export async function generateCommitMessage(diff: string): Promise<string> {
  if (!openai) {
    console.error(chalk.red('OpenAI client not initialized. Check API key.'));
    return 'chore: OpenAI client not available';
  }
  if (!diff) {
    return 'feat: No changes detected'; // Default message if diff is empty
  }

  const spinner = ora('Generating commit message with AI...').start();

  const prompt = `Generate a concise git commit message in the conventional commit format for the following diff:

\`\`\`diff
${diff}
\`\`\`

Commit message:`;

  try {
    const completion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: MODEL,
      max_tokens: 50,
      temperature: 0.7,
    });

    const rawMessage = completion.choices[0]?.message?.content?.trim();
    if (!rawMessage) {
      throw new Error('AI did not return a message.');
    }
    
    // Clean the message before returning
    const cleanedMessage = cleanAiMessage(rawMessage);
    spinner.succeed('AI generated commit message!');

    return cleanedMessage;
  } catch (error) {
    spinner.fail('Failed to generate commit message.');
    console.error(
      chalk.red('Error details:'),
      error instanceof Error ? error.message : error,
    );
    // Fallback message
    return 'chore: Failed to generate commit message';
  }
}

// Placeholder for generating PR description
export async function generatePrDescription(
  diff: string,
  template?: string | null,
): Promise<{ title: string; body: string }> {
  if (!openai) {
    console.error(chalk.red('OpenAI client not initialized. Check API key.'));
    return {
      title: 'chore: OpenAI client not available',
      body: 'OpenAI client not initialized. Check API key.',
    };
  }

  const spinner = ora('Generating PR title and description with AI...').start();

  const prompt = `Generate a Pull Request title and description for the following changes.

${template ? `Use this PR template as a base:\n---TEMPLATE START---\n${template}\n---TEMPLATE END---\n\n` : ''}Apply the following diff to generate the content:
\`\`\`diff
${diff}
\`\`\`

Format the output as follows:
PR Title: [Generated PR Title]
PR Description:
[Generated PR Description based on diff and template if provided]`;

  try {
    const completion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: MODEL,
      max_tokens: 400, // Allow more tokens for PR descriptions
      temperature: 0.7,
    });

    const rawContent = completion.choices[0]?.message?.content?.trim();
    if (!rawContent) {
      throw new Error('AI did not return content.');
    }

    // Extract title and body
    // Updated regex to handle potential markdown bold formatting around labels
    const titleMatch = rawContent.match(/^\*?\*?PR Title:\*?\*? (.*)/im);
    let title = titleMatch ? cleanAiMessage(titleMatch[1].trim()) : 'Generated PR'; // Default fallback title
    let body = rawContent;

    // Remove the matched title line from the body content
    if (titleMatch) {
      body = body.replace(titleMatch[0], '');
    }
    
    // Remove the description label (potentially with markdown) and clean the body
    body = cleanAiMessage(
      body
        .replace(/^\*?\*?PR Description:\*?\*?\n?/, '') 
        .trim()
    );

    // If the title extraction failed initially, try to find it anywhere in the body
    // (Handles cases where formatting might be slightly off)
    if (title === 'Generated PR') {
        const secondaryTitleMatch = body.match(/^\*?\*?PR Title:\*?\*? (.*)/im);
        if (secondaryTitleMatch) {
            title = cleanAiMessage(secondaryTitleMatch[1].trim());
            // Remove the title line from the body again if found this way
            body = cleanAiMessage(body.replace(secondaryTitleMatch[0], '').trim());
        }
    }

    spinner.succeed('AI generated PR title and description!');

    return { title, body };
  } catch (error) {
    spinner.fail('Failed to generate PR description.');
    console.error(
      chalk.red('Error details:'),
      error instanceof Error ? error.message : error,
    );
    return {
      title: 'chore: Failed to generate PR title',
      body: `Failed to generate PR description.\n\nDiff:\n\`\`\`diff\n${diff}\n\`\`\``,
    };
  }
}
 