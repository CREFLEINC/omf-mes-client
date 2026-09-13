import { describe, expect, it } from 'vitest';

import { resolveApiTarget } from './api-target.mjs';

/**
 * **설치본이 어디를 부르는가**를 지킨다. 여기가 흔들리면 화면에는 「서버에 연결하지
 * 못했습니다」로만 보이고, 원인은 구워서 단말에 올려야 드러난다.
 */
describe('resolveApiTarget', () => {
  it('원점을 그대로 낸다', () => {
    expect(resolveApiTarget('http://example.test', true)).toBe('http://example.test');
    expect(resolveApiTarget('https://example.test:8443', true)).toBe('https://example.test:8443');
  });

  it('끝 슬래시를 턴다 — 경로와 이어 붙일 때 `//` 가 생기지 않게 한다', () => {
    expect(resolveApiTarget('http://example.test/', true)).toBe('http://example.test');
  });

  /* ⛔ 이 값이 통과하면 요청이 `/api/api/...` 로 나간다 — 실측된 함정이다. */
  it('`/api` 가 붙은 값을 거절한다', () => {
    expect(() => resolveApiTarget('http://example.test/api', true)).toThrow(/경로가 붙어 있다/);
    expect(() => resolveApiTarget('http://example.test/api/', true)).toThrow(/경로가 붙어 있다/);
  });

  it('주소가 아닌 값·다른 스킴을 거절한다', () => {
    expect(() => resolveApiTarget('example.test', true)).toThrow(/주소가 아니다/);
    expect(() => resolveApiTarget('pop://app', true)).toThrow(/http·https/);
  });

  /* ⛔ 비어 있으면 화면이 `pop://app/api` 를 부르고 셸이 404 를 돌려준다 — 죽은 설치본이다. */
  it('릴리스에서 비면 멈춘다', () => {
    expect(() => resolveApiTarget('', true)).toThrow(/비어 있다/);
    expect(() => resolveApiTarget(undefined, true)).toThrow(/비어 있다/);
  });

  it('개발 빌드에서 비어 있는 것은 허용한다 — 중계가 서지 않을 뿐이다', () => {
    expect(resolveApiTarget('', false)).toBe('');
    expect(resolveApiTarget(undefined, false)).toBe('');
  });
});
