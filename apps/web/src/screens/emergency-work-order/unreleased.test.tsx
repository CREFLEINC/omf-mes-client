import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { jsonResponse, renderHookWithProviders, type StubFetch } from '../../test/api-harness';
import { UNRELEASED_SIZE, useUnreleasedEmergencyWorkOrders } from './unreleased';
import { EMERGENCY_WORK_ORDER_TYPE_CODE } from './work-order-type';

const WORK_ORDER = {
  workOrderId: 7001,
  workOrderNo: 'SYN-WO-0007',
  productionPlanId: 3001,
  routingOperationId: 901,
  itemId: 5001,
  orderQty: 200,
  uomId: 11,
  workOrderTypeCode: EMERGENCY_WORK_ORDER_TYPE_CODE,
  statusCode: 'SYN_CONFIRMED',
  priorityNo: 1,
};

const collecting = (): { urls: string[]; fetch: StubFetch } => {
  const urls: string[] = [];

  const fetch: StubFetch = async (request) => {
    const url = new URL(request.url);
    urls.push(`${url.pathname}?${url.searchParams.toString()}`);

    return jsonResponse({ items: [WORK_ORDER], page: { page: 1, size: 20, total: 1 } });
  };

  return { urls, fetch };
};

const renderQuery = (fetch: StubFetch) =>
  renderHookWithProviders(() => useUnreleasedEmergencyWorkOrders(), { fetch });

/** 조건을 하나씩 꺼내 본다 — 셋 중 하나라도 빠지면 목록의 뜻이 달라진다. */
const paramsOf = (url: string): URLSearchParams => new URLSearchParams(url.split('?')[1] ?? '');

describe('useUnreleasedEmergencyWorkOrders', () => {
  it('들어오면 한 번 부른다', async () => {
    const { urls, fetch } = collecting();
    renderQuery(fetch);

    await waitFor(() => {
      expect(urls).toHaveLength(1);
    });
    expect(urls[0]).toContain('/production/work-orders');
  });

  /*
   * ⛔ **긴급으로 좁히지 않으면 남의 지시가 딸려 온다.** 화면은 돌아온 것마다 [배포 재시도]를
   * 내주므로, 조건이 새면 **이 화면이 양산 지시를 배포**하게 된다.
   */
  it('⛔ 긴급 유형으로 좁혀 묻는다 — 새면 양산 지시까지 딸려 온다', async () => {
    const { urls, fetch } = collecting();
    renderQuery(fetch);

    await waitFor(() => {
      expect(urls).toHaveLength(1);
    });
    expect(paramsOf(urls[0] ?? '').get('workOrderTypeCode')).toBe(EMERGENCY_WORK_ORDER_TYPE_CODE);
  });

  /*
   * ⛔ **배포 여부를 서버에 물어야 한다.** 받아서 화면이 거르면 **페이지 안에서만** 걸러진다 —
   * 첫 20건이 전부 배포된 것이면 화면은 「밀린 것 없음」이라 말하는데 21번째가 밀려 있을 수 있다.
   */
  it('⛔ 「배포되지 않은 것」을 서버에 조건으로 실어 묻는다', async () => {
    const { urls, fetch } = collecting();
    renderQuery(fetch);

    await waitFor(() => {
      expect(urls).toHaveLength(1);
    });
    expect(paramsOf(urls[0] ?? '').get('released')).toBe('false');
  });

  it('한 번에 받아 둘 건수를 정해 묻는다', async () => {
    const { urls, fetch } = collecting();
    renderQuery(fetch);

    await waitFor(() => {
      expect(urls).toHaveLength(1);
    });
    expect(paramsOf(urls[0] ?? '').get('size')).toBe(String(UNRELEASED_SIZE));
  });

  it('받은 목록을 그대로 돌려준다', async () => {
    const { fetch } = collecting();
    const { result } = renderQuery(fetch);

    await waitFor(() => {
      expect(result.current.data?.items).toHaveLength(1);
    });
    expect(result.current.data?.items[0]?.workOrderNo).toBe('SYN-WO-0007');
  });

  it('받지 못하면 그 사실이 남는다 — 빈 목록으로 뭉개지 않는다', async () => {
    const failing: StubFetch = async () => jsonResponse({ message: '실패' }, { status: 500 });
    const { result } = renderQuery(failing);

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.data).toBeUndefined();
  });
});
