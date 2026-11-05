import type {
  MaterialIssueCloseRemaining,
  MaterialIssueRequestDetailForward,
  MaterialIssueRequestForward,
  ReplenishmentItem,
  ReplenishmentItemCreate,
  ReplenishmentItemDeleted,
  ReplenishmentItemUpdate,
  ReplenishmentRequestCreate,
  ReplenishmentRequestCreated,
  ReplenishmentSettings,
} from '@omf-mes/api-client';
import { createIdempotencyKey } from '@omf-mes/api-client';

import { useApiClient } from '../../patterns/api-context';
import { useMasterWrite, type MasterWriteResult } from '../../patterns/master';
import { runRequestWithResponse, type ApiCallResult } from '../../patterns/request';
import { replenishmentKeys } from './queries';

/** 창고 보충 직접 요청(계약 §2). 출고 자재 창고별로 요청이 나뉘고 바로 배포된다. */
export const useCreateRequest = (
  onSuccess: (created: ReplenishmentRequestCreated) => void,
): MasterWriteResult<ReplenishmentRequestCreate> => {
  const { client } = useApiClient();
  return useMasterWrite({
    request: (body, headers) =>
      client.POST('/logistics/replenishment-requests', {
        params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
        body,
      }),
    etagPath: null,
    invalidateKeys: [replenishmentKeys.all],
    knownFields: [],
    onSuccess,
  });
};

/** 출고 전 취소 — 003 경로 그대로(보충 요청이면 W-02-12 권한). */
export const useCancelRequest = (
  id: number,
  onSuccess: (saved: MaterialIssueRequestDetailForward) => void,
): MasterWriteResult<{ versionNo: number }> => {
  const { client } = useApiClient();
  return useMasterWrite({
    request: (body, headers) =>
      client.POST('/logistics/material-issue-requests/{materialIssueRequestId}:cancel', {
        params: {
          path: { materialIssueRequestId: id },
          header: { 'Idempotency-Key': headers['Idempotency-Key'] },
        },
        body,
      }),
    etagPath: null,
    invalidateKeys: [replenishmentKeys.all],
    knownFields: [],
    onSuccess,
  });
};

/** 일부 출고 뒤 잔량 마감(계약 §2). */
export const useCloseRemaining = (
  id: number,
  onSuccess: (saved: MaterialIssueRequestForward) => void,
): MasterWriteResult<MaterialIssueCloseRemaining> => {
  const { client } = useApiClient();
  return useMasterWrite({
    request: (body, headers) =>
      client.POST('/logistics/material-issue-requests/{materialIssueRequestId}:close-remaining', {
        params: {
          path: { materialIssueRequestId: id },
          header: { 'Idempotency-Key': headers['Idempotency-Key'] },
        },
        body,
      }),
    etagPath: null,
    invalidateKeys: [replenishmentKeys.all],
    knownFields: ['reasonCode', 'remark'],
    onSuccess,
  });
};

export type ItemSave =
  | { mode: 'create'; body: ReplenishmentItemCreate }
  | { mode: 'update'; id: number; body: ReplenishmentItemUpdate };

/** 관리 품목 추가 · 고치기(계약 §4). */
export const useSaveItem = (
  onSuccess: (saved: ReplenishmentItem) => void,
): MasterWriteResult<ItemSave> => {
  const { client } = useApiClient();
  return useMasterWrite<ItemSave, ReplenishmentItem>({
    request: (save, headers) =>
      save.mode === 'create'
        ? client.POST('/logistics/replenishment-items', {
            params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
            body: save.body,
          })
        : client.PUT('/logistics/replenishment-items/{replenishmentItemId}', {
            params: {
              path: { replenishmentItemId: save.id },
              header: { 'Idempotency-Key': headers['Idempotency-Key'] },
            },
            body: save.body,
          }),
    etagPath: null,
    invalidateKeys: [replenishmentKeys.all],
    knownFields: ['reorderPointQty', 'targetQty', 'sourceWarehouseId', 'itemId'],
    onSuccess,
  });
};

export const useDeleteItem = (
  onSuccess: (deleted: ReplenishmentItemDeleted) => void,
): MasterWriteResult<number> => {
  const { client } = useApiClient();
  return useMasterWrite<number, ReplenishmentItemDeleted>({
    request: (id, headers) =>
      client.DELETE('/logistics/replenishment-items/{replenishmentItemId}', {
        params: {
          path: { replenishmentItemId: id },
          header: { 'Idempotency-Key': headers['Idempotency-Key'] },
        },
      }),
    etagPath: null,
    invalidateKeys: [replenishmentKeys.all],
    knownFields: [],
    onSuccess,
  });
};

export const RUN_TIME_POLICY_CODE = 'REPLENISHMENT_RUN_TIME';

/** 실행 시각 저장 한 벌 — 공장 기본(바뀌었으면)과 바뀐 창고들. */
export interface RunTimeSave {
  plantId: number;
  today: string;
  /** 바뀐 공장 기본 시각. 그대로면 null. */
  plantDefault: string | null;
  warehouses: { warehouseId: number; runTime: string | null; versionNo: number }[];
}

type Warehouse = ReplenishmentSettings['warehouses'][number];

/**
 * 실행 시각 저장(계약 §4). 공장 기본은 운영 정책 `REPLENISHMENT_RUN_TIME` 의 「그날부터 적용」 행 — 오늘 시작한 행이
 * 있으면 그 행을 고치고 없으면 새 행을 더한다(W-CO-15 와 같은 방식). 창고 시각은 창고 설정 경로로 하나씩 보낸다.
 * 하나라도 실패하면 거기서 멈추고 그 실패를 낸다.
 */
export const useSaveRunTimes = (onSuccess: () => void): MasterWriteResult<RunTimeSave> => {
  const { client } = useApiClient();

  const savePlantDefault = async (
    save: RunTimeSave,
    key: string,
  ): Promise<ApiCallResult<unknown>> => {
    const list = await client.GET('/app/operation-policies', {
      params: { query: { policyCode: RUN_TIME_POLICY_CODE, plantId: save.plantId, size: 200 } },
    });
    if (list.error !== undefined) return list;
    const sameDay = list.data.items.find(
      (row) => row.plantId === save.plantId && row.effectiveFrom === save.today,
    );
    if (sameDay === undefined) {
      return client.POST('/app/operation-policies', {
        params: { header: { 'Idempotency-Key': key } },
        body: {
          policyCode: RUN_TIME_POLICY_CODE,
          plantId: save.plantId,
          valueText: save.plantDefault,
          effectiveFrom: save.today,
        },
      });
    }
    const { response } = await runRequestWithResponse(() =>
      client.GET('/app/operation-policies/{operationPolicyId}', {
        params: { path: { operationPolicyId: sameDay.operationPolicyId } },
      }),
    );
    return client.PUT('/app/operation-policies/{operationPolicyId}', {
      params: {
        path: { operationPolicyId: sameDay.operationPolicyId },
        header: { 'Idempotency-Key': key, 'If-Match': response.headers.get('ETag') ?? '' },
      },
      body: {
        valueText: save.plantDefault,
        effectiveFrom: sameDay.effectiveFrom,
        effectiveTo: sameDay.effectiveTo ?? null,
      },
    });
  };

  return useMasterWrite<RunTimeSave, unknown>({
    request: async (save, headers) => {
      let last: ApiCallResult<unknown> | undefined;
      let first = true;
      const nextKey = (): string => {
        const key = first ? headers['Idempotency-Key'] : createIdempotencyKey();
        first = false;
        return key;
      };
      if (save.plantDefault !== null) {
        last = await savePlantDefault(save, nextKey());
        if (last.error !== undefined) return last;
      }
      for (const warehouse of save.warehouses) {
        last = (await client.PUT('/logistics/replenishment-settings/warehouses/{warehouseId}', {
          params: {
            path: { warehouseId: warehouse.warehouseId },
            header: { 'Idempotency-Key': nextKey() },
          },
          body: { runTime: warehouse.runTime, versionNo: warehouse.versionNo },
        })) as ApiCallResult<Warehouse>;
        if (last.error !== undefined) return last;
      }
      if (last === undefined) throw new Error('바꾼 시각이 없으면 저장하지 않는다.');
      return last;
    },
    etagPath: null,
    invalidateKeys: [replenishmentKeys.all],
    knownFields: [],
    onSuccess,
  });
};
