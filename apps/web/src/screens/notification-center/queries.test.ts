import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import { notificationListBody } from './fixtures';
import { notificationKeys, useNotificationList, type NotificationListQuery } from './queries';

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
