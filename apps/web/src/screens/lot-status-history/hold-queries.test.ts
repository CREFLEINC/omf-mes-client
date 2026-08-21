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
import { useLotHoldEvents, useLotHolds } from './queries';

const HOLDS_PATH = '/quality/lot-holds';
const EVENTS_PATH = '/quality/lot-hold-events';

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
    const { result } = renderHookWithProviders(() => useLotHolds(404), {
      fetch: async (request) => {
        urls.push(new URL(request.url));
        return stub(request);
      },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(urls[0]?.searchParams.get('lotId')).toBe('404');
    expect(urls[0]?.searchParams.get('open')).toBe('false');
    expect(result.current.data?.rows.map((row) => row.holdStatusCode)).toEqual([
      'SAMPLE_OPEN',
      'SAMPLE_RELEASED',
    ]);
    expect(result.current.data?.page).toEqual(page);
  });
});

describe('보류 등록·해제 사건 hook', () => {
  it('기간이 없으면 요청하지 않는다', async () => {
    const urls: URL[] = [];
    const { result } = renderHookWithProviders(
      () => useLotHoldEvents(EMPTY_HISTORY_FILTERS, 1, 540),
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

  it('사건 경로에 기간·행위자·LOT 번호를 보내고 actorName을 응답에서 쓴다', async () => {
    const urls: URL[] = [];
    const event: components['schemas']['LotHoldEvent'] = {
      lotHoldId: 701,
      eventTypeCode: 'HELD',
      occurredAt: '2026-08-02T11:00:00+09:00',
      lotId: 404,
      lotNo: 'SAMPLE-LOT-001',
      actorId: 505,
      actorName: '합성 담당자',
    };
    const stub = createStubFetch([route(EVENTS_PATH, { items: [event], page })]);
    const { result } = renderHookWithProviders(
      () =>
        useLotHoldEvents(
          {
            from: '2026-08-01',
            to: '2026-08-07',
            actor: '505',
            lot: 'SAMPLE-LOT-001',
          },
          2,
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
    expect(urls).toHaveLength(1);
    expect(urls[0]?.pathname).toBe(EVENTS_PATH);
    expect(Object.fromEntries(urls[0]?.searchParams ?? [])).toEqual({
      occurredFrom: '2026-08-01T00:00:00+09:00',
      occurredTo: '2026-08-07T23:59:59+09:00',
      actorId: '505',
      lotNo: 'SAMPLE-LOT-001',
      sort: 'occurredDesc',
      page: '2',
    });
    expect(result.current.data?.rows[0]?.actorName).toBe('합성 담당자');
    expect(result.current.data?.page).toEqual(page);
  });
});
