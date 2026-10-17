/**
 * OpenFigma Client Configuration Generator
 * Automates one-click installation and configuration for Claude Desktop, Cursor, Zed, Windsurf, and VS Code.
 */

import path from 'node:path';
import os from 'node:os';

/**
 * Returns configuration objects or file paths for supported AI clients
 * @param {object} options
 * @param {string} [options.serverPath] - Absolute path to open-figma executable or server.js
 * @param {string} [options.apiKey] - Optional default Figma API token
 * @param {number} [options.port] - Port for HTTP mode
 * @returns {Record<string, object>} Config definitions for each client
 */
export function generateClientConfigs(options = {}) {
  const serverPath = options.serverPath || path.resolve(process.cwd(), 'src', 'server.js');
  const apiKey = options.apiKey || process.env.FIGMA_API_KEY || 'YOUR_FIGMA_API_KEY_HERE';
  const port = options.port || 3845;

  const isWindows = os.platform() === 'win32';
  const homeDir = os.homedir();

  // Paths for client configuration files
  const paths = {
    claudeDesktop: isWindows
      ? path.join(process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming'), 'Claude', 'claude_desktop_config.json')
      : path.join(homeDir, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'),
    cursor: path.join(process.cwd(), '.cursor', 'mcp.json'),
    zed: path.join(homeDir, '.config', 'zed', 'settings.json'),
    windsurf: path.join(homeDir, '.codeium', 'windsurf', 'mcp_config.json'),
    vscode: path.join(process.cwd(), '.vscode', 'mcp.json'),
    gemini: path.join(process.cwd(), 'gemini-extension.json'),
  };

  const configs = {
    claudeDesktop: {
      targetFile: paths.claudeDesktop,
      config: {
        mcpServers: {
          'open-figma': {
            command: 'node',
            args: [serverPath, '--stdio'],
            env: {
              FIGMA_API_KEY: apiKey,
            },
          },
        },
      },
    },
    cursor: {
      targetFile: paths.cursor,
      config: {
        mcpServers: {
          'open-figma': {
            command: 'node',
            args: [serverPath, '--stdio'],
            env: {
              FIGMA_API_KEY: apiKey,
            },
          },
        },
      },
    },
    zed: {
      targetFile: paths.zed,
      config: {
        experimental: {
          mcp: {
            servers: {
              'open-figma': {
                command: 'node',
                args: [serverPath, '--stdio'],
                env: {
                  FIGMA_API_KEY: apiKey,
                },
              },
            },
          },
        },
      },
    },
    windsurf: {
      targetFile: paths.windsurf,
      config: {
        mcpServers: {
          'open-figma': {
            command: 'node',
            args: [serverPath, '--stdio'],
            env: {
              FIGMA_API_KEY: apiKey,
            },
          },
        },
      },
    },
    vscode: {
      targetFile: paths.vscode,
      config: {
        servers: {
          'open-figma': {
            type: 'stdio',
            command: 'node',
            args: [serverPath, '--stdio'],
            env: {
              FIGMA_API_KEY: apiKey,
            },
          },
        },
      },
    },
    gemini: {
      targetFile: paths.gemini,
      config: {
        name: 'open-figma-mcp',
        version: '2.0.0',
        description: 'High-performance OpenFigma Model Context Protocol engine',
        transport: {
          type: 'stdio',
          command: 'node',
          args: [serverPath, '--stdio'],
        },
      },
    },
  };

  return configs;
}
