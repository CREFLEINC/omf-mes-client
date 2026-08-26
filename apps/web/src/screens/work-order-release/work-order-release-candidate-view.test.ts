import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import type { ProductionOrderItemName } from '../production-order/item-lookups';
import type { ReferenceSource } from '../production-order/reference-lookups';
import {
  toWorkOrderReleaseCandidateRows,
  toWorkOrderReleaseCandidateSnapshot,
} from './work-order-release-candidate-view';
import type { WorkOrderReleaseFact } from './queries';

const t = messages.productionOrder.values;
const fact = (workOrderId: number, itemId = 910001, uomId = 920001): WorkOrderReleaseFact => ({
  workOrderId,
  workOrderNo: `SYN-WO-${String(workOrderId)}`,
  productionPlanId: 501,
  routingOperationId: 601,
  itemId,
  orderQty: 12.5,
  uomId,
  workOrderTypeCode: 'SYN-NORMAL',
  priorityNo: 2,
  statusCode: 'SYN-READY',
  productionLineId: null,
  responsibleWorkerId: null,
  plannedStartAt: null,
  plannedEndAt: null,
  plannedEquipmentId: null,
  plannedMoldId: null,
  plannedShiftId: null,
  remarks: null,
  defaultWipLocationId: 1,
  defaultFgLocationId: 2,
  defaultScrapLocationId: 3,
  operationSettingsSnapshot: null,
  releasedAt: null,
});
const uoms = (overrides: Partial<ReferenceSource> = {}): ReferenceSource => ({
  entries: [{ value: '920001', label: 'SYN-EA · Synthetic Each' }],
  isLoading: false,
  isError: false,
  truncated: false,
  ...overrides,
});

describe('work-order release candidate snapshot', () => {
  it.each([
    [
      'disabled',
      { enabled: false, isFetching: true, isError: true, candidateIds: [701] },
      { kind: 'ABSENT' },
    ],
    [
      'fetching',
      { enabled: true, isFetching: true, isError: true, candidateIds: [701] },
      { kind: 'PENDING' },
    ],
    [
      'failed',
      { enabled: true, isFetching: false, isError: true, candidateIds: [701] },
      { kind: 'FAILED' },
    ],
    [
      'missing data',
      { enabled: true, isFetching: false, isError: false, candidateIds: undefined },
      { kind: 'ABSENT' },
    ],
    [
      'settled empty',
      { enabled: true, isFetching: false, isError: false, candidateIds: [] },
      { kind: 'SETTLED', candidateIds: [] },
    ],
  ] as const)('projects %s with fail-closed priority', (_name, source, expected) => {
    expect(toWorkOrderReleaseCandidateSnapshot(source)).toEqual(expected);
  });

  it('preserves settled candidate IDs and server order without mutating the input', () => {
    const candidateIds = [702, 701];

    expect(
      toWorkOrderReleaseCandidateSnapshot({
        enabled: true,
        isFetching: false,
        isError: false,
        candidateIds,
      }),
    ).toEqual({ kind: 'SETTLED', candidateIds: [702, 701] });
    expect(candidateIds).toEqual([702, 701]);
  });
});

describe('work-order release candidate rows', () => {
  it('preserves server order and resolves exact item and UOM labels without mutation', () => {
    const candidates = [fact(702, 910002, 920002), fact(701)];
    const itemNames: ProductionOrderItemName[] = [
      { itemId: 910001, status: 'named', label: 'SYN-ITEM-A · Synthetic Item A' },
      { itemId: 910002, status: 'named', label: 'SYN-ITEM-B · Synthetic Item B' },
    ];
    const source = uoms({
      entries: [
        { value: '920001', label: 'SYN-EA · Synthetic Each' },
        { value: '920002', label: 'SYN-KG · Synthetic Kilogram' },
      ],
    });
    const snapshot = structuredClone({ candidates, itemNames, source });

    expect(toWorkOrderReleaseCandidateRows(candidates, itemNames, source)).toEqual([
      {
        workOrderId: 702,
        workOrderNo: 'SYN-WO-702',
        itemLabel: 'SYN-ITEM-B · Synthetic Item B',
        quantityLabel: '12.5 SYN-KG · Synthetic Kilogram',
      },
      {
        workOrderId: 701,
        workOrderNo: 'SYN-WO-701',
        itemLabel: 'SYN-ITEM-A · Synthetic Item A',
        quantityLabel: '12.5 SYN-EA · Synthetic Each',
      },
    ]);
    expect({ candidates, itemNames, source }).toEqual(snapshot);
  });

  it.each([
    [
      'loading',
      { status: 'loading', label: null },
      { isLoading: true },
      t.itemLoading,
      t.referenceLoading,
    ],
    ['unknown', { status: 'unknown', label: null }, {}, t.itemUnknown, t.referenceUnknown],
    [
      'failed',
      { status: 'failed', label: null },
      { isError: true },
      t.itemFailed,
      t.referenceFailed,
    ],
    ['truncated', undefined, { truncated: true }, t.itemUnknown, t.referenceTruncated],
  ] as const)(
    'renders %s references distinctly without raw ID fallbacks',
    (_name, itemState, uomState, itemLabel, uomLabel) => {
      const itemNames: ProductionOrderItemName[] =
        itemState === undefined ? [] : [{ itemId: 910001, ...itemState }];
      const rows = toWorkOrderReleaseCandidateRows(
        [fact(701)],
        itemNames,
        uoms({ entries: [], ...uomState }),
      );

      expect(rows).toEqual([
        {
          workOrderId: 701,
          workOrderNo: 'SYN-WO-701',
          itemLabel,
          quantityLabel: `12.5 ${uomLabel}`,
        },
      ]);
      expect(JSON.stringify(rows)).not.toMatch(/910001|920001/);
    },
  );
});
