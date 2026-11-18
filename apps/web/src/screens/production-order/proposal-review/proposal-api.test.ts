import { describe, it, expect } from 'vitest';
import { createProposalReadClient, type ProposalRevalidation } from '@omf-mes/api-client';
import { jsonResponse } from '../../../test/api-harness';
import { previewProposals } from './preview';
import { proposalBody, applyRevalidation, createProposalSession } from './proposal-api';
import type { ReviewProposal } from './model';
import type { LiveCatalog } from './live-data';
const catalog: LiveCatalog = {
  values: new Map(),
  lines: new Map(),
  equipment: new Map(),
  molds: new Map(),
  items: new Map(),
  plants: new Map(),
  uoms: new Map(),
  warehouses: [],
};
const row = (): ReviewProposal => {
  const value = structuredClone(previewProposals[0]!);
  value.live = true;
  value.validated = true;
  value.basis = {
    calendar: 'cal',
    productionOrder: 'po',
    plans: 'plans',
    bom: 'bom',
    routing: 'rt',
    resources: 'res',
  };
  value.plans.forEach((plan) => {
    plan.bomId = 1;
    plan.routingId = 1;
    plan.operations.forEach((op, index) => (op.routingOperationId = index + 10));
  });
  return value;
};
const validation = (value: ReviewProposal): ProposalRevalidation => ({
  productionOrderId: Number(value.id),
  confirmable: true,
  alreadyProcessed: false,
  basis: value.basis!,
  proposalChanges: [],
  errors: [],
  warnings: [],
  corrections: [],
  existingDrafts: [],
  plans: proposalBody(value).plans.map((plan) => ({
    proposalPlanKey: plan.proposalPlanKey,
    planSource: 'NEW',
    planDate: plan.planDate,
    planDateSourceCode: plan.planDateSourceCode,
    plannedQty: plan.plannedQty,
    routingId: plan.routingId,
    bomId: plan.bomId,
    remarks: null,
    splitFromPlanKey: null,
    plannedLineId: plan.plannedLineId,
    planDateCalendar: {
      date: plan.planDate,
      statusCode: 'WORKING',
      sourceCode: 'WEEKLY_POLICY',
      workCalendarId: null,
      calendarCode: null,
      appliedProductionLineId: null,
      reasonCode: null,
      remarks: null,
      startTime: null,
      endTime: null,
      weeklyWorkingDays: 5,
    },
    fgWarehouse: {
      erpStorageLocationCode: 'WH-A',
      erpWarehouseId: 81,
      appliedWarehouseId: 81,
      arrivalLocationId: 61,
      overridden: false,
      differsFromErp: false,
    },
    workOrders: plan.workOrders.map((op, index) => ({
      ...op,
      productionLineId: op.productionLineId ?? null,
      operationSeq: index + 10,
      orderQty: plan.plannedQty,
      predecessors: [],
      plannedStartAt: `${plan.planDate}T09:00:00+07:00`,
      plannedEndAt: `${plan.planDate}T18:00:00+07:00`,
      plannedShiftId: null,
      plannedEquipmentId: null,
      plannedMoldId: null,
      responsibleWorkerId: null,
      defaultWipLocationId: 51,
      defaultFgLocationId: 61,
      defaultScrapLocationId: null,
      equipmentRequired: false,
      moldRequired: false,
      missingFields: [],
    })),
  })),
});
describe('#277 proposal contract integration', () => {
  it('keeps saved identity/version and maps new and split keys within each ERP W/O', () => {
    const value = row();
    const plan = value.plans[0]!;
    plan.source = '작성중 계획';
    plan.productionPlanId = 31;
    plan.savedVersionNo = 7;
    value.existingDraftAction = 'CONTINUE';
    value.plans.push({
      ...structuredClone(plan),
      key: 'local-split',
      source: '신규 제안',
      productionPlanId: undefined,
      splitFromKey: plan.key,
      quantity: '50',
    });
    plan.quantity = '50';
    const body = proposalBody(value);
    expect(body.plans.map((p) => p.proposalPlanKey)).toEqual(['plan-31', 'new-1']);
    expect(body.plans[0]!.savedVersionNo).toBe(7);
    expect(body.plans[1]!.splitFromPlanKey).toBe('plan-31');
    expect(body.plans[1]!.workOrders[0]!.routingOperationId).toBe(10);
  });
  it('preserves explicit USER time/date and omits WIP and scrap input', () => {
    const value = row();
    value.plans[0]!.planDateSourceCode = 'USER';
    value.plans[0]!.operations[0]!.plannedTimeSourceCode = 'USER';
    const plan = proposalBody(value).plans[0]!;
    expect(plan.planDateSourceCode).toBe('USER');
    expect(plan.workOrders[0]!.plannedTimeSourceCode).toBe('USER');
    expect(plan.workOrders[0]!.plannedStartAt).toMatch(/T08:00:00\+07:00$/);
    expect(plan.workOrders[0]).not.toHaveProperty('defaultWipLocationId');
    expect(plan.workOrders[0]).not.toHaveProperty('defaultScrapLocationId');
  });
  it('uses every explicitly reviewed draft version for REPLACE', () => {
    const value = row();
    value.existingDraftAction = 'REPLACE';
    value.existingDrafts = [
      {
        productionPlanId: 1,
        versionNo: 9,
        planNo: 'D1',
        planDate: value.plans[0]!.date,
        plannedQty: 10,
        uomId: 1,
        plannedLineId: null,
        plannedLineCode: null,
        plannedLineName: null,
        statusCode: 'PLANNED',
        createdBy: null,
        createdByName: null,
        createdAt: '2026-11-18T00:00:00Z',
        updatedAt: '2026-11-18T00:00:00Z',
        createdAutomatically: false,
      },
    ];
    expect(proposalBody(value).replacedDrafts).toEqual([{ productionPlanId: 1, versionNo: 9 }]);
  });
  it('shows server-calculated quantities/times and does not silently adopt changed basis', () => {
    const value = row();
    value.plans[0]!.recalculationRequired = true;
    const response = validation(value);
    response.plans[0]!.workOrders[0]!.orderQty = 50;
    const updated = applyRevalidation(value, response, catalog);
    expect(updated.plans[0]!.operations[0]!.quantity).toBe(50);
    expect(updated.plans[0]!.operations[0]!.start).toMatch(/09:00$/);
    expect(updated.plans[0]!.recalculationRequired).toBe(false);
    response.confirmable = false;
    response.basis = { ...response.basis, bom: 'new' };
    response.proposalChanges = [{ basis: 'bom', message: 'BOM 개정 변경' }];
    const conflict = applyRevalidation(value, response, catalog);
    expect(conflict.basis?.bom).toBe('bom');
    expect(conflict.validated).toBe(false);
    expect(conflict.basisChanges).toEqual(['BOM 개정 변경']);
  });
  it('already processed revalidation does not present an old proposal as the saved result', () => {
    const value = row();
    const result = validation(value);
    result.alreadyProcessed = true;
    result.confirmable = false;
    result.plans = [];
    const updated = applyRevalidation(value, result, catalog);
    expect(updated.outcome).toBe('ALREADY_PROCESSED');
    expect(updated.plans).toEqual([]);
    expect(updated.confirmedQty).toBe(value.orderQty);
  });
  it('revalidation only calls the non-saving endpoint', async () => {
    const value = row();
    const requests: Request[] = [];
    const api = createProposalReadClient('http://localhost', async (input) => {
      const request = input as Request;
      requests.push(request);
      return jsonResponse(validation(value));
    });
    const session = createProposalSession(api, catalog);
    expect((await session.revalidate(value)).validated).toBe(true);
    expect(requests).toHaveLength(1);
    expect(requests[0]!.url).toContain(':revalidate-plan-proposal');
    expect(requests[0]!.headers.has('Idempotency-Key')).toBe(false);
  });
  it('a lost response reuses the same idempotency key; a changed body uses a new key', async () => {
    const value = row();
    const keys: string[] = [];
    let fail = true;
    const api = createProposalReadClient('http://localhost', async (input) => {
      const request = input as Request;
      keys.push(request.headers.get('Idempotency-Key')!);
      if (fail) {
        fail = false;
        throw new Error('lost response');
      }
      return jsonResponse({
        productionOrderId: 1,
        outcome: 'CONFIRMED',
        plans: [],
        replacedDrafts: [],
      });
    });
    const session = createProposalSession(api, catalog);
    await expect(session.confirm(value)).rejects.toThrow();
    expect((await session.confirm(value)).outcome).toBe('CONFIRMED');
    expect(keys[0]).toBe(keys[1]);
    value.plans[0]!.quantity = '50';
    await session.confirm(value);
    expect(keys[2]).not.toBe(keys[0]);
  });
  it('unvalidated proposals cannot call confirmation', async () => {
    const value = row();
    value.validated = false;
    let count = 0;
    const session = createProposalSession(
      createProposalReadClient('http://localhost', async () => {
        count++;
        return jsonResponse({});
      }),
      catalog,
    );
    await expect(session.confirm(value)).rejects.toThrow('재검증');
    expect(count).toBe(0);
  });
});
