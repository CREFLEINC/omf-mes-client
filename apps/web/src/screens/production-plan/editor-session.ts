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
  rows: ProductionPlanEditorStateRow[];
}

const EMPTY_ROWS: ProductionPlanEditorStateRow[] = [];

export const useProductionPlanEditorSession = (productionOrderId: number | null) => {
  const plans = useAllProductionPlans(productionOrderId);
  const [session, setSession] = useState<EditorSessionState>({ ownerId: null, epoch: 0, rows: [] });
  const nextNewRow = useRef(0);

  useEffect(() => {
    setSession((current) => {
      if (productionOrderId === null) {
        return current.ownerId === null && current.rows.length === 0
          ? current
          : { ownerId: null, epoch: current.epoch + 1, rows: [] };
      }
      if (plans.data === undefined || plans.isFetching || plans.isError) {
        return current.ownerId === productionOrderId
          ? current
          : { ownerId: productionOrderId, epoch: current.epoch + 1, rows: [] };
      }

      const currentRows = current.ownerId === productionOrderId ? current.rows : [];
      return {
        ownerId: productionOrderId,
        epoch: current.ownerId === productionOrderId ? current.epoch : current.epoch + 1,
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

  return {
    plans,
    rows: session.ownerId === productionOrderId ? session.rows : EMPTY_ROWS,
    add,
    change,
    markPending,
    setErrors,
    settle,
    remove,
  };
};
