import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createStubFetch, jsonResponse, renderHookWithProviders } from '../../test/api-harness';
import { usePickingOrders } from './queries';

/**
 * 피처 003(tasks T060) — 대기(WAITING) 출고 요청은 피킹 지시가 없다. 피킹 목록은 피킹 지시만 읽으므로
 * 대기 요청은 보이지 않고, 출고 작업일 00:00(또는 바로) 배포로 지시가 생기면 보인다. 코드 변경 없음을 잰다.
 */

const order = (pickingOrderId: number) => ({
  pickingOrderId,
  pickingOrderNo: `SYN-PK-${String(pickingOrderId)}`,
  pickingTypeCode: 'MATERIAL',
  sourceDocumentTypeCode: 'MATERIAL_ISSUE_REQUEST',
  sourceDocumentId: 3,
  warehouseId: 11,
  statusCode: 'REGISTERED',
});

describe('자재 피킹 목록 — 출고 요청 대기 · 배포', () => {
  it('US5-5 대기 요청은 목록에 없고(피킹 지시 없음), 배포로 지시가 생기면 다시 받을 때 보인다', async () => {
    let released = false;
    const paths: string[] = [];
    const fetch = createStubFetch([
      {
        match: (request) => new URL(request.url).pathname === '/logistics/picking-orders',
        respond: (request) => {
          paths.push(new URL(request.url).pathname);
          const items = released ? [order(7)] : [];
          return jsonResponse({ items, page: { page: 1, size: 100, total: items.length } });
        },
      },
    ]);

    const { result } = renderHookWithProviders(() => usePickingOrders(), { fetch });

    await waitFor(() => expect(result.current.data).toEqual([]));

    released = true;
    await result.current.refetch();

    await waitFor(() =>
      expect(result.current.data?.map((each) => each.pickingOrderId)).toEqual([7]),
    );
    /* 출고 요청 목록(대기 포함)을 읽지 않는다 — 대기 요청이 현장에 새지 않는 근거. */
    expect(paths.every((path) => path === '/logistics/picking-orders')).toBe(true);
  });
});
