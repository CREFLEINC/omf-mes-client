import assert from 'node:assert/strict';
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { bootstrap, bootstrapErrors, WORKFLOW_SOURCE } from './bootstrap.mjs';

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'workflow-bootstrap-'));
  const source = path.join(root, WORKFLOW_SOURCE);
  mkdirSync(path.dirname(source), { recursive: true });
  writeFileSync(source, '# workflow\n\nmandatory rule\n');
  return root;
}

test('선택한 AI 도구의 로컬 어댑터를 생성한다', () => {
  const root = fixture();
  bootstrap(root, { tool: 'codex', team: '5' });
  const content = readFileSync(path.join(root, 'AGENTS.md'), 'utf8');
  assert.match(content, /"tool":"codex"/);
  assert.match(content, /"team":"Agent : T5"/);
  assert.deepEqual(bootstrapErrors(root, 'Agent : T5'), []);
});

test('재생성할 때 개인 설정을 보존하고 관리 블록을 갱신한다', () => {
  const root = fixture();
  bootstrap(root, { tool: 'claude', team: '5' });
  appendFileSync(path.join(root, 'CLAUDE.md'), '\n개인 검토 노하우\n');
  writeFileSync(path.join(root, WORKFLOW_SOURCE), '# workflow\n\nupdated mandatory rule\n');
  bootstrap(root, { tool: 'claude', team: '5' });
  const content = readFileSync(path.join(root, 'CLAUDE.md'), 'utf8');
  assert.match(content, /updated mandatory rule/);
  assert.match(content, /개인 검토 노하우/);
  assert.deepEqual(bootstrapErrors(root, 'Agent : T5'), []);
});

test('정본과 다른 관리 블록이나 담당 팀을 감지한다', () => {
  const root = fixture();
  bootstrap(root, { tool: 'codex', team: '5' });
  const target = path.join(root, 'AGENTS.md');
  writeFileSync(target, readFileSync(target, 'utf8').replace('mandatory rule', 'changed rule'));
  assert.ok(bootstrapErrors(root, 'Agent : T4').some((error) => error.includes('담당 팀')));
  assert.ok(bootstrapErrors(root, 'Agent : T5').some((error) => error.includes('관리 워크플로')));
});
