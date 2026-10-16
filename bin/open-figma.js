#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

// Check for native compiled binary first
const isWin = process.platform === 'win32';
const ext = isWin ? '.exe' : '';
const releaseBin = resolve(rootDir, 'target', 'release', `open-figma${ext}`);
const debugBin = resolve(rootDir, 'target', 'debug', `open-figma${ext}`);

let nativeBin = null;
if (existsSync(releaseBin)) {
  nativeBin = releaseBin;
} else if (existsSync(debugBin)) {
  nativeBin = debugBin;
}

if (nativeBin && !process.env.OPEN_FIGMA_FORCE_JS) {
  // Execute high-performance native Rust engine
  const child = spawn(nativeBin, process.argv.slice(2), {
    stdio: 'inherit',
    env: process.env,
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
    } else {
      process.exit(code ?? 0);
    }
  });
} else {
  // Execute universal Node.js engine
  await import('../src/server.js');
}
