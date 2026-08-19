import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import { notificationEventListBody } from './fixtures';
import { describeEvent, useNotificationEventOptions, withCurrentEvent } from './lookups';

const EVENTS_PATH = '/app/notification-events';

const ENTRIES = [
  { value: 'SYN-EVENT-01', label: '합성 이벤트 가' },
  { value: 'SYN-EVENT-02', label: '합성 이벤트 나' },
];

const eventsRoute = (respond: () => Response): StubRoute => ({
  match: (request) => new URL(request.url).pathname === EVENTS_PATH,
  respond,
});

const recordingFetch = (routes: StubRoute[]): { fetch: StubFetch; urls: URL[] } => {
  const urls: URL[] = [];
  const stub = createStubFetch(routes);

  return {
    urls,
    fetch: async (request) => {
      urls.push(new URL(request.url));

      return stub(request);
    },
  };
};

describe('describeEvent', () => {
  it('목록에 있는 코드는 이름으로 푼다', () => {
    expect(describeEvent('SYN-EVENT-01', ENTRIES)).toBe('합성 이벤트 가');
  });

  /**
   * ⭐ **풀 수 없으면 원본 코드다 — 「알 수 없음」이 아니다.**
   *
   * 형제 화면들의 참조 풀이는 미도착·실패·목록에 없음을 갈라 서로 다른 문구를 내는데, 그것이
   * 참인 이유는 **그쪽의 낙하 값이 판단이기 때문**이다. 여기서는 낙하 값이 사실(코드 자체)이라
   * 어느 갈래에서도 틀리지 않고, 사용자는 그 코드를 그대로 담당자에게 전할 수 있다.
   */
  it('목록에 없는 코드는 원문을 그대로 돌려준다', () => {
    expect(describeEvent('SYN-EVENT-99', ENTRIES)).toBe('SYN-EVENT-99');
  });

  it('목록이 비어 있어도 원문으로 낙하한다 — 미도착·실패가 같은 결과로 수렴한다', () => {
    expect(describeEvent('SYN-EVENT-01', [])).toBe('SYN-EVENT-01');
  });

  it('이름이 비었거나 공백뿐이면 코드로 낙하한다 — 빈 제목을 그리지 않는다', () => {
    expect(describeEvent('SYN-EVENT-04', [{ value: 'SYN-EVENT-04', label: '   ' }])).toBe(
      'SYN-EVENT-04',
    );
    expect(describeEvent('SYN-EVENT-05', [{ value: 'SYN-EVENT-05', label: '' }])).toBe(
      'SYN-EVENT-05',
    );
  });
});

describe('withCurrentEvent', () => {
  it('고른 값이 목록에 있으면 그대로 둔다', () => {
    expect(withCurrentEvent(ENTRIES, 'SYN-EVENT-01')).toEqual(ENTRIES);
  });

  it('「전체」면 아무것도 더하지 않는다', () => {
    expect(withCurrentEvent(ENTRIES, '')).toEqual(ENTRIES);
  });

  /** 남기지 않으면 주소로 들어온 조건을 **푸는 수단이 사라진다.** */
  it('고른 값이 목록에 없으면 맨 앞에 남긴다', () => {
    expect(withCurrentEvent(ENTRIES, 'SYN-EVENT-99')[0]).toEqual({
      value: 'SYN-EVENT-99',
      label: 'SYN-EVENT-99',
    });
  });

  it('목록이 비어 있어도 고른 값은 남는다 — 조회 실패 중에도 조건을 풀 수 있다', () => {
    expect(withCurrentEvent([], 'SYN-EVENT-99')).toHaveLength(1);
  });

  it('받은 목록을 바꾸지 않는다', () => {
    const entries = [...ENTRIES];
    withCurrentEvent(entries, 'SYN-EVENT-99');

    expect(entries).toHaveLength(2);
  });
});

describe('useNotificationEventOptions', () => {
  it('계약 경로를 좁힘 인자 없이 부른다', async () => {
    const { fetch, urls } = recordingFetch([
      eventsRoute(() => jsonResponse(notificationEventListBody())),
    ]);
    const { result } = renderHookWithProviders(() => useNotificationEventOptions(), { fetch });

    await waitFor(() => {
      expect(result.current.entries.length).toBeGreaterThan(0);
    });

    /* 좁혀 부르면 좁힘 밖 코드가 이름을 잃는다 — 이 경로에는 좁힘 인자가 아예 없다. */
    expect(urls).toHaveLength(1);
    expect(urls[0]?.pathname).toBe(EVENTS_PATH);
    expect(urls[0]?.search).toBe('');
  });

  it('코드와 이름을 선택지로 옮긴다 — 화면이 코드 목록을 지어내지 않는다', async () => {
    const { fetch } = recordingFetch([
      eventsRoute(() => jsonResponse(notificationEventListBody())),
    ]);
    const { result } = renderHookWithProviders(() => useNotificationEventOptions(), { fetch });

    await waitFor(() => {
      expect(result.current.entries).toHaveLength(3);
    });

    expect(result.current.entries[0]).toEqual({
      value: 'SYN-EVENT-01',
      label: '합성 이벤트 가',
    });
  });

  it('조회에 실패하면 그 사실을 들고 목록은 비운다', async () => {
    const { fetch } = recordingFetch([
      eventsRoute(() => jsonResponse({ message: '' }, { status: 500 })),
    ]);
    const { result } = renderHookWithProviders(() => useNotificationEventOptions(), { fetch });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.entries).toHaveLength(0);
  });

  /**
   * ⭐ **결과가 두 칸뿐이다.** 형제 사본들의 `isLoading`·`refetch`·`truncated`를 가져오지
   * 않았다 — 이 화면이 소비하지 않는 값이라, 두면 아무도 부르지 않는 복구 경로를 약속하는
   * 주석만 남는다. 늘어나면 그 시점의 소비처와 함께 늘린다.
   */
  it('화면이 쓰지 않는 칸을 들지 않는다', async () => {
    const { fetch } = recordingFetch([
      eventsRoute(() => jsonResponse(notificationEventListBody())),
    ]);
    const { result } = renderHookWithProviders(() => useNotificationEventOptions(), { fetch });

    await waitFor(() => {
      expect(result.current.entries.length).toBeGreaterThan(0);
    });

    expect(Object.keys(result.current).sort()).toEqual(['entries', 'isError']);
  });
});
