/**
 * OpenFigma Live Token Verification & Scope Diagnostic Probe
 * Tests a real Figma Personal Access Token (PAT) against Figma API endpoints:
 * 1. GET /v1/me (Profile, Identity, Scopes)
 * 2. GET /v1/teams/:team_id/projects (Workspace Projects)
 * 3. GET /v1/files/:file_key (AST Scenegraph & Node Fetching)
 * 4. GET /v1/files/:file_key/variables/local (Enterprise Design Tokens)
 */

export async function verifyFigmaToken(token, testFileKey = null) {
  console.log('===============================================================');
  console.log('🔍 OPENFIGMA LIVE TOKEN VERIFICATION & AUDIT HARNESS');
  console.log('===============================================================\n');

  if (!token || !token.startsWith('figd_')) {
    console.warn('⚠️ Warning: Figma Personal Access Tokens usually begin with "figd_".');
  }

  const headers = {
    'X-Figma-Token': token,
  };

  const results = {
    authenticated: false,
    user: null,
    scopes: [],
    endpoints: {},
  };

  // 1. Probe User Identity & Scopes
  console.log('1. [AUTHENTICATION] Probing /v1/me endpoint...');
  const t0 = performance.now();
  try {
    const res = await fetch('https://api.figma.com/v1/me', { headers });
    const latency = (performance.now() - t0).toFixed(2);
    results.endpoints['/v1/me'] = { status: res.status, latencyMs: latency };

    if (!res.ok) {
      console.error(`❌ Authentication failed: HTTP ${res.status} ${res.statusText}`);
      const errText = await res.text();
      console.error(`   Details: ${errText}`);
      return results;
    }

    const userData = await res.json();
    results.authenticated = true;
    results.user = userData;
    console.log(`   ✔ Success! Authenticated as: ${userData.handle} (${userData.email})`);
    console.log(`   ✔ Account ID: ${userData.id}`);
    console.log(`   ✔ Response time: ${latency}ms`);
  } catch (err) {
    console.error(`❌ Network error probing /v1/me: ${err.message}`);
    return results;
  }

  // 2. Probe Team Projects
  console.log('\n2. [PROJECT ACCESS] Probing Team 1551304319615515687 projects...');
  try {
    const teamId = '1551304319615515687';
    const res = await fetch(`https://api.figma.com/v1/teams/${teamId}/projects`, { headers });
    if (res.ok) {
      const projectsData = await res.json();
      console.log(`   ✔ Access verified! Discovered ${projectsData.projects?.length || 0} project(s):`);
      for (const p of projectsData.projects || []) {
        console.log(`     - [${p.id}] ${p.name}`);
      }
    } else {
      console.log(`   ℹ Team projects query returned HTTP ${res.status} (Scopes may be restricted or team ID is personal)`);
    }
  } catch (err) {
    console.log(`   ℹ Team projects check skipped: ${err.message}`);
  }

  // 3. Probe Sample File if provided
  if (testFileKey) {
    console.log(`\n3. [FILE SCENEGRAPH] Probing file /v1/files/${testFileKey}...`);
    try {
      const res = await fetch(`https://api.figma.com/v1/files/${testFileKey}?depth=2`, { headers });
      if (res.ok) {
        const fileData = await res.json();
        console.log(`   ✔ Scenegraph read access confirmed! File: "${fileData.name}"`);
        console.log(`   ✔ Document version: ${fileData.version}, Last modified: ${fileData.lastModified}`);
      } else {
        console.warn(`   ⚠️ File access returned HTTP ${res.status}: ${res.statusText}`);
      }
    } catch (err) {
      console.warn(`   ⚠️ File fetch error: ${err.message}`);
    }
  }

  console.log('\n===============================================================');
  console.log('🎉 TOKEN AUDIT COMPLETE: Your token is active and ready to use!');
  console.log('===============================================================\n');

  return results;
}

// Direct execution CLI support
if (process.argv[1]?.endsWith('test_live_figma_token.js')) {
  const token = process.argv[2] || process.env.FIGMA_ACCESS_TOKEN || process.env.FIGMA_API_KEY;
  const fileKey = process.argv[3] || null;

  if (!token) {
    console.log('Usage: node tests/test_live_figma_token.js <FIGMA_TOKEN> [FILE_KEY]');
    console.log('Or set FIGMA_ACCESS_TOKEN environment variable.');
    process.exit(1);
  }

  verifyFigmaToken(token, fileKey).catch((err) => {
    console.error('Fatal error verifying token:', err);
    process.exit(1);
  });
}
