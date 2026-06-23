import fs from 'fs';
import path from 'path';
import { simplifyDesign } from './simplify.js';

const CACHE_DIR = path.join(process.cwd(), '.figma-cache');
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes — designs rarely change mid-build, and free-tier PATs are heavily rate-limited.

function getFromCache(cacheKey, ignoreTtl = false) {
  try {
    const cachePath = path.join(CACHE_DIR, `${cacheKey}.json`);
    if (fs.existsSync(cachePath)) {
      const stats = fs.statSync(cachePath);
      const age = Date.now() - stats.mtimeMs;
      if (ignoreTtl || age < CACHE_TTL_MS) {
        console.error(`[Cache] Cache hit for ${cacheKey} (age: ${Math.round(age / 1000)}s)`);
        return JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
      }
    }
  } catch (err) {
    console.error(`[Cache] Error reading cache for ${cacheKey}:`, err.message);
  }
  return null;
}

function saveToCache(cacheKey, data) {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    const cachePath = path.join(CACHE_DIR, `${cacheKey}.json`);
    fs.writeFileSync(cachePath, JSON.stringify(data, null, 2), 'utf-8');
    console.error(`[Cache] Saved to cache: ${cacheKey}`);
  } catch (err) {
    console.error(`[Cache] Error writing cache for ${cacheKey}:`, err.message);
  }
}

/**
 * Builds standard figma request headers depending on token type
 */
export function getAuthHeaders(token) {
  const headers = {};
  if (typeof token === 'object' && token !== null) {
    if (token.oauthToken) {
      headers['Authorization'] = `Bearer ${token.oauthToken}`;
    } else if (token.token) {
      headers['X-Figma-Token'] = token.token;
    }
  } else if (typeof token === 'string' && token) {
    const trimmed = token.trim();
    // If it starts with Bearer or looks like an OAuth token (longer, no figd_ prefix)
    if (trimmed.startsWith('Bearer ') || (trimmed.length > 30 && !trimmed.startsWith('figd_'))) {
      headers['Authorization'] = trimmed.startsWith('Bearer ') ? trimmed : `Bearer ${trimmed}`;
    } else {
      headers['X-Figma-Token'] = trimmed;
    }
  }
  return headers;
}

/**
 * Resilient fetch client that handles rate limits (429) with exponential
 * backoff. `retries`/`delay` are tuned down by callers when a cached copy
 * already exists, so we serve cache fast instead of making the client wait.
 */
async function fetchWithRetry(url, options = {}, retries = 3, delay = 2500) {
  let lastResponse;
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      lastResponse = response;
      if (response.status === 429 && i < retries - 1) {
        console.error(`[Figma API] Rate limited (429). Retrying in ${delay}ms... (Attempt ${i + 1}/${retries})`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2; // exponential backoff
        continue;
      }
      return response;
    } catch (err) {
      if (i === retries - 1) throw err;
      console.error(`[Figma API] Request failed: ${err.message}. Retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
  return lastResponse;
}

/**
 * Fetch figma file data (layout tree). Pass opts.version to fetch a historical
 * version (used by the design-diff tool).
 */
export async function fetchFigmaFile(fileKey, token, opts = {}) {
  const version = opts.version;
  const cacheKey = version ? `file_${fileKey}_v${version}` : `file_${fileKey}`;
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  // If a stale copy exists, fail fast (one short attempt) and serve it on ANY
  // error — far better UX than making the client wait through 429 backoff.
  const stale = getFromCache(cacheKey, true);

  try {
    const url = `https://api.figma.com/v1/files/${fileKey}${version ? `?version=${encodeURIComponent(version)}` : ''}`;
    const response = await fetchWithRetry(url, { headers: getAuthHeaders(token) }, stale ? 1 : 3, stale ? 600 : 2500);

    if (!response.ok) {
      if (stale) {
        console.error(`[Cache] API ${response.status}; serving cached ${cacheKey} immediately.`);
        return stale;
      }
      let errMsg = response.statusText;
      try {
        const errJson = await response.json();
        if (errJson.err) errMsg = errJson.err;
      } catch (e) {}
      throw new Error(`Figma API returned ${response.status}: ${errMsg}`);
    }

    const data = await response.json();
    saveToCache(cacheKey, data);
    return data;
  } catch (err) {
    if (stale) {
      console.error(`[Cache] Network/API error; serving cached ${cacheKey}: ${err.message}`);
      return stale;
    }
    throw err;
  }
}

/**
 * Helper to recursively find a node by its ID in a layout tree
 */
function findNodeInTree(node, targetId) {
  if (!node) return null;
  if (node.id === targetId) return node;
  if (node.children) {
    for (const child of node.children) {
      const found = findNodeInTree(child, targetId);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Fetch figma node-specific details
 */
export async function fetchFigmaNodes(fileKey, nodeIds, token) {
  const idsQuery = nodeIds.join(',');
  const cacheKey = `nodes_${fileKey}_${nodeIds.join('_').replace(/[:\-]/g, '_')}`;
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  // Attempt to resolve locally from cached full file tree first
  const fileCacheKey = `file_${fileKey}`;
  const fileCached = getFromCache(fileCacheKey, true);
  if (fileCached) {
    console.error(`[Cache] Full file cache found. Resolving nodes locally...`);
    const nodes = {};
    let allFound = true;
    for (const nodeId of nodeIds) {
      const foundNode = findNodeInTree(fileCached.document, nodeId);
      if (foundNode) {
        nodes[nodeId] = {
          document: foundNode,
          components: fileCached.components || {},
          componentSets: fileCached.componentSets || {},
          styles: fileCached.styles || {}
        };
      } else {
        allFound = false;
        break;
      }
    }
    if (allFound) {
      console.error(`[Cache] Successfully resolved nodes [${nodeIds}] locally from file cache.`);
      const localResult = {
        name: fileCached.name,
        lastModified: fileCached.lastModified,
        thumbnailUrl: fileCached.thumbnailUrl,
        version: fileCached.version,
        role: fileCached.role,
        editorType: fileCached.editorType,
        linkAccess: fileCached.linkAccess,
        nodes
      };
      saveToCache(cacheKey, localResult);
      return localResult;
    }
  }

  try {
    const url = `https://api.figma.com/v1/files/${fileKey}/nodes?ids=${encodeURIComponent(idsQuery)}`;
    const stale = getFromCache(cacheKey, true);
    const response = await fetchWithRetry(url, { headers: getAuthHeaders(token) }, stale ? 1 : 3, stale ? 600 : 2500);

    if (!response.ok) {
      if (stale) {
        console.error(`[Cache] API ${response.status}; serving cached ${cacheKey} immediately.`);
        return stale;
      }
      let errMsg = response.statusText;
      try {
        const errJson = await response.json();
        if (errJson.err) errMsg = errJson.err;
      } catch (e) {}
      throw new Error(`Figma API returned ${response.status}: ${errMsg}`);
    }

    const data = await response.json();
    saveToCache(cacheKey, data);
    return data;
  } catch (err) {
    const expiredCached = getFromCache(cacheKey, true);
    if (expiredCached) {
      console.error(`[Cache] Network/API error. Falling back to expired cache for ${cacheKey}: ${err.message}`);
      return expiredCached;
    }
    throw err;
  }
}

/**
 * Render and download figma images to target folder
 */
export async function downloadFigmaImages(fileKey, nodeIds, token, imageDir, format = 'png') {
  const idsQuery = nodeIds.join(',');
  const url = `https://api.figma.com/v1/images/${fileKey}?ids=${encodeURIComponent(idsQuery)}&format=${format}`;
  
  console.error(`[Figma API] Requesting image URLs: ${url}`);
  // Fail fast (2 short attempts): rendering can't be served from cache, so a long
  // backoff just causes client-side tool timeouts. Surface a clear error instead.
  const response = await fetchWithRetry(url, {
    headers: getAuthHeaders(token)
  }, 2, 1500);

  if (!response.ok) {
    let errMsg = response.statusText;
    try {
      const errJson = await response.json();
      if (errJson.err) errMsg = errJson.err;
    } catch (e) {}
    if (response.status === 429) {
      throw new Error(`Figma image render is rate-limited (429). Free-tier render quota is limited — wait a bit and retry, or export the asset manually from Figma.`);
    }
    if (response.status === 403 || response.status === 404) {
      throw new Error(`Figma API ${response.status} rendering images: ${errMsg}. The token may not have access to this file, or the node IDs are invalid.`);
    }
    throw new Error(`Figma API returned ${response.status} when requesting image URLs: ${errMsg}`);
  }

  const result = await response.json();
  if (result.err) {
    throw new Error(`Figma rendering error: ${result.err}`);
  }

  const imageUrls = result.images || {};
  const downloadResults = [];
  const skipped = [];

  // Create folder figma-export inside target imageDir
  const exportDir = path.join(imageDir, 'figma-export');
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  // Download each image
  for (const [nodeId, imageUrl] of Object.entries(imageUrls)) {
    if (!imageUrl) {
      console.error(`[Figma API] No render URL returned for node ${nodeId} (often: frame exceeds Figma's max render size, or is empty/hidden).`);
      skipped.push(nodeId);
      continue;
    }

    try {
      console.error(`[Figma API] Downloading render for node ${nodeId} from ${imageUrl}`);
      const imgResponse = await fetchWithRetry(imageUrl);
      if (!imgResponse.ok) {
        throw new Error(`Failed to fetch image binary: ${imgResponse.statusText}`);
      }

      const buffer = Buffer.from(await imgResponse.arrayBuffer());
      
      const safeNodeName = nodeId.replace(':', '-');
      const fileName = `${safeNodeName}.${format}`;
      const filePath = path.join(exportDir, fileName);

      fs.writeFileSync(filePath, buffer);
      console.error(`[Figma API] Saved image: ${filePath}`);
      
      downloadResults.push({
        nodeId,
        fileName,
        filePath,
        localUrl: `/figma-export/${fileName}`
      });
    } catch (err) {
      console.error(`[Figma API] Failed downloading node ${nodeId}:`, err);
      skipped.push(nodeId);
    }
  }

  // Don't report a misleading "success" when nothing was actually rendered.
  if (downloadResults.length === 0) {
    throw new Error(
      `Figma rendered no images for [${nodeIds.join(', ')}]. ` +
      `Likely the node(s) exceed Figma's max render size (~4096px per side — these frames are very tall), are empty/hidden, or were rate-limited. ` +
      `Try a smaller child node, or export the frame manually from Figma (right-click → Export).`
    );
  }

  return downloadResults;
}

/**
 * Fetch local variables with automatic fallback to document styles for free tier accounts
 */
export async function fetchFigmaVariables(fileKey, token) {
  const cacheKey = `variables_${fileKey}`;
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  const url = `https://api.figma.com/v1/files/${fileKey}/variables/local`;
  console.error(`[Figma API] Requesting local variables: ${url}`);
  try {
    // Variables API is Enterprise-only; on free tiers it 403/404s and we fall
    // back to document styles. Don't waste backoff time here — try once.
    const response = await fetchWithRetry(url, {
      headers: getAuthHeaders(token)
    }, 1, 600);

    if (!response.ok) {
      if (response.status === 429) {
        const expiredCached = getFromCache(cacheKey, true);
        if (expiredCached) {
          console.error(`[Cache] Rate limited on variables. Falling back to expired cache for ${cacheKey}`);
          return expiredCached;
        }
      }
      console.error(`[Figma API] Local variables endpoint returned status ${response.status}. Falling back to document styles...`);
      const fileData = await fetchFigmaFile(fileKey, token);
      const fallbackData = {
        source: 'styles_fallback',
        styles: fileData.styles || {},
        components: fileData.components || {},
        componentSets: fileData.componentSets || {},
        name: fileData.name
      };
      saveToCache(cacheKey, fallbackData);
      return fallbackData;
    }

    const data = await response.json();
    const variablesData = {
      source: 'variables_api',
      ...data
    };
    saveToCache(cacheKey, variablesData);
    return variablesData;
  } catch (err) {
    const expiredCached = getFromCache(cacheKey, true);
    if (expiredCached) {
      console.error(`[Cache] Error on variables. Falling back to expired cache for ${cacheKey}: ${err.message}`);
      return expiredCached;
    }
    console.error(`[Figma API] Error fetching variables, executing fallback: ${err.message}`);
    const fileData = await fetchFigmaFile(fileKey, token);
    const fallbackData = {
      source: 'styles_fallback',
      styles: fileData.styles || {},
      components: fileData.components || {},
      componentSets: fileData.componentSets || {},
      name: fileData.name
    };
    saveToCache(cacheKey, fallbackData);
    return fallbackData;
  }
}

/**
 * Recursively filter and clean the node tree to return only essential metadata
 */
export function extractSparseTree(node) {
  if (!node) return null;
  const sparse = {
    id: node.id,
    name: node.name,
    type: node.type,
  };
  if (node.visible !== undefined) {
    sparse.visible = node.visible;
  }
  if (node.absoluteBoundingBox) {
    sparse.absoluteBoundingBox = node.absoluteBoundingBox;
  }
  if (node.children && Array.isArray(node.children)) {
    sparse.children = node.children
      .map(child => extractSparseTree(child))
      .filter(Boolean);
  }
  return sparse;
}

/**
 * Render, download, and return metadata for a visual screenshot of a Figma node
 */
export async function getScreenshot(fileKey, nodeId, token, imageDir, scale = 1) {
  const url = `https://api.figma.com/v1/images/${fileKey}?ids=${encodeURIComponent(nodeId)}&scale=${scale}&format=png`;
  console.error(`[Figma API] Requesting screenshot URL: ${url}`);
  const response = await fetchWithRetry(url, {
    headers: getAuthHeaders(token)
  }, 2, 1500);

  if (!response.ok) {
    let errMsg = response.statusText;
    try {
      const errJson = await response.json();
      if (errJson.err) errMsg = errJson.err;
    } catch (e) {}
    if (response.status === 429) {
      throw new Error(`Figma image render is rate-limited (429). Wait a bit and retry, or export manually from Figma.`);
    }
    throw new Error(`Figma API returned ${response.status} when requesting screenshot: ${errMsg}`);
  }

  const result = await response.json();
  if (result.err) {
    throw new Error(`Figma rendering error: ${result.err}`);
  }
  const imageUrl = result.images?.[nodeId];
  if (!imageUrl) {
    throw new Error(
      `Figma returned no screenshot for node ${nodeId}. This usually means the frame exceeds Figma's max render size ` +
      `(~4096px per side — large/tall frames fail). Try a lower scale, a smaller child node, or export it manually from Figma.`
    );
  }

  // Create folder figma-export inside target imageDir
  const exportDir = path.join(imageDir, 'figma-export');
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  console.error(`[Figma API] Downloading screenshot from ${imageUrl}`);
  const imgResponse = await fetchWithRetry(imageUrl);
  if (!imgResponse.ok) {
    throw new Error(`Failed to fetch screenshot binary: ${imgResponse.statusText}`);
  }

  const buffer = Buffer.from(await imgResponse.arrayBuffer());
  const safeNodeId = nodeId.replace(':', '-');
  const fileName = `screenshot_${safeNodeId}.png`;
  const filePath = path.join(exportDir, fileName);

  fs.writeFileSync(filePath, buffer);
  console.error(`[Figma API] Saved screenshot: ${filePath}`);

  return {
    nodeId,
    fileName,
    filePath,
    localUrl: `/figma-export/${fileName}`,
    remoteUrl: imageUrl
  };
}

/**
 * Fetch authenticated user information
 */
export async function whoami(token) {
  const url = 'https://api.figma.com/v1/me';
  console.error(`[Figma API] Fetching user info: ${url}`);
  const response = await fetchWithRetry(url, {
    headers: getAuthHeaders(token)
  });

  if (!response.ok) {
    throw new Error(`Figma API returned ${response.status}: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Fetch components and styles from a file for library listing
 */
export async function fetchFileComponentsAndStyles(fileKey, token) {
  const cacheKey = `lib_${fileKey}`;
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  try {
    const compUrl = `https://api.figma.com/v1/files/${fileKey}/components`;
    const styleUrl = `https://api.figma.com/v1/files/${fileKey}/styles`;
    
    console.error(`[Figma API] Querying components and styles for libraries...`);
    const [compRes, styleRes] = await Promise.all([
      fetchWithRetry(compUrl, { headers: getAuthHeaders(token) }),
      fetchWithRetry(styleUrl, { headers: getAuthHeaders(token) })
    ]);

    let componentsList = [];
    let stylesList = [];

    if (compRes.ok) {
      const compJson = await compRes.json();
      componentsList = compJson.meta?.components || [];
    }
    if (styleRes.ok) {
      const styleJson = await styleRes.json();
      stylesList = styleJson.meta?.styles || [];
    }

    const data = {
      fileKey,
      components: componentsList.map(c => ({
        key: c.key,
        name: c.name,
        description: c.description || '',
        nodeId: c.node_id
      })),
      styles: stylesList.map(s => ({
        key: s.key,
        name: s.name,
        description: s.description || '',
        styleType: s.style_type
      }))
    };

    saveToCache(cacheKey, data);
    return data;
  } catch (err) {
    console.error(`[Figma API] Error fetching components/styles for libraries:`, err.message);
    return { fileKey, components: [], styles: [] };
  }
}

/**
 * Recursively find component-like files in the workspace
 */
function scanDirectoryForComponents(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        if (file !== 'node_modules' && file !== '.git' && file !== 'dist' && file !== 'build' && file !== '.next') {
          scanDirectoryForComponents(filePath, fileList);
        }
      } else {
        const ext = path.extname(file);
        if (['.tsx', '.ts', '.jsx', '.js'].includes(ext)) {
          fileList.push(filePath);
        }
      }
    }
  } catch (e) {
    console.error(`[Scanner] Read error in ${dir}:`, e.message);
  }
  return fileList;
}

/**
 * Scan codebase workspace for exported React/Vue/JS components
 */
export function localComponentScanner(workspacePath) {
  const components = [];
  try {
    const srcDir = path.join(workspacePath, 'src');
    const startDir = fs.existsSync(srcDir) ? srcDir : workspacePath;
    console.error(`[Scanner] Scanning workspace for Code Connect templates starting at: ${startDir}`);
    const files = scanDirectoryForComponents(startDir);
    
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      const baseName = path.basename(file, path.extname(file));
      const seen = new Set();
      
      // Matches export function X, export const X, export class X
      const exportRegex = /export\s+(const|function|class|default\s+class|default\s+function)\s+([A-Z][a-zA-Z0-9_]*)/g;
      let match;
      while ((match = exportRegex.exec(content)) !== null) {
        const compName = match[2];
        if (!seen.has(compName)) {
          seen.add(compName);
          components.push({
            name: compName,
            filePath: path.relative(workspacePath, file).replace(/\\/g, '/')
          });
        }
      }
      
      // Matches export default X
      const defaultExportRegex = /export\s+default\s+([A-Z][a-zA-Z0-9_]*)/g;
      let defMatch;
      while ((defMatch = defaultExportRegex.exec(content)) !== null) {
        const compName = defMatch[1];
        if (!seen.has(compName)) {
          seen.add(compName);
          components.push({
            name: compName,
            filePath: path.relative(workspacePath, file).replace(/\\/g, '/')
          });
        }
      }
      
      // Fallback for uppercase files (e.g. Button.tsx)
      if (seen.size === 0 && /^[A-Z]/.test(baseName)) {
        components.push({
          name: baseName,
          filePath: path.relative(workspacePath, file).replace(/\\/g, '/')
        });
      }
    }
  } catch (err) {
    console.error(`[Scanner] Workspace scan error:`, err.message);
  }
  return components;
}

/**
 * Generic authenticated GET against the Figma REST API returning parsed JSON.
 */
async function figmaGet(pathAndQuery, token) {
  const url = `https://api.figma.com${pathAndQuery}`;
  const response = await fetchWithRetry(url, { headers: getAuthHeaders(token) });
  if (!response.ok) {
    let errMsg = response.statusText;
    try {
      const j = await response.json();
      if (j.err || j.message) errMsg = j.err || j.message;
    } catch (e) {}
    throw new Error(`Figma API returned ${response.status} for ${pathAndQuery}: ${errMsg}`);
  }
  return response.json();
}

/** GET comments on a file. */
export async function fetchComments(fileKey, token) {
  const data = await figmaGet(`/v1/files/${fileKey}/comments`, token);
  return (data.comments || []).map((c) => ({
    id: c.id,
    message: c.message,
    user: c.user?.handle,
    createdAt: c.created_at,
    resolvedAt: c.resolved_at || null,
    nodeId: c.client_meta?.node_id,
    parentId: c.parent_id || null,
  }));
}

/** POST a comment to a file (requires a write-enabled token). */
export async function postComment(fileKey, message, token, clientMeta) {
  const url = `https://api.figma.com/v1/files/${fileKey}/comments`;
  const body = { message };
  if (clientMeta) body.client_meta = clientMeta;
  const response = await fetchWithRetry(url, {
    method: 'POST',
    headers: { ...getAuthHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    let errMsg = response.statusText;
    try { const j = await response.json(); if (j.err || j.message) errMsg = j.err || j.message; } catch (e) {}
    throw new Error(`Figma API returned ${response.status} posting comment: ${errMsg}`);
  }
  const c = await response.json();
  return { id: c.id, message: c.message, createdAt: c.created_at };
}

/** GET version history of a file. */
export async function fetchVersions(fileKey, token) {
  const data = await figmaGet(`/v1/files/${fileKey}/versions`, token);
  return (data.versions || []).map((v) => ({
    id: v.id,
    createdAt: v.created_at,
    label: v.label || null,
    description: v.description || null,
    user: v.user?.handle,
  }));
}

/**
 * GET the imageRef -> rendered URL map for image fills in a file. This resolves
 * the `imageRef` values that appear in simplified IMAGE fills to real URLs.
 */
export async function fetchImageFills(fileKey, token) {
  const data = await figmaGet(`/v1/files/${fileKey}/images`, token);
  return data.meta?.images || {};
}

/**
 * GET specific nodes WITH vector geometry (fillGeometry/strokeGeometry SVG path
 * strings) for inline-SVG icon extraction.
 */
export async function fetchFigmaNodesGeometry(fileKey, nodeIds, token) {
  const ids = encodeURIComponent(nodeIds.join(','));
  return figmaGet(`/v1/files/${fileKey}/nodes?ids=${ids}&geometry=paths`, token);
}

/** GET dev resources (links) attached to a file. */
export async function fetchDevResources(fileKey, token) {
  const data = await figmaGet(`/v1/files/${fileKey}/dev_resources`, token);
  return data.dev_resources || [];
}

/** GET projects in a team. */
export async function fetchTeamProjects(teamId, token) {
  const data = await figmaGet(`/v1/teams/${teamId}/projects`, token);
  return { teamName: data.name, projects: data.projects || [] };
}

/** GET files in a project. */
export async function fetchProjectFiles(projectId, token) {
  const data = await figmaGet(`/v1/projects/${projectId}/files`, token);
  return { projectName: data.name, files: data.files || [] };
}

/**
 * Parse a Figma URL (or a bare file key) into { fileKey, nodeId }.
 *
 * Supported:
 *   https://www.figma.com/design/:fileKey/:name?node-id=12-822
 *   https://www.figma.com/file/:fileKey/:name?node-id=12-822
 *   :fileKey                       (bare key)
 *
 * In URLs Figma encodes the node id colon as a dash (12:822 -> 12-822). Only the
 * first dash is converted so compound/instance ids keep their structure.
 */
export function parseFigmaUrl(urlStr) {
  if (!urlStr) return null;
  const trimmed = String(urlStr).trim();
  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split('/').filter(Boolean);
    const designIndex = parts.indexOf('design');
    const fileIndex = parts.indexOf('file');
    const idx = designIndex !== -1 ? designIndex : fileIndex;

    if (idx !== -1 && idx + 1 < parts.length) {
      const fileKey = parts[idx + 1];
      const nodeIdParam = url.searchParams.get('node-id');
      const nodeId = nodeIdParam ? nodeIdParam.replace('-', ':') : undefined;
      return { fileKey, nodeId };
    }
  } catch (e) {
    // Not a URL — treat as a bare file key if it looks like one.
    if (/^[A-Za-z0-9]{10,}$/.test(trimmed)) {
      return { fileKey: trimmed };
    }
  }
  return null;
}

/**
 * Fetch raw Figma data (file or specific nodes) and run it through the
 * simplification pipeline, returning a compact, deduplicated SimplifiedDesign.
 *
 * @param {string} fileKey
 * @param {string[]|undefined} nodeIds  When present, only these nodes are fetched.
 * @param {*} token  Auth token (string PAT/Bearer or { token } / { oauthToken }).
 * @param {object} [opts]
 * @param {number} [opts.maxDepth=0]  0 = unlimited.
 */
export async function getSimplifiedDesign(fileKey, nodeIds, token, opts = {}) {
  const raw =
    nodeIds && nodeIds.length > 0
      ? await fetchFigmaNodes(fileKey, nodeIds, token)
      : await fetchFigmaFile(fileKey, token);
  return simplifyDesign(raw, { maxDepth: opts.maxDepth || 0 });
}
