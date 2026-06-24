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
export function buildCapabilities(me, pluginConnected = false) {
  const authed = !!me && !me.error;
  return {
    server: 'open-figma-mcp',
    transportNote: 'Streamable HTTP at /mcp (recommended) + legacy SSE at /sse + stdio. Asset serving over localhost in HTTP mode.',
    auth: authed
      ? { authenticated: true, handle: me.handle || me.email, plans: me.plans || undefined }
      : { authenticated: false, note: 'No valid Figma token resolved; read tools will fail until one is provided.' },
    canvasWrites: {
      supported: pluginConnected,
      via: 'OpenFigma Figma plugin over the local WebSocket bridge (Plugin API).',
      status: pluginConnected
        ? 'Plugin connected — canvas read/write tools are live.'
        : 'Plugin not connected. Import figma-plugin/manifest.json in Figma (Plugins → Development → Import) and run "OpenFigma Bridge" to enable canvas writes.',
      tools: [
        'get_canvas_selection', 'get_canvas_document', 'create_frame', 'create_rectangle',
        'create_text', 'set_fill_color', 'set_corner_radius', 'set_text', 'move_node',
        'resize_node', 'clone_node', 'delete_node',
      ],
    },
    realTools: {
      read: [
        'get_figma_data', 'get_metadata', 'get_design_context', 'get_variable_defs',
        'get_figjam', 'get_libraries', 'search_design_system', 'whoami',
        'get_comments', 'get_versions', 'get_image_fills', 'get_dev_resources', 'get_projects',
      ],
      derive: [
        'get_design_tokens (8 export formats)', 'generate_code / get_code (8 frameworks)',
        'create_design_system_rules', 'generate_component_api (typed props)', 'audit_accessibility (WCAG)',
        'get_design_diff (version compare)', 'audit_drift (design-vs-code)', 'extract_vectors (inline SVG icons)',
      ],
      images: ['download_figma_images', 'download_assets', 'get_screenshot', 'get_image'],
      write: [
        'add_comment (requires a write-enabled token)',
        'canvas writes (create_frame/text/rectangle, set_fill_color, move/resize/clone/delete) — via the plugin',
      ],
    },
    notSupported: {
      reason:
        'These need file-level or canvas-construction APIs that are out of scope even for the plugin. Use the granular create_* canvas tools instead.',
      tools: {
        use_figma: 'Generic "run arbitrary plugin script" is not exposed; use the specific create_*/set_* canvas tools.',
        create_new_file: 'Creating a brand-new Figma FILE is not possible from a plugin (it operates within an open file).',
        generate_figma_design: 'Full HTML/CSS → canvas conversion is not implemented; build with create_frame/create_text/etc.',
        generate_diagram: 'Mermaid → FigJam generation is not implemented.',
        upload_assets: 'Uploading arbitrary image bytes is not yet wired through the plugin.',
      },
      recommendation:
        'To implement a design in code: get_figma_data + generate_code + get_design_tokens + download_assets. To build ON the canvas: open the plugin and use the create_*/set_* tools.',
    },
    limitations: {
      variablesApi: 'GET /variables/local is Enterprise-only; OpenFigma falls back to inferring tokens from the tree.',
      rateLimits: 'Free/Starter PATs are throttled by Figma; OpenFigma caches to .figma-cache and serves stale on 429 to soften this.',
      teamEndpoints: 'Team/project listing needs team membership and a team_id from the Figma URL.',
    },
  };
}
