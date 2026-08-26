import { posix, win32 } from 'node:path';
import { describe, expect, it } from 'vitest';

import { looksLikeAsset, resolveRendererPath } from './renderer-path';

const POSIX_DIR = '/app/dist/renderer';
const WIN_DIR = 'C:\\app\\dist\\renderer';

const resolvePosix = (pathname: string, present: string[] = ['/app/dist/renderer/index.html']) =>
  resolveRendererPath({
    rendererDir: POSIX_DIR,
    pathname,
    existsSync: (p) => present.includes(p),
    path: posix,
  });

const resolveWin = (pathname: string, present: string[] = []) =>
  resolveRendererPath({
    rendererDir: WIN_DIR,
    pathname,
    existsSync: (p) => present.includes(p),
    path: win32,
  });

describe('정상 경로', () => {
  it('루트는 index.html로 푼다', () => {
    expect(resolvePosix('/')).toEqual({ kind: 'file', path: '/app/dist/renderer/index.html' });
  });

  it('있는 자산은 그 파일을 준다', () => {
    const present = ['/app/dist/renderer/assets/index-abc.js'];
    expect(resolvePosix('/assets/index-abc.js', present)).toEqual({
      kind: 'file',
      path: '/app/dist/renderer/assets/index-abc.js',
    });
  });

  it('SPA 경로는 index.html로 되돌린다', () => {
    expect(resolvePosix('/master-data/warehouse-location')).toEqual({
      kind: 'fallback',
      path: '/app/dist/renderer/index.html',
    });
  });
});

describe('없는 자산은 폴백하지 않는다', () => {
  // 폴백하면 브라우저가 JS 자리에서 HTML을 받아 MIME 오류로 둔갑한다 —
  // 「자산이 없다」가 엉뚱한 증상으로 바뀌어 원인 추적이 끊긴다.
  it('없는 .js는 not-found다', () => {
    expect(resolvePosix('/assets/missing.js')).toEqual({ kind: 'not-found' });
  });

  it('없는 .css·.wasm·폰트도 not-found다', () => {
    for (const asset of ['/assets/a.css', '/x.wasm', '/fonts/f.woff2']) {
      expect(resolvePosix(asset).kind).toBe('not-found');
    }
  });

  it('확장자 없는 경로만 폴백한다', () => {
    expect(resolvePosix('/equipment/master').kind).toBe('fallback');
  });
});

describe('경로 탈출 차단', () => {
  it('상위로 나가는 경로를 막는다', () => {
    expect(resolvePosix('/../../secret')).toEqual({ kind: 'forbidden' });
  });

  it('형제 디렉터리를 막는다 — prefix 비교로는 통과하던 자리다', () => {
    // '/app/dist/renderer' + '../renderer-secret/x' -> '/app/dist/renderer-secret/x'
    // startsWith(rendererDir) 는 true 가 되어 새어 나간다.
    expect(resolvePosix('/../renderer-secret/x')).toEqual({ kind: 'forbidden' });
  });

  it('Windows 백슬래시 형제 디렉터리를 막는다 — 대상 플랫폼이 Windows다', () => {
    // 비특수 스킴이라 WHATWG URL이 `\`를 정규화하지 않아 pathname에 그대로 남는다.
    expect(resolveWin('/..\\renderer-secret\\x')).toEqual({ kind: 'forbidden' });
  });

  it('Windows 상위 탈출을 막는다', () => {
    expect(resolveWin('/..\\..\\secret')).toEqual({ kind: 'forbidden' });
  });

  it('중간에 낀 .. 도 막는다', () => {
    expect(resolvePosix('/assets/../../outside.js')).toEqual({ kind: 'forbidden' });
  });

  it('렌더러 폴더 안의 정상 중첩 경로는 막지 않는다', () => {
    const present = ['/app/dist/renderer/assets/sub/deep.js'];
    expect(resolvePosix('/assets/sub/deep.js', present).kind).toBe('file');
  });
});

describe('자산 판별', () => {
  it('마지막 구획에 확장자가 있으면 자산이다', () => {
    expect(looksLikeAsset('assets/index-abc.js')).toBe(true);
    expect(looksLikeAsset('x.wasm')).toBe(true);
  });

  it('확장자가 없으면 자산이 아니다', () => {
    expect(looksLikeAsset('equipment/master')).toBe(false);
    expect(looksLikeAsset('')).toBe(false);
  });

  it('중간 구획의 점에 속지 않는다', () => {
    expect(looksLikeAsset('v1.2/master')).toBe(false);
  });
});
