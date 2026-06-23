/**
 * Proxy support for the built-in global fetch (undici).
 *
 * Node's built-in fetch only honors HTTP_PROXY / HTTPS_PROXY / NO_PROXY when
 * NODE_USE_ENV_PROXY=1 is set *at process startup* — setting it at runtime is
 * too late. So when a proxy is configured but that flag isn't active yet, we
 * re-exec the process once with the proxy env vars in place. The child sees the
 * flag already set and runs normally. This keeps proxy support dependency-free:
 * once active, every fetch() in figma.js transparently uses the proxy.
 *
 *   --proxy=<url> / FIGMA_PROXY=<url>  -> route traffic through <url>
 *   --proxy=none                       -> ignore inherited proxy env, go direct
 *   (no flag, HTTP(S)_PROXY present)    -> respect the inherited proxy env
 */

import { spawnSync } from 'child_process';

const REEXEC_SENTINEL = 'OPENFIGMA_PROXY_REEXEC';

function inheritedProxy(env) {
  return (
    env.HTTPS_PROXY || env.https_proxy || env.HTTP_PROXY || env.http_proxy || undefined
  );
}

/**
 * Apply proxy configuration. May re-exec the current process (and then exit).
 * Returns a short status string describing what was done (useful for logging).
 *
 * @param {string|undefined} proxy  Resolved --proxy/FIGMA_PROXY value.
 * @param {object} [io]             Injection seam for tests.
 */
export function applyProxy(proxy, io = {}) {
  const env = io.env || process.env;
  const argv = io.argv || process.argv;
  const execPath = io.execPath || process.execPath;
  const reexec = io.reexec || ((cmd, args, opts) => spawnSync(cmd, args, opts));
  const exit = io.exit || ((code) => process.exit(code));

  // Explicit bypass: connect directly, ignoring any inherited proxy env vars.
  if (proxy && proxy.toLowerCase() === 'none') {
    for (const k of ['HTTP_PROXY', 'http_proxy', 'HTTPS_PROXY', 'https_proxy']) delete env[k];
    env.NO_PROXY = '*';
    return 'direct (proxy bypassed)';
  }

  const explicit = proxy && proxy.toLowerCase() !== 'none' ? proxy : null;
  const effective = explicit || inheritedProxy(env);
  if (!effective) return 'no proxy';

  // We can skip the re-exec only when the running process is ALREADY configured
  // for exactly this proxy:
  //   - we are the child we spawned (sentinel set), or
  //   - env-proxy support is active AND the env proxy already equals `effective`.
  // Note: undici snapshots HTTP(S)_PROXY at startup, so an explicit --proxy that
  // differs from what the env had at launch MUST be applied via re-exec —
  // mutating env now would be ignored. This preserves CLI > env precedence.
  const envMatches = env.NODE_USE_ENV_PROXY === '1' && inheritedProxy(env) === effective;
  if (env[REEXEC_SENTINEL] === '1' || envMatches) {
    return `proxy active: ${effective}`;
  }

  // Re-exec once with the proxy env vars set at startup so global fetch uses them.
  const childEnv = {
    ...env,
    NODE_USE_ENV_PROXY: '1',
    HTTP_PROXY: effective,
    HTTPS_PROXY: effective,
    [REEXEC_SENTINEL]: '1',
  };
  const result = reexec(execPath, argv.slice(1), { stdio: 'inherit', env: childEnv });
  if (result.error) {
    // Spawn failed (ENOENT/EACCES, ...) — surface it and fail non-zero rather
    // than exiting 0 having never started the server.
    console.error('[Proxy] re-exec failed:', result.error.message);
    exit(1);
    return `re-exec failed: ${result.error.message}`; // only reached when exit is stubbed
  }
  // A signal kill leaves status null; treat that as a failure (exit 1).
  exit(result.status == null ? 1 : result.status);
  return `re-exec for proxy: ${effective}`; // only reached when exit is stubbed in tests
}
