import { beforeEach, describe, expect, it, vi } from 'vitest';

import { appendEntry, readQueue, writeQueue, type OutboxDraft } from './queue';
import { createIdempotencyKey } from './key';

const store = vi.hoisted(() => new Map<string, string>());

vi.mock('../local-store', () => ({
  readLocal: (key: string) => Promise.resolve(store.get(key) ?? null),
  writeLocal: (key: string, value: string) => {
    store.set(key, value);
    return Promise.resolve();
  },
  removeLocal: (key: string) => {
    store.delete(key);
    return Promise.resolve();
  },
}));

const draft = (key: string): OutboxDraft => ({
  idempotencyKey: key,
  method: 'POST',
  path: '/production/results',
  body: {},
  occurredAt: '2026-09-01T00:00:00.000Z',
  confirmation: 'immediate',
});

beforeEach(() => {
  store.clear();
});

describe('큐 보관', () => {
  it('담은 것을 그대로 돌려준다', async () => {
    await writeQueue([{ ...draft('k-1'), id: 'a' }]);

    expect(await readQueue()).toEqual([{ ...draft('k-1'), id: 'a' }]);
  });

  it('담은 적이 없으면 빈 큐다', async () => {
    expect(await readQueue()).toEqual([]);
  });

  /* 읽지 못한 큐를 그대로 두면 다음 저장이 덮어 없앤다. */
  it('보관된 값이 깨져 있으면 옮겨 두고 빈 큐로 본다', async () => {
    store.set('outbox', '{');

    expect(await readQueue()).toEqual([]);
    expect(store.get('outbox-broken')).toBe('{');
  });

  it('배열이 아닌 값도 옮겨 둔다', async () => {
    store.set('outbox', '{"a":1}');

    expect(await readQueue()).toEqual([]);
    expect(store.get('outbox-broken')).toBe('{"a":1}');
  });
});

describe('큐에 담기', () => {
  it('뒤에 붙이고 식별자를 만들어 준다', () => {
    const next = appendEntry([], draft('k-1'));

    expect(next).toHaveLength(1);
    expect(next[0]?.id).toMatch(/^[0-9a-f]{16}$/);
  });

  it('순서를 지킨다', () => {
    const next = appendEntry(appendEntry([], draft('k-1')), draft('k-2'));

    expect(next.map((entry) => entry.idempotencyKey)).toEqual(['k-1', 'k-2']);
  });

  /* 같은 키가 두 번 담기면 서버가 하나를 흡수해 화면은 두 건이 갔다고 믿는다. */
  it('큐 안의 같은 키는 다시 담지 않는다', () => {
    const once = appendEntry([], draft('k-1'));
    const twice = appendEntry(once, draft('k-1'));

    expect(twice).toHaveLength(1);
    expect(twice).toBe(once);
  });
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('멱등키', () => {
  /* 계약이 형식을 UUID 로 못 박았다. 다른 모양이면 서버가 요청 자체를 거부한다. */
  it('계약이 요구하는 형식이다', () => {
    expect(createIdempotencyKey()).toMatch(UUID);
  });

  /* 내용으로 지으면 다른 대상에 보낸 뒤 요청이 조용히 사라진다. */
  it('부를 때마다 다른 키다', () => {
    expect(createIdempotencyKey()).not.toEqual(createIdempotencyKey());
  });
});
