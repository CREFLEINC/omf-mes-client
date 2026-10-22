import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import type { WorkOrderCloseItemReference } from './candidate-references';
import {
  createWorkOrderCloseCandidateScreenState,
  reduceWorkOrderCloseCandidateScreen,
  toWorkOrderCloseCandidateFilters,
  toWorkOrderCloseCandidateRows,
  type WorkOrderCloseCandidateSnapshot,
  type WorkOrderCloseCandidateScreenState,
} from './candidate-screen-model';
import type { WorkOrderCloseFilterValues } from './filter-bar';
import type { WorkOrderCloseFilterInitialization } from './filter-initialization';
import type { WorkOrderCloseCandidateFact } from './queries';

const t = messages.workOrderClose.candidateReferences;
const emptyFilters: WorkOrderCloseFilterValues = {
  productionOrderId: '',
  plannedStartFrom: '',
  plannedStartTo: '',
  statusCode: '',
  judgmentCode: '',
};
const searchedFilters: WorkOrderCloseFilterValues = {
  productionOrderId: '501',
  plannedStartFrom: '2026-08-23',
  plannedStartTo: '2026-08-24',
  statusCode: 'IN_PROGRESS',
  judgmentCode: '',
};
const initialization = (
  kind: WorkOrderCloseFilterInitialization['kind'],
): WorkOrderCloseFilterInitialization =>
  kind === 'READY'
    ? {
        kind,
        initialFilters: { ...emptyFilters, statusCode: 'IN_PROGRESS,SUSPENDED' },
        canLoadCandidates: true,
        statusUnavailableReason: null,
      }
    : {
        kind,
        initialFilters: { ...emptyFilters, statusCode: '' },
        canLoadCandidates: false,
        statusUnavailableReason: 'SYNTHETIC STATUS UNAVAILABLE',
      };
const readyState = (): WorkOrderCloseCandidateScreenState =>
  createWorkOrderCloseCandidateScreenState(initialization('READY'));
const synchronize = (
  state: WorkOrderCloseCandidateScreenState,
  kind: WorkOrderCloseFilterInitialization['kind'],
): WorkOrderCloseCandidateScreenState =>
  reduceWorkOrderCloseCandidateScreen(state, {
    type: 'SYNCHRONIZE_INITIALIZATION',
    initialization: initialization(kind),
  });
const expectedState = (
  initializationKind: WorkOrderCloseCandidateScreenState['initializationKind'],
  appliedFilters: WorkOrderCloseFilterValues = emptyFilters,
): WorkOrderCloseCandidateScreenState => ({
  initializationKind,
  appliedFilters,
  page: 1,
  selectedWorkOrderId: null,
});
const clearMissing = (
  state: WorkOrderCloseCandidateScreenState,
  snapshot: WorkOrderCloseCandidateSnapshot,
): WorkOrderCloseCandidateScreenState =>
  reduceWorkOrderCloseCandidateScreen(state, {
    type: 'CLEAR_MISSING_SELECTION',
    snapshot,
  });
const fact = (
  workOrderId: number,
  itemId = 910001,
  uomId = 920001,
): WorkOrderCloseCandidateFact => ({
  workOrderId,
  workOrderNo: `SYN-WO-${String(workOrderId)}`,
  productionPlanId: 501,
  routingOperationId: 601,
  itemId,
  orderQty: 12.5,
  uomId,
  workOrderTypeCode: 'SYN-NORMAL',
  priorityNo: 2,
  statusCode: 'IN_PROGRESS',
  productionLineId: null,
  responsibleWorkerId: null,
  plannedStartAt: null,
  plannedEndAt: null,
  plannedEquipmentId: null,
  plannedMoldId: null,
  plannedShiftId: null,
  remarks: null,
  completedAt: null,
  completionVarianceReasonCode: null,
  closedAt: null,
  closeDispositionCode: null,
  closedWorkerNo: null,
  closedWorkerName: null,
  closedByUserName: null,
  closeJudgmentCode: null,
  voidedLotCount: null,
  progress: null,
  defaultWipLocationId: null,
  defaultFgLocationId: null,
  defaultScrapLocationId: null,
});

describe('work-order close candidate screen state', () => {
  it('fails closed, preserves READY user state, and reinitializes after a blocked lookup', () => {
    const checking = initialization('CHECKING');
    const checkingSnapshot = structuredClone(checking);
    let state = createWorkOrderCloseCandidateScreenState(checking);
    expect(state).toEqual(expectedState('CHECKING'));
    expect(toWorkOrderCloseCandidateFilters(state).statusCode).toBeNull();
    state = synchronize(state, 'READY');
    state = reduceWorkOrderCloseCandidateScreen(state, {
      type: 'SEARCH',
      filters: searchedFilters,
    });
    state = reduceWorkOrderCloseCandidateScreen(state, { type: 'CHANGE_PAGE', page: 3 });
    state = reduceWorkOrderCloseCandidateScreen(state, { type: 'SELECT', workOrderId: 701 });
    expect(synchronize(state, 'READY')).toBe(state);
    state = synchronize(state, 'UNAVAILABLE');
    expect(state).toEqual(expectedState('UNAVAILABLE'));
    state = synchronize(state, 'READY');
    expect(state).toEqual(
      expectedState('READY', { ...emptyFilters, statusCode: 'IN_PROGRESS,SUSPENDED' }),
    );
    expect(checking).toEqual(checkingSnapshot);
  });
  it('owns SEARCH RESET CHANGE_PAGE and SELECT lifetimes without mutating filters', () => {
    const input = { ...searchedFilters };
    let state = reduceWorkOrderCloseCandidateScreen(readyState(), {
      type: 'SEARCH',
      filters: input,
    });
    expect(state).toMatchObject({
      appliedFilters: searchedFilters,
      page: 1,
      selectedWorkOrderId: null,
    });
    state = reduceWorkOrderCloseCandidateScreen(state, { type: 'SELECT', workOrderId: 701 });
    expect(state.selectedWorkOrderId).toBe(701);
    state = reduceWorkOrderCloseCandidateScreen(state, { type: 'CHANGE_PAGE', page: 4 });
    expect(state).toMatchObject({
      appliedFilters: searchedFilters,
      page: 4,
      selectedWorkOrderId: null,
    });
    state = reduceWorkOrderCloseCandidateScreen(state, { type: 'SELECT', workOrderId: 702 });
    state = reduceWorkOrderCloseCandidateScreen(state, { type: 'RESET' });
    expect(state).toEqual(readyState());
    expect(input).toEqual(searchedFilters);
  });
  it('clears only the selection while preserving filters and page', () => {
    const selected = reduceWorkOrderCloseCandidateScreen(
      { ...readyState(), appliedFilters: searchedFilters, page: 4 },
      { type: 'SELECT', workOrderId: 701 },
    );
    const cleared = reduceWorkOrderCloseCandidateScreen(selected, { type: 'CLEAR_SELECTION' });
    expect(cleared).toEqual({ ...selected, selectedWorkOrderId: null });
    expect(cleared.appliedFilters).toBe(selected.appliedFilters);
    expect(reduceWorkOrderCloseCandidateScreen(cleared, { type: 'CLEAR_SELECTION' })).toBe(cleared);
  });
  it('preserves pending failed and absent selection and clears only a settled missing page', () => {
    const candidateIds = [701, 702];
    const selected = reduceWorkOrderCloseCandidateScreen(readyState(), {
      type: 'SELECT',
      workOrderId: 701,
    });
    (['PENDING', 'FAILED', 'ABSENT'] as const).forEach((kind) =>
      expect(clearMissing(selected, { kind })).toBe(selected),
    );
    expect(clearMissing(selected, { kind: 'SETTLED', candidateIds }).selectedWorkOrderId).toBe(701);
    expect(
      clearMissing(selected, { kind: 'SETTLED', candidateIds: [702] }).selectedWorkOrderId,
    ).toBeNull();
    expect(
      clearMissing(selected, { kind: 'SETTLED', candidateIds: [] }).selectedWorkOrderId,
    ).toBeNull();
    expect(candidateIds).toEqual([701, 702]);
  });
});
describe('work-order close candidate projections', () => {
  it('projects valid filters and preserves blank optional fields as null', () => {
    const state = { ...readyState(), appliedFilters: { ...searchedFilters }, page: 3 };
    const snapshot = structuredClone(state);
    expect(toWorkOrderCloseCandidateFilters(state)).toEqual({
      statusCode: 'IN_PROGRESS',
      completionJudgmentCode: null,
      productionOrderId: 501,
      plannedStartFrom: '2026-08-23',
      plannedStartTo: '2026-08-24',
      page: 3,
    });
    expect(
      toWorkOrderCloseCandidateFilters({
        ...state,
        appliedFilters: { ...emptyFilters, statusCode: 'IN_PROGRESS,SUSPENDED' },
      }),
    ).toMatchObject({ productionOrderId: null, plannedStartFrom: null, plannedStartTo: null });
    expect(state).toEqual(snapshot);
  });
  it.each([
    ['blocked lookup', { initializationKind: 'UNAVAILABLE' }],
    ['empty status', { appliedFilters: { ...searchedFilters, statusCode: '' } }],
    ['non-numeric P/O', { appliedFilters: { ...searchedFilters, productionOrderId: 'SYN-PO' } }],
    ['fractional P/O', { appliedFilters: { ...searchedFilters, productionOrderId: '1.5' } }],
    ['zero page', { page: 0 }],
    ['fractional page', { page: 1.5 }],
  ] as const)('fails closed for %s', (_name, overrides) => {
    const state = { ...readyState(), ...overrides } as WorkOrderCloseCandidateScreenState;
    expect(toWorkOrderCloseCandidateFilters(state).statusCode).toBeNull();
  });

  it('preserves candidate order and renders every reference state without raw IDs or mutation', () => {
    const candidates = [fact(702, 910002, 920002), fact(701)];
    const namedReferences: WorkOrderCloseItemReference[] = [
      { itemId: 910001, status: 'named', label: 'SYN-ITEM · Synthetic Item' },
      { itemId: 910002, status: 'named', label: 'SYN-ITEM-2 · Synthetic Item 2' },
    ];
    const source = {
      entries: [
        { uomId: 920001, label: 'SYN-EA · Synthetic Each' },
        { uomId: 920002, label: 'SYN-KG · Synthetic Kilogram' },
      ],
      isLoading: false,
      isError: false,
      truncated: false,
    };
    const snapshot = structuredClone({ candidates, namedReferences, source });
    expect(toWorkOrderCloseCandidateRows(candidates, namedReferences, source)).toEqual([
      {
        workOrderId: 702,
        workOrderNo: 'SYN-WO-702',
        itemLabel: 'SYN-ITEM-2 · Synthetic Item 2',
        statusLabel: 'IN_PROGRESS',
        quantityLabel: '12.5 SYN-KG · Synthetic Kilogram',
        goodQtyLabel: '—',
        achievementLabel: '—',
        judgmentLabel: '—',
      },
      {
        workOrderId: 701,
        workOrderNo: 'SYN-WO-701',
        itemLabel: 'SYN-ITEM · Synthetic Item',
        statusLabel: 'IN_PROGRESS',
        quantityLabel: '12.5 SYN-EA · Synthetic Each',
        goodQtyLabel: '—',
        achievementLabel: '—',
        judgmentLabel: '—',
      },
    ]);
    expect({ candidates, namedReferences, source }).toEqual(snapshot);
  });

  it.each([
    ['loading', 'loading', { isLoading: true }, t.item.loading, t.uom.loading],
    ['unknown', 'unknown', {}, t.item.unknown, t.uom.unknown],
    ['failed', 'failed', { isError: true }, t.item.failed, t.uom.failed],
    ['truncated', null, { truncated: true }, t.item.unknown, t.uom.truncated],
  ] as const)(
    'renders %s reference states without ID fallbacks',
    (_name, itemStatus, overrides, itemLabel, uomLabel) => {
      const itemReferences: WorkOrderCloseItemReference[] =
        itemStatus === null ? [] : [{ itemId: 910001, status: itemStatus, label: null }];
      const source = {
        entries: [],
        isLoading: false,
        isError: false,
        truncated: false,
        ...overrides,
      };
      const rows = toWorkOrderCloseCandidateRows([fact(701)], itemReferences, source);
      expect(rows).toEqual([
        {
          workOrderId: 701,
          workOrderNo: 'SYN-WO-701',
          itemLabel,
          statusLabel: 'IN_PROGRESS',
          quantityLabel: `12.5 ${uomLabel}`,
          goodQtyLabel: '—',
          achievementLabel: '—',
          judgmentLabel: '—',
        },
      ]);
      expect(JSON.stringify(rows)).not.toMatch(/910001|920001/);
    },
  );

  it('목록 줄에 상태 이름·양품·달성률·판정을 한 칸에 하나씩 싣는다', () => {
    const rows = toWorkOrderCloseCandidateRows(
      [
        {
          ...fact(701),
          progress: { goodQty: 4, achievementRate: 0.4, completionJudgmentCode: 'UNDER' },
        },
      ],
      [{ itemId: 910001, status: 'named', label: 'SYN-ITEM' }],
      {
        entries: [{ uomId: 920001, label: 'EA' }],
        isLoading: false,
        isError: false,
        truncated: false,
      },
      (code) => (code === 'IN_PROGRESS' ? '진행' : code),
    );

    expect(rows[0]).toMatchObject({
      statusLabel: '진행',
      goodQtyLabel: '4 EA',
      achievementLabel: '40%',
      judgmentLabel: '미달',
    });
  });

  it('판정은 끝나지 않은 상태로 볼 때만 서버로 보낸다 — 마감·취소가 섞이면 서버가 거부한다', () => {
    const state = (statusCode: string) => ({
      ...readyState(),
      appliedFilters: { ...searchedFilters, statusCode, judgmentCode: 'UNDER' },
    });

    expect(
      toWorkOrderCloseCandidateFilters(state('IN_PROGRESS,SUSPENDED')).completionJudgmentCode,
    ).toBe('UNDER');
    expect(toWorkOrderCloseCandidateFilters(state('CLOSED')).completionJudgmentCode).toBeNull();
  });
});
