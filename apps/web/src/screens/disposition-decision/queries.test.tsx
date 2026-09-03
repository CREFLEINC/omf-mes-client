import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { jsonResponse, renderHookWithProviders, type StubFetch } from '../../test/api-harness';
import { useItemLookup, useUomLookup } from './lookups';
import {
  dispositionKeys,
  nonconformanceDetailPath,
  useDecisionHistory,
  useDispositionDecisions,
  useNonconformanceDetail,
} from './queries';

const collecting = (): { urls: string[]; fetch: StubFetch } => {
  const urls: string[] = [];
  const fetch: StubFetch = async (request) => {
    urls.push(new URL(request.url).pathname);
    return jsonResponse({ items: [], page: { page: 1, size: 50, total: 0 } });
  };

  return { urls, fetch };
};

describe('nonconformanceDetailPath', () => {
  it('⭐ 낙관적 잠금 토큰은 부적합 «상세»의 경로에서 꺼낸다 — 저장 경로가 아니다', () => {
    expect(nonconformanceDetailPath(41)).toBe('/quality/nonconformances/41');
    expect(nonconformanceDetailPath(41)).not.toContain('disposition-decisions');
  });
});

describe('dispositionKeys', () => {
  it('캐시 키에 식별자를 담는다 — 다른 부적합의 상세가 섞이지 않는다', () => {
    expect(dispositionKeys.detail(41)).toEqual(['disposition-decision', 'detail', 41]);
    expect(dispositionKeys.decisions(41)).toEqual(['disposition-decision', 'decisions', 41]);
    expect(dispositionKeys.detail(41)).not.toEqual(dispositionKeys.detail(42));
  });

  it('무효화 뿌리 키가 모든 갈래를 덮는다', () => {
    expect(dispositionKeys.detail(41).slice(0, 1)).toEqual([...dispositionKeys.all]);
    expect(dispositionKeys.decisions(41).slice(0, 1)).toEqual([...dispositionKeys.all]);
  });
});

describe('고르기 전 조회를 열지 않는다', () => {
  it('⛔ 부적합을 고르기 전에는 상세·판정 이력 요청을 만들지 않는다 — /0 요청도 없다', () => {
    const { urls, fetch } = collecting();

    const { result } = renderHookWithProviders(
      () => ({
        detail: useNonconformanceDetail(null),
        decisions: useDispositionDecisions(null),
      }),
      { fetch },
    );

    expect(result.current.detail.fetchStatus).toBe('idle');
    expect(result.current.decisions.fetchStatus).toBe('idle');
    expect(urls).toEqual([]);
  });

  it('고르면 그 식별자의 경로를 부른다', async () => {
    const { urls, fetch } = collecting();

    renderHookWithProviders(
      () => ({
        detail: useNonconformanceDetail(41),
        decisions: useDispositionDecisions(41),
      }),
      { fetch },
    );

    await waitFor(() => {
      expect(urls).toContain('/quality/nonconformances/41');
      expect(urls).toContain('/quality/nonconformances/41/disposition-decisions');
    });
  });
});

describe('useDecisionHistory', () => {
  it('⛔ 이력 탭이 아니면 조회를 열지 않는다 — 보지 않는 목록을 부르지 않는다', () => {
    const { urls, fetch } = collecting();

    const { result } = renderHookWithProviders(() => useDecisionHistory(null), { fetch });

    expect(result.current.fetchStatus).toBe('idle');
    expect(urls).toEqual([]);
  });

  it('이력 탭이면 처분 결정 목록을 부른다', async () => {
    const { urls, fetch } = collecting();

    renderHookWithProviders(
      () =>
        useDecisionHistory({
          decidedFrom: '2026-07-14T00:00:00+09:00',
          decidedTo: '2026-08-13T00:00:00+09:00',
        }),
      { fetch },
    );

    await waitFor(() => {
      expect(urls).toContain('/quality/disposition-decisions');
    });
  });

  it('캐시 키가 조회 조건을 담는다 — 조건이 바뀌면 다른 결과다', () => {
    const base = { decidedFrom: 'A', decidedTo: 'B' };

    expect(dispositionKeys.history(base)).not.toEqual(
      dispositionKeys.history({ ...base, dispositionTypeCode: 'REWORK' }),
    );
    expect(dispositionKeys.history(null)).toEqual(['disposition-decision', 'history', null]);
  });
});

describe('참조 이름 조회', () => {
  it('미사용까지 함께 받는다 — 이름을 못 찾은 값이 「알 수 없음」으로 남지 않게 한다', async () => {
    const urls: string[] = [];
    const fetch: StubFetch = async (request) => {
      urls.push(request.url);
      return jsonResponse({ items: [], page: { page: 1, size: 50, total: 0 } });
    };

    renderHookWithProviders(() => ({ items: useItemLookup(), uoms: useUomLookup() }), { fetch });

    await waitFor(() => {
      expect(urls.some((url) => url.includes('/mdm/items?includeInactive=true'))).toBe(true);
      expect(urls.some((url) => url.includes('/mdm/uoms?includeInactive=true'))).toBe(true);
    });
  });

  it('목록이 잘렸는지 알린다 — 이름을 못 찾은 것이 「없는 값」인지 가르는 근거다', async () => {
    const fetch: StubFetch = async () =>
      jsonResponse({
        items: [
          {
            uomId: 7001,
            uomCode: 'EA',
            uomName: '개',
            decimalScale: 0,
            isActive: true,
          },
        ],
        page: { page: 1, size: 1, total: 9 },
      });

    const { result } = renderHookWithProviders(() => useUomLookup(), { fetch });

    await waitFor(() => {
      expect(result.current.truncated).toBe(true);
    });
    expect(result.current.entries).toEqual([{ value: '7001', label: 'EA', isActive: true }]);
  });

  it('품목은 코드와 이름을 함께 보인다 — 코드만으로는 같은 품목인지 가리기 어렵다', async () => {
    const fetch: StubFetch = async () =>
      jsonResponse({
        items: [
          {
            itemId: 5001,
            itemCode: 'SYNTH-ITEM-1',
            itemName: '합성 품목',
            itemTypeCode: 'CODE-F',
            baseUomId: 7001,
            lotControlled: true,
            serialControlTypeCode: 'CODE-H',
            inspectionRequired: true,
            fifoPolicyCode: 'CODE-I',
            negativeStockAllowed: false,
            isActive: true,
          },
        ],
        page: { page: 1, size: 50, total: 1 },
      });

    const { result } = renderHookWithProviders(() => useItemLookup(), { fetch });

    await waitFor(() => {
      expect(result.current.entries).toEqual([
        { value: '5001', label: 'SYNTH-ITEM-1 · 합성 품목', isActive: true },
      ]);
    });
  });
});
