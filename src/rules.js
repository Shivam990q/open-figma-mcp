import fs from 'fs';
import path from 'path';

const UNIVERSAL_RULE_CONTENT = `# Lovable & AI Agent Project Rules

## Universal Figma Asset Configuration
* All images, vector graphics, and icons downloaded by the Figma MCP server are stored in the project's public folder at \`/figma-export/\`.
* Do NOT use temporary AI-generated placeholders or ask the user to upload these files.
* In your generated React/HTML/Next.js components, always use the matching files directly with their relative paths (e.g., \`<img src="/figma-export/filename.png" />\` or \`/figma-export/node-id.png\`).

## Figma Design Guidelines
* Always fetch layout metadata, colors, typographies, and positioning using the local figma MCP server tools (\`get_figma_data\`).
* Do not invent ad-hoc styling metrics. Use the spacing, margins, and padding values returned by the server.
* Map vertical stacks in Figma directly to Tailwind \`flex flex-col\` and horizontal layout groupings directly to \`flex flex-row\`.
`;

/**
 * Automatically write rules files (LOVABLE.md and .cursorrules) into the project directories.
 */
export function writeUniversalRules(projectPath) {
  try {
    const resolvedPath = path.resolve(projectPath);
    
    // Write LOVABLE.md to project root
    const rootLovablePath = path.join(resolvedPath, 'LOVABLE.md');
    fs.writeFileSync(rootLovablePath, UNIVERSAL_RULE_CONTENT, 'utf-8');
    console.error(`[Rules Writer] Created/Updated: ${rootLovablePath}`);

    // Write .cursorrules to project root
    const rootCursorRulesPath = path.join(resolvedPath, '.cursorrules');
    fs.writeFileSync(rootCursorRulesPath, UNIVERSAL_RULE_CONTENT, 'utf-8');
    console.error(`[Rules Writer] Created/Updated: ${rootCursorRulesPath}`);

    // Write to frontend subdirectory if it exists
    const frontendDir = path.join(resolvedPath, 'frontend');
    if (fs.existsSync(frontendDir) && fs.statSync(frontendDir).isDirectory()) {
      const frontendLovablePath = path.join(frontendDir, 'LOVABLE.md');
      fs.writeFileSync(frontendLovablePath, UNIVERSAL_RULE_CONTENT, 'utf-8');
      console.error(`[Rules Writer] Created/Updated: ${frontendLovablePath}`);

      const frontendCursorRulesPath = path.join(frontendDir, '.cursorrules');
      fs.writeFileSync(frontendCursorRulesPath, UNIVERSAL_RULE_CONTENT, 'utf-8');
      console.error(`[Rules Writer] Created/Updated: ${frontendCursorRulesPath}`);
    }
  } catch (err) {
    console.error('[Rules Writer] Error writing universal rules:', err);
  }
}
