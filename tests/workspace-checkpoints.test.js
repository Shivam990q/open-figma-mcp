import test from 'node:test';
import assert from 'node:assert';
import { DesignCheckpointKernel } from '../src/tools/workspace-checkpoints.js';

test('DesignCheckpointKernel creates immutable design snapshots and restores via rollback', () => {
  const kernel = new DesignCheckpointKernel();

  const initialState = {
    document: {
      id: '0:0',
      name: 'Document',
      type: 'DOCUMENT',
      children: [
        {
          id: '1:1',
          name: 'Hero Frame',
          type: 'FRAME',
          children: [
            { id: '2:1', name: 'Header Title', type: 'TEXT', characters: 'Welcome to OpenFigma' },
          ],
        },
      ],
    },
    globalVars: { primaryColor: '#3B82F6' },
  };

  const cp1 = kernel.createCheckpoint('v1.0.0', 'Initial baseline hero design', initialState);
  assert.strictEqual(cp1.checkpointId, 'v1.0.0');
  assert.strictEqual(cp1.description, 'Initial baseline hero design');

  const checkpoints = kernel.listCheckpoints();
  assert.strictEqual(checkpoints.length, 1);
  assert.strictEqual(checkpoints[0].id, 'v1.0.0');
  assert.strictEqual(checkpoints[0].nodesCount, 3); // Document + Frame + Text

  // Execute rollback
  const restored = kernel.rollback('v1.0.0');
  assert.strictEqual(restored.success, true);
  assert.strictEqual(restored.restoredId, 'v1.0.0');
  assert.strictEqual(restored.document.children[0].children[0].characters, 'Welcome to OpenFigma');
  assert.strictEqual(restored.globalVars.primaryColor, '#3B82F6');
});

test('DesignCheckpointKernel structural AST diffing detects added, removed, and modified nodes', () => {
  const kernel = new DesignCheckpointKernel();

  const stateA = {
    document: {
      id: '0:0',
      children: [
        { id: '1:1', name: 'Card', type: 'FRAME', cornerRadius: 8, fills: [{ color: '#FFFFFF' }] },
        { id: '1:2', name: 'Old Button', type: 'RECTANGLE' },
      ],
    },
  };

  const stateB = {
    document: {
      id: '0:0',
      children: [
        { id: '1:1', name: 'Card', type: 'FRAME', cornerRadius: 16, fills: [{ color: '#F3F4F6' }] },
        { id: '1:3', name: 'New CTA Button', type: 'FRAME' },
      ],
    },
  };

  kernel.createCheckpoint('cp_base', 'Base state', stateA);
  kernel.createCheckpoint('cp_target', 'Updated state with new CTA', stateB);

  const diff = kernel.diffCheckpoints('cp_base', 'cp_target');
  assert.strictEqual(diff.summary.added, 1);
  assert.strictEqual(diff.added[0].id, '1:3');
  assert.strictEqual(diff.summary.removed, 1);
  assert.strictEqual(diff.removed[0].id, '1:2');
  assert.strictEqual(diff.summary.modified, 1);
  assert.strictEqual(diff.modified[0].id, '1:1');
  assert.ok(diff.modified[0].changes.some((c) => c.field === 'cornerRadius' && c.to === 16));
});

test('DesignCheckpointKernel creates isolated virtual branches for design exploration', () => {
  const kernel = new DesignCheckpointKernel();

  const state = {
    document: { id: '0:0', children: [{ id: '1:1', name: 'Master Nav' }] },
  };

  kernel.createCheckpoint('main_cp', 'Production navigation', state);
  const branch = kernel.createBranch('experimental-dark-nav', 'main_cp');

  assert.strictEqual(branch.success, true);
  assert.strictEqual(branch.branchName, 'experimental-dark-nav');
  assert.strictEqual(branch.baseCheckpointId, 'main_cp');
});
