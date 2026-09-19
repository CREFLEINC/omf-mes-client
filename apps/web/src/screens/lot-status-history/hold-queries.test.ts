import type { components } from '@omf-mes/api-client';
import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { EMPTY_HISTORY_FILTERS } from './filters';
import { useLotHistoryTimeline, useLotHolds, useLotTimeline } from './queries';

const HOLDS_PATH = '/quality/lot-holds';
const EVENTS_PATH = '/quality/lot-hold-events';
const STATUS_EVENTS_PATH = '/trace/lot-status-events';

const route = (path: string, body: unknown): StubRoute => ({
  match: (request) => request.method === 'GET' && new URL(request.url).pathname === path,
  respond: () => jsonResponse(body),
});

const hold = (lotHoldId: number, statusCode: string): components['schemas']['LotHold'] => ({
  lotHoldId,
  lotId: 404,
  lotNo: 'SAMPLE-LOT-001',
  reasonCode: 'SAMPLE_REASON',
  statusCode,
  heldAt: '2026-08-01T09:00:00+09:00',
  ...(statusCode === 'SAMPLE_RELEASED' ? { releasedAt: '2026-08-03T10:00:00+09:00' } : {}),
});

const page = { page: 1, size: 50, total: 2 };

describe('선택 LOT 보류 문서 hook', () => {
  it('LOT을 선택하지 않으면 요청하지 않는다', async () => {
    const urls: URL[] = [];
    const { result } = renderHookWithProviders(() => useLotHolds(null), {
      fetch: async (request) => {
        urls.push(new URL(request.url));
        return jsonResponse({});
      },
    });

    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
    expect(urls).toHaveLength(0);
  });

  it('open=false로 열린 건과 해제 건을 함께 받고 후처리로 거르지 않는다', async () => {
    const urls: URL[] = [];
    const stub = createStubFetch([
      route(HOLDS_PATH, {
        items: [hold(701, 'SAMPLE_OPEN'), hold(702, 'SAMPLE_RELEASED')],
        page,
      }),
    ]);
    const { result } = renderHookWithProviders(() => useLotHolds(404, 2), {
      fetch: async (request) => {
        urls.push(new URL(request.url));
        return stub(request);
      },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(urls[0]?.searchParams.get('lotId')).toBe('404');
    expect(urls[0]?.searchParams.get('open')).toBe('false');
    expect(urls[0]?.searchParams.get('page')).toBe('2');
    expect(result.current.data?.rows.map((row) => row.holdStatusCode)).toEqual([
      'SAMPLE_OPEN',
      'SAMPLE_RELEASED',
    ]);
    expect(result.current.data?.page).toEqual(page);
  });
});

const holdEvent = (
  overrides: Partial<components['schemas']['LotHoldEvent']> = {},
): components['schemas']['LotHoldEvent'] => ({
  lotHoldId: 701,
  eventTypeCode: 'HELD',
  occurredAt: '2026-08-02T11:00:00+09:00',
  lotId: 404,
  lotNo: 'SAMPLE-LOT-001',
  actorId: 505,
  actorName: '합성 담당자',
  ...overrides,
});

const statusEvent = (
  overrides: Partial<components['schemas']['LotStatusHistoryEvent']> = {},
): components['schemas']['LotStatusHistoryEvent'] => ({
  lotStatusHistoryId: 901,
  lotId: 404,
  lotNo: 'SAMPLE-LOT-001',
  fromStatusCode: 'SAMPLE_PENDING',
  toStatusCode: 'SAMPLE_NORMAL',
  transitionCode: 'C4',
  changedBy: 505,
  changedAt: '2026-08-02T12:00:00+09:00',
  ...overrides,
});

describe('LOT 이력 hook — 보류 사건과 상태 변경을 합친다', () => {
  it('기간이 없으면 요청하지 않는다', async () => {
    const urls: URL[] = [];
    const { result } = renderHookWithProviders(
      () => useLotHistoryTimeline(EMPTY_HISTORY_FILTERS, 540),
      {
        fetch: async (request) => {
          urls.push(new URL(request.url));
          return jsonResponse({});
        },
      },
    );

    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
    expect(urls).toHaveLength(0);
  });

  it('보류 사건은 서버가 거르고 상태 변경은 같은 행위자·LOT 번호로 화면이 걸러 시간순으로 합친다', async () => {
    const urls: URL[] = [];
    const stub = createStubFetch([
      route(EVENTS_PATH, {
        items: [
          holdEvent({ eventTypeCode: 'RELEASED', occurredAt: '2026-08-02T11:30:00+09:00' }),
          holdEvent(),
        ],
        page: { page: 1, size: 200, total: 2 },
      }),
      route(STATUS_EVENTS_PATH, {
        items: [
          statusEvent(),
          statusEvent({ lotStatusHistoryId: 902, lotNo: 'SAMPLE-LOT-OTHER' }),
          statusEvent({ lotStatusHistoryId: 903, changedBy: 999 }),
        ],
      }),
    ]);
    const { result } = renderHookWithProviders(
      () =>
        useLotHistoryTimeline(
          { from: '2026-08-01', to: '2026-08-07', actor: '505', lot: 'SAMPLE-LOT-001' },
          540,
        ),
      {
        fetch: async (request) => {
          urls.push(new URL(request.url));
          return stub(request);
        },
      },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const holdUrl = urls.find(({ pathname }) => pathname === EVENTS_PATH);
    const statusUrl = urls.find(({ pathname }) => pathname === STATUS_EVENTS_PATH);
    expect(Object.fromEntries(holdUrl?.searchParams ?? [])).toEqual({
      occurredFrom: '2026-08-01T00:00:00+09:00',
      occurredTo: '2026-08-08T00:00:00+09:00',
      actorId: '505',
      lotNo: 'SAMPLE-LOT-001',
      sort: 'occurredDesc',
      page: '1',
      size: '200',
    });
    // 상태 변경이력은 행위자·LOT 번호 질의가 없다 — 기간만 보낸다.
    expect(Object.fromEntries(statusUrl?.searchParams ?? [])).toEqual({
      occurredFrom: '2026-08-01T00:00:00+09:00',
      occurredTo: '2026-08-08T00:00:00+09:00',
    });
    expect(result.current.data?.entries.map((entry) => entry.key)).toEqual([
      'status:901',
      'hold:701:RELEASED:2026-08-02T11:30:00+09:00',
      'hold:701:HELD:2026-08-02T11:00:00+09:00',
    ]);
    expect(result.current.data?.isTruncated).toBe(false);
  });

  it('보류 사건이 한 쪽을 넘으면 끝까지 넘겨 읽는다', async () => {
    const urls: URL[] = [];
    const { result } = renderHookWithProviders(
      () =>
        useLotHistoryTimeline(
          { ...EMPTY_HISTORY_FILTERS, from: '2026-08-01', to: '2026-08-07' },
          540,
        ),
      {
        fetch: async (request) => {
          const url = new URL(request.url);
          urls.push(url);
          if (url.pathname === STATUS_EVENTS_PATH) return jsonResponse({ items: [] });
          const pageNo = Number(url.searchParams.get('page'));
          return jsonResponse({
            items: [holdEvent({ lotHoldId: 700 + pageNo })],
            page: { page: pageNo, size: 1, total: 2 },
          });
        },
      },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(
      urls
        .filter(({ pathname }) => pathname === EVENTS_PATH)
        .map((url) => url.searchParams.get('page')),
    ).toEqual(['1', '2']);
    expect(result.current.data?.entries).toHaveLength(2);
  });

  it('LOT 상세는 그 LOT 의 두 이력을 LOT id 로 부른다', async () => {
    const urls: URL[] = [];
    const stub = createStubFetch([
      route(EVENTS_PATH, { items: [holdEvent()], page: { page: 1, size: 200, total: 1 } }),
      route(STATUS_EVENTS_PATH, { items: [statusEvent()] }),
    ]);
    const { result } = renderHookWithProviders(() => useLotTimeline(404), {
      fetch: async (request) => {
        urls.push(new URL(request.url));
        return stub(request);
      },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    for (const path of [EVENTS_PATH, STATUS_EVENTS_PATH]) {
      const url = urls.find(({ pathname }) => pathname === path);
      expect(url?.searchParams.get('lotId')).toBe('404');
      expect(url?.searchParams.get('occurredFrom')).toBe('2000-01-01T00:00:00Z');
      expect(url?.searchParams.get('occurredTo')).not.toBeNull();
    }
    expect(result.current.data?.entries.map((entry) => entry.kind)).toEqual(['status', 'hold']);
  });
});
