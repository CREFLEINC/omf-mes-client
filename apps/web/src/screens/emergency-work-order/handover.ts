import type { ApiError } from '@omf-mes/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { toApiError } from '../../patterns/request';
import { toWorkOrderReleaseBody } from './issue-request';
import { emergencyWorkOrderKeys } from './queries';
import {
  ReleaseFailure,
  type ReleaseFailureStep,
  type ReleaseKeyHolder,
  releaseWorkOrder,
} from './release-step';
import type { WorkOrder } from './types';

/** 배포를 이어받을 대상. 목록의 한 줄이 이만큼을 준다. */
export interface HandoverTarget {
  workOrderId: number;
  workOrderNo: string;
  /** LOT 크기가 여기서 나온다 — 지시수량 전량을 한 슬롯으로 보낸다. */
  orderQty: number;
}

export const toHandoverTarget = (workOrder: WorkOrder): HandoverTarget => ({
  workOrderId: workOrder.workOrderId,
  workOrderNo: workOrder.workOrderNo,
  orderQty: workOrder.orderQty,
});

/** 이어받기가 멈춘 자리. 어디까지 갔는지가 사용자에게 하는 말을 가른다. */
export interface HandoverFailure {
  workOrderNo: string;
  step: ReleaseFailureStep;
}

export interface HandoverResult {
  /** 되찾은 W/O 를 **배포만** 낸다. */
  release: (target: HandoverTarget) => void;
  /** 지금 배포가 나가 있는 W/O. 없으면 `null`. */
  releasingId: number | null;
  /** 이어받아 배포까지 끝난 W/O 번호. */
  releasedNo: string | null;
  failure: HandoverFailure | null;
  error: ApiError | null;
}

/**
 * **배포 안 된 W/O 이어받기.**
 *
 * ⛔ **발행 훅과 상태를 나눠 갖는다 — 합치지 않는다.** 발행 훅의 「배포 안 끝난 W/O」는
 * **새 발행을 막는** 상태다. 되찾은 목록을 거기 얹으면 **지난주에 밀린 지시 하나가 오늘의
 * 긴급 발행을 영영 막는다.** 이어받기는 밀린 것을 치우는 일이지 새 발행을 막는 일이 아니다.
 *
 * ⛔ **한 번에 하나만 나간다.** 여러 줄의 [배포 재시도]를 잇따라 누르거나 같은 줄을 두 번
 * 눌러도 나가는 요청은 하나다 — 되돌릴 수 없는 쓰기다.
 *
 * ⚠ **토큰을 들고 있지 않다.** 이 W/O 들이 만들어진 순간을 이 화면은 보지 못했다(다른 사람이,
 * 다른 단말에서, 혹은 새로고침 전에 만들었다). 그래서 배포 걸음이 상세를 한 번 불러 토큰을
 * 얻는다 — 발행 직후 경로와 갈리는 지점이 거기다.
 */
export const useHandoverRelease = (): HandoverResult => {
  const { client, etags } = useApiClient();
  const queryClient = useQueryClient();
  const [releasingId, setReleasingId] = useState<number | null>(null);
  const [releasedNo, setReleasedNo] = useState<string | null>(null);
  const [failure, setFailure] = useState<HandoverFailure | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  /* ⛔ 렌더와 무관하게 「나가 있는가」를 아는 자리 — 상태로는 같은 틱의 두 번째를 못 막는다. */
  const inFlight = useRef(false);
  /**
   * 배포의 멱등 키. **대상마다 하나이고, 재시도해도 같은 키다.**
   *
   * ⛔ 매번 새 키를 내면 「같은 키로 안전하게 다시 누른다」가 성립하지 않아 이중 배포가 열린다.
   */
  const releaseKey = useRef<ReleaseKeyHolder['current']>(null);

  const release = useCallback(
    (target: HandoverTarget): void => {
      if (inFlight.current) return;

      const body = toWorkOrderReleaseBody(String(target.orderQty));
      /* 수량을 읽을 수 없으면 LOT 크기를 지어내지 않는다 — 보내지 않고 멈춘다. */
      if (body === undefined) return;

      inFlight.current = true;
      setReleasingId(target.workOrderId);
      setReleasedNo(null);
      setFailure(null);
      setError(null);

      void (async () => {
        try {
          await releaseWorkOrder({
            client,
            etags,
            workOrderId: target.workOrderId,
            body,
            keyHolder: releaseKey,
            /* ⚠ 만들어진 순간을 보지 못했으니 토큰이 없다 — 배포 걸음이 상세로 얻는다. */
            ifMatch: null,
          });

          /* 끝난 키로 다음 쓰기가 나가지 않게 버린다. */
          releaseKey.current = null;
          setReleasedNo(target.workOrderNo);
          void queryClient.invalidateQueries({ queryKey: emergencyWorkOrderKeys.unreleased() });
        } catch (cause) {
          const step: ReleaseFailureStep = cause instanceof ReleaseFailure ? cause.step : 'unknown';
          setFailure({ workOrderNo: target.workOrderNo, step });
          setError(toApiError(cause instanceof ReleaseFailure ? cause.cause : cause));
        } finally {
          inFlight.current = false;
          setReleasingId(null);
        }
      })();
    },
    [client, etags, queryClient],
  );

  return { release, releasingId, releasedNo, failure, error };
};
