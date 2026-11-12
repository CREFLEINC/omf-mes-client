import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { layoutKeys, useDrawingContent, useLocationStock } from './queries';

/**
 * 도면 그림 받기 — **그림은 `<img src>` 가 아니라 계약 클라이언트로 온다.**
 *
 * 세션 쿠키가 필요한 자원이라 주소만 걸어 두면 교차 출처에서 조용히 빈다. 여기서는 그 길이
 * 실제로 blob 을 돌려주는지, 그리고 **다시 받지 않아야 할 때 받지 않는지**를 본다.
 */

const CONTENT_PATH = `/app/attachments/${String(5001)}/content`;
const PNG_BYTES = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

const contentRoute = (calls: Request[]): StubRoute => ({
  match: (request) => new URL(request.url).pathname === CONTENT_PATH,
  respond: (request) => {
    calls.push(request);

    return new Response(PNG_BYTES, { status: 200, headers: { 'Content-Type': 'image/png' } });
  },
});

describe('useDrawingContent', () => {
  it('첨부 내용을 blob 으로 돌려준다', async () => {
    const calls: Request[] = [];
    const { result } = renderHookWithProviders(() => useDrawingContent(5001), {
      fetch: createStubFetch([contentRoute(calls)]),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const blob = result.current.data;

    expect(blob).toBeInstanceOf(Blob);
    expect(new Uint8Array(await (blob as Blob).arrayBuffer())).toEqual(PNG_BYTES);
    expect(calls).toHaveLength(1);
  });

  it('⛔ 도면이 없으면 부르지 않는다 — 첨부 0번은 없는 자원이다', async () => {
    const calls: Request[] = [];
    const { result } = renderHookWithProviders(() => useDrawingContent(null), {
      fetch: createStubFetch([contentRoute(calls)]),
    });

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('idle');
    });

    expect(result.current.isPending).toBe(true);
    expect(calls).toHaveLength(0);
  });

  /*
   * ⭐ 교체 흐름이 방금 올린 파일을 이 자리에 심는다. 첨부 내용은 불변이라 다시 받을 이유가
   * 없고, 도면은 수 MB 다 — 심어 둔 것이 그대로 나와야 그 최적화가 성립한다.
   */
  it('⭐ 심어 둔 파일이 그대로 나온다 — 방금 올린 그림을 다시 받지 않는다', async () => {
    const calls: Request[] = [];
    const file = new File([PNG_BYTES], 'layout.png', { type: 'image/png' });
    let attachmentId: number | null = null;

    const { result, rerender, queryClient } = renderHookWithProviders(
      () => useDrawingContent(attachmentId),
      { fetch: createStubFetch([contentRoute(calls)]) },
    );

    queryClient.setQueryData(layoutKeys.drawing(5001), file);
    attachmentId = 5001;
    rerender();

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBe(file);
    expect(calls).toHaveLength(0);
  });
});

/*
 * 창고 재고 — 조회 화면의 재고 모양 · 재고 표(피처 006 FR-011 · FR-013 · R-7). 창고 단위로 한 번, 위치별로 끝까지 받는다.
 */
describe('useLocationStock', () => {
  const BALANCES_PATH = '/inventory/balances';

  const balanceRow = (locationId: number) => ({
    groupBy: 'LOCATION',
    locationId,
    itemId: 1,
    ownershipTypeCode: 'OWNED',
    onHandQty: 1,
    reservedQty: 0,
    pickedQty: 0,
    blockedQty: 0,
    availableQty: 1,
    uomId: 7,
  });

  it('US2-4 ⭐ 창고 · 위치 묶음 · 200줄 쪽으로 끝 쪽까지 받는다 — 0 재고 줄은 달라고 하지 않는다', async () => {
    const calls: URL[] = [];
    const { result } = renderHookWithProviders(() => useLocationStock(12), {
      fetch: createStubFetch([
        {
          match: (request) => new URL(request.url).pathname === BALANCES_PATH,
          respond: (request) => {
            const url = new URL(request.url);
            const page = Number(url.searchParams.get('page'));

            calls.push(url);

            return jsonResponse({
              items: page === 1 ? [balanceRow(4), balanceRow(5)] : [balanceRow(6)],
              page: { page, size: 200, total: 3 },
            });
          },
        },
      ]),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.items.map((row) => row.locationId)).toEqual([4, 5, 6]);
    expect(result.current.data?.truncated).toBe(false);
    expect(calls.map((url) => url.searchParams.get('page'))).toEqual(['1', '2']);
    for (const url of calls) {
      expect(url.searchParams.get('warehouseId')).toBe('12');
      expect(url.searchParams.get('groupBy')).toBe('LOCATION');
      expect(url.searchParams.get('size')).toBe('200');
      expect(url.searchParams.has('includeZero')).toBe(false);
    }
  });

  it('⛔ 창고를 고르기 전에는 부르지 않는다', async () => {
    const { result } = renderHookWithProviders(() => useLocationStock(null), {
      fetch: createStubFetch([]),
    });

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('idle');
    });
    expect(result.current.isPending).toBe(true);
  });
});
