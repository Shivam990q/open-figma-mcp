import fs from 'fs';
import path from 'path';

/**
 * Scan project path to determine where figma images should be downloaded.
 */
export function detectImageDir(projectPath) {
  const resolvedPath = path.resolve(projectPath);
  
  // 1. Next.js structure inside sub-folder: frontend/public
  const frontendPublic = path.join(resolvedPath, 'frontend', 'public');
  if (fs.existsSync(frontendPublic) && fs.statSync(frontendPublic).isDirectory()) {
    console.error(`[Detector] Detected Next.js/Vite frontend folder: ${frontendPublic}`);
    return frontendPublic;
  }

  // 2. Standard Next.js/Vite project root: public
  const standardPublic = path.join(resolvedPath, 'public');
  if (fs.existsSync(standardPublic) && fs.statSync(standardPublic).isDirectory()) {
    console.error(`[Detector] Detected public assets folder: ${standardPublic}`);
    return standardPublic;
  }

  // 3. React/Vue src assets: src/assets
  const srcAssets = path.join(resolvedPath, 'src', 'assets');
  if (fs.existsSync(srcAssets) && fs.statSync(srcAssets).isDirectory()) {
    console.error(`[Detector] Detected React/Vue assets folder: ${srcAssets}`);
    return srcAssets;
  }

  // 4. Default fallback: project root
  console.error(`[Detector] No specific assets folder found, defaulting to project root: ${resolvedPath}`);
  return resolvedPath;
}
