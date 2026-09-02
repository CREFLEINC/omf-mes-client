import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { OutboxEntry } from './queue';
import {
  OUTBOX_REJECTED_BROKEN_KEY,
  OUTBOX_REJECTED_KEY,
  REJECTED_LIMIT,
  appendRejected,
  dropRejected,
  readRejected,
  writeRejected,
  type RejectedRecord,
} from './rejected';
import type { OutboxRejection } from './send';

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

beforeEach(() => {
  store.clear();
});

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

const rejection = (overrides: Partial<OutboxRejection> = {}): OutboxRejection => ({
  entry: entry(),
  error: { kind: 'http', status: 422 },
  cascaded: false,
  ...overrides,
});

const AT = '2026-09-01T01:00:00.000Z';

describe('되돌아온 건', () => {
  it('되돌린 시각과 함께 남긴다', () => {
    const kept = appendRejected([], [rejection()], AT);

    expect(kept).toHaveLength(1);
    expect(kept[0]?.entry.id).toBe('e-1');
    expect(kept[0]?.error).toEqual({ kind: 'http', status: 422 });
    expect(kept[0]?.rejectedAt).toBe(AT);
  });

  it('이미 남아 있는 것 뒤에 붙인다', () => {
    const first = appendRejected([], [rejection()], AT);
    const kept = appendRejected(first, [rejection({ entry: entry({ id: 'e-2' }) })], AT);

    expect(kept.map((record) => record.entry.id)).toEqual(['e-1', 'e-2']);
  });

  /* 다시 보내지 않는 건이라 사진의 몸을 들고 있을 곳이 없다. 무엇이었는지는 이름이 말한다. */
  it('파일의 몸은 버리고 이름은 남긴다', () => {
    const withPhoto = entry({
      file: { fileName: 'a.jpg', mimeType: 'image/jpeg', data: 'AAAABBBB' },
    });

    const kept = appendRejected([], [rejection({ entry: withPhoto })], AT);

    expect(kept[0]?.entry.file?.data).toBe('');
    expect(kept[0]?.entry.file?.fileName).toBe('a.jpg');
  });

  it('한도를 넘으면 오래된 것부터 버린다', () => {
    const many = Array.from({ length: REJECTED_LIMIT + 5 }, (_, index) =>
      rejection({ entry: entry({ id: `e-${String(index)}` }) }),
    );

    const kept = appendRejected([], many, AT);

    expect(kept).toHaveLength(REJECTED_LIMIT);
    expect(kept[0]?.entry.id).toBe('e-5');
  });

  it('보관소에 남긴 것을 그대로 되읽는다', async () => {
    await writeRejected(appendRejected([], [rejection()], AT));

    const read = await readRejected();

    expect(read).toHaveLength(1);
    expect(read[0]?.entry.label).toBe('설비 고장 보고');
  });

  /* 여기서 버리면 무엇이 되돌아왔는지가 통째로 사라진다. */
  it('읽지 못한 내용은 원본을 다른 자리에 남긴다', async () => {
    store.set(OUTBOX_REJECTED_KEY, '{망가진');

    await expect(readRejected()).resolves.toEqual([]);
    expect(store.get(OUTBOX_REJECTED_BROKEN_KEY)).toBe('{망가진');
  });

  it('내린 것만 목록에서 빠진다', () => {
    const records: RejectedRecord[] = appendRejected(
      [],
      [rejection(), rejection({ entry: entry({ id: 'e-2' }) })],
      AT,
    );

    expect(dropRejected(records, 'e-1').map((record) => record.entry.id)).toEqual(['e-2']);
  });
});
