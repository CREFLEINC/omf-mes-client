import { describe, expect, it } from 'vitest';

import { createApiClient } from '@omf-mes/api-client';

import type { OutboxEntry } from '../patterns/outbox';
import { createOutboxTransport } from './outbox-transport';

const entry = (overrides: Partial<OutboxEntry> = {}): OutboxEntry => ({
  id: 'e-1',
  label: '설비 고장 보고',
  idempotencyKey: 'key-1',
  method: 'POST',
  path: '/maintenance/breakdowns',
  body: { equipmentId: 7 },
  occurredAt: '2026-09-01T00:00:00.000Z',
  confirmation: 'pending',
  ...overrides,
});

const transportWith = (seen: Request[]) => {
  const api = createApiClient({
    baseUrl: 'http://api.test',
    fetch: (request: Request) => {
      seen.push(request);
      return Promise.resolve(
        new Response(JSON.stringify({ breakdownId: 42 }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    },
  });

  return createOutboxTransport(api);
};

describe('큐 전송기', () => {
  it('계약 경로로 보내고 응답 본문을 돌려준다', async () => {
    const seen: Request[] = [];

    const response = await transportWith(seen)(entry());

    expect(new URL(seen[0]?.url ?? '').pathname).toBe('/maintenance/breakdowns');
    expect(seen[0]?.method).toBe('POST');
    expect(response).toEqual({ breakdownId: 42 });
  });

  it('멱등키를 싣는다', async () => {
    const seen: Request[] = [];

    await transportWith(seen)(entry());

    expect(seen[0]?.headers.get('Idempotency-Key')).toBe('key-1');
  });

  /* 계약이 전 쓰기에 사번을 요구한다. 없으면 서버가 요청 자체를 받지 않는다. */
  it('담을 때의 사번을 싣는다', async () => {
    const seen: Request[] = [];

    await transportWith(seen)(entry({ workerNo: '900028' }));

    expect(seen[0]?.headers.get('X-Worker-No')).toBe('900028');
  });

  it('사번이 없는 건에는 그 헤더를 붙이지 않는다', async () => {
    const seen: Request[] = [];

    await transportWith(seen)(entry());

    expect(seen[0]?.headers.has('X-Worker-No')).toBe(false);
  });

  /* 큐에 담긴 건의 토큰은 이미 낡았고 충돌 화면을 볼 작업자가 그 자리에 없다. */
  it('낙관적 잠금 토큰을 싣지 않는다', async () => {
    const seen: Request[] = [];

    await transportWith(seen)(entry());

    expect(seen[0]?.headers.has('If-Match')).toBe(false);
  });

  it('파일은 몸을 바꿔 보내고 내용 유형을 우리가 적지 않는다', async () => {
    const seen: Request[] = [];

    await transportWith(seen)(
      entry({
        body: null,
        file: { fileName: 'a.jpg', mimeType: 'image/jpeg', data: 'AAAA' },
      }),
    );

    const contentType = seen[0]?.headers.get('Content-Type') ?? '';

    expect(contentType.startsWith('multipart/form-data')).toBe(true);
    expect(contentType).toContain('boundary=');
  });

  it('보낼 수 없는 방식은 그렇게 말한다', async () => {
    const seen: Request[] = [];

    await expect(
      transportWith(seen)(entry({ method: 'FOO' as OutboxEntry['method'] })),
    ).rejects.toThrow('보낼 수 없는 방식입니다');
  });
});
