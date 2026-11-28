import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { jsonResponse, renderHookWithProviders, type StubFetch } from '../../test/api-harness';
import {
  LOOKUP_SIZE,
  NAME_UNKNOWN,
  useItemNames,
  useProcessLookup,
  useProductionLineLookup,
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

const PROCESS = {
  processId: 41,
  processCode: 'SYN-PR-01',
  processName: '합성 공정',
  processTypeCode: 'SYN_INTERNAL',
  isActive: true,
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

    const items = url.pathname === '/mdm/processes' ? [PROCESS] : [LINE];
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

describe('useProcessLookup', () => {
  it('공정 이름을 보인다', async () => {
    const { result } = renderHookWithProviders(() => useProcessLookup(), {
      fetch: stub().fetch,
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });
    expect(result.current.labelOf(41)).toBe('합성 공정');
    expect(result.current.options).toEqual([{ value: '41', label: '합성 공정' }]);
  });

  /* 지난 W/O 를 찾는 조건이다 — 쓰지 않게 된 공정으로 만든 지시도 걸러 볼 수 있어야 한다. */
  it('쓰지 않게 된 공정까지 받는다', async () => {
    const stubbed = stub();

    renderHookWithProviders(() => useProcessLookup(), { fetch: stubbed.fetch });

    await waitFor(() => {
      expect(stubbed.urls).toHaveLength(1);
    });
    expect(stubbed.urls[0]).toContain('includeInactive=true');
  });

  /* ⛔ 선택지가 이게 전부인 척하지 않는다 — 넘쳤으면 넘쳤다고 알린다. */
  it('받은 것보다 전체가 많으면 잘렸다고 알린다', async () => {
    const { result } = renderHookWithProviders(() => useProcessLookup(), {
      fetch: stub({ total: 9000 }).fetch,
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });
    expect(result.current.isTruncated).toBe(true);
  });

  it('⛔ 조회가 실패해도 숫자로 물러나지 않는다', async () => {
    const { result } = renderHookWithProviders(() => useProcessLookup(), {
      fetch: stub({ fail: true }).fetch,
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.labelOf(41)).toBe(NAME_UNKNOWN);
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
        processes: useProcessLookup(),
      }),
      { fetch: stubbed.fetch },
    );

    await waitFor(() => {
      expect(stubbed.urls).toHaveLength(3);
    });
    for (const path of ['/mdm/items/', '/mdm/production-lines', '/mdm/processes']) {
      expect(stubbed.urls.some((url) => url.startsWith(path))).toBe(true);
    }
  });
});
