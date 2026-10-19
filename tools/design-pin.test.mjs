import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { check, pin, validateDesignBaseline } from './design-pin.mjs';

const git = (cwd, ...args) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

const commitEmpty = (design) =>
  git(
    design,
    '-c',
    'user.name=t',
    '-c',
    'user.email=t@t',
    'commit',
    '-q',
    '--allow-empty',
    '-m',
    'c',
  );

function workspace() {
  const root = mkdtempSync(path.join(tmpdir(), 'design-pin-'));
  const design = path.join(root, '.client-dev', 'design', 'omf-mes');
  mkdirSync(design, { recursive: true });
  git(design, 'init', '-q');
  commitEmpty(design);
  return { root, design };
}

test('클론 HEAD를 고정하고 상태 파일의 다른 값은 보존한다', () => {
  const { root, design } = workspace();
  const statePath = path.join(root, '.client-dev', 'state.json');
  writeFileSync(statePath, JSON.stringify({ serverApiBaseline: { source: 'x' } }));

  const pinned = pin(root);
  const state = JSON.parse(readFileSync(statePath, 'utf8'));
  assert.equal(pinned.commit, git(design, 'rev-parse', 'HEAD'));
  assert.equal(state.designBaseline.source, path.join('.client-dev', 'design', 'omf-mes'));
  assert.deepEqual(state.serverApiBaseline, { source: 'x' });
  assert.equal(check(root).commit, pinned.commit);
});

test('클론 HEAD가 고정 커밋에서 움직이면 check가 실패한다', () => {
  const { root, design } = workspace();
  pin(root);
  commitEmpty(design);
  assert.throws(() => check(root), /고정 커밋/);
  pin(root);
  assert.doesNotThrow(() => check(root));
});

test('--commit이 HEAD와 다르면 고정하지 않는다', () => {
  const { root } = workspace();
  assert.throws(() => pin(root, { commit: 'a'.repeat(40) }), /지정한 커밋/);
});

test('상태 파일이 없으면 check가 pin을 안내한다', () => {
  const { root } = workspace();
  assert.throws(() => check(root), /design:pin/);
});

test('designBaseline 형식을 검사한다', () => {
  assert.deepEqual(validateDesignBaseline({ commit: 'a'.repeat(40), source: 's' }), []);
  assert.equal(validateDesignBaseline({ commit: 'abc' }).length, 2);
  assert.deepEqual(validateDesignBaseline(undefined), ['designBaseline이 없습니다.']);
});
