import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { jsonResponse, renderHookWithProviders, type StubFetch } from '../../test/api-harness';
import {
  LOOKUP_SIZE,
  NAME_UNKNOWN,
  useItemNames,
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

    /* 품목만 **번호마다 상세**를 부른다 — 응답이 `{ item, editability }` 봉투다. */
    if (url.pathname === '/mdm/items/5001') return jsonResponse({ item: ITEM, editability: {} });
    if (url.pathname.startsWith('/mdm/items/')) {
      return jsonResponse({ message: '없다' }, { status: 404 });
    }

    const items = url.pathname === '/planning/production-orders' ? [ORDER] : [LINE];
    const total = options.total ?? items.length;
    return jsonResponse({ items, page: { page: 1, size: 200, total } });
  };

  return { urls, fetch };
};

describe('useItemNames', () => {
  const ITEM_IDS = [5001];

  it('코드와 이름을 함께 보인다 — 이름만으로는 같은 이름이 여럿일 때 못 가른다', async () => {
    const { result } = renderHookWithProviders(() => useItemNames(ITEM_IDS), {
      fetch: stub().fetch,
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });
    expect(result.current.labelOf(5001)).toBe('SYN-ITEM-0001 · 합성 품목');
  });

  it('문자열 식별자로도 찾는다 — 목록의 행은 글자로 들고 있다', async () => {
    const { result } = renderHookWithProviders(() => useItemNames(ITEM_IDS), {
      fetch: stub().fetch,
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });
    expect(result.current.labelOf('5001')).toBe('SYN-ITEM-0001 · 합성 품목');
  });

  /*
   * ⛔ `5001` 은 사용자가 쓰는 말이 아니다. 이름을 모르는데 식별자를 내면 그것이 품목명인
   * 줄 알고 읽는다 — 모르면 모른다고 적는다.
   */
  it.each([
    ['고른 것이 없을 때', undefined],
    ['묻지 않은 식별자일 때', 9999],
  ])('⛔ %s 숫자 식별자를 보이지 않는다', async (_name, id) => {
    const { result } = renderHookWithProviders(() => useItemNames(ITEM_IDS), {
      fetch: stub().fetch,
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });
    expect(result.current.labelOf(id)).toBe(NAME_UNKNOWN);
  });

  it('⛔ 조회가 실패해도 숫자로 물러나지 않는다', async () => {
    const { result } = renderHookWithProviders(() => useItemNames(ITEM_IDS), {
      fetch: stub({ fail: true }).fetch,
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.labelOf(5001)).toBe(NAME_UNKNOWN);
    expect(result.current.labelOf(5001)).not.toContain('5001');
  });

  it('받기 전에도 숫자를 보이지 않는다', () => {
    const { result } = renderHookWithProviders(() => useItemNames(ITEM_IDS), {
      fetch: stub().fetch,
    });

    expect(result.current.labelOf(5001)).toBe(NAME_UNKNOWN);
  });

  /*
   * ⭐ **이 화면이 고친 결함이다**(omf-all-around#37). 목록 한 쪽(상한 200건)으로 풀던 때는
   * 그 밖의 품목이 전부 「이름 확인 중」으로 굳었다 — 마스터가 9,269건인 환경이 실재한다.
   * 번호마다 물으면 마스터가 아무리 커도 화면에 선 줄은 이름이 붙는다.
   */
  it('⭐ 번호마다 상세를 부르고 목록은 부르지 않는다', async () => {
    const stubbed = stub();

    renderHookWithProviders(() => useItemNames(ITEM_IDS), { fetch: stubbed.fetch });

    await waitFor(() => {
      expect(stubbed.urls).toHaveLength(1);
    });
    expect(stubbed.urls[0]).toBe('/mdm/items/5001');
    /* 짝 방향 — 목록 경로로는 한 번도 나가지 않는다(쪽 크기를 실을 자리 자체가 없다). */
    expect(stubbed.urls.some((url) => url.startsWith('/mdm/items?'))).toBe(false);
  });

  it('같은 품목을 가리키는 지시가 여럿이어도 한 번만 묻는다', async () => {
    const stubbed = stub();

    renderHookWithProviders(() => useItemNames([5001, 5001, 5001]), { fetch: stubbed.fetch });

    await waitFor(() => {
      expect(stubbed.urls).toHaveLength(1);
    });
  });

  it('부를 번호가 없으면 요청도 없다', () => {
    const stubbed = stub();

    const { result } = renderHookWithProviders(() => useItemNames([]), { fetch: stubbed.fetch });

    expect(stubbed.urls).toEqual([]);
    expect(result.current.isPending).toBe(false);
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
        items: useItemNames([5001]),
        lines: useProductionLineLookup(),
        orders: useProductionOrderLookup(),
      }),
      { fetch: stubbed.fetch },
    );

    await waitFor(() => {
      expect(stubbed.urls).toHaveLength(3);
    });
    for (const path of ['/mdm/items/', '/mdm/production-lines', '/planning/production-orders']) {
      expect(stubbed.urls.some((url) => url.startsWith(path))).toBe(true);
    }
  });
});
