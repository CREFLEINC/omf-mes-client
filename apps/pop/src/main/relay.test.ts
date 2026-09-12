import { describe, expect, it, vi } from 'vitest';

import { normalizeTarget, relayHeaders, relayToApi, shouldRelay } from './api-relay';

/**
 * **중계가 무엇을 넘기고 무엇을 넘기지 않는가**를 지킨다. 이 판정이 흔들리면 조용히 깨진다 —
 * 화면은 그냥 「서버에 연결하지 못했습니다」만 말하고, 원인은 설치본에서만 드러난다.
 */
describe('POP API 중계 — 넘길 요청 고르기', () => {
  const TARGET = 'http://example.test';

  /* ⭐ 스위치를 안 준 설치본의 동작이 이전과 «같아야» 한다 — 이 갈래가 그것을 지킨다. */
  it('스위치를 주지 않으면 아무것도 넘기지 않는다', () => {
    expect(shouldRelay('/api/mdm/terminals/1', '')).toBe(false);
    expect(shouldRelay('/index.html', '')).toBe(false);
  });

  it('`/api/` 로 시작하는 것만 넘긴다', () => {
    expect(shouldRelay('/api/mdm/terminals/1', TARGET)).toBe(true);
    expect(shouldRelay('/api/health', TARGET)).toBe(true);
  });

  /* ⚠ 렌더러 산출물이 걸리면 화면이 통째로 비어 뜬다. */
  it('화면 파일은 넘기지 않는다', () => {
    expect(shouldRelay('/index.html', TARGET)).toBe(false);
    expect(shouldRelay('/pop.html', TARGET)).toBe(false);
    expect(shouldRelay('/assets/pop-abc123.js', TARGET)).toBe(false);
    expect(shouldRelay('/', TARGET)).toBe(false);
  });

  /* ⛔ 접두를 `/api` 로 두면 아래가 전부 백엔드로 나간다 — 슬래시까지가 접두다. */
  it('이름이 api 로 시작할 뿐인 화면 파일을 넘기지 않는다', () => {
    expect(shouldRelay('/apiary.html', TARGET)).toBe(false);
    expect(shouldRelay('/assets/api-client.js', TARGET)).toBe(false);
  });

  it('끝 슬래시를 털어 `//` 가 생기지 않게 한다', () => {
    expect(normalizeTarget('http://example.test/')).toBe('http://example.test');
    expect(normalizeTarget('http://example.test///')).toBe('http://example.test');
    expect(normalizeTarget(undefined)).toBe('');
  });
});

describe('POP API 중계 — 넘기는 방식', () => {
  const TARGET = 'http://example.test';

  /* ⭐ 단말 토큰이 이 헤더로 나간다 — 떨어뜨리면 업무 요청 전부가 막힌다. */
  it('인증 헤더는 그대로 싣고 화면 안 사정은 뗀다', () => {
    const headers = relayHeaders(
      new Headers({
        authorization: 'Bearer token',
        'content-type': 'application/json',
        'idempotency-key': 'key-1',
        origin: 'pop://app',
        referer: 'pop://app/pop/worker-assignment',
        'content-length': '999',
      }),
    );

    expect(headers.get('authorization')).toBe('Bearer token');
    expect(headers.get('content-type')).toBe('application/json');
    expect(headers.get('idempotency-key')).toBe('key-1');
    expect(headers.get('origin')).toBeNull();
    expect(headers.get('referer')).toBeNull();
    expect(headers.get('content-length')).toBeNull();
  });

  it('경로와 질의를 붙여 백엔드로 보낸다', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));

    await relayToApi(
      fetchImpl,
      TARGET,
      new Request('pop://app/api/mdm/terminals?page=1'),
      '/api/mdm/terminals',
      '?page=1',
    );

    expect(fetchImpl).toHaveBeenCalledWith(
      'http://example.test/api/mdm/terminals?page=1',
      expect.objectContaining({ method: 'GET', redirect: 'manual' }),
    );
  });

  /* ⚠ 빈 본문을 실으면 400 으로 떨어뜨리는 서버가 있다. */
  it('GET 에는 본문을 싣지 않는다', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('{}'));

    await relayToApi(fetchImpl, TARGET, new Request('pop://app/api/health'), '/api/health', '');

    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({ body: undefined });
  });

  it('본문 있는 요청은 본문을 그대로 넘긴다', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('{}', { status: 201 }));

    await relayToApi(
      fetchImpl,
      TARGET,
      new Request('pop://app/api/work-orders', { method: 'POST', body: '{"a":1}' }),
      '/api/work-orders',
      '',
    );

    const body = fetchImpl.mock.calls[0]?.[1]?.body as ArrayBuffer;

    expect(new TextDecoder().decode(body)).toBe('{"a":1}');
  });

  /**
   * ⛔ **실패를 응답으로 바꾸지 않는다.** 500 을 돌려주면 화면이 「서버가 거절했다」로 읽어
   *    「이 토큰은 더 이상 쓸 수 없습니다」를 말한다 — 닿지 못한 것과 거절당한 것을 가르려고
   *    만든 갈래가 이 자리에서 무너진다(리뷰 지적).
   */
  it('백엔드에 닿지 못하면 던진다 — 응답으로 감싸지 않는다', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('connect ECONNREFUSED'));

    await expect(
      relayToApi(fetchImpl, TARGET, new Request('pop://app/api/health'), '/api/health', ''),
    ).rejects.toThrow('ECONNREFUSED');
  });
});
