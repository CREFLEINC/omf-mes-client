import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createStubFetch, jsonResponse, renderHookWithProviders } from '../../test/api-harness';
import { allocation, issueLog, reissueReason, summary } from './fixtures';
import { useAllocations, useIssueHistory, useIssueSummaries, useReissueReasons } from './queries';

const pathOf = (request: Request): string => new URL(request.url).pathname;
const pageOf = (request: Request): number =>
  Number(new URL(request.url).searchParams.get('page') ?? '1');
const targetIdsOf = (request: Request): number[] =>
  new URL(request.url).searchParams
    .getAll('targetIds')
    .flatMap((value) => value.split(','))
    .map(Number);

describe('shipping-packing-label queries — 완전 조회', () => {
  it('배분은 첫 쪽만 쓰지 않고 page.total까지 모두 읽는다', async () => {
    const pages: number[] = [];
    const { result } = renderHookWithProviders(() => useAllocations(9101), {
      fetch: createStubFetch([
        {
          match: (request) => pathOf(request) === '/logistics/shipment-lot-allocations',
          respond: (request) => {
            const page = pageOf(request);
            pages.push(page);

            return jsonResponse({
              items: [allocation(9400 + page, 9500 + page, `SYN-LOT-${String(page)}`, true)],
              page: { page, size: 1, total: 2 },
            });
          },
        },
      ]),
    });

    await waitFor(() => {
      expect(result.current.data?.map((item) => item.shipmentLotAllocationId)).toEqual([
        9401, 9402,
      ]);
    });
    expect(pages).toEqual([1, 2]);
  });

  it('summary 대상은 계약 상한 1000개로 나누고 요청한 전건을 합친다', async () => {
    const batchSizes: number[] = [];
    const targetIds = Array.from({ length: 1_001 }, (_, index) => index + 1);
    const { result } = renderHookWithProviders(
      () => useIssueSummaries('DELIVERY_LABEL', targetIds),
      {
        fetch: createStubFetch([
          {
            match: (request) => pathOf(request) === '/app/document-issues/summary',
            respond: (request) => {
              const ids = targetIdsOf(request);
              batchSizes.push(ids.length);

              return jsonResponse({ items: ids.map((id) => summary(id, 0)) });
            },
          },
        ]),
      },
    );

    await waitFor(() => {
      expect(result.current.data).toHaveLength(1_001);
    });
    expect(batchSizes.sort((left, right) => right - left)).toEqual([1_000, 1]);
  });

  it('summary가 요청 대상을 하나라도 누락하면 0회로 추정하지 않고 실패한다', async () => {
    const { result } = renderHookWithProviders(() => useIssueSummaries('PACKING_LABEL', [1, 2]), {
      fetch: createStubFetch([
        {
          match: (request) => pathOf(request) === '/app/document-issues/summary',
          respond: () => jsonResponse({ items: [summary(1, 0)] }),
        },
      ]),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.data).toBeUndefined();
  });

  it('재발행 사유와 이력도 page.total까지 전건을 읽는다', async () => {
    const { result } = renderHookWithProviders(
      () => ({
        reasons: useReissueReasons(true),
        history: useIssueHistory('DELIVERY_LABEL', 9401),
      }),
      {
        fetch: createStubFetch([
          {
            match: (request) => pathOf(request) === '/mdm/code-values',
            respond: (request) => {
              const page = pageOf(request);

              return jsonResponse({
                items: [reissueReason(`SYN-${String(page)}`, `합성 사유 ${String(page)}`)],
                page: { page, size: 1, total: 2 },
              });
            },
          },
          {
            match: (request) => pathOf(request) === '/app/document-issues',
            respond: (request) => {
              const page = pageOf(request);

              return jsonResponse({
                items: [issueLog(9700 + page, 9401, 'SYN-LOT-0001', page)],
                page: { page, size: 1, total: 2 },
              });
            },
          },
        ]),
      },
    );

    await waitFor(() => {
      expect(result.current.reasons.data).toHaveLength(2);
      expect(result.current.history.data).toHaveLength(2);
    });
  });
});
