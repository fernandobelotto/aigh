import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import chalk from 'chalk';
import ora from 'ora';
import { loadConfig, AIGHConfig } from './config.js';

// Default models per provider (v2.x packages)
// From @ai-sdk provider type definitions
const DEFAULT_MODELS: Record<string, string> = {
  openai: 'gpt-5.2-pro',
  anthropic: 'claude-opus-4-5',
  google: 'gemini-3-pro-preview',
};

// Get the model instance based on config
function getModel(config: AIGHConfig) {
  const provider = config.ai_provider || 'openai';
  const modelName = config.model || DEFAULT_MODELS[provider];

  switch (provider) {
    case 'openai': {
      if (!config.openai_api_key) {
        throw new Error(
          'OpenAI API key not found. Please set OPENAI_API_KEY environment variable or run `aigh config set openai_api_key YOUR_KEY`.',
        );
      }
      const openai = createOpenAI({ apiKey: config.openai_api_key });
      return { model: openai(modelName), provider, modelName };
    }
    case 'anthropic': {
      if (!config.anthropic_api_key) {
        throw new Error(
          'Anthropic API key not found. Please set ANTHROPIC_API_KEY environment variable or run `aigh config set anthropic_api_key YOUR_KEY`.',
        );
      }
      const anthropic = createAnthropic({ apiKey: config.anthropic_api_key });
      return { model: anthropic(modelName), provider, modelName };
    }
    case 'google': {
      if (!config.google_api_key) {
        throw new Error(
          'Google API key not found. Please set GOOGLE_GENERATIVE_AI_API_KEY environment variable or run `aigh config set google_api_key YOUR_KEY`.',
        );
      }
      const google = createGoogleGenerativeAI({ apiKey: config.google_api_key });
      return { model: google(modelName), provider, modelName };
    }
    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
}

// Helper function to clean AI generated messages
function cleanAiMessage(message: string): string {
  let cleaned = message.trim();
  // Remove leading/trailing ``` with optional language identifier and whitespace
  cleaned = cleaned
    .replace(/^```(?:\w+)?\s*\n?/, '')
    .replace(/\n?```\s*$/, '')
    .trim();

  // Attempt to find the start of the actual commit message (conventional commit format)
  const lines = cleaned.split('\n');
  const commitStartIndex = lines.findIndex((line) => /^[a-zA-Z]+(\([^)]+\))?!?:/.test(line.trim()));

  if (commitStartIndex !== -1) {
    // If a conventional commit line is found, take it and everything after
    cleaned = lines.slice(commitStartIndex).join('\n').trim();
  }
  // Return the potentially cleaner message
  return cleaned;
}

function parseResponseForPr(responseText: string): { title: string; body: string } {
  // Attempt to parse structured output
  const titleMatch = responseText.match(/^\*?\*?PR Title:\*?\*? (.*)/im);
  let title = titleMatch ? cleanAiMessage(titleMatch[1].trim()) : '';
  let body = responseText;

  if (titleMatch) {
    body = body.replace(titleMatch[0], '');
  }
  body = cleanAiMessage(body.replace(/^\*?\*?PR Description:\*?\*?\n?/, '').trim());

  // If parsing failed, use the whole response as body and generate a fallback title
  if (!title) {
    title = 'Generated PR Description'; // Fallback title
    body = cleanAiMessage(responseText); // Use the full cleaned response as body
  }
  return { title, body };
}

// Generate commit message using AI
export async function generateCommitMessage(diff: string): Promise<string> {
  const config = await loadConfig();

  if (!diff) {
    return 'feat: No changes detected';
  }

  let spinner = ora();

  try {
    const { model, provider, modelName } = getModel(config);
    spinner = ora(`Generating commit message with ${provider} (${modelName})...`).start();

    const prompt = `Generate a concise git commit message in the conventional commit format for the following diff:\n\n\`\`\`diff\n${diff}\n\`\`\`\n\nCommit message:`;

    const response = await generateText({
      model,
      prompt,
      maxOutputTokens: 1024,
    });

    if (process.env.AIGH_DEBUG) {
      console.log(chalk.gray('\n[DEBUG] Full generateText response:'));
      console.log(chalk.gray(JSON.stringify(response, null, 2)));
    }

    const { text } = response;

    if (!text) {
      throw new Error('AI did not return a message.');
    }

    const cleanedMessage = cleanAiMessage(text);
    // Extract only the first line (the commit header)
    const firstLine = cleanedMessage.split('\n')[0].trim();

    spinner.succeed(`AI (${provider}) generated commit message!`);
    return firstLine;
  } catch (error) {
    const provider = config.ai_provider || 'openai';
    spinner.fail(`Failed to generate commit message using ${provider}.`);
    console.error(chalk.red('Error details:'), error instanceof Error ? error.message : error);
    if (process.env.AIGH_DEBUG && error instanceof Error) {
      console.log(chalk.gray('\n[DEBUG] Full error:'));
      console.log(chalk.gray(error.stack || error.toString()));
      if ('cause' in error) {
        console.log(chalk.gray('[DEBUG] Error cause:'), error.cause);
      }
    }
    return `chore: Failed to generate commit message via ${provider}`;
  }
}

// Generate PR description using AI
export async function generatePrDescription(
  diff: string,
  template?: string | null,
): Promise<{ title: string; body: string }> {
  const config = await loadConfig();
  const provider = config.ai_provider || 'openai';

  let spinner = ora();

  const fallbackResult = {
    title: `chore: Failed to generate PR title via ${provider}`,
    body: `Failed to generate PR description via ${provider}.\n\nDiff:\n\`\`\`diff\n${diff}\n\`\`\``,
  };

  try {
    const { model, provider: providerName, modelName } = getModel(config);
    spinner = ora(`Generating PR details with ${providerName} (${modelName})...`).start();

    const basePrompt = `Generate a Pull Request title and description for the following changes.`;
    const templatePrompt = template
      ? `Use this PR template as a base:\n---TEMPLATE START---\n${template}\n---TEMPLATE END---\n\n`
      : '';
    const diffPrompt = `Apply the following diff to generate the content:\n\`\`\`diff\n${diff}\n\`\`\``;
    const formatPrompt = `Format the output EXACTLY as follows, including the labels:\nPR Title: [Generated PR Title]\nPR Description:\n[Generated PR Description based on diff and template if provided]`;
    const fullPrompt = `${basePrompt}\n\n${templatePrompt}${diffPrompt}\n\n${formatPrompt}`;

    const { text } = await generateText({
      model,
      prompt: fullPrompt,
      maxOutputTokens: 2048,
    });

    if (!text) {
      throw new Error('AI did not return content.');
    }

    const parsed = parseResponseForPr(text);

    if (!parsed.title || parsed.body === undefined) {
      throw new Error('Failed to parse AI response for title and body.');
    }

    spinner.succeed(`AI (${providerName}) generated PR title and description!`);
    return parsed;
  } catch (error) {
    spinner.fail(`Failed to generate PR description using ${provider}.`);
    console.error(chalk.red('Error details:'), error instanceof Error ? error.message : error);
    return fallbackResult;
  }
}
