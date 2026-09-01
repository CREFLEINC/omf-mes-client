import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiRequestError } from '../request';
import { OutboxProvider, useOutbox } from './context';
import type { OutboxDraft } from './queue';
import type { OutboxTransport } from './send';

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

/* 셸이 스스로 보내므로 기본은 못 닿는 상태로 둔다 - 그래야 큐에 쌓인 것을 잴 수 있다. */
const unreachable: OutboxTransport = () => Promise.reject(new ApiRequestError({ kind: 'network' }));

const mount = (send: OutboxTransport = unreachable) =>
  renderHook(() => useOutbox(), {
    wrapper: ({ children }) => <OutboxProvider send={send}>{children}</OutboxProvider>,
  });

beforeEach(() => {
  store.clear();
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
