import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  inferBranchTeam,
  migrateLegacyNoticeState,
  normalizeNoticeReference,
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

test('공통 설계 변동 공지 참조를 정규화한다', () => {
  assert.equal(normalizeNoticeReference('CREFLEINC/omf-mes#123'), 'CREFLEINC/omf-mes#123');
  assert.equal(
    normalizeNoticeReference('https://github.com/CREFLEINC/omf-mes/issues/123'),
    'https://github.com/CREFLEINC/omf-mes/issues/123',
  );
  assert.equal(
    normalizeNoticeReference('https://github.com/CREFLEINC/omf-mes/issues/123/#issuecomment-456'),
    'https://github.com/CREFLEINC/omf-mes/issues/123',
  );
  assert.throws(() => normalizeNoticeReference('123'), /GitHub 이슈 URL/);
  assert.throws(() => normalizeNoticeReference('CREFLEINC/omf-mes-client#123'), /고정 설계 저장소/);
  assert.throws(
    () => normalizeNoticeReference('CREFLEINC/omf-mes-backend#123'),
    /고정 설계 저장소/,
  );
});

test('설계 변동 기준에는 공통 공지 참조가 필요하다', () => {
  const errors = validateState({
    schemaVersion: 1,
    team: 'Agent : T5',
    activeIssue: 782,
    designBaseline: {
      repository: 'CREFLEINC/omf-mes',
      commit: 'a'.repeat(40),
      source: '.client-dev/design/omf-mes',
      pinnedAt: new Date().toISOString(),
      reason: 'design-change-notice',
      noticeReference: null,
    },
  });
  assert.ok(errors.some((error) => error.includes('notice-ref')));
});

test('과거 팀별 공지 이슈 상태를 거부한다', () => {
  const legacy = {
    schemaVersion: 1,
    team: 'Agent : T5',
    activeIssue: 782,
    designBaseline: {
      repository: 'CREFLEINC/omf-mes',
      commit: 'a'.repeat(40),
      source: '.client-dev/design/omf-mes',
      pinnedAt: new Date().toISOString(),
      reason: 'design-change-notice',
      noticeIssue: 123,
      noticeReference: 'CREFLEINC/omf-mes#123',
    },
  };
  const errors = validateState(legacy);
  assert.ok(errors.some((error) => error.includes('noticeIssue')));
  const migrated = migrateLegacyNoticeState(legacy, 'CREFLEINC/omf-mes#456');
  assert.equal(migrated.designBaseline.noticeIssue, undefined);
  assert.equal(migrated.designBaseline.noticeReference, 'CREFLEINC/omf-mes#456');
  assert.deepEqual(validateState(migrated), []);
  const withoutRepository = structuredClone(legacy);
  delete withoutRepository.designBaseline.repository;
  assert.equal(
    migrateLegacyNoticeState(withoutRepository, 'CREFLEINC/omf-mes#456').designBaseline.repository,
    'CREFLEINC/omf-mes',
  );
});

test('저장소 정책 검사가 폐기된 하네스를 감지한다', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'workflow-policy-'));
  execFileSync('git', ['init', '-q'], { cwd: root });
  const required = [
    'docs/client-dev-workflow/multi-agent-team-workflow-v3.md',
    'tools/workflow/bootstrap.mjs',
    'docs/client-dev-workflow/README.md',
    'docs/client-dev-workflow/references/design-request.md',
    '.github/ISSUE_TEMPLATE/design-request-tracking.yml',
  ];
  for (const file of required) {
    const target = path.join(root, file);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, 'current policy\n');
  }
  assert.deepEqual(repositoryPolicyErrors(root), []);
  writeFileSync(
    path.join(root, '.github/ISSUE_TEMPLATE/design-change-impact-review.yml'),
    'client-owned notice format\n',
  );
  assert.ok(
    repositoryPolicyErrors(root).some((error) => error.includes('design-change-impact-review.yml')),
  );
  writeFileSync(path.join(root, 'multi-agent-team-workflow-v2.md'), 'old policy\n');
  assert.ok(repositoryPolicyErrors(root).some((error) => error.includes('폐기된 하네스')));
  writeFileSync(
    path.join(root, 'docs/client-dev-workflow/multi-agent-team-workflow-v3.md'),
    '설계팀이 이 저장소에 발행\n',
  );
  assert.ok(
    repositoryPolicyErrors(root).some((error) =>
      error.includes('클라이언트 전용 설계 변동 공지 채널'),
    ),
  );
  writeFileSync(path.join(root, 'AGENTS.md'), 'tracked local adapter\n');
  execFileSync('git', ['add', 'AGENTS.md'], { cwd: root });
  assert.ok(
    repositoryPolicyErrors(root).some((error) =>
      error.includes('AI 도구별 로컬 어댑터는 Git에서 추적하면 안 됩니다'),
    ),
  );
});

test('Git 작업 트리가 아니면 추적 검사를 통과시키지 않는다', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'workflow-no-git-'));
  assert.ok(
    repositoryPolicyErrors(root).some((error) =>
      error.includes('Git 작업 트리를 확인할 수 없습니다'),
    ),
  );
});
