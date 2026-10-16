import test from 'node:test';
import assert from 'node:assert';
import { renderSvg, renderSvgDataUri } from '../src/tools/svg.js';
import { CodeConnectRegistry } from '../src/tools/connect.js';
import { transpileCodeToNodes } from '../src/tools/transpiler.js';
import { scanDlpLeaks } from '../src/tools/dlp.js';

test('renderSvg outputs valid scalable SVG markup', () => {
  const node = {
    id: '1:1',
    name: 'PrimaryButton',
    type: 'FRAME',
    visible: true,
    bbox: { x: 10, y: 20, width: 200, height: 48 },
    cornerRadius: 8,
    fills: [{ type: 'SOLID', color: { r: 0.15, g: 0.5, b: 0.95 } }],
  };

  const svg = renderSvg(node);
  assert.ok(svg.includes('<svg xmlns="http://www.w3.org/2000/svg"'));
  assert.ok(svg.includes('width="200"'));
  assert.ok(svg.includes('rx="8"'));
  assert.ok(svg.includes('fill="#2680F2"'));
});

test('renderSvgDataUri outputs base64 URI', () => {
  const node = { id: '1:2', type: 'FRAME', visible: true, bbox: { width: 100, height: 100 } };
  const uri = renderSvgDataUri(node);
  assert.ok(uri.startsWith('data:image/svg+xml;base64,'));
});

test('CodeConnectRegistry maps component to code', () => {
  const registry = new CodeConnectRegistry([
    {
      target: 'Button',
      importPath: '@/components/ui/button',
      componentName: 'Button',
      template: '<Button variant="{{variant}}">{{children}}</Button>',
    },
  ]);

  const node = {
    id: '10:1',
    name: 'Button',
    type: 'COMPONENT',
    characters: 'Click Me',
    componentProperties: { variant: 'outline' },
  };

  const code = registry.generateConnectedCode(node);
  assert.strictEqual(code, '<Button variant="outline">Click Me</Button>');
});

test('transpileCodeToNodes parses Tailwind button into Figma Frame', () => {
  const snippet = '<button className="flex p-4 bg-blue-600 rounded-lg text-white">Save</button>';
  const res = transpileCodeToNodes(snippet);
  assert.strictEqual(res.rootNodes.length, 1);
  const btn = res.rootNodes[0];
  assert.strictEqual(btn.name, 'ButtonLayer');
  assert.strictEqual(btn.layoutMode, 'HORIZONTAL');
  assert.strictEqual(btn.cornerRadius, 8);
  assert.strictEqual(btn.padding?.top, 16);
  assert.strictEqual(btn.characters, 'Save');
});

test('scanDlpLeaks catches exposed AWS and OpenAI keys', () => {
  const node = {
    id: 'sec:1',
    name: 'ConfigText',
    characters: 'API key is AKIAIOSFODNN7EXAMPLE and OpenAI sk-abcdef1234567890abcdef1234567890',
  };

  const findings = scanDlpLeaks(node);
  assert.strictEqual(findings.length, 2);
  assert.strictEqual(findings[0].leakType, 'AwsAccessKey');
  assert.strictEqual(findings[0].maskedValue, 'AKIA...LE');
  assert.strictEqual(findings[1].leakType, 'OpenAiKey');
});
