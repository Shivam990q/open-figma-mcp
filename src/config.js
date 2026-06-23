/**
 * Centralized configuration resolution for OpenFigma MCP.
 *
 * Precedence (highest first):
 *   1. CLI arguments  (--flag value  or  --flag=value)
 *   2. Environment variables (.env or shell)
 *   3. Built-in defaults
 *
 * A per-request `X-Figma-Token` header (HTTP mode) overrides the resolved
 * credentials for that request only; that is handled in server.js.
 */

import dotenv from 'dotenv';
import { detectImageDir } from './detector.js';

export const VERSION = '1.3.0';
export const VALID_FORMATS = ['yaml', 'json', 'tree'];
export const DEFAULT_PORT = 3845; // Lovable Desktop autodetect port (override with --port/FRAMELINK_PORT)
export const DEFAULT_HOST = '127.0.0.1';

/** Read `--name value` or `--name=value` from argv; otherwise return fallback. */
export function getArg(argv, name, fallback) {
  const idx = argv.indexOf(name);
  if (idx !== -1 && idx + 1 < argv.length && !argv[idx + 1].startsWith('--')) {
    return argv[idx + 1];
  }
  const eq = argv.find((a) => a.startsWith(`${name}=`));
  if (eq) return eq.slice(name.length + 1);
  return fallback;
}

/** True if a boolean flag is present (either `--flag` or `--flag=...`). */
export function hasFlag(argv, name) {
  return argv.includes(name) || argv.some((a) => a.startsWith(`${name}=`));
}

/** Load environment variables, honoring an optional `--env <path>` override. */
export function loadEnv(argv = process.argv, env = process.env) {
  const envPath = getArg(argv, '--env');
  if (envPath) dotenv.config({ path: envPath });
  else dotenv.config();
  return env;
}

function resolveFormat(argv, env) {
  let format = getArg(argv, '--format');
  if (!format && hasFlag(argv, '--json')) format = 'json';
  if (!format) format = env.OUTPUT_FORMAT;
  if (!format) format = 'yaml';
  format = String(format).toLowerCase();
  return VALID_FORMATS.includes(format) ? format : 'yaml';
}

/**
 * Resolve the full configuration object from argv + env.
 */
export function resolveConfig(argv = process.argv, env = process.env, cwd = process.cwd()) {
  const figmaApiKey = getArg(argv, '--figma-api-key', env.FIGMA_API_KEY);
  const figmaOauthToken = getArg(argv, '--figma-oauth-token', env.FIGMA_OAUTH_TOKEN);

  // OAuth (Authorization: Bearer) takes precedence over a PAT when both are set.
  const globalToken = figmaOauthToken
    ? { oauthToken: figmaOauthToken }
    : figmaApiKey
      ? { token: figmaApiKey }
      : undefined;

  const port = parseInt(
    getArg(argv, '--port', env.FRAMELINK_PORT || env.PORT || String(DEFAULT_PORT)),
    10,
  );
  const host = getArg(argv, '--host', env.FRAMELINK_HOST || env.HOST || DEFAULT_HOST);
  const format = resolveFormat(argv, env);
  const imageDir = getArg(argv, '--image-dir', env.IMAGE_DIR || detectImageDir(cwd));
  const skipImageDownloads =
    hasFlag(argv, '--skip-image-downloads') || String(env.SKIP_IMAGE_DOWNLOADS) === 'true';
  const stdio = hasFlag(argv, '--stdio');

  // Proxy: explicit flag/env, or "none" to bypass. Inherited HTTP(S)_PROXY env
  // vars are respected automatically (see applyProxy in server.js).
  const proxy = getArg(argv, '--proxy', env.FIGMA_PROXY);

  // Telemetry is never collected by OpenFigma; the flags are accepted as no-ops
  // for drop-in compatibility with figma-developer-mcp configs.
  const telemetryDisabled =
    hasFlag(argv, '--no-telemetry') ||
    String(env.FRAMELINK_TELEMETRY).toLowerCase() === 'off' ||
    Boolean(env.DO_NOT_TRACK && env.DO_NOT_TRACK !== '0');

  return {
    figmaApiKey,
    figmaOauthToken,
    globalToken,
    port: Number.isFinite(port) ? port : DEFAULT_PORT,
    host,
    format,
    imageDir,
    skipImageDownloads,
    stdio,
    proxy,
    telemetryDisabled,
  };
}

/**
 * Parse the `fetch` subcommand arguments. Explicit flags override URL-derived
 * values.
 */
export function parseFetchArgs(argv) {
  const fetchIdx = argv.indexOf('fetch');
  let urlOrKey = fetchIdx !== -1 ? argv[fetchIdx + 1] : undefined;
  if (urlOrKey && urlOrKey.startsWith('--')) urlOrKey = undefined;

  return {
    urlOrKey,
    fileKey: getArg(argv, '--file-key'),
    nodeId: getArg(argv, '--node-id'),
    depth: parseInt(getArg(argv, '--depth', '0'), 10) || 0,
  };
}

export const HELP_TEXT = `OpenFigma MCP v${VERSION}
Universal Figma MCP server — pulls design data into AI coding agents without a paid Dev Mode seat.

USAGE
  open-figma-mcp [options]                          Start the MCP server (HTTP/SSE by default, --stdio for clients)
  open-figma-mcp fetch   <url|fileKey> [options]    Print simplified design data and exit
  open-figma-mcp tokens  <url|fileKey> [--format]   Extract design tokens (css/scss/tailwind/tailwind4/js/ts/json/style-dictionary)
  open-figma-mcp codegen <url> --node-id <id> [--framework react-tailwind|react-inline|vue|svelte|angular|html|flutter|swiftui]
  open-figma-mcp audit   <url|fileKey> [--page-background <hex>]   WCAG accessibility audit (JSON)

AUTH
  --figma-api-key <token>     Figma Personal Access Token (or FIGMA_API_KEY)
  --figma-oauth-token <token> Figma OAuth Bearer token   (or FIGMA_OAUTH_TOKEN)

SERVER
  --stdio                     Run over stdio (for Cursor, Claude Desktop, VS Code, ...)
  --port <n>                  HTTP port (or FRAMELINK_PORT / PORT). Default ${DEFAULT_PORT} (Lovable autodetect)
  --host <addr>               HTTP host (or FRAMELINK_HOST / HOST). Default ${DEFAULT_HOST}

OUTPUT
  --format <yaml|json|tree>   Output format (or OUTPUT_FORMAT). Default yaml
  --json                      Alias for --format=json
  --image-dir <path>          Base dir for image downloads (or IMAGE_DIR). Default: autodetected public/assets dir
  --skip-image-downloads      Do not register image download tools (or SKIP_IMAGE_DOWNLOADS=true)

NETWORK
  --proxy <url|none>          HTTP(S) proxy URL, or "none" to bypass proxy env vars (or FIGMA_PROXY).
                              Standard HTTP_PROXY / HTTPS_PROXY / NO_PROXY are respected automatically.
  --env <path>                Load environment variables from a custom .env file

FETCH OPTIONS
  --file-key <key>            Override the file key parsed from the URL
  --node-id <1234:5678>       Override the node id parsed from the URL
  --depth <n>                 Limit tree traversal depth

MISC
  --no-telemetry              Accepted for compatibility (OpenFigma collects no telemetry)
  --version                   Print version and exit
  --help                      Print this help and exit
`;
