import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { jsonResponse, renderHookWithProviders, type StubFetch } from '../../test/api-harness';
import {
  LOOKUP_SIZE,
  NAME_UNKNOWN,
  useItemLookup,
  useProductionLineLookup,
  useProductionOrderLookup,
} from './lookups';

const ITEM = {
  itemId: 5001,
  itemCode: 'SYN-ITEM-0001',
  itemName: '합성 품목',
  itemTypeCode: 'SYN_PRODUCT',
  baseUomId: 11,
  lotControlled: true,
  serialControlTypeCode: 'SYN_NONE',
  inspectionRequired: false,
  fifoPolicyCode: 'SYN_FIFO',
  negativeStockAllowed: false,
  isActive: true,
};

const LINE = {
  productionLineId: 7,
  plantId: 1,
  lineCode: 'SYN-LINE-A',
  lineName: '합성 라인',
  lineTypeCode: 'SYN_ASSY',
  isActive: true,
};

const ORDER = {
  productionOrderId: 31,
  productionOrderNo: 'SYN-PO-0031',
  itemId: 5001,
  orderQty: 3000,
  statusCode: 'SYN_OPEN',
};

const stub = (
  options: { fail?: boolean; total?: number } = {},
): { urls: string[]; fetch: StubFetch } => {
  const urls: string[] = [];
  const fetch: StubFetch = async (request) => {
    const url = new URL(request.url);
    urls.push(`${url.pathname}${url.search}`);

    if (options.fail === true) return jsonResponse({ message: '실패' }, { status: 500 });

    const items =
      url.pathname === '/mdm/items'
        ? [ITEM]
        : url.pathname === '/planning/production-orders'
          ? [ORDER]
          : [LINE];
    const total = options.total ?? items.length;
    return jsonResponse({ items, page: { page: 1, size: 200, total } });
  };

  return { urls, fetch };
};

describe('useItemLookup', () => {
  it('코드와 이름을 함께 보인다 — 이름만으로는 같은 이름이 여럿일 때 못 가른다', async () => {
    const { result } = renderHookWithProviders(() => useItemLookup(), { fetch: stub().fetch });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });
    expect(result.current.labelOf(5001)).toBe('SYN-ITEM-0001 · 합성 품목');
  });

  it('문자열 식별자로도 찾는다 — 목록의 행은 글자로 들고 있다', async () => {
    const { result } = renderHookWithProviders(() => useItemLookup(), { fetch: stub().fetch });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });
    expect(result.current.labelOf('5001')).toBe('SYN-ITEM-0001 · 합성 품목');
  });

  it('고를 수 있는 값들을 함께 내준다 — 필터의 선택지가 된다', async () => {
    const { result } = renderHookWithProviders(() => useItemLookup(), { fetch: stub().fetch });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });
    expect(result.current.options).toEqual([{ value: '5001', label: 'SYN-ITEM-0001 · 합성 품목' }]);
  });

  /*
   * ⛔ `5001` 은 사용자가 쓰는 말이 아니다. 이름을 모르는데 식별자를 내면 그것이 품목명인
   * 줄 알고 읽는다 — 모르면 모른다고 적는다.
   */
  it.each([
    ['고른 것이 없을 때', undefined],
    ['목록에 없는 식별자일 때', 9999],
  ])('⛔ %s 숫자 식별자를 보이지 않는다', async (_name, id) => {
    const { result } = renderHookWithProviders(() => useItemLookup(), { fetch: stub().fetch });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });
    expect(result.current.labelOf(id)).toBe(NAME_UNKNOWN);
  });

  it('⛔ 조회가 실패해도 숫자로 물러나지 않는다', async () => {
    const { result } = renderHookWithProviders(() => useItemLookup(), {
      fetch: stub({ fail: true }).fetch,
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.labelOf(5001)).toBe(NAME_UNKNOWN);
    expect(result.current.labelOf(5001)).not.toContain('5001');
  });

  it('받기 전에도 숫자를 보이지 않는다', () => {
    const { result } = renderHookWithProviders(() => useItemLookup(), { fetch: stub().fetch });

    expect(result.current.labelOf(5001)).toBe(NAME_UNKNOWN);
  });

  it('쓰지 않게 된 품목도 이름을 낸다 — 이미 그 품목으로 만든 지시가 있다', async () => {
    const stubbed = stub();

    renderHookWithProviders(() => useItemLookup(), { fetch: stubbed.fetch });

    await waitFor(() => {
      expect(stubbed.urls).toHaveLength(1);
    });
    expect(stubbed.urls[0]).toContain('includeInactive=true');
  });

  /*
   * ⛔ 200건을 넘으면 뒤쪽 품목은 이름이 안 붙고 필터에서 고를 수조차 없다. 화면이 그것을
   * 모르면 「선택지가 이게 전부」인 척하게 된다 — 잘렸다는 사실을 내줘야 적을 수 있다(A-11).
   */
  it('⛔ 받은 것보다 전체가 많으면 잘렸다고 알린다', async () => {
    const { result } = renderHookWithProviders(() => useItemLookup(), {
      fetch: stub({ total: 4321 }).fetch,
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });
    expect(result.current.isTruncated).toBe(true);
  });

  it('다 받았으면 잘렸다고 하지 않는다', async () => {
    const { result } = renderHookWithProviders(() => useItemLookup(), { fetch: stub().fetch });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });
    expect(result.current.isTruncated).toBe(false);
  });

  it.each([
    ['받기 전에는', false],
    ['조회가 실패했을 때는', true],
  ])('%s 잘렸다고 하지 않는다 — 모르는 것을 안다고 하지 않는다', async (_name, fail) => {
    const { result } = renderHookWithProviders(() => useItemLookup(), {
      fetch: stub({ fail }).fetch,
    });

    if (fail) {
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    }
    expect(result.current.isTruncated).toBe(false);
  });

  it(`한 번에 ${String(LOOKUP_SIZE)}건을 받는다`, async () => {
    const stubbed = stub();

    renderHookWithProviders(() => useItemLookup(), { fetch: stubbed.fetch });

    await waitFor(() => {
      expect(stubbed.urls).toHaveLength(1);
    });
    expect(stubbed.urls[0]).toContain(`size=${String(LOOKUP_SIZE)}`);
  });
});

describe('useProductionOrderLookup', () => {
  /*
   * ⛔ P/O 는 번호가 곧 이름이다. 품목·라인처럼 「코드 · 이름」으로 꾸미면 없는 필드를
   * 지어내는 셈이 된다.
   */
  it('P/O 번호를 그대로 보인다', async () => {
    const { result } = renderHookWithProviders(() => useProductionOrderLookup(), {
      fetch: stub().fetch,
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });
    expect(result.current.labelOf(31)).toBe('SYN-PO-0031');
  });

  /*
   * ⛔ 하위를 함께 받으면 page·total 이 «루트 기준»으로 바뀌어 「몇 건 중 몇 건을 받았나」가
   * 어긋난다 — 잘림 판정이 거짓이 된다.
   */
  it('⛔ 하위 P/O 를 함께 받지 않는다 — 세는 기준이 바뀐다', async () => {
    const stubbed = stub();

    renderHookWithProviders(() => useProductionOrderLookup(), { fetch: stubbed.fetch });

    await waitFor(() => {
      expect(stubbed.urls).toHaveLength(1);
    });
    expect(stubbed.urls[0]).not.toContain('includeChildren');
  });

  /* P/O 는 주문이 들어올 때마다 늘어난다 — 「고르려는 것이 목록에 없는」 일이 실제로 생긴다. */
  it('받은 것보다 전체가 많으면 잘렸다고 알린다', async () => {
    const { result } = renderHookWithProviders(() => useProductionOrderLookup(), {
      fetch: stub({ total: 9000 }).fetch,
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });
    expect(result.current.isTruncated).toBe(true);
  });

  it('⛔ 조회가 실패해도 숫자로 물러나지 않는다', async () => {
    const { result } = renderHookWithProviders(() => useProductionOrderLookup(), {
      fetch: stub({ fail: true }).fetch,
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.labelOf(31)).toBe(NAME_UNKNOWN);
  });
});

describe('useProductionLineLookup', () => {
  it('라인 코드와 이름을 함께 보인다', async () => {
    const { result } = renderHookWithProviders(() => useProductionLineLookup(), {
      fetch: stub().fetch,
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });
    expect(result.current.labelOf(7)).toBe('SYN-LINE-A · 합성 라인');
  });

  it('셋이 서로 다른 자리에서 받는다 — 캐시가 섞이지 않는다', async () => {
    const stubbed = stub();

    renderHookWithProviders(
      () => ({
        items: useItemLookup(),
        lines: useProductionLineLookup(),
        orders: useProductionOrderLookup(),
      }),
      { fetch: stubbed.fetch },
    );

    await waitFor(() => {
      expect(stubbed.urls).toHaveLength(3);
    });
    for (const path of ['/mdm/items', '/mdm/production-lines', '/planning/production-orders']) {
      expect(stubbed.urls.some((url) => url.startsWith(path))).toBe(true);
    }
  });
});
