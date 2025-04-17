import chalk from 'chalk';
import { loadConfig, saveConfig, GHPConfig } from '../utils/config.js';

// Define allowed keys explicitly to help TypeScript
const VALID_KEYS: ReadonlyArray<string> = [
  'ai_provider',
  'openai_api_key',
  'openai_model',
  'google_api_key',
  'gemini_model',
];

// Type guard to check if a key is a valid GHPConfig key string
function isValidConfigKey(key: string): key is keyof GHPConfig & string {
    return VALID_KEYS.includes(key);
}

// Helper to safely get and mask config values
function getDisplayValue(config: GHPConfig, key: keyof GHPConfig & string): string {
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
    console.log(chalk.bold('Current ghp configuration:'));
    for (const k of VALID_KEYS) {
       // Ensure k is treated as a valid key string here
       if (isValidConfigKey(k)) {
        console.log(`  ${k}: ${getDisplayValue(config, k)}`);
       }
    }
    console.log(chalk.dim(`\nConfig file location: ~/.ghp/config.json`));
  }
}

export async function handleConfigSet(key: string, value: string) {
  if (!isValidConfigKey(key)) {
    console.error(chalk.red(`Invalid config key: ${key}`));
    console.log(chalk.blue('Valid keys are:'), VALID_KEYS.join(', '));
    process.exit(1);
  }

  if (key === 'ai_provider' && value !== 'openai' && value !== 'gemini') {
      console.error(chalk.red(`Invalid value for ai_provider: ${value}. Must be 'openai' or 'gemini'.`));
      process.exit(1);
  }

  const config = await loadConfig();

  // Now that key is validated as keyof GHPConfig, assignment is safer
  // We still need to handle potential type mismatches if not string, but for now:
  config[key] = value as any; // Use 'as any' carefully after validation, or add specific type checks

  try {
    await saveConfig(config);
    console.log(chalk.green(`Successfully set ${key} to ${value}`));
    // Provide feedback based on the key set
    if (key === 'openai_api_key' || key === 'google_api_key') {
        console.log(chalk.yellow(`API key saved to ~/.ghp/config.json. It won't be displayed fully.`));
    } else if (key === 'ai_provider') {
        const requiredKey = value === 'openai' ? 'openai_api_key' : 'google_api_key';
        const envVarName = value === 'openai' ? 'OPENAI_API_KEY' : 'GOOGLE_API_KEY';
        // Ensure requiredKey is treated as a valid key string
        if (isValidConfigKey(requiredKey) && !config[requiredKey] && !process.env[envVarName]) {
            console.log(chalk.yellow(`Switched provider to ${value}. Remember to set the ${requiredKey}!`));
        }
    }

  } catch (error) {
    console.error(chalk.red(`Failed to save configuration for key ${key}:`), error);
    process.exit(1);
  }
} 