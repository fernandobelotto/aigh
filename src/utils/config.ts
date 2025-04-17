import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import chalk from 'chalk';

// Define the structure of the configuration
export interface AIGHConfig {
  ai_provider?: 'openai' | 'gemini'; // Specify the AI provider
  openai_api_key?: string;
  openai_model?: string;
  google_api_key?: string; // API key for Google Gemini
  gemini_model?: string; // Model name for Gemini (e.g., 'gemini-1.5-flash')
  // Add other potential config keys here later
  [key: string]: unknown; // Allow other keys
}

// Default configuration values
const DEFAULT_AIGH_CONFIG: AIGHConfig = {
  ai_provider: 'openai', // Default to OpenAI
  openai_model: 'gpt-4o-mini',
  gemini_model: 'gemini-1.5-flash', // Default Gemini model
};

// Path to the configuration file
const CONFIG_DIR = path.join(os.homedir(), '.aigh');
const CONFIG_FILE_PATH = path.join(CONFIG_DIR, 'config.json');

// Ensure the configuration directory exists
async function ensureConfigDirExists(): Promise<void> {
  try {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
  } catch (error: unknown) {
    // Ignore EEXIST error (directory already exists)
    if (error instanceof Error && (error as NodeJS.ErrnoException).code === 'EEXIST') {
      // Do nothing
    } else {
      console.error(chalk.red(`Error creating config directory ${CONFIG_DIR}:`), error);
      throw error; // Re-throw other errors
    }
  }
}

/**
 * Loads the GHP configuration from ~/.ghp/config.json.
 * Merges loaded config with defaults.
 * Handles file not existing gracefully.
 */
export async function loadConfig(): Promise<AIGHConfig> {
  await ensureConfigDirExists();
  let userConfig: Partial<AIGHConfig> = {};

  try {
    const fileContent = await fs.readFile(CONFIG_FILE_PATH, 'utf-8');
    // Prevent parsing empty strings which causes JSON errors
    if (fileContent.trim() === '') {
        // Treat empty file same as non-existent file (use defaults)
        userConfig = {};
    } else {
        userConfig = JSON.parse(fileContent) as Partial<AIGHConfig>;
    }
  } catch (error: unknown) {
    if (error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
      // Config file doesn't exist, OK, use defaults (userConfig already {})
    } else if (error instanceof SyntaxError) {
        // Config file exists but is invalid JSON (e.g., corrupted, manually edited incorrectly)
        // Log a warning but proceed with defaults, don't crash.
        console.warn(chalk.yellow(`Warning: Config file at ${CONFIG_FILE_PATH} contains invalid JSON. Using default settings.`));
        // userConfig remains {} 
    } else {
      // Log other unexpected errors (permissions, etc.)
      console.error(chalk.red('Unexpected error reading config file:'), error);
      // Still proceed with defaults, but log the error
    }
  }

  // Merge user config with defaults, user config takes precedence
  // Also include API keys from env if not set in config
  const envOpenaiApiKey = process.env.OPENAI_API_KEY;
  const envGoogleApiKey = process.env.GOOGLE_API_KEY; // Check for Google key in env

  const finalConfig = {
    ...DEFAULT_AIGH_CONFIG,
    ...userConfig,
  };

  // Prioritize config file key over env var, but use env var if config key missing
  if (!finalConfig.openai_api_key && envOpenaiApiKey) {
    finalConfig.openai_api_key = envOpenaiApiKey;
  }
  if (!finalConfig.google_api_key && envGoogleApiKey) {
    finalConfig.google_api_key = envGoogleApiKey;
  }

  return finalConfig;
}

/**
 * Saves the provided configuration object to ~/.ghp/config.json.
 */
export async function saveConfig(config: AIGHConfig): Promise<void> {
  await ensureConfigDirExists();
  try {
    // Don't save environment variable API keys back to the file
    const configToSave = { ...config };
    if (configToSave.openai_api_key === process.env.OPENAI_API_KEY) {
      delete configToSave.openai_api_key;
    }
    if (configToSave.google_api_key === process.env.GOOGLE_API_KEY) {
      delete configToSave.google_api_key;
    }

    const fileContent = JSON.stringify(configToSave, null, 2); // Pretty print JSON
    await fs.writeFile(CONFIG_FILE_PATH, fileContent, 'utf-8');
  } catch (error: unknown) {
    console.error(chalk.red('Error saving config file:'), error);
    throw error; // Re-throw error
  }
} 