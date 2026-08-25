import { describe, expect, it } from 'vitest';

import type { ProductionPlanEditorStateRow } from './editor-state';
import {
  appendProductionPlanRow,
  changeProductionPlanRow,
  draftFromProductionPlan,
  markProductionPlanRowPending,
  prepareProductionPlanRow,
  reconcileProductionPlanRows,
  removeProductionPlanRow,
  setProductionPlanRowErrors,
  settleProductionPlanRow,
} from './editor-state';
import type { ProductionPlanFact } from './types';

const plan = (
  productionPlanId: number,
  overrides: Partial<ProductionPlanFact> = {},
): ProductionPlanFact => ({
  productionPlanId,
  productionOrderId: 5001,
  planNo: `PLAN-${String(productionPlanId)}`,
  planDate: '2026-08-26',
  plannedQty: 100,
  uomId: 6001,
  bomId: 7001,
  routingId: 8001,
  plannedLineId: 9001,
  statusCode: 'DRAFT',
  confirmedAt: null,
  remarks: '기준 비고',
  ...overrides,
});

const existingRow = (fact = plan(101)): ProductionPlanEditorStateRow =>
  reconcileProductionPlanRows([], [fact])[0] as ProductionPlanEditorStateRow;

describe('production plan editor state', () => {
  it('maps nullable server facts to editable strings without inventing values', () => {
    expect(draftFromProductionPlan(plan(101, { plannedLineId: null, remarks: null }))).toEqual({
      planDate: '2026-08-26',
      plannedQty: '100',
      bomId: '7001',
      routingId: '8001',
      plannedLineId: '',
      remarks: '',
    });
  });

  it('preserves dirty and new drafts on refetch but accepts a newly confirmed server fact', () => {
    const dirty = changeProductionPlanRow(
      [existingRow()],
      'plan-101',
      'plannedQty',
      '75',
    )[0] as ProductionPlanEditorStateRow;
    const withNew = appendProductionPlanRow([dirty], 'new-a', {
      planDate: '2026-08-27',
      plannedQty: '25',
      bomId: '7001',
      routingId: '8001',
    });
    const preserved = reconcileProductionPlanRows(withNew, [plan(101, { plannedQty: 90 })]);
    expect(preserved.map((row) => row.draft.plannedQty)).toEqual(['75', '25']);
    expect(new Set(preserved.map((row) => row.displayNo)).size).toBe(2);

    const confirmed = reconcileProductionPlanRows(preserved, [
      plan(101, { plannedQty: 90, confirmedAt: '2026-08-26T09:00:00+09:00' }),
    ]);
    expect(confirmed[0]).toMatchObject({
      confirmed: true,
      isDirty: false,
      draft: { plannedQty: '90' },
    });
  });

  it('clears the edited field error and marks only the target row dirty or pending', () => {
    const first = { ...existingRow(), errors: { plannedQty: 'INVALID_QUANTITY' as const } };
    const second = existingRow(plan(102));
    const changed = changeProductionPlanRow([first, second], first.key, 'plannedQty', '80');
    expect(changed[0]).toMatchObject({ isDirty: true, errors: {}, draft: { plannedQty: '80' } });
    expect(changed[1]).toBe(second);
    expect(markProductionPlanRowPending(changed, second.key, true)[1]?.isPending).toBe(true);
    expect(
      setProductionPlanRowErrors(changed, second.key, { bomId: 'REQUIRED' })[1]?.errors,
    ).toEqual({
      bomId: 'REQUIRED',
    });
    expect(removeProductionPlanRow(changed, first.key)).toEqual([second]);
  });

  it('baseline 값으로 되돌린 행은 dirty를 해제하고 다음 서버 사실을 수용한다', () => {
    const original = existingRow();
    const changed = changeProductionPlanRow([original], original.key, 'plannedQty', '75');
    const reverted = changeProductionPlanRow(changed, original.key, 'plannedQty', '100');
    expect(reverted[0]?.isDirty).toBe(false);
    expect(reconcileProductionPlanRows(reverted, [plan(101, { plannedQty: 90 })])[0]).toMatchObject(
      {
        isDirty: false,
        draft: { plannedQty: '90' },
      },
    );
  });

  it('pending 초안은 미확정 재조회에서 보존하고 서버 확정 시 폐기한다', () => {
    const original = existingRow();
    const pending = markProductionPlanRowPending(
      [{ ...original, draft: { ...original.draft, plannedQty: '75' }, isDirty: false }],
      original.key,
      true,
    );
    expect(reconcileProductionPlanRows(pending, [plan(101, { plannedQty: 90 })])[0]).toMatchObject({
      isPending: true,
      draft: { plannedQty: '75' },
    });
    expect(
      reconcileProductionPlanRows(pending, [
        plan(101, { plannedQty: 90, confirmedAt: '2026-08-26T09:00:00+09:00' }),
      ])[0],
    ).toMatchObject({ confirmed: true, isPending: false, draft: { plannedQty: '90' } });
  });

  it('prepares create, changed update, unchanged no-op, and invalid commands', () => {
    const created = appendProductionPlanRow([], 'new-a', {
      planDate: '2026-08-27',
      plannedQty: '25',
      bomId: '7001',
      routingId: '8001',
    })[0] as ProductionPlanEditorStateRow;
    expect(
      prepareProductionPlanRow(created, { productionOrderId: 5001, uomId: 6001 }),
    ).toMatchObject({
      ok: true,
      command: { kind: 'create', body: { plannedQty: 25 } },
    });
    const existing = existingRow();
    expect(prepareProductionPlanRow(existing, { productionOrderId: 5001, uomId: 6001 })).toEqual({
      ok: true,
      command: { kind: 'none' },
    });
    const cleared = changeProductionPlanRow(
      [existing],
      existing.key,
      'plannedLineId',
      '',
    )[0] as ProductionPlanEditorStateRow;
    expect(
      prepareProductionPlanRow(cleared, { productionOrderId: 5001, uomId: 6001 }),
    ).toMatchObject({
      ok: true,
      command: { kind: 'update', productionPlanId: 101, body: { plannedLineId: null } },
    });
    expect(
      prepareProductionPlanRow(
        { ...created, draft: { ...created.draft, bomId: '' } },
        { productionOrderId: 5001, uomId: 6001 },
      ),
    ).toEqual({
      ok: false,
      errors: { bomId: 'REQUIRED' },
    });
  });

  it('settles a successful create into the same display slot and removes pending edits', () => {
    const created = appendProductionPlanRow([], 'new-a', {
      planDate: '2026-08-27',
      plannedQty: '25',
      bomId: '7001',
      routingId: '8001',
    });
    const pending = markProductionPlanRowPending(created, 'new-a', true);
    expect(settleProductionPlanRow(pending, 'new-a', plan(202))[0]).toMatchObject({
      key: 'plan-202',
      displayNo: 1,
      productionPlanId: 202,
      isPending: false,
      isDirty: false,
    });
  });
});
