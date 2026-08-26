import { messages } from '@omf-mes/i18n';
import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import {
  WORK_ORDER_RELEASE_STATUS_GROUP,
  toWorkOrderReleaseFilterLookups,
  useWorkOrderReleaseProductionLines,
  useWorkOrderReleaseStatusValues,
  workOrderReleaseFilterLookupKeys,
  type WorkOrderReleaseLookupSnapshot,
  type WorkOrderReleaseProductionLine,
  type WorkOrderReleaseStatusValue,
} from './work-order-release-filter-lookups';

const t = messages.workOrderRelease.filter;
const route = (pathname: string, body: unknown): StubRoute => ({
  match: (request) => request.method === 'GET' && new URL(request.url).pathname === pathname,
  respond: () => jsonResponse(body),
});

describe('work-order release filter lookup reads', () => {
  it('uses the design-owned status group and complete active lookup query', async () => {
    const requests: URL[] = [];
    const stub = createStubFetch([
      route('/mdm/code-values', {
        items: [
          {
            codeValueId: 1,
            codeGroupId: 2,
            code: 'SYN-READY',
            codeName: 'Synthetic Ready',
            displayOrder: 20,
            isActive: true,
          },
        ],
        page: { page: 1, size: 200, total: 201 },
      }),
    ]);
    const { result } = renderHookWithProviders(() => useWorkOrderReleaseStatusValues(), {
      fetch: async (request) => {
        requests.push(new URL(request.url));
        return stub(request);
      },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(workOrderReleaseFilterLookupKeys.statusValues).not.toEqual(
      workOrderReleaseFilterLookupKeys.productionLines,
    );
    expect(Array.from(requests[0]?.searchParams.entries() ?? [])).toEqual([
      ['codeGroupCode', WORK_ORDER_RELEASE_STATUS_GROUP],
      ['includeInactive', 'false'],
      ['page', '1'],
      ['size', '200'],
    ]);
    expect(result.current.data).toEqual({
      items: [
        {
          code: 'SYN-READY',
          codeName: 'Synthetic Ready',
          displayOrder: 20,
          isActive: true,
        },
      ],
      truncated: true,
    });
  });

  it('loads global active production lines without inventing a plant scope', async () => {
    const requests: URL[] = [];
    const stub = createStubFetch([
      route('/mdm/production-lines', {
        items: [
          {
            productionLineId: 301,
            plantId: 101,
            lineCode: 'SYN-LINE',
            lineName: 'Synthetic Line',
            lineTypeCode: 'LINE',
            isActive: true,
          },
        ],
        page: { page: 1, size: 200, total: 2 },
      }),
    ]);
    const { result } = renderHookWithProviders(() => useWorkOrderReleaseProductionLines(), {
      fetch: async (request) => {
        requests.push(new URL(request.url));
        return stub(request);
      },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(Array.from(requests[0]?.searchParams.entries() ?? [])).toEqual([
      ['includeInactive', 'false'],
      ['page', '1'],
      ['size', '200'],
    ]);
    expect(requests[0]?.searchParams.has('plantId')).toBe(false);
    expect(result.current.data).toEqual({
      items: [
        {
          productionLineId: 301,
          lineCode: 'SYN-LINE',
          lineName: 'Synthetic Line',
          isActive: true,
        },
      ],
      truncated: true,
    });
  });
});

const status = (
  overrides: Partial<WorkOrderReleaseLookupSnapshot<WorkOrderReleaseStatusValue>> = {},
): WorkOrderReleaseLookupSnapshot<WorkOrderReleaseStatusValue> => ({
  data: {
    items: [
      { code: 'LATER', codeName: 'Later', displayOrder: 30, isActive: true },
      { code: 'RETIRED', codeName: 'Retired', displayOrder: 10, isActive: false },
      { code: 'FIRST', codeName: '   ', displayOrder: 20, isActive: true },
    ],
    truncated: false,
  },
  isError: false,
  isPending: false,
  ...overrides,
});
const lines = (
  overrides: Partial<WorkOrderReleaseLookupSnapshot<WorkOrderReleaseProductionLine>> = {},
): WorkOrderReleaseLookupSnapshot<WorkOrderReleaseProductionLine> => ({
  data: {
    items: [
      { productionLineId: 302, lineCode: 'LINE-B', lineName: 'Line B', isActive: true },
      { productionLineId: 301, lineCode: 'LINE-A', lineName: 'Line A', isActive: false },
    ],
    truncated: false,
  },
  isError: false,
  isPending: false,
  ...overrides,
});

describe('work-order release filter lookup projection', () => {
  it('sorts active statuses and preserves active production-line server order without mutation', () => {
    const statusSource = status();
    const lineSource = lines();
    const snapshot = structuredClone({ statusSource, lineSource });

    expect(toWorkOrderReleaseFilterLookups(statusSource, lineSource)).toEqual({
      statusOptions: [
        { value: 'FIRST', label: 'FIRST' },
        { value: 'LATER', label: 'Later' },
      ],
      productionLineOptions: [{ value: '302', label: 'LINE-B · Line B' }],
      statusUnavailableReason: null,
      productionLineUnavailableReason: null,
    });
    expect({ statusSource, lineSource }).toEqual(snapshot);
  });

  it.each([
    ['loading', { isPending: true }, t.statusLookupLoading],
    ['failed over loading', { isPending: true, isError: true }, t.statusLookupFailed],
    [
      'truncated',
      { data: { items: [] as WorkOrderReleaseStatusValue[], truncated: true } },
      t.statusLookupTruncated,
    ],
  ] as const)('disables an incomplete status lookup for %s', (_name, overrides, reason) => {
    expect(
      toWorkOrderReleaseFilterLookups(status(overrides), lines()).statusUnavailableReason,
    ).toBe(reason);
  });

  it('keeps an empty complete line lookup usable as the all-lines filter', () => {
    const projected = toWorkOrderReleaseFilterLookups(
      status(),
      lines({ data: { items: [], truncated: false } }),
    );

    expect(projected.productionLineOptions).toEqual([]);
    expect(projected.productionLineUnavailableReason).toBeNull();
  });

  it.each([
    ['loading', { isPending: true }, t.productionLineLookupLoading],
    ['failed over loading', { isPending: true, isError: true }, t.productionLineLookupFailed],
    [
      'truncated',
      { data: { items: [] as WorkOrderReleaseProductionLine[], truncated: true } },
      t.productionLineLookupTruncated,
    ],
  ] as const)(
    'disables an incomplete production-line lookup for %s',
    (_name, overrides, reason) => {
      expect(
        toWorkOrderReleaseFilterLookups(status(), lines(overrides)).productionLineUnavailableReason,
      ).toBe(reason);
    },
  );
});
