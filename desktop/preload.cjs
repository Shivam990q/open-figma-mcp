const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('openFigmaAPI', {
  // System & Daemon Status
  getStatus: () => ipcRenderer.invoke('openfigma:get-status'),
  
  // Figma REST API & Scenegraph
  fetchFile: (fileKey, token) => ipcRenderer.invoke('openfigma:fetch-file', { fileKey, token }),
  
  // Token Generation (8 formats)
  exportTokens: (globalVars, format) => ipcRenderer.invoke('openfigma:export-tokens', { globalVars, format }),
  
  // Code Synthesis (9 frameworks)
  generateCode: (node, framework) => ipcRenderer.invoke('openfigma:generate-code', { node, framework }),
  
  // Design Auditing (APCA Contrast + DLP + Prompt Injection)
  runAudit: (node) => ipcRenderer.invoke('openfigma:run-audit', { node }),
  
  // Live Canvas Write-Back to Figma Companion Plugin
  dispatchFigmaCommand: (command, payload) => ipcRenderer.invoke('openfigma:dispatch-bridge', { command, payload }),
  
  // Native Window Management
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
});
