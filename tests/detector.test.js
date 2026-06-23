import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { detectImageDir } from '../src/detector.js';
import { writeUniversalRules } from '../src/rules.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tempBase = path.join(__dirname, 'temp-projects');

console.log('=== Starting Workspace Detector & Rules Writer Tests ===');

// Helper to prepare clean temp directories
function setupTempDir(name) {
  const dirPath = path.join(tempBase, name);
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

function cleanupAll() {
  if (fs.existsSync(tempBase)) {
    fs.rmSync(tempBase, { recursive: true, force: true });
    console.log('Cleaned up all temporary directories.');
  }
}

async function run() {
  try {
    // ----------------------------------------------------
    // Test Case 1: Next.js multi-folder (frontend/public)
    // ----------------------------------------------------
    console.log('\n--- Test 1: Next.js Multi-Folder structure (frontend/public) ---');
    const project1 = setupTempDir('nextjs-subfolder');
    const frontPublicDir = path.join(project1, 'frontend', 'public');
    fs.mkdirSync(frontPublicDir, { recursive: true });

    const resolvedDir1 = detectImageDir(project1);
    console.log('Resolved Image Directory:', resolvedDir1);
    if (resolvedDir1 !== frontPublicDir) {
      throw new Error(`Expected resolved directory to be ${frontPublicDir}, but got ${resolvedDir1}`);
    }
    console.log('✅ Test 1 Passed: Correctly resolved frontend/public');

    // Test writing rules
    writeUniversalRules(project1);
    const rootLovable1 = path.join(project1, 'LOVABLE.md');
    const rootCursor1 = path.join(project1, '.cursorrules');
    const frontLovable1 = path.join(project1, 'frontend', 'LOVABLE.md');
    const frontCursor1 = path.join(project1, 'frontend', '.cursorrules');

    if (!fs.existsSync(rootLovable1) || !fs.existsSync(rootCursor1) || !fs.existsSync(frontLovable1) || !fs.existsSync(frontCursor1)) {
      throw new Error('Rules files were not successfully created in both root and frontend folders!');
    }
    console.log('✅ Test 1 Rules Passed: Rules written in root & frontend directories');

    // ----------------------------------------------------
    // Test Case 2: Standard Vite/Next.js (public)
    // ----------------------------------------------------
    console.log('\n--- Test 2: Standard Vite/Next.js (public at root) ---');
    const project2 = setupTempDir('vite-standard');
    const publicDir2 = path.join(project2, 'public');
    fs.mkdirSync(publicDir2, { recursive: true });

    const resolvedDir2 = detectImageDir(project2);
    console.log('Resolved Image Directory:', resolvedDir2);
    if (resolvedDir2 !== publicDir2) {
      throw new Error(`Expected resolved directory to be ${publicDir2}, but got ${resolvedDir2}`);
    }
    console.log('✅ Test 2 Passed: Correctly resolved public');

    writeUniversalRules(project2);
    if (!fs.existsSync(path.join(project2, 'LOVABLE.md')) || !fs.existsSync(path.join(project2, '.cursorrules'))) {
      throw new Error('Rules files were not successfully created in standard Vite root!');
    }
    console.log('✅ Test 2 Rules Passed: Rules written in project root');

    // ----------------------------------------------------
    // Test Case 3: React/Vue with src/assets
    // ----------------------------------------------------
    console.log('\n--- Test 3: React/Vue style (src/assets) ---');
    const project3 = setupTempDir('react-src-assets');
    const srcAssets3 = path.join(project3, 'src', 'assets');
    fs.mkdirSync(srcAssets3, { recursive: true });

    const resolvedDir3 = detectImageDir(project3);
    console.log('Resolved Image Directory:', resolvedDir3);
    if (resolvedDir3 !== srcAssets3) {
      throw new Error(`Expected resolved directory to be ${srcAssets3}, but got ${resolvedDir3}`);
    }
    console.log('✅ Test 3 Passed: Correctly resolved src/assets');

    writeUniversalRules(project3);
    if (!fs.existsSync(path.join(project3, 'LOVABLE.md')) || !fs.existsSync(path.join(project3, '.cursorrules'))) {
      throw new Error('Rules files were not successfully created in React root!');
    }
    console.log('✅ Test 3 Rules Passed: Rules written in project root');

    // ----------------------------------------------------
    // Test Case 4: Static HTML / Vanilla JS (Root fallback)
    // ----------------------------------------------------
    console.log('\n--- Test 4: Static HTML fallback (root) ---');
    const project4 = setupTempDir('static-html');

    const resolvedDir4 = detectImageDir(project4);
    console.log('Resolved Image Directory:', resolvedDir4);
    if (resolvedDir4 !== project4) {
      throw new Error(`Expected resolved directory to be project root ${project4}, but got ${resolvedDir4}`);
    }
    console.log('✅ Test 4 Passed: Fallback to root directory correct');

    writeUniversalRules(project4);
    if (!fs.existsSync(path.join(project4, 'LOVABLE.md')) || !fs.existsSync(path.join(project4, '.cursorrules'))) {
      throw new Error('Rules files were not successfully created in Static HTML root!');
    }
    console.log('✅ Test 4 Rules Passed: Rules written in project root');

    console.log('\n🎉 ALL WORKSPACE DETECTOR AND RULES WRITER TESTS PASSED!');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exitCode = 1;
  } finally {
    cleanupAll();
  }
}

run();
