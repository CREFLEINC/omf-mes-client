import { messages } from '@omf-mes/i18n';
import { useQuery } from '@tanstack/react-query';
import { waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubRoute,
} from '../test/api-harness';
import { useApiClient } from './api-context';
import { useLoadFailure } from './load-failure';
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

  /* 재발급·단말 정보 변경으로 토큰이 죽으면 모든 조회가 401 이다. 새 QR 이 필요하다. */
  it('거절됐고 토큰도 죽었으면 등록 만료를 말한다', async () => {
    const fetch = createStubFetch([
      items(() => jsonResponse(denied, { status: 401 })),
      probe(() => jsonResponse(denied, { status: 401 })),
    ]);

    const { result } = renderHookWithProviders(useScreen, { fetch });

    await waitFor(() => {
      expect(result.current.text).toBe(messages.httpError.deviceExpired);
    });
  });

  /* 토큰은 사는데 이 조회만 막혔다. 새 QR 을 받아도 풀리지 않는다. */
  it('거절됐지만 토큰이 살아 있으면 이 조회가 막혔다고 말한다', async () => {
    const fetch = createStubFetch([
      items(() => jsonResponse(denied, { status: 401 })),
      probe(() => jsonResponse({ items: [], page })),
    ]);

    const { result } = renderHookWithProviders(useScreen, { fetch });

    await waitFor(() => {
      expect(result.current.text).toBe(messages.httpError.deviceNotAllowed);
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
      expect(result.current.first.text).toBe(messages.httpError.deviceExpired);
    });
    expect(probes).toBe(1);
  });
});
