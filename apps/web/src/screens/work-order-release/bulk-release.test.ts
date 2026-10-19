import { act, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { jsonResponse, renderHookWithProviders, type StubFetch } from '../../test/api-harness';
import { missingReleaseSetup, useBulkRelease } from './bulk-release';

const ready = {
  productionLineId: 21,
  defaultWipLocationId: 31,
  defaultFgLocationId: 32,
  defaultScrapLocationId: 33,
};

type Setup = { [K in keyof typeof ready]?: number | null };

const workOrder = (workOrderId: number, itemId: number, setup: Setup = ready) => ({
  workOrderId,
  workOrderNo: `SYN-WO-${workOrderId}`,
  productionPlanId: 501,
  routingOperationId: 601,
  itemId,
  orderQty: 1000,
  uomId: 801,
  workOrderTypeCode: 'NORMAL',
  priorityNo: 100,
  statusCode: 'PLANNED',
  responsibleWorkerId: null,
  plannedStartAt: null,
  plannedEndAt: null,
  plannedEquipmentId: null,
  plannedMoldId: null,
  plannedShiftId: null,
  remarks: null,
  operationSettingsSnapshot: null,
  releasedAt: null,
  productionLineId: null,
  defaultWipLocationId: null,
  defaultFgLocationId: null,
  defaultScrapLocationId: null,
  ...setup,
});

const item = (itemId: number, defaultProductionLotSize: number | null, baseUomId = 801) => ({
  item: {
    itemId,
    itemCode: `ITEM-${itemId}`,
    itemName: '합성 품목',
    baseUomId,
    defaultProductionLotSize,
  },
});

describe('missingReleaseSetup', () => {
  it('라인과 기본 위치 셋이 다 있어야 배포 전제를 갖춘다', () => {
    expect(missingReleaseSetup(workOrder(1, 1) as never)).toBe(false);
    expect(missingReleaseSetup(workOrder(1, 1, { defaultScrapLocationId: null }) as never)).toBe(
      true,
    );
  });
});

describe('useBulkRelease', () => {
  it('건마다 최신 ETag 와 품목 기본 LOT 크기로 배포하고, 전제가 빠지거나 기본값이 없으면 건너뛴다', async () => {
    const releases: { workOrderId: string; ifMatch: string | null; body: unknown }[] = [];
    const details: Record<string, object> = {
      '11': workOrder(11, 701),
      '12': workOrder(12, 701, { productionLineId: null }),
      '13': workOrder(13, 702),
      '14': workOrder(14, 703),
    };
    const items: Record<string, object> = {
      '701': item(701, 500),
      '702': item(702, null),
      '703': item(703, 500, 999),
    };
    const fetch: StubFetch = async (request) => {
      const path = new URL(request.url).pathname;
      const release = /^\/production\/work-orders\/(\d+):release$/.exec(path);
      if (request.method === 'POST' && release !== null) {
        releases.push({
          workOrderId: release[1] ?? '',
          ifMatch: request.headers.get('If-Match'),
          body: await request.json(),
        });
        return jsonResponse(details[release[1] ?? '']);
      }
      const detail = /^\/production\/work-orders\/(\d+)$/.exec(path);
      if (detail !== null)
        return jsonResponse(details[detail[1] ?? ''], { headers: { ETag: '7' } });
      const itemMatch = /^\/mdm\/items\/(\d+)$/.exec(path);
      if (itemMatch !== null) return jsonResponse(items[itemMatch[1] ?? '']);
      throw new Error(`unexpected ${request.method} ${path}`);
    };
    const { result } = renderHookWithProviders(() => useBulkRelease(), { fetch });

    await act(() =>
      result.current.run(
        [11, 12, 13, 14].map((id) => ({ workOrderId: id, workOrderNo: `SYN-WO-${id}` })),
      ),
    );

    await waitFor(() => expect(result.current.outcomes).not.toBeNull());
    expect(result.current.outcomes?.map((outcome) => outcome.status)).toEqual([
      'released',
      'skipped',
      'skipped',
      'skipped',
    ]);
    expect(releases).toEqual([{ workOrderId: '11', ifMatch: '7', body: { lotSize: 500 } }]);
  });
});
