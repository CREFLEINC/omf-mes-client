import { describe, expect, it } from 'vitest';

import {
  buildProductionPlanCreate,
  summarizeProductionPlanQuantities,
  validateProductionPlanDraft,
  type ProductionPlanDraft,
} from './editor-model';

const validDraft = (overrides: Partial<ProductionPlanDraft> = {}): ProductionPlanDraft => ({
  planDate: '2026-08-22',
  plannedQty: '12.5',
  bomId: '9001',
  routingId: '9101',
  plannedLineId: '',
  remarks: '',
  ...overrides,
});

describe('production-plan editor model', () => {
  it('reports only required errors for an empty draft', () => {
    expect(
      validateProductionPlanDraft({
        planDate: ' ',
        plannedQty: '',
        bomId: '\t',
        routingId: '',
        plannedLineId: '',
        remarks: ' ',
      }),
    ).toEqual({
      planDate: 'REQUIRED',
      plannedQty: 'REQUIRED',
      bomId: 'REQUIRED',
      routingId: 'REQUIRED',
    });
  });

  it.each([
    ['calendar rollover', { planDate: '2026-02-30' }, { planDate: 'INVALID_DATE' }],
    ['non-finite quantity', { plannedQty: 'Infinity' }, { plannedQty: 'INVALID_QUANTITY' }],
    ['non-positive quantity', { plannedQty: '0' }, { plannedQty: 'INVALID_QUANTITY' }],
    ['invalid BOM ID', { bomId: '0' }, { bomId: 'INVALID_SELECTION' }],
    ['invalid routing ID', { routingId: '9007199254740992' }, { routingId: 'INVALID_SELECTION' }],
    ['invalid optional line ID', { plannedLineId: '-1' }, { plannedLineId: 'INVALID_SELECTION' }],
  ])('rejects %s', (_name, draft, errors) => {
    expect(validateProductionPlanDraft(validDraft(draft))).toEqual(errors);
  });

  it('builds the exact generated create body from a valid complete draft', () => {
    expect(
      buildProductionPlanCreate(
        validDraft({
          planDate: ' 2026-08-22 ',
          plannedQty: '12.5',
          bomId: '9001',
          routingId: '9101',
          plannedLineId: '9201',
          remarks: ' Preserve this text ',
        }),
        { productionOrderId: 8001, uomId: 8002 },
      ),
    ).toEqual({
      ok: true,
      body: {
        productionOrderId: 8001,
        planDate: '2026-08-22',
        plannedQty: 12.5,
        uomId: 8002,
        bomId: 9001,
        routingId: 9101,
        plannedLineId: 9201,
        remarks: ' Preserve this text ',
      },
    });
  });

  it('omits optional create fields and returns errors instead of an invalid partial body', () => {
    expect(
      buildProductionPlanCreate(validDraft(), { productionOrderId: 8001, uomId: 8002 }),
    ).toEqual({
      ok: true,
      body: {
        productionOrderId: 8001,
        planDate: '2026-08-22',
        plannedQty: 12.5,
        uomId: 8002,
        bomId: 9001,
        routingId: 9101,
      },
    });
    expect(
      buildProductionPlanCreate(validDraft({ plannedQty: '0' }), {
        productionOrderId: 8001,
        uomId: 8002,
      }),
    ).toEqual({ ok: false, errors: { plannedQty: 'INVALID_QUANTITY' } });
  });

  it('summarizes empty, under, matched, and over plan quantities', () => {
    expect(summarizeProductionPlanQuantities(10, [])).toEqual({
      planCount: 0,
      totalPlannedQty: 0,
      remainingQty: 10,
      relation: 'empty',
    });
    expect(summarizeProductionPlanQuantities(10, [3, 2])).toEqual({
      planCount: 2,
      totalPlannedQty: 5,
      remainingQty: 5,
      relation: 'under',
    });
    expect(summarizeProductionPlanQuantities(10, [4, 6])).toEqual({
      planCount: 2,
      totalPlannedQty: 10,
      remainingQty: 0,
      relation: 'matched',
    });
    expect(summarizeProductionPlanQuantities(10, [8, 3])).toEqual({
      planCount: 2,
      totalPlannedQty: 11,
      remainingQty: -1,
      relation: 'over',
    });
  });

  it('matches floating quantities within machine precision and throws for invalid summary input', () => {
    expect(summarizeProductionPlanQuantities(0.3, [0.1, 0.2])).toEqual({
      planCount: 2,
      totalPlannedQty: 0.30000000000000004,
      remainingQty: 0,
      relation: 'matched',
    });
    expect(() => summarizeProductionPlanQuantities(Number.NaN, [])).toThrow(Error);
    expect(() => summarizeProductionPlanQuantities(1, [-1])).toThrow(Error);
  });
});
