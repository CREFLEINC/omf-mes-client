import { createIdempotencyKey, type components } from '@omf-mes/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { splitError, type SplitError } from '../../patterns/master';
import { runRequest, toApiError } from '../../patterns/request';
import { oqcInspectionKeys } from '../oqc-inspection/queries';
import { RESULT_STATUS, SAVE_FIELDS } from '../pqc-inspection/queries';
import type { PqcSubmitter } from './panel';

type InspectionResultCreate = components['schemas']['InspectionResultCreate'];

/**
 * 관리웹(W-03-11)의 저장 — **바로 보낸다.** POP 의 오프라인 큐와 같은 모양을 내어 패널이 둘을
 * 가리지 않게 한다.
 *
 * ⛔ 사번을 싣지 않는다 — 관리웹은 계정 세션이 검사자다(서버가 세션에서 정한다).
 * ⚠ 큐가 아니므로 「담는 순간 성공」이 아니다 — 거부·실패는 `rejection` 으로 돌아와 패널이 저장
 *   표시를 거둔다. 통신 실패도 같은 자리로 낸다(관리웹에는 자동 재전송이 없다).
 */
export const useDirectSubmitter = (): PqcSubmitter => {
  const { client } = useApiClient();
  const queryClient = useQueryClient();
  const [rejection, setRejection] = useState<SplitError | null>(null);
  const [rejectedStatusCode, setRejectedStatusCode] = useState<string | null>(null);
  const [sentCount, setSentCount] = useState(0);
  /** 나가 있는 확정. 돌아오기 전에 다시 누르면 같은 판정이 두 번 나간다. */
  const [confirming, setConfirming] = useState<ReadonlySet<number>>(new Set());

  const enqueue = useCallback(
    (_workerNo: string, body: InspectionResultCreate): void => {
      const id = body.inspectionRequestId;
      const isConfirm = body.statusCode === RESULT_STATUS.confirmed;

      setRejection(null);
      setRejectedStatusCode(null);
      if (isConfirm) setConfirming((current) => new Set(current).add(id));

      void runRequest(() =>
        client.POST('/quality/inspection-results', {
          params: { header: { 'Idempotency-Key': createIdempotencyKey() } },
          body,
        }),
      )
        .then(() => {
          setSentCount((count) => count + 1);
          /* 목록의 상태(대기 → 진행 → 완료)가 바뀐다 — 확정한 의뢰가 「대기·진행만」에 남지 않게 다시 묻는다(리뷰 m5). */
          void queryClient.invalidateQueries({ queryKey: oqcInspectionKeys.queues() });
        })
        .catch((error: unknown) => {
          setRejection(splitError(toApiError(error), SAVE_FIELDS, undefined));
          setRejectedStatusCode(body.statusCode);
        })
        .finally(() => {
          if (!isConfirm) return;
          setConfirming((current) => {
            const next = new Set(current);
            next.delete(id);
            return next;
          });
        });
    },
    [client, queryClient],
  );

  const clearRejection = useCallback((): void => {
    setRejection(null);
    setRejectedStatusCode(null);
  }, []);

  const hasPendingConfirm = useCallback((id: number): boolean => confirming.has(id), [confirming]);

  return { enqueue, rejection, rejectedStatusCode, clearRejection, hasPendingConfirm, sentCount };
};
