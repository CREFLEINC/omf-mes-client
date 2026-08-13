import { messages } from '@omf-mes/i18n';
import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createStubFetch, jsonResponse, renderHookWithProviders } from '../../test/api-harness';
import { warehouseFixtures } from './fixtures';
import {
  describeReference,
  isTruncated,
  lookupNote,
  toReference,
  useWarehouseOptions,
  type ReferenceSource,
} from './lookups';

const t = messages.disposalIssue;

const WAREHOUSES_PATH = '/mdm/warehouses';
const WAREHOUSE_LABEL = 'SAMPLE-WH-01 · 합성 폐기창고 가';

const source = (overrides: Partial<ReferenceSource> = {}): ReferenceSource => ({
  entries: [{ value: '9701', label: WAREHOUSE_LABEL, isActive: true }],
  isError: false,
  isLoading: false,
  truncated: false,
  ...overrides,
});

describe('toReference', () => {
  it('목록에 있으면 이름으로 푼다', () => {
    expect(toReference(source(), 9701)).toEqual({ kind: 'named', label: WAREHOUSE_LABEL });
  });

  /**
   * **`omf-mes#47`을 재생산하지 않는 자리다.** 본 자료가 참조보다 먼저 오면 정상 값이
   * 「알 수 없음」으로 보이는데, 그 문구는 *값이 잘못됐다*는 뜻이라 사용자가 반대로 읽는다.
   */
  it('아직 오지 않은 것과 목록에 없는 것을 가른다', () => {
    expect(toReference(source({ entries: [], isLoading: true }), 9701)).toEqual({ kind: 'loading' });
    expect(toReference(source({ entries: [] }), 9701)).toEqual({ kind: 'unknown' });
  });

  /* 못 받은 목록으로 「그 값이 목록에 없다」를 판정하면 정상 값에 잘못된 값이라는 표를 붙인다. */
  it('실패가 미도착·목록에 없음보다 앞선다', () => {
    expect(toReference(source({ isError: true, isLoading: true, entries: [] }), 9701)).toEqual({
      kind: 'failed',
    });
  });

  it('번호가 없으면 목록에 없음으로 본다', () => {
    expect(toReference(source(), null)).toEqual({ kind: 'unknown' });
    expect(toReference(source(), undefined)).toEqual({ kind: 'unknown' });
  });

  /** **어느 갈래에도 번호를 담지 않는다**(`omf-mes#44`) — 담을 자리가 없으면 샐 경로도 없다. */
  it('어느 갈래에도 번호를 담지 않는다', () => {
    for (const state of [
      toReference(source(), 9701),
      toReference(source({ entries: [] }), 9799),
      toReference(source({ isLoading: true, entries: [] }), 9701),
      toReference(source({ isError: true, entries: [] }), 9701),
    ]) {
      expect(JSON.stringify(state)).not.toContain('9701');
      expect(JSON.stringify(state)).not.toContain('9799');
    }
  });
});

describe('describeReference', () => {
  /** 네 갈래의 문구가 서로 달라야 뜻이 구분된다 — 뭉치면 사용자가 원인을 반대로 읽는다. */
  it('네 갈래의 문구가 서로 다르다', () => {
    const texts = [
      describeReference({ kind: 'named', label: WAREHOUSE_LABEL }),
      describeReference({ kind: 'unknown' }),
      describeReference({ kind: 'loading' }),
      describeReference({ kind: 'failed' }),
    ];

    expect(texts).toEqual([
      WAREHOUSE_LABEL,
      t.values.unknown,
      t.values.referenceLoading,
      t.values.referenceFailed,
    ]);
    expect(new Set(texts).size).toBe(4);
  });
});

describe('isTruncated · lookupNote', () => {
  it('전체 건수가 받은 건수보다 많으면 잘린 것이다', () => {
    expect(isTruncated({ page: 1, size: 50, total: 120 }, 50)).toBe(true);
    expect(isTruncated({ page: 1, size: 50, total: 50 }, 50)).toBe(false);
  });

  /** **실패가 잘림보다 앞선다** — 첫 조회가 잘리고 다시 부르기가 실패하면 둘이 함께 참이 된다. */
  it('실패가 잘림보다 앞선다', () => {
    expect(lookupNote({ isError: true, truncated: true })).toBe(t.filters.lookupFailed);
    expect(lookupNote({ isError: false, truncated: true })).toBe(t.filters.lookupTruncated);
    expect(lookupNote({ isError: false, truncated: false })).toBeUndefined();
  });

  /**
   * **창고 유형 미확정 안내는 이 함수가 내지 않는다.** 목록을 받아 온 결과가 아니라 값 목록이
   * 확정되지 않았다는 별개의 사실이고, 화면이 둘을 이어 붙인다.
   */
  it('창고 유형 미확정 안내를 내지 않는다', () => {
    expect(lookupNote({ isError: false, truncated: false })).not.toBe(t.filters.warehouseTypePending);
  });
});

const warehousesFetch = (
  page: Partial<{ page: number; size: number; total: number }> = {},
): { fetch: ReturnType<typeof createStubFetch>; urls: URL[] } => {
  const urls: URL[] = [];

  const fetch = createStubFetch([
    {
      match: (request) => new URL(request.url).pathname === WAREHOUSES_PATH,
      respond: (request) => {
        urls.push(new URL(request.url));

        return jsonResponse({
          items: warehouseFixtures,
          page: { page: 1, size: 50, total: warehouseFixtures.length, ...page },
        });
      },
    },
  ]);

  return { fetch, urls };
};

describe('useWarehouseOptions', () => {
  it('「코드 · 이름」으로 풀고 유형 코드를 함께 나른다', async () => {
    const { fetch } = warehousesFetch();
    const { result } = renderHookWithProviders(() => useWarehouseOptions(), { fetch });

    await waitFor(() => {
      expect(result.current.entries).toHaveLength(warehouseFixtures.length);
    });

    expect(result.current.entries[0]).toEqual({
      value: '9701',
      label: WAREHOUSE_LABEL,
      isActive: true,
      warehouseTypeCode: 'SAMPLE_WH_TYPE_A',
    });
  });

  /**
   * **미사용 창고를 빼지 않는다** — 이 칸은 과거 입고를 찾는 조건이라, 빼면 그 입고를
   * 조건으로 찾을 방법이 사라진다. 목록에 남기고 표식은 화면이 붙인다.
   */
  it('미사용까지 받아 오고 목록에 남긴다', async () => {
    const { fetch, urls } = warehousesFetch();
    const { result } = renderHookWithProviders(() => useWarehouseOptions(), { fetch });

    await waitFor(() => {
      expect(result.current.entries).toHaveLength(warehouseFixtures.length);
    });

    expect(urls[0]?.searchParams.get('includeInactive')).toBe('true');
    expect(result.current.entries.some((entry) => !entry.isActive)).toBe(true);
  });

  /**
   * **유형으로 좁혀 받지 않는다.** 실을 값이 아직 없고, 값이 정해져도 목록 표의 창고 이름은
   * 조건 밖 창고까지 풀어야 한다 — 좁히는 자리는 선택지 하나다.
   */
  it('창고 유형 조건을 싣지 않는다', async () => {
    const { fetch, urls } = warehousesFetch();
    const { result } = renderHookWithProviders(() => useWarehouseOptions(), { fetch });

    await waitFor(() => {
      expect(result.current.entries).toHaveLength(warehouseFixtures.length);
    });

    expect(urls[0]?.searchParams.has('warehouseTypeCode')).toBe(false);
  });

  it('목록이 잘리면 그 사실을 낸다', async () => {
    const { fetch } = warehousesFetch({ total: 120 });
    const { result } = renderHookWithProviders(() => useWarehouseOptions(), { fetch });

    await waitFor(() => {
      expect(result.current.truncated).toBe(true);
    });
  });

  it('실패하면 실패로 앉고 복구 경로를 낸다', async () => {
    const fetch = createStubFetch([
      {
        match: (request) => new URL(request.url).pathname === WAREHOUSES_PATH,
        respond: () => jsonResponse({ message: '' }, { status: 500 }),
      },
    ]);
    const { result } = renderHookWithProviders(() => useWarehouseOptions(), { fetch });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.entries).toEqual([]);
    expect(typeof result.current.refetch).toBe('function');
  });
});
