import * as esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isWatch = process.argv.includes('--watch');
const isDev = process.argv.includes('--dev') || isWatch;

const sharedConfig = {
  entryPoints: ['src/cli.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node18',
  external: ['openai', '@google/genai', 'dotenv', 'chalk', 'inquirer', 'execa', 'ora'],
  charset: 'utf8',
  sourcemap: isDev ? 'inline' : false,
  minify: !isDev,
  treeShaking: true,
  define: {
    'process.env.NODE_ENV': isDev ? '"development"' : '"production"'
  },
  logLevel: 'info',
};

async function build() {
  try {
    const context = await esbuild.context({
      ...sharedConfig,
      outfile: 'dist/cli.js',
    });

    if (isWatch) {
      await context.watch();
      console.log('Watching for changes...');
    } else {
      await context.rebuild();
      await context.dispose();

      // Make the CLI file executable
      const cliPath = path.join(__dirname, 'dist', 'cli.js');
      try {
        fs.chmodSync(cliPath, '755');
        console.log('Made CLI file executable');
      } catch (error) {
        console.error('Failed to make CLI file executable:', error);
      }
      
      console.log('Build complete.');
    }
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build(); 