import { splitPlanQuantity } from './quantity-split';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { ProductionPlanDraftErrors, ProductionPlanDraftField } from './editor-model';
import {
  appendProductionPlanRow,
  changeProductionPlanRow,
  markProductionPlanRowPending,
  reconcileProductionPlanRows,
  removeProductionPlanRow,
  settleProductionPlanRow,
  setProductionPlanRowErrors,
  type NewProductionPlanDefaults,
  type ProductionPlanEditorStateRow,
} from './editor-state';
import { useAllProductionPlans } from './queries';
import type { ProductionPlanFact } from './types';

interface EditorSessionState {
  ownerId: number | null;
  epoch: number;
  isHydrated: boolean;
  rows: ProductionPlanEditorStateRow[];
}

const EMPTY_ROWS: ProductionPlanEditorStateRow[] = [];

export const useProductionPlanEditorSession = (productionOrderId: number | null) => {
  const plans = useAllProductionPlans(productionOrderId);
  const [session, setSession] = useState<EditorSessionState>({
    ownerId: null,
    epoch: 0,
    isHydrated: false,
    rows: [],
  });
  const nextNewRow = useRef(0);

  useEffect(() => {
    setSession((current) => {
      if (productionOrderId === null) {
        return current.ownerId === null && current.rows.length === 0
          ? current
          : { ownerId: null, epoch: current.epoch + 1, isHydrated: false, rows: [] };
      }
      if (plans.data === undefined || plans.isFetching || plans.isError) {
        return current.ownerId === productionOrderId
          ? current
          : {
              ownerId: productionOrderId,
              epoch: current.epoch + 1,
              isHydrated: false,
              rows: [],
            };
      }

      const currentRows = current.ownerId === productionOrderId ? current.rows : [];
      return {
        ownerId: productionOrderId,
        epoch: current.ownerId === productionOrderId ? current.epoch : current.epoch + 1,
        isHydrated: true,
        rows: reconcileProductionPlanRows(currentRows, plans.data.items),
      };
    });
  }, [plans.data, plans.isError, plans.isFetching, productionOrderId]);

  const sessionEpoch =
    productionOrderId !== null && session.ownerId === productionOrderId ? session.epoch : null;
  const updateRows = useCallback(
    (update: (rows: ProductionPlanEditorStateRow[]) => ProductionPlanEditorStateRow[]) => {
      setSession((current) =>
        sessionEpoch !== null &&
        current.ownerId === productionOrderId &&
        current.epoch === sessionEpoch
          ? { ...current, rows: update(current.rows) }
          : current,
      );
    },
    [productionOrderId, sessionEpoch],
  );
  const add = useCallback(
    (defaults: NewProductionPlanDefaults) => {
      nextNewRow.current += 1;
      updateRows((rows) =>
        appendProductionPlanRow(rows, `new-plan-${String(nextNewRow.current)}`, defaults),
      );
    },
    [updateRows],
  );
  const addMany = useCallback(
    (defaults: NewProductionPlanDefaults[]) => {
      const entries = defaults.map((draft) => {
        nextNewRow.current += 1;
        return { key: `new-plan-${nextNewRow.current}`, draft };
      });
      updateRows((rows) =>
        entries.reduce(
          (current, entry) => appendProductionPlanRow(current, entry.key, entry.draft),
          rows,
        ),
      );
    },
    [updateRows],
  );
  const split = useCallback(
    (key: string, quantity: number, decimalScale = 6) => {
      nextNewRow.current += 1;
      const nextKey = `new-plan-${nextNewRow.current}`;
      updateRows((rows) => {
        const row = rows.find((item) => item.key === key);
        const quantities = splitPlanQuantity(Number(row?.draft.plannedQty), quantity, decimalScale);
        if (!row || row.confirmed || row.isPending || quantities === null) return rows;
        const changed = changeProductionPlanRow(
          rows,
          key,
          'plannedQty',
          String(quantities.remaining),
        );
        const appended = appendProductionPlanRow(changed, nextKey, {
          ...row.draft,
          plannedQty: String(quantities.split),
        });
        return changeProductionPlanRow(appended, nextKey, 'remarks', row.draft.remarks).map(
          (item) => (item.key === nextKey ? { ...item, splitSourceKey: row.key } : item),
        );
      });
    },
    [updateRows],
  );
  const change = useCallback(
    (key: string, field: ProductionPlanDraftField, value: string) =>
      updateRows((rows) => changeProductionPlanRow(rows, key, field, value)),
    [updateRows],
  );
  const markPending = useCallback(
    (key: string, pending: boolean) =>
      updateRows((rows) => markProductionPlanRowPending(rows, key, pending)),
    [updateRows],
  );
  const setErrors = useCallback(
    (key: string, errors: ProductionPlanDraftErrors) =>
      updateRows((rows) => setProductionPlanRowErrors(rows, key, errors)),
    [updateRows],
  );
  const settle = useCallback(
    (key: string, plan: ProductionPlanFact) => {
      if (plan.productionOrderId !== productionOrderId) return;
      updateRows((rows) => settleProductionPlanRow(rows, key, plan));
    },
    [productionOrderId, updateRows],
  );
  const remove = useCallback(
    (key: string) => updateRows((rows) => removeProductionPlanRow(rows, key)),
    [updateRows],
  );
  /* 고친 줄을 버리고 서버의 최신 계획으로 다시 채운다(저장 충돌 뒤 「최신 불러오기」). */
  const { refetch } = plans;
  const discard = useCallback(() => {
    setSession((current) =>
      current.ownerId === productionOrderId ? { ...current, isHydrated: false, rows: [] } : current,
    );
    void refetch();
  }, [productionOrderId, refetch]);

  return {
    plans,
    isHydrated: session.ownerId === productionOrderId && session.isHydrated,
    rows: session.ownerId === productionOrderId ? session.rows : EMPTY_ROWS,
    add,
    addMany,
    split,
    change,
    markPending,
    setErrors,
    settle,
    remove,
    discard,
  };
};
