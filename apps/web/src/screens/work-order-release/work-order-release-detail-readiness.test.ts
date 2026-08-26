import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import type { WorkOrderValidationReport } from '../work-order/queries';
import {
  toWorkOrderReleaseDetailState,
  toWorkOrderReleaseReadiness,
  type WorkOrderReleaseDetailState,
} from './work-order-release-detail-readiness';
import type { WorkOrderReleaseFact } from './queries';

const t = messages.workOrderRelease;
const detail = (overrides: Partial<WorkOrderReleaseFact> = {}): WorkOrderReleaseFact => ({
  workOrderId: 701,
  workOrderNo: 'SYN-WO-701',
  productionPlanId: 501,
  routingOperationId: 601,
  itemId: 910001,
  orderQty: 12.5,
  uomId: 920001,
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
  ...overrides,
});
const report = (overrides: Partial<WorkOrderValidationReport> = {}): WorkOrderValidationReport => ({
  passed: true,
  findings: [],
  ...overrides,
});
const validation = (
  overrides: Partial<Parameters<typeof toWorkOrderReleaseReadiness>[1]> = {},
): Parameters<typeof toWorkOrderReleaseReadiness>[1] => ({
  isFetching: false,
  isError: false,
  report: report(),
  ...overrides,
});
const ready = (value = detail()): WorkOrderReleaseDetailState => ({ kind: 'READY', detail: value });
const body = { lotSize: 5, handoverNote: 'Synthetic handover' };

describe('work-order release detail state', () => {
  it.each([
    [null, true, true, detail(), { kind: 'NOT_SELECTED' }],
    [701, true, true, detail(), { kind: 'CHECKING' }],
    [701, false, true, detail(), { kind: 'UNAVAILABLE' }],
    [701, false, false, undefined, { kind: 'UNAVAILABLE' }],
    [701, false, false, detail({ workOrderId: 702 }), { kind: 'UNAVAILABLE' }],
  ] as const)(
    'fails closed for selection=%s fetching=%s error=%s',
    (selectedWorkOrderId, isFetching, isError, value, expected) => {
      expect(
        toWorkOrderReleaseDetailState({
          selectedWorkOrderId,
          isFetching,
          isError,
          detail: value,
        }),
      ).toEqual(expected);
    },
  );

  it('accepts only an exact settled selected detail without mutation', () => {
    const value = detail();
    const snapshot = structuredClone(value);

    expect(
      toWorkOrderReleaseDetailState({
        selectedWorkOrderId: 701,
        isFetching: false,
        isError: false,
        detail: value,
      }),
    ).toEqual({ kind: 'READY', detail: value });
    expect(value).toEqual(snapshot);
  });

  it('locks release during a normal background detail refetch with exact cached data', () => {
    const state = toWorkOrderReleaseDetailState({
      selectedWorkOrderId: 701,
      isFetching: true,
      isError: false,
      detail: detail(),
    });

    expect(state).toEqual({ kind: 'CHECKING' });
    expect(toWorkOrderReleaseReadiness(state, validation(), body)).toMatchObject({
      inputLockedReason: t.readiness.detailLoading,
      releaseDisabledReason: t.readiness.detailLoading,
      releaseBody: null,
    });
  });
});

describe('work-order release readiness', () => {
  it.each([
    ['NOT_SELECTED', null],
    ['CHECKING', t.readiness.detailLoading],
    ['UNAVAILABLE', t.readiness.detailUnavailable],
  ] as const)('blocks a %s detail state without stale facts', (kind, reason) => {
    const result = toWorkOrderReleaseReadiness({ kind }, validation(), body);

    expect(result).toMatchObject({
      detail: null,
      inputLockedReason: reason,
      releaseDisabledReason: reason,
      releaseBody: null,
      preconditions: { passesStaticGate: false, blockReason: 'noSelection' },
    });
  });

  it.each([
    ['validation loading', validation({ isFetching: true }), t.status.validationUnavailable],
    ['validation error', validation({ isError: true }), t.status.validationUnavailable],
    ['missing validation', validation({ report: undefined }), t.status.validationUnavailable],
    [
      'validation block',
      validation({
        report: report({
          passed: false,
          findings: [{ severity: 'BLOCK', field: null, code: 'SYN-BLOCK', message: 'blocked' }],
        }),
      }),
      t.status.validationBlocked,
    ],
  ] as const)('locks input and release for %s', (_name, snapshot, reason) => {
    const result = toWorkOrderReleaseReadiness(ready(), snapshot, body);

    expect(result.inputLockedReason).toBe(reason);
    expect(result.releaseDisabledReason).toBe(reason);
    expect(result.releaseBody).toBeNull();
  });

  it('gives already-released state precedence over validation and body', () => {
    const result = toWorkOrderReleaseReadiness(
      ready(detail({ releasedAt: '2026-08-26T09:00:00+09:00' })),
      validation({ isError: true }),
      body,
    );

    expect(result.inputLockedReason).toBe(t.status.alreadyReleased);
    expect(result.releaseDisabledReason).toBe(t.status.alreadyReleased);
    expect(result.releaseBody).toBeNull();
  });

  it('keeps valid WARN and missing-location warnings non-blocking but requires a valid body', () => {
    const selected = detail({ defaultWipLocationId: null });
    const withWarning = validation({
      report: report({
        findings: [{ severity: 'WARN', field: null, code: 'SYN-WARN', message: 'warning' }],
      }),
    });
    const waiting = toWorkOrderReleaseReadiness(ready(selected), withWarning, null);
    const allowed = toWorkOrderReleaseReadiness(ready(selected), withWarning, body);

    expect(waiting).toMatchObject({
      inputLockedReason: null,
      releaseDisabledReason: t.readiness.inputRequired,
      releaseBody: null,
      preconditions: { passesStaticGate: true, missingDefaultLocations: ['wip'] },
    });
    expect(allowed).toMatchObject({
      detail: selected,
      inputLockedReason: null,
      releaseDisabledReason: null,
      releaseBody: body,
    });
  });
});
