import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
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
  const target = path.join(root, 'CLAUDE.md');
  writeFileSync(
    target,
    readFileSync(target, 'utf8').replace(
      '## 개인별 AI 도구 설정',
      '개인 구역 앞 메모\n\n## 개인별 AI 도구 설정',
    ),
  );
  writeFileSync(path.join(root, WORKFLOW_SOURCE), '# workflow\n\nupdated mandatory rule\n');
  bootstrap(root, { tool: 'claude', team: '5' });
  const content = readFileSync(target, 'utf8');
  assert.match(content, /updated mandatory rule/);
  assert.match(content, /개인 구역 앞 메모/);
  assert.deepEqual(bootstrapErrors(root, 'Agent : T5'), []);
});

test('출처 불명 파일은 force 없이는 덮어쓰지 않는다', () => {
  const root = fixture();
  const target = path.join(root, 'AGENTS.md');
  writeFileSync(target, '직접 작성한 기존 파일\n');
  assert.throws(
    () => bootstrap(root, { tool: 'codex', team: '5' }),
    /검증된 부트스트랩 생성물이 아닙니다/,
  );
  assert.equal(readFileSync(target, 'utf8'), '직접 작성한 기존 파일\n');
  bootstrap(root, { tool: 'codex', team: '5', force: true });
  assert.match(readFileSync(target, 'utf8'), /workflow-bootstrap/);
});

test('both는 Codex와 Claude 어댑터를 함께 생성한다', () => {
  const root = fixture();
  bootstrap(root, { tool: 'both', team: '5' });
  assert.equal(existsSync(path.join(root, 'AGENTS.md')), true);
  assert.equal(existsSync(path.join(root, 'CLAUDE.md')), true);
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
