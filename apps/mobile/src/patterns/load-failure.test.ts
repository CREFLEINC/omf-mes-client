import { messages } from '@omf-mes/i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubRoute,
} from '../test/api-harness';
import { useApiClient } from './api-context';
import { TOKEN_CHECK_PATIENCE_MS, useLoadFailure, useSaveRefusal } from './load-failure';
import { forgetPlant, rememberPlant } from './plant';
import { runRequest } from './request';

const store = vi.hoisted(() => new Map<string, string>());

vi.mock('./local-store', () => ({
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

const OFFLINE = '사번을 확인할 수 없습니다. 연결을 확인하세요.';
const denied = { errors: [{ scope: 'screen', code: 'PERMISSION_DENIED', message: '거절' }] };
/** 서버 `loginRequired()` - 토큰이 없거나 죽었을 때, 단말에 열지 않은 경로일 때 같은 문구다. */
const loginRequired = {
  errors: [{ scope: 'screen', code: 'PERMISSION_DENIED', message: '로그인이 필요합니다.' }],
};
/** 서버 `wrongTerminalType()` - 토큰은 맞는데 단말 유형이 다르다(omf-mes-server#859). */
const WRONG_TYPE =
  '이 기능은 POP 단말에서만 쓸 수 있습니다(지금 단말: PDA(모바일 단말)) — POP 단말에서 하세요.';
const wrongType = { errors: [{ scope: 'screen', code: 'PERMISSION_DENIED', message: WRONG_TYPE }] };
const page = { page: 1, size: 1, total: 0 };

/** 화면의 조회 하나와 문구 고르기를 함께 돌린다. */
const useScreen = () => {
  const { client } = useApiClient();
  const items = useQuery({
    queryKey: ['items'],
    queryFn: () => runRequest(() => client.GET('/mdm/items', {})),
  });
  const describe = useLoadFailure();

  return { items, text: items.isError ? describe(items.error, OFFLINE) : null };
};

const items = (respond: StubRoute['respond']): StubRoute => ({
  match: (request) => new URL(request.url).pathname === '/mdm/items',
  respond,
});

/** 토큰 확인은 등록 때와 같은 조회다 - 공장을 싣고 한 줄만 묻는다. */
const probe = (respond: StubRoute['respond']): StubRoute => ({
  match: (request) => {
    const url = new URL(request.url);
    return url.pathname === '/mdm/workers' && url.searchParams.get('plantId') === '7';
  },
  respond,
});

describe('조회 실패 문구 고르기', () => {
  beforeEach(async () => {
    store.clear();
    await rememberPlant(7);
  });

  it('닿지 못했으면 그 자리의 연결 문구를 쓴다', async () => {
    const fetch = createStubFetch([items(() => Promise.reject(new TypeError('Failed to fetch')))]);

    const { result } = renderHookWithProviders(useScreen, { fetch });

    await waitFor(() => {
      expect(result.current.text).toBe(OFFLINE);
    });
  });

  it('서버가 답을 못 줬으면 연결을 보라고 하지 않는다', async () => {
    const fetch = createStubFetch([items(() => jsonResponse({}, { status: 500 }))]);

    const { result } = renderHookWithProviders(useScreen, { fetch });

    await waitFor(() => {
      expect(result.current.text).toBe(messages.httpError.loadServer);
    });
  });

  /*
   * 재발급·단말 정보 변경으로 토큰이 죽으면 모든 조회가 401 이다. 새 QR 이 필요하다는 말은
   * 셸이 한 번만 한다 - 조회마다 달면 한 화면에 여러 번 뜬다(#1198).
   */
  it('거절됐고 토큰도 죽었으면 조회 자리에는 아무 문구도 달지 않는다', async () => {
    const fetch = createStubFetch([
      items(() => jsonResponse(denied, { status: 401 })),
      probe(() => jsonResponse(denied, { status: 401 })),
    ]);

    const { result } = renderHookWithProviders(useScreen, { fetch });

    await waitFor(() => {
      expect(result.current.items.isError).toBe(true);
      expect(result.current.text).toBeNull();
    });
  });

  /* 토큰은 사는데 이 조회만 막혔다. 새 QR 을 받아도 풀리지 않는다. */
  it('거절됐지만 토큰이 살아 있으면 이 조회가 막혔다고 말한다', async () => {
    const fetch = createStubFetch([
      items(() => jsonResponse(loginRequired, { status: 401 })),
      probe(() => jsonResponse({ items: [], page })),
    ]);

    const { result } = renderHookWithProviders(useScreen, { fetch });

    await waitFor(() => {
      expect(result.current.text).toBe(messages.httpError.deviceNotAllowed);
    });
  });

  /* 토큰은 사는데 단말 유형이 다르다. 서버가 어느 단말·화면에서 할지를 실어 보낸다(#202). */
  it('거절됐고 토큰이 살아 있으면 서버가 실은 까닭을 그대로 보인다', async () => {
    const fetch = createStubFetch([
      items(() => jsonResponse(wrongType, { status: 401 })),
      probe(() => jsonResponse({ items: [], page })),
    ]);

    const { result } = renderHookWithProviders(useScreen, { fetch });

    await waitFor(() => {
      expect(result.current.text).toBe(WRONG_TYPE);
    });
  });

  it('토큰을 확인하지 못하면 어느 쪽인지 단정하지 않는다', async () => {
    await forgetPlant();
    const fetch = createStubFetch([items(() => jsonResponse(denied, { status: 401 }))]);

    const { result } = renderHookWithProviders(useScreen, { fetch });

    await waitFor(() => {
      expect(result.current.text).toBe(messages.httpError.deviceRejected);
    });
  });

  /*
   * 실기(#1198) - 토큰 확인이 답하기 전 잠깐 조회마다 「받아들여지지 않았습니다」가 두 줄 떴다가
   * 만료 한 줄로 바뀌었다. 판정이 나기 전에는 아무것도 달지 않는다.
   */
  it('토큰 확인이 답하기 전에는 거절 문구를 달지 않는다', async () => {
    let answer: ((response: Response) => void) | null = null;
    const fetch = createStubFetch([
      items(() => jsonResponse(loginRequired, { status: 401 })),
      probe(
        () =>
          new Promise<Response>((resolve) => {
            answer = resolve;
          }),
      ),
    ]);

    const { result } = renderHookWithProviders(useScreen, { fetch });

    await waitFor(() => {
      expect(answer).not.toBeNull();
    });
    expect(result.current.items.isError).toBe(true);
    expect(result.current.text).toBeNull();

    answer!(jsonResponse({ items: [], page }));

    await waitFor(() => {
      expect(result.current.text).toBe(messages.httpError.deviceNotAllowed);
    });
  });

  /*
   * 기다림은 확인을 보낸 때부터 센다. 화면이 선 때부터 세면, 연 지 오래 뒤에 거절된 조회는
   * 기다리지 않고 단정하지 않는 문구를 먼저 달았다가 바꾼다(#1198 리뷰).
   */
  it('화면이 선 지 오래 뒤에 거절돼도 토큰 확인이 답하기 전에는 문구를 달지 않는다', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    try {
      let refuse = false;
      let asked = false;
      const fetch = createStubFetch([
        items(() =>
          refuse ? jsonResponse(denied, { status: 401 }) : jsonResponse({ items: [], page }),
        ),
        probe(() => {
          asked = true;
          return new Promise<Response>(() => undefined);
        }),
      ]);

      const { result } = renderHookWithProviders(useScreen, { fetch });

      await waitFor(() => {
        expect(result.current.items.isSuccess).toBe(true);
      });
      await vi.advanceTimersByTimeAsync(TOKEN_CHECK_PATIENCE_MS + 1_000);

      refuse = true;
      await result.current.items.refetch();

      await waitFor(() => {
        expect(asked).toBe(true);
        expect(result.current.items.isError).toBe(true);
      });
      expect(result.current.text).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  /* 오래전에 받은 「산다」로 지금의 거절을 판정하지 않는다. 다시 묻는 동안은 기다린다. */
  it('앞서 받은 판정이 낡았으면 다시 묻는 동안 문구를 달지 않는다', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    try {
      let refuse = false;
      let probes = 0;
      const fetch = createStubFetch([
        items(() =>
          refuse ? jsonResponse(denied, { status: 401 }) : jsonResponse({ items: [], page }),
        ),
        /* 앞 판정은 캐시에 직접 넣는다. 다시 묻는 확인은 답하지 않게 붙잡는다. */
        probe(() => {
          probes += 1;
          return new Promise<Response>(() => undefined);
        }),
      ]);

      const { result } = renderHookWithProviders(
        () => {
          const screen = useScreen();
          const queryClient = useQueryClient();
          return { screen, queryClient };
        },
        { fetch },
      );

      await waitFor(() => {
        expect(result.current.screen.items.isSuccess).toBe(true);
      });
      await result.current.queryClient.fetchQuery({
        queryKey: ['device-token-state'],
        queryFn: () => Promise.resolve('alive'),
      });
      await vi.advanceTimersByTimeAsync(31_000);

      refuse = true;
      await result.current.screen.items.refetch();

      await waitFor(() => {
        expect(result.current.screen.items.isError).toBe(true);
        expect(probes).toBe(1);
      });
      expect(result.current.screen.text).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  /* 확인까지 막혀 답이 오지 않으면 끝내 아무 말도 없게 된다. 기다림에 끝을 둔다. */
  it('토큰 확인이 오래 답하지 않으면 단정하지 않는 문구로 넘어간다', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    try {
      let asked = false;
      const fetch = createStubFetch([
        items(() => jsonResponse(denied, { status: 401 })),
        probe(() => {
          asked = true;
          return new Promise<Response>(() => undefined);
        }),
      ]);

      const { result } = renderHookWithProviders(useScreen, { fetch });

      await waitFor(() => {
        expect(asked).toBe(true);
      });
      expect(result.current.text).toBeNull();

      await vi.advanceTimersByTimeAsync(TOKEN_CHECK_PATIENCE_MS);

      await waitFor(() => {
        expect(result.current.text).toBe(messages.httpError.deviceRejected);
      });
    } finally {
      vi.useRealTimers();
    }
  });

  /* 연결 문구에 함께 적혀 있던 주의는 까닭이 달라도 남아야 한다. */
  it('연결이 아닌 실패에는 주의를 뒤에 붙인다', async () => {
    const fetch = createStubFetch([items(() => jsonResponse({}, { status: 500 }))]);

    const { result } = renderHookWithProviders(
      () => {
        const screen = useScreen();
        const describe = useLoadFailure();
        return screen.items.isError
          ? describe(screen.items.error, OFFLINE, { caution: '확인한 뒤에 옮기세요.' })
          : null;
      },
      { fetch },
    );

    await waitFor(() => {
      expect(result.current).toBe(`${messages.httpError.loadServer} 확인한 뒤에 옮기세요.`);
    });
  });

  it('여러 조회가 한꺼번에 거절돼도 토큰 확인은 한 번만 나간다', async () => {
    let probes = 0;
    const fetch = createStubFetch([
      items(() => jsonResponse(denied, { status: 401 })),
      probe(() => {
        probes += 1;
        return jsonResponse(denied, { status: 401 });
      }),
    ]);

    const { result } = renderHookWithProviders(
      () => ({ first: useScreen(), second: useScreen() }),
      {
        fetch,
      },
    );

    await waitFor(() => {
      expect(result.current.first.items.isError).toBe(true);
      expect(result.current.first.text).toBeNull();
    });
    expect(probes).toBe(1);
  });
});

/** 화면의 바로 저장 하나와 거절 문구 고르기를 함께 돌린다. */
const useSave = () => {
  const { client } = useApiClient();
  const save = useMutation({
    mutationFn: () => runRequest(() => client.GET('/mdm/items', {})),
  });
  const refusal = useSaveRefusal();

  return { save, text: save.isError ? refusal(save.error) : null };
};

describe('바로 저장 거절 문구(#202)', () => {
  beforeEach(async () => {
    store.clear();
    await rememberPlant(7);
  });

  it('토큰이 살아 있는데 거절되면 서버가 실은 까닭을 보인다', async () => {
    const fetch = createStubFetch([
      items(() => jsonResponse(wrongType, { status: 401 })),
      probe(() => jsonResponse({ items: [], page })),
    ]);
    const { result } = renderHookWithProviders(useSave, { fetch });

    act(() => {
      result.current.save.mutate();
    });

    await waitFor(() => {
      expect(result.current.text).toBe(WRONG_TYPE);
    });
  });

  it('단말에 열지 않은 경로의 로그인 문구는 그대로 보이지 않는다', async () => {
    const fetch = createStubFetch([
      items(() => jsonResponse(loginRequired, { status: 401 })),
      probe(() => jsonResponse({ items: [], page })),
    ]);
    const { result } = renderHookWithProviders(useSave, { fetch });

    act(() => {
      result.current.save.mutate();
    });

    await waitFor(() => {
      expect(result.current.text).toBe(messages.httpError.deviceNotAllowed);
    });
  });

  it('토큰이 죽었거나 401 이 아니면 화면의 지금 문구를 쓴다(null)', async () => {
    const dead = createStubFetch([
      items(() => jsonResponse(loginRequired, { status: 401 })),
      probe(() => jsonResponse(loginRequired, { status: 401 })),
    ]);
    const first = renderHookWithProviders(useSave, { fetch: dead });
    act(() => {
      first.result.current.save.mutate();
    });
    await waitFor(() => {
      expect(first.result.current.save.isError).toBe(true);
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(first.result.current.text).toBeNull();

    const server = createStubFetch([items(() => jsonResponse({}, { status: 500 }))]);
    const second = renderHookWithProviders(useSave, { fetch: server });
    act(() => {
      second.result.current.save.mutate();
    });
    await waitFor(() => {
      expect(second.result.current.save.isError).toBe(true);
    });
    expect(second.result.current.text).toBeNull();
  });
});
