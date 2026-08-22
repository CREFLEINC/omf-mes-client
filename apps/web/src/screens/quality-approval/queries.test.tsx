import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { jsonResponse, renderHookWithProviders, type StubFetch } from '../../test/api-harness';
import {
  customerReferencePath,
  PROCESS_REFERENCE_PATH,
  qualityApprovalKeys,
  UOM_REFERENCE_PATH,
  useApprovalRequestDetail,
  useConditionCustomer,
  useConditionProcesses,
  useConditionUoms,
  useConditionWorkOrder,
  useConcessionCandidates,
  useConcessionDetail,
  workOrderReferencePath,
} from './queries';

describe('useApprovalRequestDetail', () => {
  it('선택이 없으면 상세 조회를 열지 않고 /0 요청도 만들지 않는다', () => {
    const urls: string[] = [];
    const fetch: StubFetch = async (request) => {
      urls.push(request.url);
      return new Response('{}');
    };

    const { result } = renderHookWithProviders(() => useApprovalRequestDetail(null), { fetch });

    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.isError).toBe(false);
    expect(urls).toEqual([]);
  });
});

describe('condition query guards', () => {
  it('승인 상세 성공 전에는 후보와 조건 상세를 열거나 /0 요청을 만들지 않는다', () => {
    const urls: string[] = [];
    const fetch: StubFetch = async (request) => {
      urls.push(request.url);
      return new Response('{}');
    };

    const { result } = renderHookWithProviders(
      () => ({ candidates: useConcessionCandidates(null), detail: useConcessionDetail(null) }),
      { fetch },
    );

    expect(result.current.candidates.fetchStatus).toBe('idle');
    expect(result.current.detail.fetchStatus).toBe('idle');
    expect(urls).toEqual([]);
  });
});

describe('condition exact reference queries', () => {
  it('참조 ID를 캐시 키와 exact 경로에 포함한다', () => {
    expect(qualityApprovalKeys.workOrder(1_201)).toEqual([
      'quality-approval',
      'condition-work-order',
      1_201,
    ]);
    expect(qualityApprovalKeys.customer(1_401)).toEqual([
      'quality-approval',
      'condition-customer',
      1_401,
    ]);
    expect(workOrderReferencePath(1_201)).toBe('/production/work-orders/1201');
    expect(customerReferencePath(1_401)).toBe('/mdm/partners/1401');
  });

  it('null 축은 exact 요청을 열지 않고 /0도 만들지 않는다', () => {
    const urls: string[] = [];
    const fetch: StubFetch = async (request) => {
      urls.push(request.url);
      return jsonResponse({});
    };
    const { result } = renderHookWithProviders(
      () => ({ workOrder: useConditionWorkOrder(null), customer: useConditionCustomer(null) }),
      { fetch },
    );

    expect(result.current.workOrder.fetchStatus).toBe('idle');
    expect(result.current.customer.fetchStatus).toBe('idle');
    expect(urls).toEqual([]);
  });

  it('각 ID를 query 없이 exact GET으로 한 번만 조회한다', async () => {
    const urls: URL[] = [];
    const fetch: StubFetch = async (request) => {
      const url = new URL(request.url);
      urls.push(url);
      return url.pathname === workOrderReferencePath(1_201)
        ? jsonResponse({ workOrderId: 1_201, workOrderNo: 'SYNTH-WO-1201' })
        : jsonResponse({ partnerId: 1_401, partnerName: '합성 고객' });
    };
    const { result } = renderHookWithProviders(
      () => ({ workOrder: useConditionWorkOrder(1_201), customer: useConditionCustomer(1_401) }),
      { fetch },
    );

    await waitFor(() => {
      expect(result.current.workOrder.data?.workOrderNo).toBe('SYNTH-WO-1201');
      expect(result.current.customer.data?.partnerName).toBe('합성 고객');
    });
    expect(urls.map(({ pathname }) => pathname)).toEqual([
      workOrderReferencePath(1_201),
      customerReferencePath(1_401),
    ]);
    expect(urls.every(({ search }) => search === '')).toBe(true);
  });

  it('ID 전환 중에는 앞 ID의 이름을 placeholder로 유지하지 않는다', async () => {
    const pending = new Promise<Response>(() => undefined);
    let workOrderId = 1_201;
    let partnerId = 1_401;
    const fetch: StubFetch = async (request) => {
      const pathname = new URL(request.url).pathname;
      if (pathname === workOrderReferencePath(1_201)) {
        return jsonResponse({ workOrderId: 1_201, workOrderNo: 'SYNTH-WO-OLD' });
      }
      if (pathname === customerReferencePath(1_401)) {
        return jsonResponse({ partnerId: 1_401, partnerName: '합성 고객 이전값' });
      }
      return pending;
    };
    const rendered = renderHookWithProviders(
      () => ({
        workOrder: useConditionWorkOrder(workOrderId),
        customer: useConditionCustomer(partnerId),
      }),
      { fetch },
    );

    await waitFor(() => {
      expect(rendered.result.current.workOrder.data?.workOrderNo).toBe('SYNTH-WO-OLD');
      expect(rendered.result.current.customer.data?.partnerName).toBe('합성 고객 이전값');
    });
    workOrderId = 1_202;
    partnerId = 1_402;
    rendered.rerender();

    await waitFor(() => {
      expect(rendered.result.current.workOrder.fetchStatus).toBe('fetching');
      expect(rendered.result.current.customer.fetchStatus).toBe('fetching');
    });
    expect(rendered.result.current.workOrder.data).toBeUndefined();
    expect(rendered.result.current.customer.data).toBeUndefined();
  });
});

describe('condition list reference queries', () => {
  it('조건 상세 전 UOM과 nullable 공정은 요청하지 않는다', () => {
    const urls: string[] = [];
    const fetch: StubFetch = async (request) => {
      urls.push(request.url);
      return jsonResponse({});
    };
    const { result } = renderHookWithProviders(
      () => ({ uoms: useConditionUoms(false), processes: useConditionProcesses(null) }),
      { fetch },
    );

    expect(result.current.uoms.fetchStatus).toBe('idle');
    expect(result.current.processes.fetchStatus).toBe('idle');
    expect(urls).toEqual([]);
  });

  it('목록별 고정 키로 includeInactive만 보내 한 번씩 조회한다', async () => {
    const urls: URL[] = [];
    const fetch: StubFetch = async (request) => {
      const url = new URL(request.url);
      urls.push(url);
      const items =
        url.pathname === UOM_REFERENCE_PATH
          ? [{ uomId: 901, uomCode: 'SYNTH-EA', uomName: '합성 낱개' }]
          : [{ processId: 1_301, processCode: 'SYNTH-OP', processName: '합성 공정' }];
      return jsonResponse({ items, page: { page: 1, size: 20, total: 1 } });
    };
    const { result } = renderHookWithProviders(
      () => ({ uoms: useConditionUoms(true), processes: useConditionProcesses(1_301) }),
      { fetch },
    );

    await waitFor(() => {
      expect(result.current.uoms.data?.items).toHaveLength(1);
      expect(result.current.processes.data?.items).toHaveLength(1);
    });
    expect(qualityApprovalKeys.uoms).toEqual(['quality-approval', 'condition-uoms']);
    expect(qualityApprovalKeys.processes).toEqual(['quality-approval', 'condition-processes']);
    expect(urls.map(({ pathname }) => pathname)).toEqual([
      UOM_REFERENCE_PATH,
      PROCESS_REFERENCE_PATH,
    ]);
    expect(urls.map((url) => Object.fromEntries(url.searchParams))).toEqual([
      { includeInactive: 'true' },
      { includeInactive: 'true' },
    ]);
  });
});
