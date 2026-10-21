import { createIdempotencyKey } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import type { BulkOutcome } from '../../patterns/bulk-result';
import { runRequest, toApiError } from '../../patterns/request';
import {
  apiErrorText,
  forecastRelease,
  invalidateFlow,
  releaseWorkOrder,
  unreleasedWorkOrdersOf,
  type ReleaseForecast,
} from './release-runner';
import { processPath } from './worklist-filters';

const t = messages.erpWorkOrderFlow;

export type BulkKind = 'release' | 'autoPlan';

export interface BulkTarget {
  productionOrderId: number;
  productionOrderNo: string;
}

export interface BulkRun {
  kind: BulkKind;
  outcomes: BulkOutcome[];
}

const outcomeOf = (
  target: BulkTarget,
  status: BulkOutcome['status'],
  reason: string | null,
  items?: { done: number; total: number },
): BulkOutcome => ({
  id: String(target.productionOrderId),
  label: target.productionOrderNo,
  status,
  reason,
  ...(items === undefined ? {} : { items }),
  ...(status === 'processed' ? {} : { fixHref: processPath(target.productionOrderNo) }),
});

/** 확인 창 예고: ERP W/O마다 배포될 W/O 수. 실행과 같은 판정이다(C-18). */
export interface ForecastEntry extends BulkTarget {
  forecast: ReleaseForecast | null;
  error: string | null;
}

export const forecastStatus = (entry: ForecastEntry): BulkOutcome['status'] => {
  if (entry.forecast === null) return 'failed';
  if (entry.forecast.total === 0 || entry.forecast.ready === 0) return 'skipped';
  return entry.forecast.ready < entry.forecast.total ? 'partial' : 'processed';
};

/**
 * 작업함 일괄 동작(C-17, C-18). 고른 ERP W/O마다 차례로 실행하고, 한 건이 실패해도 나머지를 계속한다.
 * 결과는 ERP W/O 단위로 세고, W/O 일부만 배포되면 「일부 처리」다.
 */
export const useWorklistBulk = () => {
  const { client } = useApiClient();
  const queryClient = useQueryClient();
  const [run, setRun] = useState<BulkRun | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const forecast = useCallback(
    async (targets: readonly BulkTarget[]): Promise<ForecastEntry[]> => {
      const entries: ForecastEntry[] = [];
      for (const target of targets) {
        try {
          entries.push({
            ...target,
            forecast: await forecastRelease(client, queryClient, target.productionOrderId),
            error: null,
          });
        } catch (cause) {
          entries.push({ ...target, forecast: null, error: apiErrorText(toApiError(cause)) });
        }
      }
      return entries;
    },
    [client, queryClient],
  );

  const releaseOrder = useCallback(
    async (target: BulkTarget): Promise<BulkOutcome> => {
      try {
        const workOrders = await unreleasedWorkOrdersOf(client, target.productionOrderId);
        if (workOrders.length === 0)
          return outcomeOf(target, 'skipped', t.bulk.outcomeReasons.noWorkOrders, {
            done: 0,
            total: 0,
          });
        const attempts = [];
        for (const workOrder of workOrders)
          attempts.push(await releaseWorkOrder(client, queryClient, workOrder, null));
        const released = attempts.filter((item) => item.status === 'released').length;
        const items = { done: released, total: attempts.length };
        const firstIssue = attempts.find((item) => item.status !== 'released');
        if (firstIssue === undefined) return outcomeOf(target, 'processed', null, items);
        const reason = `${firstIssue.workOrderNo} ${firstIssue.reason ?? ''}`.trim();
        if (released > 0) return outcomeOf(target, 'partial', reason, items);
        return outcomeOf(
          target,
          attempts.some((item) => item.status === 'failed') ? 'failed' : 'skipped',
          reason,
          items,
        );
      } catch (cause) {
        return outcomeOf(target, 'failed', apiErrorText(toApiError(cause)));
      }
    },
    [client, queryClient],
  );

  const autoPlanOrder = useCallback(
    async (target: BulkTarget): Promise<BulkOutcome> => {
      try {
        const result = await runRequest(() =>
          client.POST('/planning/production-orders/{productionOrderId}:auto-plan', {
            params: {
              path: { productionOrderId: target.productionOrderId },
              header: { 'Idempotency-Key': createIdempotencyKey() },
            },
          }),
        );
        if (result.outcome === 'CONFIRMED') return outcomeOf(target, 'processed', null);
        if (result.outcome === 'DRAFT')
          return outcomeOf(target, 'skipped', t.bulk.outcomeReasons.draft);
        return outcomeOf(
          target,
          'skipped',
          result.reasons.map((reason) => t.reasons[reason]).join(', '),
        );
      } catch (cause) {
        return outcomeOf(target, 'failed', apiErrorText(toApiError(cause)));
      }
    },
    [client],
  );

  const start = useCallback(
    async (kind: BulkKind, targets: readonly BulkTarget[]) => {
      setIsRunning(true);
      setRun(null);
      const outcomes: BulkOutcome[] = [];
      for (const target of targets) {
        outcomes.push(
          kind === 'release' ? await releaseOrder(target) : await autoPlanOrder(target),
        );
      }
      await invalidateFlow(queryClient);
      setRun({ kind, outcomes });
      setIsRunning(false);
    },
    [autoPlanOrder, queryClient, releaseOrder],
  );

  return { run, isRunning, start, forecast, clear: () => setRun(null) };
};
