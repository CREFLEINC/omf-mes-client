import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiRequestError } from '../request';
import { OutboxProvider, useOutbox } from './context';
import type { OutboxDraft } from './queue';
import type { OutboxTransport } from './send';

const store = vi.hoisted(() => new Map<string, string>());

/** 보관소가 특정 자리의 저장을 거절하는 상황을 만든다. */
const refuse = vi.hoisted(() => ({ key: null as string | null }));

vi.mock('../local-store', () => ({
  readLocal: (key: string) => Promise.resolve(store.get(key) ?? null),
  writeLocal: (key: string, value: string) => {
    if (key === refuse.key) {
      return Promise.reject(new Error('보관소가 거절했습니다'));
    }

    store.set(key, value);
    return Promise.resolve();
  },
  removeLocal: (key: string) => {
    store.delete(key);
    return Promise.resolve();
  },
}));

const draft = (key: string): OutboxDraft => ({
  label: '생산 실적',
  idempotencyKey: key,
  method: 'POST',
  path: '/production/results',
  body: {},
  occurredAt: '2026-09-01T00:00:00.000Z',
  confirmation: 'immediate',
});

/* 셸이 스스로 보내므로 기본은 못 닿는 상태로 둔다 - 그래야 큐에 쌓인 것을 잴 수 있다. */
const unreachable: OutboxTransport = () => Promise.reject(new ApiRequestError({ kind: 'network' }));

const mount = (send: OutboxTransport = unreachable) =>
  renderHook(() => useOutbox(), {
    wrapper: ({ children }) => <OutboxProvider send={send}>{children}</OutboxProvider>,
  });

beforeEach(() => {
  store.clear();
  refuse.key = null;
});

describe('outbox', () => {
  it('담긴 건수를 상시 낸다', async () => {
    const { result } = mount();

    await act(async () => {
      await result.current.enqueue(draft('k-1'));
    });

    expect(result.current.pending).toBe(1);
  });

  /* 통신을 기다리게 하지 않는 것이 이 부품의 요점이다. */
  /* 통신을 기다리게 하지 않는 것이 이 부품의 요점이다. */
  it('담기는 통신이 끝나기를 기다리지 않는다', async () => {
    const { result } = mount(() => new Promise<void>(() => undefined));

    await act(async () => {
      await result.current.enqueue(draft('k-1'));
    });

    expect(result.current.pending).toBe(1);
  });

  /* 화면 둘이 동시에 담으면 나중 것이 먼저 것을 덮어 한 건이 사라진다. */
  it('동시에 담아도 한 건도 잃지 않는다', async () => {
    const { result } = mount();

    await act(async () => {
      await Promise.all([
        result.current.enqueue(draft('k-1')),
        result.current.enqueue(draft('k-2')),
        result.current.enqueue(draft('k-3')),
      ]);
    });

    expect(result.current.pending).toBe(3);
  });

  /* 보내는 중에 담긴 것을 비우면 방금 담은 기록이 사라진다. */
  it('보내는 도중에 담긴 것을 지우지 않는다', async () => {
    let release: (() => void) | null = null;
    const send: OutboxTransport = () =>
      new Promise<void>((resolve) => {
        release = resolve;
      });
    const { result } = mount(send);

    await act(async () => {
      await result.current.enqueue(draft('k-1'));
    });

    await act(async () => {
      const sending = result.current.flush();
      await result.current.enqueue(draft('k-2'));
      release?.();
      await sending;
    });

    expect(result.current.pending).toBe(1);
  });

  /* 겹쳐 부르면 같은 건을 두 번 보낸다. 서버가 흡수해도 보낸 건수는 거짓이 된다. */
  it('겹쳐 보내라 해도 같은 건을 두 번 보내지 않는다', async () => {
    const seen: string[] = [];
    let reachable = false;
    const send: OutboxTransport = (entry) => {
      if (!reachable) {
        return Promise.reject(new ApiRequestError({ kind: 'network' }));
      }
      seen.push(entry.idempotencyKey);
      return Promise.resolve();
    };
    const { result } = mount(send);

    await act(async () => {
      await result.current.enqueue(draft('k-1'));
    });

    reachable = true;
    await act(async () => {
      await Promise.all([result.current.flush(), result.current.flush()]);
    });

    expect(seen).toEqual(['k-1']);
  });

  it('앱을 다시 띄워도 담긴 것이 남아 있다', async () => {
    const first = mount();
    await act(async () => {
      await first.result.current.enqueue(draft('k-1'));
    });

    const again = mount();

    await waitFor(() => {
      expect(again.result.current.pending).toBe(1);
    });
  });

  it('보낸 만큼 건수가 줄고 큐가 비워진다', async () => {
    const { result } = mount(() => Promise.resolve());

    await act(async () => {
      await result.current.enqueue(draft('k-1'));
      await result.current.enqueue(draft('k-2'));
    });

    await act(async () => {
      await result.current.flush();
    });

    expect(result.current.pending).toBe(0);
    expect(store.get('outbox')).toBe('[]');
  });

  /* 닿지 못한 것을 지우면 되찾을 자리가 없다. */
  it('닿지 못하면 담긴 채로 남는다', async () => {
    const send: OutboxTransport = () => Promise.reject(new ApiRequestError({ kind: 'network' }));
    const { result } = mount(send);

    await act(async () => {
      await result.current.enqueue(draft('k-1'));
    });

    let outcome: string | undefined;
    await act(async () => {
      outcome = (await result.current.flush())?.outcome;
    });

    expect(outcome).toBe('unreachable');
    expect(result.current.pending).toBe(1);
  });

  it('거부된 건은 큐에서 빠진다', async () => {
    const send: OutboxTransport = () =>
      Promise.reject(new ApiRequestError({ kind: 'http', status: 409 }));
    const { result } = mount(send);

    await act(async () => {
      await result.current.enqueue(draft('k-1'));
    });

    await waitFor(() => {
      expect(result.current.pending).toBe(0);
    });
  });

  /* 큐에서 빠지고 어디에도 남지 않으면, 적은 사람은 기록이 어디로 갔는지 알 수 없다. */
  it('거부된 건을 큐 밖에 남긴다', async () => {
    const send: OutboxTransport = () =>
      Promise.reject(new ApiRequestError({ kind: 'http', status: 422 }));
    const { result } = mount(send);

    await act(async () => {
      await result.current.enqueue(draft('k-1'));
    });

    await waitFor(() => {
      expect(result.current.rejected).toHaveLength(1);
    });
    expect(result.current.rejected[0]?.entry.label).toBe('생산 실적');
    expect(result.current.rejected[0]?.error).toEqual({ kind: 'http', status: 422 });
  });

  /*
   * 큐를 먼저 비우면, 그 사이에 보관소가 거절할 때 큐에서도 빠지고 어디에도 남지 않는다.
   * 남기는 것이 먼저라야 최악이 같은 건을 큐에 한 번 더 남기는 데서 그친다.
   */
  it('보관소가 큐 저장을 거절해도 되돌아온 건은 남는다', async () => {
    const send: OutboxTransport = () =>
      Promise.reject(new ApiRequestError({ kind: 'http', status: 422 }));

    // 담아 둔 것을 셸이 스스로 보내는 첫 회차에 거절이 걸리게 한다.
    store.set('outbox', JSON.stringify([{ ...draft('k-1'), id: 'e-1' }]));
    refuse.key = 'outbox';

    const { result } = mount(send);

    await waitFor(() => {
      expect(result.current.rejected).toHaveLength(1);
    });
  });

  it('앱을 다시 띄워도 되돌아온 건이 남아 있다', async () => {
    const send: OutboxTransport = () =>
      Promise.reject(new ApiRequestError({ kind: 'http', status: 422 }));
    const first = mount(send);

    await act(async () => {
      await first.result.current.enqueue(draft('k-1'));
    });
    await waitFor(() => {
      expect(first.result.current.rejected).toHaveLength(1);
    });

    const again = mount(send);

    await waitFor(() => {
      expect(again.result.current.rejected).toHaveLength(1);
    });
  });

  /* 닿지 못한 것은 기다리면 간다. 거부와 같은 목록에 넣으면 갈 것을 안 간다고 하는 셈이다. */
  it('닿지 못한 건은 되돌아온 것으로 세지 않는다', async () => {
    const { result } = mount();

    await act(async () => {
      await result.current.enqueue(draft('k-1'));
    });

    await act(async () => {
      await result.current.flush();
    });

    expect(result.current.rejected).toHaveLength(0);
    expect(result.current.pending).toBe(1);
  });

  it('내린 건은 다시 띄워도 돌아오지 않는다', async () => {
    const send: OutboxTransport = () =>
      Promise.reject(new ApiRequestError({ kind: 'http', status: 422 }));
    const { result } = mount(send);

    await act(async () => {
      await result.current.enqueue(draft('k-1'));
    });
    await waitFor(() => {
      expect(result.current.rejected).toHaveLength(1);
    });

    const id = result.current.rejected[0]?.entry.id ?? '';
    await act(async () => {
      await result.current.dismissRejected(id);
    });

    expect(result.current.rejected).toHaveLength(0);

    const again = mount(send);
    await waitFor(() => {
      expect(again.result.current.pending).toBe(0);
    });
    expect(again.result.current.rejected).toHaveLength(0);
  });

  /* 어느 화면도 열지 않으면 큐가 갇힌다. 셸이 스스로 보낸다. */
  it('앱을 다시 띄우면 남아 있던 것을 스스로 보낸다', async () => {
    const first = mount();
    await act(async () => {
      await first.result.current.enqueue(draft('k-1'));
    });

    const seen: string[] = [];
    const send: OutboxTransport = (entry) => {
      seen.push(entry.idempotencyKey);
      return Promise.resolve();
    };
    const again = mount(send);

    await waitFor(() => {
      expect(seen).toEqual(['k-1']);
    });
    expect(again.result.current.pending).toBe(0);
  });

  it('연결이 돌아오면 스스로 보낸다', async () => {
    const seen: string[] = [];
    let reachable = false;
    const send: OutboxTransport = (entry) => {
      if (!reachable) {
        return Promise.reject(new ApiRequestError({ kind: 'network' }));
      }
      seen.push(entry.idempotencyKey);
      return Promise.resolve();
    };
    const { result } = mount(send);

    await act(async () => {
      await result.current.enqueue(draft('k-1'));
      await result.current.flush();
    });

    expect(result.current.pending).toBe(1);

    reachable = true;
    await act(async () => {
      window.dispatchEvent(new Event('online'));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await waitFor(() => {
      expect(seen).toEqual(['k-1']);
    });
  });

  /* 서버만 죽었다 살아나면 연결 사건이 오지 않아 큐가 앱을 켜 둔 내내 갇힌다. */
  it('화면이 다시 앞으로 나오면 스스로 보낸다', async () => {
    const seen: string[] = [];
    let reachable = false;
    const send: OutboxTransport = (entry) => {
      if (!reachable) {
        return Promise.reject(new ApiRequestError({ kind: 'network' }));
      }
      seen.push(entry.idempotencyKey);
      return Promise.resolve();
    };
    const { result } = mount(send);

    await act(async () => {
      await result.current.enqueue(draft('k-1'));
    });

    expect(result.current.pending).toBe(1);

    reachable = true;
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await waitFor(() => {
      expect(seen).toEqual(['k-1']);
    });
  });

  it('빈 큐를 보내면 아무 결과도 내지 않는다', async () => {
    const { result } = mount();

    let value: unknown;
    await act(async () => {
      value = await result.current.flush();
    });

    expect(value).toBeNull();
  });
});
