/**
 * Honesty layer.
 *
 * OpenFigma is a FREE Figma server built on the REST API + a Personal Access
 * Token. The REST API is read-mostly: the only writes it supports are comments,
 * dev resources, and (Enterprise) variables. Creating or editing canvas nodes —
 * frames, components, variants, auto-layout — requires the Figma *Plugin* API,
 * which is only available inside the Figma desktop app / the official MCP.
 *
 * Earlier builds shipped tools (use_figma, create_new_file, generate_figma_design,
 * generate_diagram, upload_assets) that *pretended* to do canvas writes and
 * returned fabricated success with mock node IDs. An agent that trusts those
 * reports work that never happened. This module replaces that fiction with
 * honest, structured "not supported here" responses pointing at the real path.
 */

export const REST_ONLY_NOTICE =
  'OpenFigma is a free REST-API server authenticated with a Personal Access Token. ' +
  'It reads design data and can write comments/dev-resources, but it cannot create or ' +
  'edit Figma canvas content — that requires the Figma Plugin API (Figma desktop app or ' +
  "the official Figma MCP). This tool does not fabricate a result.";

/** Structured "this isn't supported on a REST PAT" response payload. */
export function unsupported(tool, alternative) {
  return {
    supported: false,
    tool,
    reason: REST_ONLY_NOTICE,
    alternative,
  };
}

/**
 * Build a capability report from a whoami() result (which may be null when no
 * token / offline). Tells the agent up front what will actually work.
 */
export function buildCapabilities(me) {
  const authed = !!me && !me.error;
  return {
    server: 'open-figma-mcp',
    transportNote: 'Asset serving over localhost is available only in HTTP/SSE mode.',
    auth: authed
      ? { authenticated: true, handle: me.handle || me.email, plans: me.plans || undefined }
      : { authenticated: false, note: 'No valid Figma token resolved; read tools will fail until one is provided.' },
    realTools: {
      read: [
        'get_figma_data', 'get_metadata', 'get_design_context', 'get_variable_defs',
        'get_figjam', 'get_libraries', 'search_design_system', 'whoami',
        'get_comments', 'get_versions', 'get_image_fills', 'get_dev_resources', 'get_projects',
      ],
      derive: [
        'get_design_tokens (8 export formats)', 'generate_code (react-tailwind/react-inline/vue/html)',
        'generate_component_api (typed props)', 'audit_accessibility (WCAG)', 'get_design_diff (version compare)',
        'audit_drift (design-vs-code)', 'extract_vectors (inline SVG icons)',
      ],
      images: ['download_figma_images', 'download_assets', 'get_screenshot'],
      write: ['add_comment (requires a write-enabled token)'],
    },
    notSupported: {
      reason: REST_ONLY_NOTICE,
      tools: {
        use_figma: 'Canvas scripting needs the Plugin API.',
        create_new_file: 'File creation needs the Plugin API.',
        generate_figma_design: 'Code-to-canvas needs the Plugin API.',
        generate_diagram: 'Mermaid-to-FigJam needs the Plugin API.',
        upload_assets: 'Uploading bytes into a Figma file needs the Plugin API.',
      },
      recommendation:
        'For implementing a design in code, use get_figma_data + generate_code + get_design_tokens + download_assets.',
    },
    limitations: {
      variablesApi: 'GET /variables/local is Enterprise-only; OpenFigma falls back to inferring tokens from the tree.',
      rateLimits: 'Free/Starter PATs are heavily throttled by Figma (as low as ~6 Tier-1 reads/month on non-Dev seats). OpenFigma caches to .figma-cache to soften this.',
      teamEndpoints: 'Team/project listing needs team membership and a team_id from the Figma URL.',
    },
  };
}
