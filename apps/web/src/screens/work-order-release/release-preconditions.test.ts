import { describe, expect, it } from 'vitest';

import type { WorkOrderValidationReport } from '../work-order/queries';
import type { WorkOrderReleaseFact } from './queries';
import {
  deriveWorkOrderReleasePreconditions,
  WORK_ORDER_RELEASE_LOCATION_KINDS,
} from './release-preconditions';

const releaseFact = (overrides: Partial<WorkOrderReleaseFact> = {}): WorkOrderReleaseFact => ({
  workOrderId: 702,
  workOrderNo: 'SYN-WO-702',
  productionPlanId: 501,
  routingOperationId: 601,
  itemId: 701,
  orderQty: 12.5,
  uomId: 801,
  workOrderTypeCode: 'SYN_NORMAL',
  priorityNo: 2,
  statusCode: 'SYN-CALLER-STATUS',
  productionLineId: null,
  responsibleWorkerId: null,
  plannedStartAt: null,
  plannedEndAt: null,
  plannedEquipmentId: null,
  plannedMoldId: null,
  plannedShiftId: null,
  remarks: null,
  defaultWipLocationId: 911,
  defaultFgLocationId: 912,
  defaultScrapLocationId: 913,
  operationSettingsSnapshot: {},
  releasedAt: null,
  ...overrides,
});

const report = (overrides: Partial<WorkOrderValidationReport> = {}): WorkOrderValidationReport => ({
  passed: true,
  findings: [],
  ...overrides,
});

describe('work-order release preconditions', () => {
  it('exports the exact stable location kinds and isolates no selection from stale inputs', () => {
    expect(WORK_ORDER_RELEASE_LOCATION_KINDS).toEqual(['wip', 'finishedGoods', 'scrap']);
    expect(deriveWorkOrderReleasePreconditions(null, report())).toEqual({
      passesStaticGate: false,
      blockReason: 'noSelection',
      missingDefaultLocations: [],
    });
  });

  it.each([undefined, report({ passed: false })])(
    'gives already released work orders precedence over validation: %j',
    (validation) => {
      expect(
        deriveWorkOrderReleasePreconditions(
          releaseFact({ releasedAt: '2026-08-23T08:30:00+09:00' }),
          validation,
        ),
      ).toMatchObject({ passesStaticGate: false, blockReason: 'alreadyReleased' });
    },
  );

  it('fails closed when the validation report is unavailable', () => {
    expect(deriveWorkOrderReleasePreconditions(releaseFact(), undefined)).toEqual({
      passesStaticGate: false,
      blockReason: 'validationUnavailable',
      missingDefaultLocations: [],
    });
  });

  it.each([
    report({ passed: false }),
    report({
      findings: [{ severity: 'BLOCK', field: null, code: 'SYN-BLOCK', message: 'Synthetic block' }],
    }),
  ])('blocks defensive validation outcomes: %j', (validation) => {
    expect(deriveWorkOrderReleasePreconditions(releaseFact(), validation)).toMatchObject({
      passesStaticGate: false,
      blockReason: 'validationBlocked',
    });
  });

  it.each([
    report(),
    report({
      findings: [{ severity: 'WARN', field: null, code: 'SYN-WARN', message: 'Synthetic warn' }],
    }),
  ])('allows successful validation outcomes: %j', (validation) => {
    expect(deriveWorkOrderReleasePreconditions(releaseFact(), validation)).toEqual({
      passesStaticGate: true,
      blockReason: null,
      missingDefaultLocations: [],
    });
  });

  it.each([
    [911, 912, 913, []],
    [null, 912, 913, ['wip']],
    [911, null, 913, ['finishedGoods']],
    [911, 912, null, ['scrap']],
    [null, null, 913, ['wip', 'finishedGoods']],
    [null, 912, null, ['wip', 'scrap']],
    [911, null, null, ['finishedGoods', 'scrap']],
    [null, null, null, ['wip', 'finishedGoods', 'scrap']],
  ] as const)(
    'keeps missing default locations as ordered warnings: %s, %s, %s',
    (
      defaultWipLocationId,
      defaultFgLocationId,
      defaultScrapLocationId,
      missingDefaultLocations,
    ) => {
      expect(
        deriveWorkOrderReleasePreconditions(
          releaseFact({ defaultWipLocationId, defaultFgLocationId, defaultScrapLocationId }),
          report(),
        ),
      ).toEqual({ passesStaticGate: true, blockReason: null, missingDefaultLocations });
    },
  );

  it('does not mutate selected facts or validation reports', () => {
    const selected = releaseFact({ defaultWipLocationId: null });
    const validation = report({
      findings: [{ severity: 'WARN', field: null, code: 'SYN-WARN', message: 'Synthetic warn' }],
    });
    const originalSelected = structuredClone(selected);
    const originalValidation = structuredClone(validation);

    deriveWorkOrderReleasePreconditions(selected, validation);

    expect(selected).toEqual(originalSelected);
    expect(validation).toEqual(originalValidation);
  });
});
