// @ts-nocheck
/**
 * Bridge to the OpenFigma core engine. The desktop app reuses the EXACT same
 * Node modules that power the CLI / MCP server — no logic is duplicated.
 * These relative imports are bundled by electron-vite at build time.
 */
import {
  parseFigmaUrl,
  getSimplifiedDesign,
  fetchFigmaFile,
  fetchFigmaNodes,
  fetchFigmaVariables,
  fetchFigmaNodesGeometry,
  whoami as figmaWhoami,
} from '../../../src/figma.js'
import { serialize } from '../../../src/serialize.js'
import { simplifyDesign } from '../../../src/simplify.js'
import { extractTokens, formatTokens, TOKEN_FORMATS } from '../../../src/tokens.js'
import { generateCode, CODEGEN_FRAMEWORKS } from '../../../src/codegen.js'
import { auditAccessibility } from '../../../src/a11y.js'
import { extractVectors } from '../../../src/vectors.js'

export { CODEGEN_FRAMEWORKS, TOKEN_FORMATS }

const asTokenObj = (token: string) => ({ token })

function resolveTarget(input: { url?: string; fileKey?: string; nodeId?: string }) {
  let fileKey = input.fileKey
  let nodeId = input.nodeId
  if (input.url) {
    const parsed = parseFigmaUrl(input.url)
    if (parsed) {
      if (!fileKey) fileKey = parsed.fileKey
      if (!nodeId) nodeId = parsed.nodeId
    }
  }
  return { fileKey, nodeId }
}

export async function whoami(token: string) {
  return figmaWhoami(asTokenObj(token))
}

/** Fetch + simplify, returning serialized output AND a token-savings estimate. */
export async function fetchDesign(token: string, input: any, format = 'yaml') {
  const { fileKey, nodeId } = resolveTarget(input)
  if (!fileKey) throw new Error('A Figma URL or file key is required.')
  const raw = nodeId
    ? await fetchFigmaNodes(fileKey, [nodeId], asTokenObj(token))
    : await fetchFigmaFile(fileKey, asTokenObj(token))
  const design = simplifyDesign(raw, { maxDepth: input.depth || 0 })
  const output = serialize(design, format)
  const rawSize = JSON.stringify(raw).length
  const simpSize = output.length
  const ratio = rawSize > 0 ? rawSize / simpSize : 1
  return {
    fileKey,
    nodeId,
    name: design.name,
    output,
    nodeCount: countNodes(design.nodes),
    styleCount: Object.keys(design.globalVars?.styles || {}).length,
    rawSize,
    simplifiedSize: simpSize,
    ratio: Math.round(ratio * 10) / 10,
    rawTokensEst: Math.round(rawSize / 4),
    simplifiedTokensEst: Math.round(simpSize / 4),
    securityWarnings: design.securityWarnings || null,
  }
}

function countNodes(nodes: any[] = []): number {
  let n = 0
  for (const node of nodes) {
    n++
    if (node.children) n += countNodes(node.children)
  }
  return n
}

export async function designTokens(token: string, input: any, format = 'css') {
  const { fileKey, nodeId } = resolveTarget(input)
  if (!fileKey) throw new Error('A Figma URL or file key is required.')
  const raw = nodeId
    ? await fetchFigmaNodes(fileKey, [nodeId], asTokenObj(token))
    : await fetchFigmaFile(fileKey, asTokenObj(token))
  let variables
  try {
    variables = await fetchFigmaVariables(fileKey, asTokenObj(token))
  } catch (e) {
    /* free tier — inferred tokens */
  }
  const tokens = extractTokens(raw, variables)
  const text = format === 'json' ? JSON.stringify(tokens, null, 2) : formatTokens(tokens, format)
  return { tokens, text, format }
}

export async function codegen(token: string, input: any, framework = 'react-tailwind') {
  const { fileKey, nodeId } = resolveTarget(input)
  if (!fileKey) throw new Error('A Figma URL or file key is required.')
  if (!nodeId) throw new Error('Code generation needs a node id (select a frame/component in the URL).')
  const design = await getSimplifiedDesign(fileKey, [nodeId], asTokenObj(token), { maxDepth: input.depth || 0 })
  return { code: generateCode(design, framework), framework }
}

export async function audit(token: string, input: any, pageBackground?: string) {
  const { fileKey, nodeId } = resolveTarget(input)
  if (!fileKey) throw new Error('A Figma URL or file key is required.')
  const raw = nodeId
    ? await fetchFigmaNodes(fileKey, [nodeId], asTokenObj(token))
    : await fetchFigmaFile(fileKey, asTokenObj(token))
  return auditAccessibility(raw, { pageBackground })
}
