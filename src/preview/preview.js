/**
 * OpenFigma Live Canvas Web Preview Engine
 * Inspired by Open Claude Design.
 * Provides an interactive visual prototyping canvas with sandboxed iframe,
 * click-to-inspect DOM overlay, in-place Tweaks toolbar, and 2-way sync to Figma.
 */

export function generatePreviewHtml(componentCode = '', options = {}) {
  const title = options.title || 'OpenFigma Live Canvas Preview';
  const theme = options.theme || 'light';
  const defaultBg = theme === 'dark' ? '#0F172A' : '#F8FAFC';

  // Fallback default component if none provided
  const safeCode = componentCode.trim() || `
    <div class="flex flex-col items-center justify-center p-12 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-md mx-auto">
      <div class="w-16 h-16 bg-blue-500/10 text-blue-600 rounded-2xl flex items-center justify-center mb-6 text-2xl font-bold">
        🎨
      </div>
      <h2 class="text-2xl font-bold text-slate-900 dark:text-white mb-2">OpenFigma Live Canvas</h2>
      <p class="text-slate-600 dark:text-slate-400 text-center mb-6 text-sm">
        Interactive prototype rendered directly from your AI agent. Click any element to inspect CSS or tweak tokens.
      </p>
      <button id="cta-btn" class="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-md transition-all">
        Sync with Figma
      </button>
    </div>
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body {
      margin: 0;
      padding: 0;
      background: ${defaultBg};
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      overflow: hidden;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }
    #top-bar {
      height: 52px;
      background: #1E293B;
      color: #F8FAFC;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 16px;
      border-bottom: 1px solid #334155;
      font-size: 13px;
    }
    .btn {
      padding: 6px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
      border: none;
      transition: all 0.2s;
    }
    .btn-primary {
      background: #2563EB;
      color: white;
    }
    .btn-primary:hover {
      background: #1D4ED8;
    }
    .btn-secondary {
      background: #334155;
      color: #E2E8F0;
    }
    .btn-secondary:hover {
      background: #475569;
    }
    #main-container {
      flex: 1;
      display: flex;
      position: relative;
    }
    #iframe-wrapper {
      flex: 1;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    iframe {
      width: 100%;
      height: 100%;
      border: 1px solid #CBD5E1;
      border-radius: 12px;
      background: white;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
    }
    #sidebar {
      width: 320px;
      background: white;
      border-left: 1px solid #E2E8F0;
      display: flex;
      flex-direction: column;
      padding: 16px;
      overflow-y: auto;
    }
  </style>
</head>
<body>
  <div id="top-bar">
    <div style="display:flex; align-items:center; gap:8px;">
      <span style="font-weight:bold; font-size:15px; color:#38BDF8;">⚡ OpenFigma Live Canvas</span>
      <span style="background:#0F172A; padding:2px 8px; border-radius:4px; font-size:11px; color:#94A3B8;">Preview Engine</span>
    </div>
    <div style="display:flex; gap:8px;">
      <button class="btn btn-secondary" onclick="toggleTheme()">🌓 Toggle Dark</button>
      <button class="btn btn-primary" onclick="syncToFigma()">🎨 Push to Figma Canvas</button>
    </div>
  </div>

  <div id="main-container">
    <div id="iframe-wrapper">
      <iframe id="preview-frame" sandbox="allow-scripts allow-same-origin"></iframe>
    </div>

    <div id="sidebar">
      <h3 style="margin-top:0; font-size:14px; font-weight:bold; color:#0F172A; border-bottom:1px solid #F1F5F9; padding-bottom:8px;">
        🔍 Visual Inspector (Claude Design)
      </h3>
      <div id="inspector-details" style="font-size:12px; color:#64748B; margin-top:8px;">
        Click any element in the preview canvas to inspect computed styles, Tailwind classes, and component attributes.
      </div>

      <h3 style="font-size:14px; font-weight:bold; color:#0F172A; border-bottom:1px solid #F1F5F9; padding-bottom:8px; margin-top:24px;">
        🎛️ Live Design Tweaks
      </h3>
      <div style="display:flex; flex-direction:column; gap:12px; margin-top:8px; font-size:12px;">
        <div>
          <label style="display:block; margin-bottom:4px; color:#475569; font-weight:500;">Primary Accent Color</label>
          <input type="color" id="tweak-color" value="#2563EB" style="width:100%; height:32px; border-radius:4px; border:1px solid #CBD5E1; cursor:pointer;" onchange="applyTweakColor(this.value)">
        </div>
        <div>
          <label style="display:block; margin-bottom:4px; color:#475569; font-weight:500;">Corner Radius (<span id="radius-val">8px</span>)</label>
          <input type="range" id="tweak-radius" min="0" max="32" value="8" style="width:100%; cursor:pointer;" oninput="applyTweakRadius(this.value)">
        </div>
      </div>

      <h3 style="font-size:14px; font-weight:bold; color:#0F172A; border-bottom:1px solid #F1F5F9; padding-bottom:8px; margin-top:24px;">
        🚀 Instant Canvas Scaffolding
      </h3>
      <div style="display:flex; flex-direction:column; gap:8px; margin-top:8px;">
        <button class="btn btn-secondary" style="width:100%; text-align:left; font-size:12px; padding:8px 10px;" onclick="deployComponent('canvas_create_navbar', { brandName: 'Acme Pro', theme: 'dark' })">
          ✨ Deploy Modern Navbar
        </button>
        <button class="btn btn-secondary" style="width:100%; text-align:left; font-size:12px; padding:8px 10px;" onclick="deployComponent('canvas_create_hero_section', { title: 'Autonomous Design Fabric', badge: 'v2.0 Enterprise' })">
          🎯 Deploy Hero Section
        </button>
        <button class="btn btn-secondary" style="width:100%; text-align:left; font-size:12px; padding:8px 10px;" onclick="deployComponent('canvas_create_design_system_scaffold', { brandName: 'Quantum Design System', primaryColor: '#2563EB' })">
          🎨 Deploy Full Design System
        </button>
      </div>
    </div>
  </div>

  <script>
    const iframe = document.getElementById('preview-frame');
    const rawContent = ${JSON.stringify(safeCode)};

    function renderIframe(htmlContent) {
      const srcDoc = \`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <script src="https://cdn.tailwindcss.com"><\\/script>
  <style>
    body {
      margin: 0;
      padding: 32px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      box-sizing: border-box;
    }
    .hover-highlight {
      outline: 2px dashed #3B82F6 !important;
      cursor: pointer;
    }
  </style>
</head>
<body>
  \${htmlContent}

  <script>
    document.body.addEventListener('mouseover', (e) => {
      e.target.classList.add('hover-highlight');
    });
    document.body.addEventListener('mouseout', (e) => {
      e.target.classList.remove('hover-highlight');
    });
    document.body.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = e.target.getBoundingClientRect();
      const classes = Array.from(e.target.classList).filter(c => c !== 'hover-highlight');
      window.parent.postMessage({
        type: 'ELEMENT_SELECTED',
        payload: {
          tagName: e.target.tagName,
          id: e.target.id || null,
          classList: classes,
          text: e.target.innerText?.substring(0, 50) || null,
          rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) }
        }
      }, '*');
    });
  <\\/script>
</body>
</html>\`;
      iframe.srcdoc = srcDoc;
    }

    renderIframe(rawContent);

    // Listen for postMessage from sandboxed iframe
    window.addEventListener('message', (event) => {
      if (event.data?.type === 'ELEMENT_SELECTED') {
        const p = event.data.payload;
        const details = document.getElementById('inspector-details');
        details.innerHTML = \`
          <div style="background:#F8FAFC; padding:10px; border-radius:6px; border:1px solid #E2E8F0;">
            <div style="font-weight:bold; color:#2563EB; margin-bottom:4px;">\${p.tagName} \${p.id ? '#' + p.id : ''}</div>
            <div style="margin-bottom:6px;"><strong>Text:</strong> \${p.text || '<em>(no text)</em>'}</div>
            <div style="margin-bottom:6px;"><strong>Dimensions:</strong> \${p.rect.width} × \${p.rect.height}px</div>
            <div><strong>Classes:</strong></div>
            <div style="font-family:monospace; font-size:11px; background:#E2E8F0; padding:6px; border-radius:4px; margin-top:4px; word-break:break-all;">
              \${p.classList.join(' ') || '(none)'}
            </div>
          </div>
        \`;
      }
    });

    function toggleTheme() {
      document.body.style.background = document.body.style.background === 'rgb(15, 23, 42)' ? '#F8FAFC' : '#0F172A';
    }

    function applyTweakColor(color) {
      const doc = iframe.contentDocument;
      if (!doc) return;
      const el = doc.querySelector('button, [class*="bg-"]');
      if (el) el.style.backgroundColor = color;
    }

    function applyTweakRadius(rad) {
      document.getElementById('radius-val').innerText = rad + 'px';
      const doc = iframe.contentDocument;
      if (!doc) return;
      const el = doc.querySelector('button, [class*="rounded"]');
      if (el) el.style.borderRadius = rad + 'px';
    }

    function syncToFigma() {
      fetch('/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'tools/call',
          params: {
            name: 'transpile_code_to_canvas',
            arguments: { code: rawContent }
          }
        })
      })
      .then(res => res.json())
      .then(() => alert('✔ Component markup successfully transpiled and queued for Figma canvas!'))
      .catch(err => alert('Sync error: ' + err.message));
    }

    function deployComponent(toolName, args) {
      fetch('/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'tools/call',
          params: {
            name: toolName,
            arguments: args
          }
        })
      })
      .then(res => res.json())
      .then(data => {
        alert('✔ ' + toolName + ' successfully dispatched to Figma canvas!');
      })
      .catch(err => alert('Deployment error: ' + err.message));
    }
  </script>
</body>
</html>`;
}
