import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  inferBranchTeam,
  normalizeTeam,
  repositoryPolicyErrors,
  validateState,
} from './workflow-state.mjs';

test('팀 번호를 표준 라벨로 정규화한다', () => {
  assert.equal(normalizeTeam('5'), 'Agent : T5');
  assert.equal(normalizeTeam('T5'), 'Agent : T5');
  assert.equal(normalizeTeam('Agent : T5'), 'Agent : T5');
  assert.throws(() => normalizeTeam('0'));
});

test('브랜치 이름에서 담당 팀을 찾는다', () => {
  assert.equal(inferBranchTeam('codex/team5-feature'), 'Agent : T5');
  assert.equal(inferBranchTeam('feature/team-12/api'), 'Agent : T12');
  assert.equal(inferBranchTeam('feature/no-owner'), null);
});

test('설계 변동 기준에는 공지 이슈가 필요하다', () => {
  const errors = validateState({
    schemaVersion: 1,
    team: 'Agent : T5',
    activeIssue: 782,
    designBaseline: {
      commit: 'a'.repeat(40),
      source: '.client-dev/design/omf-mes',
      pinnedAt: new Date().toISOString(),
      reason: 'design-change-notice',
      noticeIssue: null,
    },
  });
  assert.ok(errors.some((error) => error.includes('noticeIssue')));
});

test('저장소 정책 검사가 폐기된 하네스를 감지한다', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'workflow-policy-'));
  const required = [
    'AGENTS.md',
    'CLAUDE.md',
    'docs/client-dev-workflow/README.md',
    'docs/client-dev-workflow/references/design-reference.md',
    'docs/client-dev-workflow/references/design-request.md',
    '.github/ISSUE_TEMPLATE/design-change-notice.yml',
    '.github/ISSUE_TEMPLATE/design-request-tracking.yml',
  ];
  for (const file of required) {
    const target = path.join(root, file);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, 'current policy\n');
  }
  assert.deepEqual(repositoryPolicyErrors(root), []);
  writeFileSync(path.join(root, 'multi-agent-team-workflow-v2.md'), 'old policy\n');
  assert.ok(repositoryPolicyErrors(root).some((error) => error.includes('폐기된 하네스')));
});
