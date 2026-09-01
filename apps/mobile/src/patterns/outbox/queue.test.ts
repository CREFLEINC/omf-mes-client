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

  /* 읽지 못한 큐를 비우면 보내지 못한 것이 조용히 사라진다. */
  it('보관된 값이 깨져 있어도 예외를 내지 않는다', async () => {
    store.set('outbox', '{');

    expect(await readQueue()).toEqual([]);
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

describe('멱등키', () => {
  /* 본문만으로 만들면 다른 대상에 보낸 뒤 요청이 조용히 사라진다. */
  it('대상이 다르면 키도 다르다', () => {
    const first = createIdempotencyKey({ operation: 'result', target: 1 });
    const second = createIdempotencyKey({ operation: 'result', target: 2 });

    expect(first.startsWith('result:1:')).toBe(true);
    expect(second.startsWith('result:2:')).toBe(true);
  });

  it('오퍼레이션이 다르면 키도 다르다', () => {
    expect(createIdempotencyKey({ operation: 'issue', target: 1 })).not.toEqual(
      createIdempotencyKey({ operation: 'receipt', target: 1 }),
    );
  });

  /* 같은 대상에 같은 일을 일부러 두 번 하는 경우가 있다. */
  it('같은 대상이라도 부를 때마다 다른 키다', () => {
    const scope = { operation: 'result', target: 1 };

    expect(createIdempotencyKey(scope)).not.toEqual(createIdempotencyKey(scope));
  });

  it('대상이 없으면 오퍼레이션만으로 짓는다', () => {
    expect(createIdempotencyKey({ operation: 'register' }).startsWith('register:')).toBe(true);
  });
});
