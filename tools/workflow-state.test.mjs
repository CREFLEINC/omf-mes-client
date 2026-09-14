import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  migrateLegacyNoticeState,
  normalizeNoticeReference,
  repositoryPolicyErrors,
  validateState,
} from './workflow-state.mjs';

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

/* 팀 번호가 폐지되기 전에 만든 로컬 상태에는 team 이 남아 있다. 그것 때문에 막지 않는다. */
test('팀 번호가 남은 옛 상태를 받아들인다', () => {
  const errors = validateState({
    schemaVersion: 1,
    team: 'Agent : T5',
    activeIssue: 782,
    designBaseline: {
      repository: 'CREFLEINC/omf-mes',
      commit: 'a'.repeat(40),
      source: '.client-dev/design/omf-mes',
      pinnedAt: new Date().toISOString(),
      reason: 'initial',
      noticeReference: null,
    },
  });
  assert.deepEqual(errors, []);
});

test('과거 팀별 공지 이슈 상태를 거부한다', () => {
  const legacy = {
    schemaVersion: 1,
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
  writeFileSync(path.join(root, 'README.md'), 'pnpm workflow:bootstrap --tool claude --team 3\n');
  assert.ok(repositoryPolicyErrors(root).some((error) => error.includes('폐지된 팀 번호 인자')));
  writeFileSync(path.join(root, 'README.md'), '착수 라벨: Agent : T3\n');
  assert.ok(repositoryPolicyErrors(root).some((error) => error.includes('폐지된 팀 번호 라벨')));
  writeFileSync(path.join(root, 'AGENTS.md'), 'tracked local adapter\n');
  execFileSync('git', ['add', 'AGENTS.md'], { cwd: root });
  assert.ok(
    repositoryPolicyErrors(root).some((error) =>
      error.includes('AI 도구별 로컬 어댑터는 Git에서 추적하면 안 됩니다'),
    ),
  );
});

/*
 * .client-dev/ 에는 비공개 요청서와 설계 참조 클론이 들어간다. 이 저장소는 공개라
 * 한 번 올라가면 되돌릴 수 없다. .gitignore 는 이미 추적 중인 파일을 막지 못한다.
 */
test('.client-dev/ 가 추적되면 잡아낸다', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'workflow-client-dev-'));
  execFileSync('git', ['init', '--quiet'], { cwd: root });
  mkdirSync(path.join(root, '.client-dev/requests'), { recursive: true });
  writeFileSync(path.join(root, '.client-dev/state.json'), '{}\n');
  writeFileSync(path.join(root, '.client-dev/requests/ask.md'), '비공개 요청서\n');
  execFileSync('git', ['add', '-f', '.client-dev'], { cwd: root });

  assert.ok(
    repositoryPolicyErrors(root).some((error) =>
      error.includes('.client-dev/: 로컬 전용 자료는 Git에서 추적하면 안 됩니다'),
    ),
  );

  /* 보인 것만 빼면 되는 줄로 읽히지 않도록 몇 건인지를 함께 말한다. */
  for (const name of ['a.md', 'b.md', 'c.md']) {
    writeFileSync(path.join(root, '.client-dev/requests', name), 'x\n');
  }
  execFileSync('git', ['add', '-f', '.client-dev'], { cwd: root });

  assert.ok(repositoryPolicyErrors(root).some((error) => error.includes('5건: ')));
  assert.ok(repositoryPolicyErrors(root).some((error) => error.includes('외 2건')));
});

test('Git 작업 트리가 아니면 추적 검사를 통과시키지 않는다', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'workflow-no-git-'));
  assert.ok(
    repositoryPolicyErrors(root).some((error) =>
      error.includes('Git 작업 트리를 확인할 수 없습니다'),
    ),
  );
});
