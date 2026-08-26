import { act, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { jsonResponse, renderHookWithProviders, type StubFetch } from '../../test/api-harness';
import { useProductionPlanEditorSession } from './editor-session';

const productionPlan = (productionPlanId: number, productionOrderId = 701, plannedQty = 50) => ({
  productionPlanId,
  productionOrderId,
  planNo: `PLAN-${String(productionPlanId)}`,
  planDate: '2026-08-26',
  plannedQty,
  uomId: 8101,
  bomId: 8201,
  routingId: 8301,
  plannedLineId: null,
  statusCode: 'DRAFT',
  confirmedAt: null,
  remarks: null,
});

const defaults = {
  planDate: '2026-08-27',
  plannedQty: '25',
  bomId: '8201',
  routingId: '8301',
};

describe('useProductionPlanEditorSession', () => {
  it('전체 쪽을 읽은 뒤 모든 서버 계획을 편집 행으로 연결한다', async () => {
    const requests: URL[] = [];
    const fetch: StubFetch = async (request) => {
      const url = new URL(request.url);
      requests.push(url);
      const page = Number(url.searchParams.get('page') ?? '1');
      return jsonResponse({
        items: [productionPlan(page === 1 ? 501 : 502)],
        page: { page, size: 1, total: 2 },
      });
    };
    const { result } = renderHookWithProviders(() => useProductionPlanEditorSession(701), {
      fetch,
    });

    await waitFor(() => expect(result.current.rows).toHaveLength(2));

    expect(result.current.rows.map((row) => row.key)).toEqual(['plan-501', 'plan-502']);
    expect(requests.map((url) => url.searchParams.get('page'))).toEqual([null, '2']);
    expect(requests.every((url) => url.searchParams.get('productionOrderId') === '701')).toBe(true);
    expect(requests.every((url) => url.searchParams.get('size') === '100')).toBe(true);
  });

  it('행 작업을 현재 P/O 세션에만 적용하고 서버 정착 결과를 기준값으로 바꾼다', async () => {
    const fetch: StubFetch = async () =>
      jsonResponse({
        items: [productionPlan(501)],
        page: { page: 1, size: 100, total: 1 },
      });
    const { result } = renderHookWithProviders(() => useProductionPlanEditorSession(701), {
      fetch,
    });
    await waitFor(() => expect(result.current.rows).toHaveLength(1));

    act(() => result.current.change('plan-501', 'plannedQty', '60'));
    act(() => result.current.markPending('plan-501', true));
    act(() => result.current.setErrors('plan-501', { plannedQty: 'INVALID_QUANTITY' }));
    expect(result.current.rows[0]).toMatchObject({
      isDirty: true,
      isPending: true,
      errors: { plannedQty: 'INVALID_QUANTITY' },
    });

    act(() => result.current.settle('plan-501', productionPlan(501, 701, 60)));
    expect(result.current.rows[0]).toMatchObject({
      isDirty: false,
      isPending: false,
      draft: { plannedQty: '60' },
      errors: {},
    });

    act(() => result.current.add(defaults));
    const newRow = result.current.rows.find((row) => row.productionPlanId === null);
    expect(newRow).toMatchObject({ draft: defaults, isDirty: true });
    act(() => result.current.remove(newRow?.key ?? 'missing'));
    expect(result.current.rows).toHaveLength(1);
  });

  it('같은 P/O 재조회에는 미저장 행을 보존한다', async () => {
    let plannedQty = 50;
    let requests = 0;
    const fetch: StubFetch = async () => {
      requests += 1;
      return jsonResponse({
        items: [productionPlan(501, 701, plannedQty)],
        page: { page: 1, size: 100, total: 1 },
      });
    };
    const { result, queryClient } = renderHookWithProviders(
      () => useProductionPlanEditorSession(701),
      { fetch },
    );
    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    act(() => result.current.change('plan-501', 'plannedQty', '60'));
    act(() => result.current.add(defaults));

    plannedQty = 55;
    await act(() => queryClient.invalidateQueries({ queryKey: ['production-plans'] }));
    await waitFor(() => expect(requests).toBe(2));
    await waitFor(() => expect(result.current.plans.data?.items[0]?.plannedQty).toBe(55));

    expect(result.current.rows.map((row) => row.draft.plannedQty)).toEqual(['60', '25']);
  });

  it('P/O가 바뀌는 즉시 이전 행을 숨기고 새 소유자의 응답만 정착시킨다', async () => {
    let selectedId = 701;
    let resolveSecond: ((response: Response) => void) | undefined;
    const fetch: StubFetch = async (request) => {
      const id = Number(new URL(request.url).searchParams.get('productionOrderId'));
      if (id === 701) {
        return jsonResponse({
          items: [productionPlan(501)],
          page: { page: 1, size: 100, total: 1 },
        });
      }
      return new Promise<Response>((resolve) => {
        resolveSecond = resolve;
      });
    };
    const { result, rerender } = renderHookWithProviders(
      () => useProductionPlanEditorSession(selectedId),
      { fetch },
    );
    await waitFor(() => expect(result.current.rows[0]?.productionPlanId).toBe(501));

    selectedId = 702;
    rerender();
    expect(result.current.rows).toEqual([]);
    await waitFor(() => expect(resolveSecond).toBeDefined());
    act(() =>
      resolveSecond?.(
        jsonResponse({
          items: [productionPlan(601, 702)],
          page: { page: 1, size: 100, total: 1 },
        }),
      ),
    );

    await waitFor(() => expect(result.current.rows[0]?.productionPlanId).toBe(601));
    expect(result.current.rows[0]?.draft.plannedQty).toBe('50');
  });

  it('A→B→A 뒤에는 과거 A 세션 콜백이 새 A 행을 변경하지 않는다', async () => {
    let selectedId = 701;
    const fetch: StubFetch = async (request) => {
      const id = Number(new URL(request.url).searchParams.get('productionOrderId'));
      return jsonResponse({
        items: [productionPlan(id === 701 ? 501 : 601, id)],
        page: { page: 1, size: 100, total: 1 },
      });
    };
    const { result, rerender } = renderHookWithProviders(
      () => useProductionPlanEditorSession(selectedId),
      { fetch },
    );
    await waitFor(() => expect(result.current.rows[0]?.productionPlanId).toBe(501));
    const staleChange = result.current.change;

    selectedId = 702;
    rerender();
    await waitFor(() => expect(result.current.rows[0]?.productionPlanId).toBe(601));
    selectedId = 701;
    rerender();
    await waitFor(() => expect(result.current.rows[0]?.productionPlanId).toBe(501));
    act(() => staleChange('plan-501', 'plannedQty', '999'));

    expect(result.current.rows[0]?.draft.plannedQty).toBe('50');
    expect(result.current.rows[0]?.isDirty).toBe(false);
  });

  it('선택하지 않은 P/O와 다른 P/O의 정착 결과는 현재 행을 만들거나 바꾸지 않는다', async () => {
    let selectedId: number | null = null;
    const fetch: StubFetch = async () =>
      jsonResponse({
        items: [productionPlan(501)],
        page: { page: 1, size: 100, total: 1 },
      });
    const { result, rerender } = renderHookWithProviders(
      () => useProductionPlanEditorSession(selectedId),
      { fetch },
    );
    act(() => result.current.add(defaults));
    expect(result.current.rows).toEqual([]);

    selectedId = 701;
    rerender();
    await waitFor(() => expect(result.current.rows[0]?.productionPlanId).toBe(501));
    act(() => result.current.settle('plan-501', productionPlan(601, 702, 999)));

    expect(result.current.rows[0]).toMatchObject({
      productionPlanId: 501,
      draft: { plannedQty: '50' },
    });
  });

  it('여러 P/O 세션에서 추가한 신규 행 키가 다시 사용되지 않는다', async () => {
    let selectedId = 701;
    const fetch: StubFetch = async (request) => {
      const id = Number(new URL(request.url).searchParams.get('productionOrderId'));
      return jsonResponse({ items: [], page: { page: 1, size: 100, total: 0, owner: id } });
    };
    const { result, rerender } = renderHookWithProviders(
      () => useProductionPlanEditorSession(selectedId),
      { fetch },
    );
    await waitFor(() => expect(result.current.plans.isSuccess).toBe(true));
    act(() => result.current.add(defaults));
    act(() => result.current.add(defaults));
    const firstKeys = result.current.rows.map((row) => row.key);

    selectedId = 702;
    rerender();
    await waitFor(() => expect(result.current.plans.isSuccess).toBe(true));
    act(() => result.current.add(defaults));

    expect(firstKeys).toEqual(['new-plan-1', 'new-plan-2']);
    expect(result.current.rows.map((row) => row.key)).toEqual(['new-plan-3']);
  });

  it('전체 조회에 다른 P/O 계획이 섞이면 편집 정본으로 받지 않는다', async () => {
    const fetch: StubFetch = async () =>
      jsonResponse({
        items: [productionPlan(501, 701), productionPlan(601, 702)],
        page: { page: 1, size: 100, total: 2 },
      });
    const { result } = renderHookWithProviders(() => useProductionPlanEditorSession(701), {
      fetch,
    });

    await waitFor(() => expect(result.current.plans.isError).toBe(true));

    expect(result.current.rows).toEqual([]);
    expect(result.current.plans.error).toEqual(
      new Error('다른 생산 P/O의 계획이 전체 목록 응답에 섞였습니다.'),
    );
  });

  it('새 P/O의 캐시 재검증이 실패하면 낡은 캐시를 편집 행으로 열지 않는다', async () => {
    let selectedId = 702;
    let order702Requests = 0;
    const fetch: StubFetch = async (request) => {
      const id = Number(new URL(request.url).searchParams.get('productionOrderId'));
      if (id === 702 && (order702Requests += 1) > 1) {
        return jsonResponse({ message: 'synthetic stale cache' }, { status: 500 });
      }
      return jsonResponse({
        items: [productionPlan(id === 701 ? 501 : 601, id)],
        page: { page: 1, size: 100, total: 1 },
      });
    };
    const { result, rerender } = renderHookWithProviders(
      () => useProductionPlanEditorSession(selectedId),
      { fetch },
    );
    await waitFor(() => expect(result.current.rows[0]?.productionPlanId).toBe(601));
    selectedId = 701;
    rerender();
    await waitFor(() => expect(result.current.rows[0]?.productionPlanId).toBe(501));

    selectedId = 702;
    rerender();
    expect(result.current.rows).toEqual([]);
    await waitFor(() => expect(result.current.plans.isError).toBe(true));
    expect(result.current.rows).toEqual([]);
  });
});
