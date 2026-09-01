import { describe, expect, it, vi } from 'vitest';

import { NETWORK_ERROR } from '@omf-mes/api-client';

import { ApiRequestError } from '../request';
import { flushQueue, type OutboxTransport } from './send';
import type { OutboxEntry } from './queue';

const entry = (id: string, batchId?: string): OutboxEntry => ({
  id,
  idempotencyKey: `key-${id}`,
  method: 'POST',
  path: '/production/results',
  body: { id },
  occurredAt: '2026-09-01T00:00:00.000Z',
  confirmation: 'immediate',
  ...(batchId === undefined ? {} : { batchId }),
});

const rejectWith = (ids: Set<string>): OutboxTransport => {
  return (item) => {
    if (ids.has(item.id)) {
      return Promise.reject(
        new ApiRequestError({ kind: 'http', status: 409, message: '이미 처리됐습니다' }),
      );
    }
    return Promise.resolve();
  };
};

describe('큐 전송', () => {
  it('담긴 순서대로 하나씩 보낸다', async () => {
    const seen: string[] = [];
    const send: OutboxTransport = (item) => {
      seen.push(item.id);
      return Promise.resolve();
    };

    const result = await flushQueue([entry('a'), entry('b'), entry('c')], send);

    expect(seen).toEqual(['a', 'b', 'c']);
    expect(result.sent).toBe(3);
    expect(result.outcome).toBe('drained');
    expect(result.remaining).toEqual([]);
  });

  /* 마흔 건 중 하나가 거부됐다고 서른아홉을 되돌리면 현장이 멈춘다. */
  it('거부된 건만 빼고 나머지를 계속 보낸다', async () => {
    const seen: string[] = [];
    const send: OutboxTransport = (item) => {
      seen.push(item.id);
      return rejectWith(new Set(['b']))(item);
    };

    const result = await flushQueue([entry('a'), entry('b'), entry('c')], send);

    expect(seen).toEqual(['a', 'b', 'c']);
    expect(result.sent).toBe(2);
    expect(result.rejected.map((item) => item.entry.id)).toEqual(['b']);
    expect(result.remaining).toEqual([]);
  });

  /* 뒤 건은 앞 건이 만든 식별자를 참조하므로 혼자서는 반드시 실패한다. */
  it('묶음의 앞이 거부되면 딸린 뒤도 함께 되돌린다', async () => {
    const seen: string[] = [];
    const send: OutboxTransport = (item) => {
      seen.push(item.id);
      return rejectWith(new Set(['out']))(item);
    };

    const result = await flushQueue(
      [entry('out', 'move-1'), entry('in', 'move-1'), entry('other')],
      send,
    );

    expect(seen).toEqual(['out', 'other']);
    expect(result.rejected.map((item) => [item.entry.id, item.cascaded])).toEqual([
      ['out', false],
      ['in', true],
    ]);
    expect(result.sent).toBe(1);
  });

  it('딸려 되돌아온 건은 앞 건의 이유를 그대로 갖는다', async () => {
    const result = await flushQueue(
      [entry('out', 'move-1'), entry('in', 'move-1')],
      rejectWith(new Set(['out'])),
    );

    expect(result.rejected[1]?.error).toEqual(result.rejected[0]?.error);
  });

  /* 연결이 없는 것은 그 건의 잘못이 아니다. */
  it('닿지 못하면 거기서 멈추고 남은 것을 그대로 둔다', async () => {
    const send: OutboxTransport = (item) =>
      item.id === 'b' ? Promise.reject(new ApiRequestError(NETWORK_ERROR)) : Promise.resolve();

    const result = await flushQueue([entry('a'), entry('b'), entry('c')], send);

    expect(result.sent).toBe(1);
    expect(result.outcome).toBe('unreachable');
    expect(result.remaining.map((item) => item.id)).toEqual(['b', 'c']);
    expect(result.rejected).toEqual([]);
  });

  /* 판정을 받지 못한 기록을 버리면 되찾을 자리가 없다. */
  it('무엇인지 모를 실패에는 기록을 버리지 않는다', async () => {
    const send: OutboxTransport = (item) =>
      item.id === 'b' ? Promise.reject(new TypeError('예상 못 한 것')) : Promise.resolve();

    const result = await flushQueue([entry('a'), entry('b'), entry('c')], send);

    expect(result.outcome).toBe('unreachable');
    expect(result.remaining.map((item) => item.id)).toEqual(['b', 'c']);
    expect(result.rejected).toEqual([]);
  });

  it('빈 큐는 아무것도 보내지 않는다', async () => {
    const send = vi.fn(() => Promise.resolve());

    const result = await flushQueue([], send);

    expect(send).not.toHaveBeenCalled();
    expect(result).toEqual({ sent: 0, rejected: [], remaining: [], outcome: 'drained' });
  });
});
