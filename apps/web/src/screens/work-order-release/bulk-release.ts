import { createIdempotencyKey, type ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { runRequest, runRequestWithResponse, toApiError } from '../../patterns/request';
import { productionOrderItemKeys } from '../production-order/item-lookups';
import { workOrderKeys } from '../work-order/queries';
import { toWorkOrderReleaseFact, workOrderReleaseKeys, type WorkOrderReleaseFact } from './queries';

const t = messages.workOrderRelease.bulk;

export type BulkReleaseStatus = 'released' | 'skipped' | 'failed';

export interface BulkReleaseOutcome {
  workOrderId: number;
  workOrderNo: string;
  status: BulkReleaseStatus;
  /** 건너뛴·실패한 이유. 배포됐으면 null. */
  reason: string | null;
}

export interface BulkReleaseTarget {
  workOrderId: number;
  workOrderNo: string;
}

/** 4M 에서 정해야 하는 배포 전제 — 서버도 같은 이유로 거부하지만 보내기 전에 걸러 건별 실패를 줄인다. */
export const missingReleaseSetup = (fact: WorkOrderReleaseFact): boolean =>
  fact.productionLineId === null ||
  fact.defaultWipLocationId === null ||
  fact.defaultFgLocationId === null ||
  fact.defaultScrapLocationId === null;

const errorText = (error: ApiError): string => {
  if (error.kind === 'validation' || error.kind === 'stateLocked') {
    return error.errors.map((item) => item.message).join(' ') || t.reasons.failed;
  }
  if (error.kind === 'conflict') return error.message;
  if (error.kind === 'http') return error.message ?? t.reasons.failed;
  return messages.httpError.description;
};

/**
 * 고른 W/O 를 품목 기본 LOT 크기로 한 건씩 배포한다. 배포는 LOT 번호와 자재 출고요청을 만드는 되돌리기
 * 어려운 전이라 건마다 최신 상세의 ETag 로 보내고, 한 건이 실패해도 나머지를 계속한다.
 */
export const useBulkRelease = () => {
  const { client } = useApiClient();
  const queryClient = useQueryClient();
  const [outcomes, setOutcomes] = useState<BulkReleaseOutcome[] | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const releaseOne = useCallback(
    async (target: BulkReleaseTarget): Promise<BulkReleaseOutcome> => {
      const outcome = (status: BulkReleaseStatus, reason: string | null): BulkReleaseOutcome => ({
        ...target,
        status,
        reason,
      });
      try {
        const detail = await runRequestWithResponse(() =>
          client.GET('/production/work-orders/{workOrderId}', {
            params: { path: { workOrderId: target.workOrderId } },
          }),
        );
        const fact = toWorkOrderReleaseFact(detail.data);
        if (missingReleaseSetup(fact)) return outcome('skipped', t.reasons.setupMissing);

        const item = await queryClient.fetchQuery({
          queryKey: productionOrderItemKeys.detail(fact.itemId),
          queryFn: () =>
            runRequest(() =>
              client.GET('/mdm/items/{itemId}', { params: { path: { itemId: fact.itemId } } }),
            ),
        });
        const lotSize = item.item.defaultProductionLotSize ?? null;
        if (lotSize === null || lotSize <= 0 || item.item.baseUomId !== fact.uomId) {
          return outcome('skipped', t.reasons.noDefaultLotSize);
        }

        await runRequest(() =>
          client.POST('/production/work-orders/{workOrderId}:release', {
            params: {
              path: { workOrderId: target.workOrderId },
              header: {
                'Idempotency-Key': createIdempotencyKey(),
                'If-Match': detail.response.headers.get('ETag') ?? '',
              },
            },
            body: { lotSize },
          }),
        );
        return outcome('released', null);
      } catch (cause) {
        return outcome('failed', errorText(toApiError(cause)));
      }
    },
    [client, queryClient],
  );

  const run = useCallback(
    async (targets: readonly BulkReleaseTarget[]): Promise<void> => {
      setIsRunning(true);
      setOutcomes(null);
      const results: BulkReleaseOutcome[] = [];
      for (const target of targets) results.push(await releaseOne(target));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: workOrderReleaseKeys.all }),
        queryClient.invalidateQueries({ queryKey: workOrderKeys.all }),
      ]);
      setOutcomes(results);
      setIsRunning(false);
    },
    [queryClient, releaseOne],
  );

  return { run, isRunning, outcomes, clear: () => setOutcomes(null) };
};
