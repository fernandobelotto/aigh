import chalk from 'chalk';
import inquirer from 'inquirer';
import { loadConfig, saveConfig, AIGHConfig } from '../utils/config.js';

// Define allowed keys explicitly to help TypeScript
const VALID_KEYS: ReadonlyArray<string> = [
  'ai_provider',
  'model',
  'openai_api_key',
  'anthropic_api_key',
  'google_api_key',
];

// Available providers and their models
const PROVIDERS = [
  { name: 'OpenAI', value: 'openai' },
  { name: 'Anthropic (Claude)', value: 'anthropic' },
  { name: 'Google (Gemini)', value: 'google' },
] as const;

// Model lists from @ai-sdk provider type definitions (v2.x packages)
// OpenAI: node_modules/@ai-sdk/openai/dist/index.d.ts (OpenAIChatModelId)
// Anthropic: node_modules/@ai-sdk/anthropic/dist/index.d.ts (AnthropicMessagesModelId)
// Google: node_modules/@ai-sdk/google/dist/index.d.ts (GoogleGenerativeAIModelId)
const MODELS_BY_PROVIDER: Record<string, Array<{ name: string; value: string }>> = {
  openai: [
    { name: 'GPT-5.2 Pro (Recommended)', value: 'gpt-5.2-pro' },
    { name: 'GPT-5.2', value: 'gpt-5.2' },
    { name: 'GPT-5.1', value: 'gpt-5.1' },
    { name: 'GPT-5', value: 'gpt-5' },
    { name: 'GPT-5 Mini', value: 'gpt-5-mini' },
    { name: 'GPT-5 Nano', value: 'gpt-5-nano' },
    { name: 'GPT-4.5 Preview', value: 'gpt-4.5-preview' },
    { name: 'GPT-4.1', value: 'gpt-4.1' },
    { name: 'GPT-4.1 Mini', value: 'gpt-4.1-mini' },
    { name: 'GPT-4o', value: 'gpt-4o' },
    { name: 'O3', value: 'o3' },
    { name: 'O3 Mini', value: 'o3-mini' },
    { name: 'O1', value: 'o1' },
  ],
  anthropic: [
    { name: 'Claude Opus 4.5 (Recommended)', value: 'claude-opus-4-5' },
    { name: 'Claude Opus 4.1', value: 'claude-opus-4-1' },
    { name: 'Claude Opus 4.0', value: 'claude-opus-4-0' },
    { name: 'Claude Sonnet 4.5', value: 'claude-sonnet-4-5' },
    { name: 'Claude Sonnet 4.0', value: 'claude-sonnet-4-0' },
    { name: 'Claude Haiku 4.5', value: 'claude-haiku-4-5' },
    { name: 'Claude 3.7 Sonnet', value: 'claude-3-7-sonnet-latest' },
    { name: 'Claude 3.5 Haiku', value: 'claude-3-5-haiku-latest' },
  ],
  google: [
    { name: 'Gemini 3 Pro Preview (Recommended)', value: 'gemini-3-pro-preview' },
    { name: 'Gemini 3 Flash Preview', value: 'gemini-3-flash-preview' },
    { name: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro' },
    { name: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash' },
    { name: 'Gemini 2.5 Flash Lite', value: 'gemini-2.5-flash-lite' },
    { name: 'Gemini 2.0 Flash', value: 'gemini-2.0-flash' },
    { name: 'Gemini 1.5 Pro', value: 'gemini-1.5-pro' },
    { name: 'Gemma 3 27B', value: 'gemma-3-27b-it' },
  ],
};

// Type guard to check if a key is a valid AIGHConfig key string
function isValidConfigKey(key: string): key is keyof AIGHConfig & string {
    return VALID_KEYS.includes(key);
}

// Helper to safely get and mask config values
function getDisplayValue(config: AIGHConfig, key: keyof AIGHConfig & string): string {
    const value = config[key];
    if (value === undefined || value === null) {
        return chalk.grey('(Not set)');
    }
    // Ensure value is a string before using string methods
    if (typeof value === 'string' && key.includes('_api_key')) {
        return `${value.slice(0, 4)}...${value.slice(-4)}`;
    }
    return String(value);
}

export async function handleConfigGet(key?: string) {
  const config = await loadConfig();

  if (key) {
    if (isValidConfigKey(key)) {
      console.log(`${key}: ${getDisplayValue(config, key)}`);
    } else {
      console.error(chalk.red(`Invalid config key: ${key}`));
      console.log(chalk.blue('Valid keys are:'), VALID_KEYS.join(', '));
      process.exit(1);
    }
  } else {
    console.log(chalk.bold('Current aigh configuration:'));
    for (const k of VALID_KEYS) {
       // Ensure k is treated as a valid key string here
       if (isValidConfigKey(k)) {
        console.log(`  ${k}: ${getDisplayValue(config, k)}`);
       }
    }
    console.log(chalk.dim(`\nConfig file location: ~/.aigh/config.json`));
  }
}

export async function handleConfigSet(key: string, value: string) {
  if (!isValidConfigKey(key)) {
    console.error(chalk.red(`Invalid config key: ${key}`));
    console.log(chalk.blue('Valid keys are:'), VALID_KEYS.join(', '));
    process.exit(1);
  }

  if (key === 'ai_provider' && !['openai', 'anthropic', 'google'].includes(value)) {
      console.error(chalk.red(`Invalid value for ai_provider: ${value}. Must be 'openai', 'anthropic', or 'google'.`));
      process.exit(1);
  }

  const config = await loadConfig();

  // Now that key is validated as keyof AIGHConfig, assignment is safer
  // We still need to handle potential type mismatches if not string, but for now:
  config[key] = value as any; // Use 'as any' carefully after validation, or add specific type checks

  try {
    await saveConfig(config);
    console.log(chalk.green(`Successfully set ${key} to ${value}`));
    // Provide feedback based on the key set
    if (key.includes('_api_key')) {
        console.log(chalk.yellow(`API key saved to ~/.aigh/config.json. It won't be displayed fully.`));
    } else if (key === 'ai_provider') {
        const keyMap: Record<string, { key: string; env: string }> = {
          openai: { key: 'openai_api_key', env: 'OPENAI_API_KEY' },
          anthropic: { key: 'anthropic_api_key', env: 'ANTHROPIC_API_KEY' },
          google: { key: 'google_api_key', env: 'GOOGLE_GENERATIVE_AI_API_KEY' },
        };
        const { key: requiredKey, env: envVarName } = keyMap[value] || {};
        if (requiredKey && isValidConfigKey(requiredKey) && !config[requiredKey] && !process.env[envVarName]) {
            console.log(chalk.yellow(`Switched provider to ${value}. Remember to set the ${requiredKey}!`));
        }
    }

  } catch (error) {
    console.error(chalk.red(`Failed to save configuration for key ${key}:`), error);
    process.exit(1);
  }
}

export async function handleConfigSetup() {
  console.log(chalk.bold('\n  aigh Configuration Setup\n'));

  const config = await loadConfig();

  // Step 1: Select AI Provider
  const { provider } = await inquirer.prompt<{ provider: 'openai' | 'anthropic' | 'google' }>([
    {
      type: 'list',
      name: 'provider',
      message: 'Select your AI provider:',
      choices: PROVIDERS,
      default: config.ai_provider || 'openai',
    },
  ]);

  // Step 2: Select Model for the chosen provider
  const models = MODELS_BY_PROVIDER[provider];
  const { model } = await inquirer.prompt<{ model: string }>([
    {
      type: 'list',
      name: 'model',
      message: `Select a model for ${PROVIDERS.find(p => p.value === provider)?.name}:`,
      choices: [
        ...models,
        new inquirer.Separator(),
        { name: 'Enter custom model name', value: '__custom__' },
      ],
      default: config.model || models[0].value,
    },
  ]);

  let finalModel = model;
  if (model === '__custom__') {
    const { customModel } = await inquirer.prompt<{ customModel: string }>([
      {
        type: 'input',
        name: 'customModel',
        message: 'Enter the model name:',
        validate: (input: string) => input.trim() ? true : 'Model name cannot be empty',
      },
    ]);
    finalModel = customModel;
  }

  // Step 3: Check if API key is set, prompt if not
  const keyMap: Record<string, { configKey: keyof AIGHConfig; envVar: string; name: string }> = {
    openai: { configKey: 'openai_api_key', envVar: 'OPENAI_API_KEY', name: 'OpenAI' },
    anthropic: { configKey: 'anthropic_api_key', envVar: 'ANTHROPIC_API_KEY', name: 'Anthropic' },
    google: { configKey: 'google_api_key', envVar: 'GOOGLE_GENERATIVE_AI_API_KEY', name: 'Google' },
  };

  const { configKey, envVar, name } = keyMap[provider];
  const existingKey = config[configKey] || process.env[envVar];

  let apiKey: string | undefined;
  if (existingKey) {
    const maskedKey = typeof existingKey === 'string'
      ? `${existingKey.slice(0, 4)}...${existingKey.slice(-4)}`
      : '(set)';
    const { updateKey } = await inquirer.prompt<{ updateKey: boolean }>([
      {
        type: 'confirm',
        name: 'updateKey',
        message: `${name} API key is already set (${maskedKey}). Update it?`,
        default: false,
      },
    ]);
    if (updateKey) {
      const { newKey } = await inquirer.prompt<{ newKey: string }>([
        {
          type: 'password',
          name: 'newKey',
          message: `Enter your ${name} API key:`,
          mask: '*',
          validate: (input: string) => input.trim() ? true : 'API key cannot be empty',
        },
      ]);
      apiKey = newKey;
    }
  } else {
    const { newKey } = await inquirer.prompt<{ newKey: string }>([
      {
        type: 'password',
        name: 'newKey',
        message: `Enter your ${name} API key:`,
        mask: '*',
        validate: (input: string) => input.trim() ? true : 'API key cannot be empty',
      },
    ]);
    apiKey = newKey;
  }

  // Save configuration
  config.ai_provider = provider;
  config.model = finalModel;
  if (apiKey) {
    config[configKey] = apiKey;
  }

  try {
    await saveConfig(config);
    console.log(chalk.green('\n  Configuration saved successfully!\n'));
    console.log(chalk.dim('  Provider:'), chalk.cyan(provider));
    console.log(chalk.dim('  Model:   '), chalk.cyan(finalModel));
    console.log(chalk.dim('  API Key: '), chalk.cyan(apiKey ? 'Updated' : 'Unchanged'));
    console.log(chalk.dim('\n  Config file: ~/.aigh/config.json\n'));
  } catch (error) {
    console.error(chalk.red('\n  Failed to save configuration:'), error);
    process.exit(1);
  }
}