import type {
  MaterialLotBatchCreate,
  MaterialLotBatchCreated,
  MaterialLotVoidResult,
} from '@omf-mes/api-client';

import { useApiClient } from '../../patterns/api-context';
import { useMasterWrite, type MasterWriteResult } from '../../patterns/master';
import { materialLotIssueKeys } from './queries';

/**
 * 자재 관리 LOT 발행(계약 §1 `POST /logistics/material-lot-batches`). POP P-01-01 과 같은 본문이다(US1-8).
 * ⛔ 되돌릴 수 없는 쓰기(번호가 매겨진다)라 적용될 때까지 같은 멱등 키를 쓴다 — 통신이 끊긴 뒤 다시 누르면
 *   같은 묶음으로 본다.
 */
export const useIssueBatch = (
  onSuccess: (created: MaterialLotBatchCreated) => void,
): MasterWriteResult<MaterialLotBatchCreate> => {
  const { client } = useApiClient();
  return useMasterWrite({
    request: (body, headers) =>
      client.POST('/logistics/material-lot-batches', {
        params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
        body,
      }),
    etagPath: null,
    invalidateKeys: [materialLotIssueKeys.all],
    knownFields: [],
    keyLifetime: 'until-applied',
    onSuccess,
  });
};

/** 대기 자재 관리 LOT 폐기(계약 §1 `POST /trace/lots:void`) — 대기가 아닌 LOT 는 건별 실패로 온다. */
export const useVoidLots = (
  onSuccess: (result: MaterialLotVoidResult) => void,
): MasterWriteResult<number[]> => {
  const { client } = useApiClient();
  return useMasterWrite({
    request: (lotIds, headers) =>
      client.POST('/trace/lots:void', {
        params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
        body: { lotIds },
      }),
    etagPath: null,
    invalidateKeys: [materialLotIssueKeys.all],
    knownFields: [],
    onSuccess,
  });
};
