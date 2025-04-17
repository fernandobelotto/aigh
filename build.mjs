import * as esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';

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
  external: ['openai', 'dotenv', 'chalk', 'inquirer', 'execa', 'ora'],
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
      console.log('Build complete.');
    }
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build(); 