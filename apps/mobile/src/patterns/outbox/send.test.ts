import { describe, expect, it, vi } from 'vitest';

import { NETWORK_ERROR } from '@omf-mes/api-client';

import { ApiRequestError } from '../request';
import { flushQueue, type OutboxTransport } from './send';
import type { OutboxEntry } from './queue';

const entry = (id: string, batchId?: string): OutboxEntry => ({
  id,
  label: '생산 실적',
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

describe('앞 건이 만든 것에 붙는 건', () => {
  const leader = { ...entry('body', 'report-1'), path: '/maintenance/breakdowns' };
  const follower = {
    ...entry('photo', 'report-1'),
    path: '/maintenance/breakdowns/:id/attachments',
    pathFrom: { entryId: 'body', field: 'breakdownId', token: ':id' },
  };

  it('앞 건의 응답으로 경로를 완성해 보낸다', async () => {
    const seen: string[] = [];
    const send: OutboxTransport = (item) => {
      seen.push(item.path);
      return Promise.resolve(item.id === 'body' ? { breakdownId: 42 } : {});
    };

    const result = await flushQueue([leader, follower], send);

    expect(seen).toEqual(['/maintenance/breakdowns', '/maintenance/breakdowns/42/attachments']);
    expect(result.sent).toBe(2);
  });

  /* 붙을 곳이 없으면 이 건만 다시 보내서는 풀리지 않는다. */
  it('앞 건이 거부되면 붙을 곳이 없어 함께 되돌아온다', async () => {
    const result = await flushQueue([leader, follower], rejectWith(new Set(['body'])));

    expect(result.sent).toBe(0);
    expect(result.rejected.map((item) => [item.entry.id, item.cascaded])).toEqual([
      ['body', false],
      ['photo', true],
    ]);
  });

  /* 본문은 갔는데 사진이 다음 회차로 넘어가면, 그때는 앞 건이 큐에 없어 붙을 곳을 잃는다. */
  it('앞 건이 간 뒤 멈추면 뒤 건이 완성된 경로를 들고 남는다', async () => {
    const send: OutboxTransport = (item) => {
      if (item.id === 'body') {
        return Promise.resolve({ breakdownId: 42 });
      }
      return Promise.reject(new ApiRequestError(NETWORK_ERROR));
    };

    const result = await flushQueue([leader, follower], send);

    expect(result.outcome).toBe('unreachable');
    expect(result.remaining).toHaveLength(1);
    expect(result.remaining[0]?.path).toBe('/maintenance/breakdowns/42/attachments');
    expect(result.remaining[0]?.pathFrom).toBeUndefined();
  });

  it('앞 건의 응답에 그 값이 없으면 보내지 않는다', async () => {
    const seen: string[] = [];
    const send: OutboxTransport = (item) => {
      seen.push(item.path);
      return Promise.resolve({});
    };

    const result = await flushQueue([leader, follower], send);

    expect(seen).toEqual(['/maintenance/breakdowns']);
    expect(result.rejected.map((item) => item.entry.id)).toEqual(['photo']);
  });
});

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
    expect(result).toEqual({
      sent: 0,
      responses: new Map(),
      rejected: [],
      remaining: [],
      outcome: 'drained',
    });
  });
});

describe('서버가 돌려준 값', () => {
  /*
   * 서버가 매기는 값을 화면이 보여야 할 때가 있다 - 자재 묶음 번호처럼 화면이 미리 지어낼 수
   * 없는 것이다. 여기서 끊기면 큐를 타는 쓰기는 그 값을 다시 얻을 길이 없다.
   */
  it('보낸 건의 응답을 멱등키로 찾을 수 있다', async () => {
    const send: OutboxTransport = (item) =>
      Promise.resolve({ lotNo: `LOT-${(item.body as { id: string }).id}` });

    const result = await flushQueue([entry('a'), entry('b')], send);

    expect(result.responses.get('key-a')).toEqual({ lotNo: 'LOT-a' });
    expect(result.responses.get('key-b')).toEqual({ lotNo: 'LOT-b' });
  });

  /* 못 간 건의 응답을 내면 화면이 가지 않은 것을 갔다고 말한다. */
  it('되돌아온 건의 응답은 내지 않는다', async () => {
    const result = await flushQueue([entry('a')], rejectWith(new Set(['a'])));

    expect(result.responses.has('key-a')).toBe(false);
    expect(result.rejected).toHaveLength(1);
  });

  /* 도중에 멈춰도 그때까지 간 건의 값은 화면이 써야 한다. */
  it('도중에 멈춰도 그때까지 간 건의 응답은 낸다', async () => {
    const send: OutboxTransport = (item) => {
      if ((item.body as { id: string }).id === 'b') {
        return Promise.reject(new ApiRequestError(NETWORK_ERROR));
      }

      return Promise.resolve({ lotNo: 'LOT-a' });
    };

    const result = await flushQueue([entry('a'), entry('b')], send);

    expect(result.outcome).toBe('unreachable');
    expect(result.responses.get('key-a')).toEqual({ lotNo: 'LOT-a' });
  });
});
