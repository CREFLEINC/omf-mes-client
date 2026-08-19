import { act, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import { notificationListBody } from './fixtures';
import {
  notificationKeys,
  useMarkAllRead,
  useMarkRead,
  useNotificationList,
  type NotificationListQuery,
} from './queries';

const LIST_PATH = '/app/notifications';

const KST_PERIOD: NotificationListQuery = {
  occurredFrom: '2026-08-11T00:00:00+09:00',
  occurredTo: '2026-08-17T23:59:59+09:00',
};

const listRoute: StubRoute = {
  match: (request) => new URL(request.url).pathname === LIST_PATH,
  respond: () => jsonResponse(notificationListBody()),
};

/** 나간 주소를 기록한다. 「무엇을 실었는가」와 「몇 번 불렀는가」를 한 자리에서 본다. */
const recordingFetch = (): { fetch: StubFetch; urls: URL[] } => {
  const urls: URL[] = [];
  const stub = createStubFetch([listRoute]);

  return {
    urls,
    fetch: async (request) => {
      urls.push(new URL(request.url));

      return stub(request);
    },
  };
};

describe('notificationKeys', () => {
  it('조건이 다르면 캐시 키가 다르다 — 같으면 다른 기간의 결과가 서로의 자리에 선다', () => {
    const other: NotificationListQuery = {
      ...KST_PERIOD,
      occurredFrom: '2026-08-01T00:00:00+09:00',
    };

    expect(notificationKeys.list(KST_PERIOD)).not.toEqual(notificationKeys.list(other));
  });

  it('조회하지 않는 상태도 자기 키를 갖는다', () => {
    expect(notificationKeys.list(null)).toEqual(['notifications', 'list', null]);
  });
});

describe('useNotificationList', () => {
  it('기간을 실어 목록을 부른다', async () => {
    const { fetch, urls } = recordingFetch();
    const { result } = renderHookWithProviders(() => useNotificationList(KST_PERIOD), { fetch });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(urls).toHaveLength(1);
    expect(urls[0]?.pathname).toBe(LIST_PATH);
    expect(urls[0]?.searchParams.get('occurredFrom')).toBe('2026-08-11T00:00:00+09:00');
    expect(urls[0]?.searchParams.get('occurredTo')).toBe('2026-08-17T23:59:59+09:00');
  });

  it('쪽 크기를 싣지 않는다 — 서버 기본값을 쓴다', () => {
    const { fetch, urls } = recordingFetch();
    renderHookWithProviders(() => useNotificationList(KST_PERIOD), { fetch });

    return waitFor(() => {
      expect(urls).toHaveLength(1);
      expect(urls[0]?.searchParams.has('size')).toBe(false);
    });
  });

  it('응답을 화면이 쓰는 모양으로 옮긴다 — 표기와 쪽 메타가 함께 온다', async () => {
    const { fetch } = recordingFetch();
    const { result } = renderHookWithProviders(() => useNotificationList(KST_PERIOD), { fetch });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.items[0]?.occurredAtText).toBe('08-17 14:05');
    /* 쪽 메타는 서버가 정본이다 — 화면이 지어내지 않는다. */
    expect(result.current.data?.page.size).toBe(50);
  });

  it('보낼 수 없는 기간에서는 한 번도 부르지 않는다', async () => {
    const { fetch, urls } = recordingFetch();
    const { result } = renderHookWithProviders(() => useNotificationList(null), { fetch });

    /* 짝 양성 없이 「부르지 않았다」만 재면 훅이 아예 죽어도 통과한다 — 상태를 함께 본다. */
    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('idle');
    });

    expect(urls).toHaveLength(0);
  });
});

describe('useMarkRead — 되먹임 예외는 요청 실패가 아니다', () => {
  const READ_PATH = '/app/notifications/7101:read';

  const markReadRoute = (respond: () => Response): StubRoute => ({
    match: (request) => request.method === 'POST' && new URL(request.url).pathname === READ_PATH,
    respond,
  });

  /**
   * ⭐ **성공 되먹임이 던진 것을 요청 실패로 말하지 않는다**(전례 `login/queries.ts` ·
   * `omf-mes#96` 계열 — W-CO-01에 리뷰 지적으로 들어온 규율).
   *
   * `.catch`를 `.then` 뒤에만 걸어 두면 **되먹임이 던진 것까지** 잡는다. 그러면 서버는 읽음으로
   * 바꿨는데 화면은 「읽음으로 바꾸지 못했습니다」라는 **거짓 진술**을 세우고, 사용자가 다시
   * 눌러도 아무 일이 없다(이미 읽음이다).
   *
   * ⚠ **화면을 거쳐서는 이 경로에 닿을 수 없다** — 화면의 되먹임은 `setReadState` 하나이고,
   * React의 상태 갱신 함수는 **나중에** 불려 이 자리에서 동기적으로 던지지 않는다(실측).
   * 그래서 훅을 직접 세워 잰다. 되먹임은 소비자가 넘기는 함수라 **훅이 그것을 신뢰하지 않는
   * 것**이 이 갈래의 뜻이다.
   */
  it('되먹임이 던지면 되먹임 갈래로 기록한다', async () => {
    const { result } = renderHookWithProviders(
      () =>
        useMarkRead({
          onSuccess: () => {
            throw new Error('합성 되먹임 예외');
          },
        }),
      { fetch: createStubFetch([markReadRoute(() => new Response(null, { status: 204 }))]) },
    );

    act(() => {
      result.current.markRead(7101);
    });

    await waitFor(() => {
      expect(result.current.failure).not.toBeNull();
    });

    expect(result.current.failure?.kind).toBe('feedback');
    /* ⛔ 통신 실패로 오인시키지 않는다 — 연결은 멀쩡했고 서버는 답했다. */
    expect(result.current.failure?.error.kind).not.toBe('network');
    /* 원인을 버리지 않는다 — 이 앱의 결함이 「서버가 이상하다」로 보이면 안 된다. */
    expect(result.current.failure?.cause).toBeInstanceOf(Error);
  });

  /** 짝 양성 — 진짜 요청 실패는 요청 갈래로 간다. 둘이 갈려야 뜻이 있다. */
  it('요청이 실패하면 요청 갈래로 기록한다', async () => {
    const { result } = renderHookWithProviders(
      () =>
        useMarkRead({
          onSuccess: () => undefined,
        }),
      {
        fetch: createStubFetch([
          markReadRoute(() => jsonResponse({ message: '' }, { status: 403 })),
        ]),
      },
    );

    act(() => {
      result.current.markRead(7101);
    });

    await waitFor(() => {
      expect(result.current.failure).not.toBeNull();
    });

    expect(result.current.failure?.kind).toBe('request');
    expect(result.current.failure?.cause).toBeUndefined();
  });

  it('되먹임이 던져도 그 번호가 잠긴 채로 남지 않는다', async () => {
    const { result } = renderHookWithProviders(
      () =>
        useMarkRead({
          onSuccess: () => {
            throw new Error('합성 되먹임 예외');
          },
        }),
      { fetch: createStubFetch([markReadRoute(() => new Response(null, { status: 204 }))]) },
    );

    act(() => {
      result.current.markRead(7101);
    });

    await waitFor(() => {
      expect(result.current.failure).not.toBeNull();
    });

    /* `.finally`가 갈래와 무관하게 돈다 — 그 카드를 다시 누를 수 있어야 한다. */
    expect(result.current.pendingIds.has(7101)).toBe(false);
  });
});

describe('useMarkAllRead — 되먹임 예외는 요청 실패가 아니다', () => {
  const READ_ALL_PATH = '/app/notifications:read-all';

  const readAllRoute = (respond: () => Response): StubRoute => ({
    match: (request) =>
      request.method === 'POST' && new URL(request.url).pathname === READ_ALL_PATH,
    respond,
  });

  /**
   * ⭐ **두 쓰기의 규율이 갈리면 안 된다.** 이 회차에 그 예외가 실제로 나는 경로는 없지만
   * (되먹임이 알림 한 줄뿐이다) 되먹임은 **소비자가 넘기는 함수**라, 뒤에 무엇이 붙든 그것이
   * 던진 것을 「모두 읽음으로 바꾸지 못했습니다」로 말하면 **거짓**이 된다 — 서버는 이미 전부
   * 바꿔 두었다. 규율이 한쪽에만 있으면 **뒤에 붙이는 사람이 어느 쪽을 따를지 알 수 없다.**
   */
  it('되먹임이 던지면 되먹임 갈래로 기록한다', async () => {
    const { result } = renderHookWithProviders(
      () =>
        useMarkAllRead({
          onSuccess: () => {
            throw new Error('합성 되먹임 예외');
          },
        }),
      { fetch: createStubFetch([readAllRoute(() => jsonResponse({ readCount: 5 }))]) },
    );

    act(() => {
      result.current.markAllRead();
    });

    await waitFor(() => {
      expect(result.current.failure).not.toBeNull();
    });

    expect(result.current.failure?.kind).toBe('feedback');
    expect(result.current.failure?.cause).toBeInstanceOf(Error);
  });

  /** 짝 양성 — 진짜 요청 실패는 요청 갈래로 간다. 둘이 갈려야 뜻이 있다. */
  it('요청이 실패하면 요청 갈래로 기록한다', async () => {
    const { result } = renderHookWithProviders(
      () => useMarkAllRead({ onSuccess: () => undefined }),
      {
        fetch: createStubFetch([
          readAllRoute(() => jsonResponse({ message: '' }, { status: 500 })),
        ]),
      },
    );

    act(() => {
      result.current.markAllRead();
    });

    await waitFor(() => {
      expect(result.current.failure).not.toBeNull();
    });

    expect(result.current.failure?.kind).toBe('request');
    expect(result.current.failure?.cause).toBeUndefined();
  });

  it('되먹임이 던져도 나가는 중 표시가 풀린다', async () => {
    const { result } = renderHookWithProviders(
      () =>
        useMarkAllRead({
          onSuccess: () => {
            throw new Error('합성 되먹임 예외');
          },
        }),
      { fetch: createStubFetch([readAllRoute(() => jsonResponse({ readCount: 5 }))]) },
    );

    act(() => {
      result.current.markAllRead();
    });

    await waitFor(() => {
      expect(result.current.failure).not.toBeNull();
    });

    expect(result.current.isSubmitting).toBe(false);
  });
});
