#!/usr/bin/env node

/**
 * OpenFigma Desktop Studio - Native Standalone App Launcher
 * Launches the OpenFigma live canvas preview and MCP companion bridge in a dedicated
 * desktop application window (zero URL bar, standalone window) without heavy Electron overhead.
 */

import http from 'node:http';
import { spawn, exec } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const PORT = parseInt(process.env.OPEN_FIGMA_PORT || process.env.PORT || '3845', 10);
const APP_URL = `http://127.0.0.1:${PORT}/preview`;

console.log('================================================================');
console.log('🖥️  OPENFIGMA DESKTOP STUDIO (NATIVE APP RUNNER)');
console.log('================================================================\n');

function checkServerReady(port) {
  return new Promise((res) => {
    const req = http.get(`http://127.0.0.1:${port}/healthz`, (response) => {
      res(response.statusCode === 200);
    });
    req.on('error', () => res(false));
    req.setTimeout(1000, () => {
      req.destroy();
      res(false);
    });
  });
}

async function startServerIfNeeded() {
  const isRunning = await checkServerReady(PORT);
  if (isRunning) {
    console.log(`✔ OpenFigma background daemon already active on port ${PORT}`);
    return null;
  }

  console.log(`⏳ Launching OpenFigma daemon on http://127.0.0.1:${PORT}...`);
  const serverPath = resolve(rootDir, 'src', 'server.js');
  const serverProcess = spawn(process.execPath, [serverPath, '--port', String(PORT)], {
    cwd: rootDir,
    stdio: 'ignore',
    detached: true,
  });
  serverProcess.unref();

  // Wait for healthz probe
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 200));
    if (await checkServerReady(PORT)) {
      console.log(`✔ OpenFigma daemon ready on port ${PORT}`);
      return serverProcess;
    }
  }

  throw new Error(`Server failed to start on port ${PORT} within 4 seconds.`);
}

function launchDesktopWindow(url) {
  const platform = process.platform;
  console.log(`🚀 Spawning native desktop application window for: ${url}\n`);

  if (platform === 'win32') {
    // Windows: Check MS Edge or Chrome in app mode
    const edgePaths = [
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    ];
    const chromePaths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    ];

    let browserExe = null;
    for (const p of [...edgePaths, ...chromePaths]) {
      if (existsSync(p)) {
        browserExe = p;
        break;
      }
    }

    if (browserExe) {
      const child = spawn(browserExe, [`--app=${url}`, '--window-size=1360,860', '--app-id=open-figma-desktop'], {
        detached: true,
        stdio: 'ignore',
      });
      child.unref();
      console.log(`✔ Native Desktop Window launched via: ${browserExe}`);
      return;
    }

    // Fallback to default browser
    exec(`start ${url}`);
  } else if (platform === 'darwin') {
    // macOS: Try Chrome app mode or open
    const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    if (existsSync(chromePath)) {
      const child = spawn(chromePath, [`--app=${url}`, '--window-size=1360,860'], {
        detached: true,
        stdio: 'ignore',
      });
      child.unref();
      console.log(`✔ Native Desktop Window launched via Google Chrome`);
      return;
    }
    exec(`open "${url}"`);
  } else {
    // Linux
    exec(`google-chrome --app="${url}" || chromium --app="${url}" || xdg-open "${url}"`);
  }
}

async function main() {
  try {
    await startServerIfNeeded();
    launchDesktopWindow(APP_URL);
    console.log('\n================================================================');
    console.log('🎉 OpenFigma Studio is running!');
    console.log(`   - Live Interactive Studio: ${APP_URL}`);
    console.log(`   - Figma Companion Bridge:  ws://127.0.0.1:${PORT}`);
    console.log(`   - Prometheus Metrics:      http://127.0.0.1:${PORT}/metrics`);
    console.log('================================================================\n');
  } catch (err) {
    console.error('❌ Failed to launch desktop studio:', err.message);
    process.exit(1);
  }
}

main();
