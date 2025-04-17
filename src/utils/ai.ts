import OpenAI from 'openai';
import chalk from 'chalk';
import ora from 'ora';
import { loadConfig } from './config.js'; // Import config loader
import { GoogleGenAI } from "@google/genai";

// Function to initialize OpenAI client based on config
async function getOpenAIClient() {
  const config = await loadConfig();
  const apiKey = config.openai_api_key;

  if (!apiKey) {
    console.error(
      chalk.red(
        'Error: OpenAI API key not found. Please set OPENAI_API_KEY environment variable or run `ghp config set openai_api_key YOUR_KEY`.',
      ),
    );
    return null;
  }
  return new OpenAI({ apiKey });
}

async function getGoogleGenAIClient() {
  const config = await loadConfig();
  const apiKey = config.google_api_key;
  if (!apiKey) {
    console.error(
      chalk.red(
        'Error: Google API key not found. Please set GOOGLE_API_KEY env var or run `ghp config set google_api_key YOUR_KEY`.',
      ),
    );
    return null;
  }

  const ai = new GoogleGenAI({ apiKey: apiKey });
  return ai;
}

// Helper function to clean AI generated messages
function cleanAiMessage(message: string): string {
  let cleaned = message.trim();
  // Remove leading/trailing ``` with optional language identifier and whitespace
  cleaned = cleaned.replace(/^```(?:\w+)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();

  // Attempt to find the start of the actual commit message (conventional commit format)
  const lines = cleaned.split('\n');
  const commitStartIndex = lines.findIndex(line => /^[a-zA-Z]+(\([^)]+\))?!?:/.test(line.trim()));

  if (commitStartIndex !== -1) {
    // If a conventional commit line is found, take it and everything after
    cleaned = lines.slice(commitStartIndex).join('\n').trim();
  }
  // Return the potentially cleaner message
  return cleaned;
}

function parseGeminiResponseForPr(responseText: string): { title: string; body: string } {
    // Attempt to parse structured output from Gemini
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

// Placeholder for generating commit message
export async function generateCommitMessage(diff: string): Promise<string> {
  const config = await loadConfig();
  const provider = config.ai_provider || 'openai';

  if (!diff) {
    return 'feat: No changes detected';
  }

  let model: string | undefined;
  let spinner = ora(); // Initialize spinner

  try {
    let generatedMessage: string | null = null;

    if (provider === 'openai') {
      const openai = await getOpenAIClient();
      if (!openai) return 'chore: OpenAI client not available';
      model = config.openai_model || 'gpt-4o-mini';
      spinner = ora(`Generating commit message with OpenAI (${model})...`).start();

      const prompt = `Generate a concise git commit message in the conventional commit format for the following diff:\n\n\`\`\`diff\n${diff}\n\`\`\`\n\nCommit message:`;
      const completion = await openai.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: model,
        max_tokens: 60, // Slightly increased token limit
        temperature: 0.7,
      });
      generatedMessage = completion.choices[0]?.message?.content;

    } else if (provider === 'gemini') {
      const genAIInstance = await getGoogleGenAIClient(); // Renamed variable for clarity
      if (!genAIInstance) return 'chore: Gemini client not available';
      model = config.gemini_model || 'gemini-1.5-flash';
      spinner = ora(`Generating commit message with Gemini (${model})...`).start();

      const prompt = `Generate a concise git commit message in the conventional commit format for the following diff:\n\n\`\`\`diff\n${diff}\n\`\`\`\n\nCommit message:`;
      // Use the initialized client instance
      const result = await genAIInstance.models.generateContent({ model: model, contents: prompt });
      generatedMessage = result.text ?? null;
    } else {
      throw new Error(`Unsupported AI provider: ${provider}`);
    }

    if (!generatedMessage) {
      throw new Error('AI did not return a message.');
    }

    const cleanedMessage = cleanAiMessage(generatedMessage);
    spinner.succeed(`AI (${provider}) generated commit message!`);
    return cleanedMessage;

  } catch (error) {
    spinner.fail(`Failed to generate commit message using ${provider} (${model}).`);
    console.error(chalk.red('Error details:'), error instanceof Error ? error.message : error);
    return `chore: Failed to generate commit message via ${provider}`;
  }
}

// Placeholder for generating PR description
export async function generatePrDescription(
  diff: string,
  template?: string | null,
): Promise<{ title: string; body: string }> {
  const config = await loadConfig();
  const provider = config.ai_provider || 'openai';

  let model: string | undefined;
  let spinner = ora();

  const fallbackResult = {
      title: `chore: Failed to generate PR title via ${provider}`,
      body: `Failed to generate PR description via ${provider}.\n\nDiff:\n\`\`\`diff\n${diff}\n\`\`\``,
  };

  try {
    let title: string | undefined;
    let body: string | undefined;

    const basePrompt = `Generate a Pull Request title and description for the following changes.`;
    const templatePrompt = template ? `Use this PR template as a base:\n---TEMPLATE START---\n${template}\n---TEMPLATE END---\n\n` : '';
    const diffPrompt = `Apply the following diff to generate the content:\n\`\`\`diff\n${diff}\n\`\`\``;
    const formatPrompt = `Format the output EXACTLY as follows, including the labels:\nPR Title: [Generated PR Title]\nPR Description:\n[Generated PR Description based on diff and template if provided]`;
    const fullPrompt = `${basePrompt}\n\n${templatePrompt}${diffPrompt}\n\n${formatPrompt}`;

    if (provider === 'openai') {
      const openai = await getOpenAIClient();
      if (!openai) return { title: 'chore: OpenAI client not available', body: 'Client init failed.' };
      model = config.openai_model || 'gpt-4o-mini';
      spinner = ora(`Generating PR details with OpenAI (${model})...`).start();

      const completion = await openai.chat.completions.create({
        messages: [{ role: 'user', content: fullPrompt }],
        model: model,
        max_tokens: 500, // Increased token limit for PRs
        temperature: 0.7,
      });
      const rawContent = completion.choices[0]?.message?.content?.trim();
      if (!rawContent) throw new Error('OpenAI did not return content.');
      // Use the same parsing logic for OpenAI response
      const parsed = parseGeminiResponseForPr(rawContent);
      title = parsed.title;
      body = parsed.body;


    } else if (provider === 'gemini') {
      const genAIInstance = await getGoogleGenAIClient(); // Renamed variable for clarity
      if (!genAIInstance) return { title: 'chore: Gemini client not available', body: 'Client init failed.' };
      model = config.gemini_model || 'gemini-1.5-flash';
      spinner = ora(`Generating PR details with Gemini (${model})...`).start();

      // Use the initialized client instance
      const geminiModel = genAIInstance.getGenerativeModel({ model: model });
      const result = await geminiModel.generateContent(fullPrompt);
      const response = result.response;
      const rawContent = response.text();
      if (!rawContent) throw new Error('Gemini did not return content.');
      const parsed = parseGeminiResponseForPr(rawContent);
      title = parsed.title;
      body = parsed.body;

    } else {
      throw new Error(`Unsupported AI provider: ${provider}`);
    }

    if (!title || body === undefined) { // Check if body is explicitly undefined
        throw new Error('Failed to parse AI response for title and body.');
    }

    spinner.succeed(`AI (${provider}) generated PR title and description!`);
    return { title, body };

  } catch (error) {
    spinner.fail(`Failed to generate PR description using ${provider} (${model}).`);
    console.error(chalk.red('Error details:'), error instanceof Error ? error.message : error);
    return fallbackResult;
  }
}
 