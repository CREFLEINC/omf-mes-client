import { describe, expect, it } from 'vitest';

import { apiProxy } from './vite.api-proxy';

describe('apiProxy', () => {
  it('주소가 없으면 프록시를 두지 않는다 — 기본 동작(목 서버 직접 호출)이 그대로다', () => {
    expect(apiProxy(undefined)).toBeUndefined();
    expect(apiProxy('')).toBeUndefined();
  });

  it('/api 를 백엔드 원점으로 넘긴다', () => {
    expect(apiProxy('http://backend.test:3100')).toEqual({
      '/api': { target: 'http://backend.test:3100', changeOrigin: true },
    });
  });

  /*
   * 경로를 다시 쓰지 않는 것이 핵심이다 — 계약의 `servers` 가 `/api` 이므로
   * 클라이언트가 보내는 `/api/...` 를 그대로 넘겨야 백엔드 경로와 맞는다.
   */
  it('경로를 고쳐 쓰지 않는다', () => {
    const proxy = apiProxy('http://backend.test:3100');
    expect(proxy?.['/api']).not.toHaveProperty('rewrite');
  });
});
