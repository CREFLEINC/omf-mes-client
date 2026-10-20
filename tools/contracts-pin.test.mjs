import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { check, materialize, pin, validateServerContracts } from './contracts-pin.mjs';

const git = (cwd, ...args) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

const commitContract = (server, body) => {
  writeFileSync(path.join(server, 'contracts', 'a.json'), body);
  git(server, 'add', 'contracts/a.json');
  git(server, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', body);
  return git(server, 'rev-parse', 'HEAD');
};

function workspace() {
  const base = mkdtempSync(path.join(tmpdir(), 'contracts-pin-'));
  const root = path.join(base, 'client');
  const server = path.join(base, 'server');
  mkdirSync(root);
  mkdirSync(path.join(server, 'contracts'), { recursive: true });
  git(server, 'init', '-q');
  const first = commitContract(server, '{"v":1}');
  return { root, server, first };
}

test('지정한 서버 커밋을 고정하고 상태 파일의 다른 값은 보존한다', () => {
  const { root, server, first } = workspace();
  const statePath = path.join(root, '.client-dev', 'state.json');
  mkdirSync(path.dirname(statePath), { recursive: true });
  writeFileSync(statePath, JSON.stringify({ other: 1 }));

  const pinned = pin(root, { server, commit: 'HEAD' });
  const state = JSON.parse(readFileSync(statePath, 'utf8'));
  assert.equal(pinned.commit, first);
  assert.equal(state.other, 1);
  assert.equal(check(root).commit, first);
});

test('서버 클론이 앞으로 가도 고정 커밋의 계약을 읽는다', () => {
  const { root, server, first } = workspace();
  pin(root, { server, commit: 'HEAD' });
  commitContract(server, '{"v":2}');

  const { directory } = materialize(root, ['a.json']);
  assert.equal(path.basename(directory), first);
  assert.equal(readFileSync(path.join(directory, 'a.json'), 'utf8'), '{"v":1}');
});

test('고정 커밋에 없는 계약 파일은 실패한다', () => {
  const { root, server } = workspace();
  pin(root, { server, commit: 'HEAD' });
  assert.throws(() => materialize(root, ['missing.json']), /contracts\/missing\.json/);
});

test('없는 커밋은 고정하지 않는다', () => {
  const { root, server } = workspace();
  assert.throws(() => pin(root, { server, commit: 'a'.repeat(40) }), /커밋을 찾을 수 없습니다/);
});

test('상태 파일이 없으면 check가 pin을 안내한다', () => {
  const { root } = workspace();
  assert.equal(existsSync(path.join(root, '.client-dev')), false);
  assert.throws(() => check(root), /contracts:pin/);
});

test('serverContracts 형식을 검사한다', () => {
  assert.deepEqual(validateServerContracts({ commit: 'a'.repeat(40), source: 's' }), []);
  assert.equal(validateServerContracts({ commit: 'abc' }).length, 2);
  assert.deepEqual(validateServerContracts(undefined), ['serverContracts가 없습니다.']);
});
