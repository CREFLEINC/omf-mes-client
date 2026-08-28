import type { ApiError, components } from '@omf-mes/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { runRequestWithResponse, toApiError } from '../../patterns/request';
import {
  type IssueCommand,
  toWorkOrderCreateBody,
  toWorkOrderReleaseBody,
  type WorkOrderReleaseBody,
} from './issue-request';
import { emergencyWorkOrderKeys } from './queries';
import {
  ReleaseFailure,
  type ReleaseFailureStep,
  type ReleaseKeyHolder,
  releaseWorkOrder,
} from './release-step';

type WorkOrder = components['schemas']['WorkOrder'];

/**
 * 만들어졌지만 배포가 끝나지 않은 W/O.
 *
 * ⭐ **보낼 본문을 함께 들고 다닌다.** 재시도가 «그 W/O 에 맞는» 본문을 보내야 하는데, 본문만
 * 따로 두면 다른 발행이 그 자리를 덮어써 **엉뚱한 LOT 크기가 앞선 W/O 의 키로** 나간다.
 */
export interface PendingWorkOrder {
  workOrderId: number;
  workOrderNo: string;
  body: WorkOrderReleaseBody;
  /**
   * 발행 응답이 준 낙관적 잠금 토큰. 되찾은 W/O 처럼 **모르는 경우** `null`.
   *
   * ⛔ **경로별 보관소에서 꺼내지 않고 여기 함께 든다.** 발행은 «목록» 경로로 나가므로 보관소는
   * 이 토큰을 목록 경로에 적어 둔다 — 그런데 토큰은 **행에 속한 값**이다. 자리를 잘못 잡으면
   * 다음 발행이 앞 W/O 의 토큰을 덮고, 그 배포는 남의 번호로 나간다. 본문을 함께 들고 다니는
   * 것과 같은 이유다.
   */
  ifMatch: string | null;
  /** 배포가 어디서 멈췄는가. 시작 전에는 `null`. */
  failedAt: ReleaseFailureStep | null;
}

export interface IssueResult {
  issue: (command: IssueCommand) => void;
  /** 만들어졌으나 배포가 끝나지 않은 W/O 를 **배포만** 다시 시도한다. */
  retryRelease: () => void;
  isIssuing: boolean;
  /** 발행·배포가 끝까지 간 W/O 번호. */
  releasedNo: string | null;
  /** ⛔ 배포가 끝나지 않은 W/O. 이것이 있으면 새 발행을 막는다. */
  pending: PendingWorkOrder | null;
  /**
   * ⛔ **발행됐는지 모르는 상태.** 서버가 2xx 를 줬는데 번호를 읽지 못한 경우다 — 지시가
   * 이미 만들어졌을 수 있는데 **번호를 몰라 배포도 재시도도 낼 수 없다.** 「실패」로 말하면
   * 사용자가 한 번 더 눌러 긴급 지시가 둘이 된다.
   */
  isCreateUncertain: boolean;
  error: ApiError | null;
}

/**
 * 발행·배포. **한 액션이고 호출은 둘이다.**
 *
 * ```
 * ① POST /production/work-orders               (멱등 키 · 계획 참조 null · 응답이 토큰을 준다)
 * ② POST …/{id}:release                        (멱등 키 · If-Match 는 ①이 준 토큰)
 * ```
 *
 * ⭐ **가운데 조회가 없어졌다.** 종전에는 토큰을 얻으려 상세를 한 번 더 불렀는데, 발행 응답이
 * 그것을 직접 준다(omf-mes#258 회신). 걸음이 하나 줄어든 만큼 아래 창도 좁아진다.
 *
 * ⛔ **①과 ② 사이에는 트랜잭션이 없다.** 서버가 한 트랜잭션으로 묶는 것은 ①의 «안쪽»
 * (내부 P/O·계획·W/O)이다. ①이 성공하고 ②가 실패하면 **배포되지 않은 W/O 가 남고, 화면은
 * 그것을 되돌릴 수 없다** — 이 화면에 취소 액션이 없고, 취소 오퍼레이션은 선발행 슬롯 자동
 * 폐번이 부수 효과라 배포 전에는 **다른 일을 하는 액션을 빌려 쓰는 것**이 된다. 그래서
 * **「성공이라고 말하지 않는」 데까지** 한다.
 *
 * ⭐ **화면을 떠나도 잃지 않는다.** 종전에는 만들어진 번호가 컴포넌트와 함께 사라졌는데,
 * 이제 진입할 때 서버에서 되찾는다(`useUnreleasedEmergencyWorkOrders`) — 서버가 정본이라
 * 새로고침해도, 다른 단말에서도 보인다. 이 훅이 든 상태는 **지금 이 순간의 것**일 뿐이다.
 *
 * ⛔ **한 번에 하나만 나간다.** 잠금이 버튼을 잠그더라도 그것은 화면의 일이고, **두 번 눌러
 * 긴급 지시가 둘이 되는 것**은 여기서 막아야 한다 — 버튼이 잠기기 전에 두 번째 누름이 들어올
 * 수 있고, 이 훅을 다른 자리에서 부를 수도 있다. 되돌릴 수 없는 쓰기의 마지막 문이다.
 */
export const useIssueEmergencyWorkOrder = (): IssueResult => {
  const { client, etags } = useApiClient();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<PendingWorkOrder | null>(null);
  const [releasedNo, setReleasedNo] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [isIssuing, setIsIssuing] = useState(false);
  const [isCreateUncertain, setIsCreateUncertain] = useState(false);

  /**
   * ⛔ **나가 있는 요청이 있는지**를 렌더와 무관하게 아는 자리. 상태로는 못 막는다 — 같은
   * 틱에 두 번 부르면 둘 다 옛 상태를 보고 둘 다 나간다.
   */
  const inFlight = useRef(false);
  const releaseKey = useRef<ReleaseKeyHolder['current']>(null);

  /**
   * 발행의 멱등 키. **같은 본문으로 다시 누르면 같은 키를 쓴다.**
   *
   * ⛔ 매번 새 키를 내면 통신이 끊긴 뒤 다시 눌렀을 때 서버가 **다른 쓰기로 보고 두 번
   * 실행**한다 — 긴급 지시가 둘이 된다. 본문이 달라지면 다른 쓰기이므로 새 키를 준다.
   */
  const createKey = useRef<{ signature: string; key: string } | null>(null);

  const createKeyFor = (signature: string): string => {
    if (createKey.current === null || createKey.current.signature !== signature) {
      createKey.current = { signature, key: crypto.randomUUID() };
    }

    return createKey.current.key;
  };

  const handOver = useCallback(
    async (target: PendingWorkOrder): Promise<void> => {
      await releaseWorkOrder({
        client,
        etags,
        workOrderId: target.workOrderId,
        body: target.body,
        keyHolder: releaseKey,
        ifMatch: target.ifMatch,
      });

      /* 배포까지 갔을 때만 두 키를 함께 버린다 — 끝난 키로 다음 쓰기가 나가지 않게. */
      releaseKey.current = null;
      createKey.current = null;
      setPending(null);
      setReleasedNo(target.workOrderNo);
      void queryClient.invalidateQueries({ queryKey: emergencyWorkOrderKeys.all });
    },
    [client, etags, queryClient],
  );

  const runRelease = useCallback(
    async (target: PendingWorkOrder): Promise<void> => {
      try {
        await handOver(target);
      } catch (cause) {
        const step: ReleaseFailureStep = cause instanceof ReleaseFailure ? cause.step : 'unknown';
        setPending({ ...target, failedAt: step });
        setError(toApiError(cause instanceof ReleaseFailure ? cause.cause : cause));
      }
    },
    [handOver],
  );

  const issue = useCallback(
    (command: IssueCommand): void => {
      /* 나가 있는 요청이 있거나, 배포가 안 끝난 W/O 가 남아 있으면 새로 발행하지 않는다. */
      if (inFlight.current || pending !== null) return;

      const createBody = toWorkOrderCreateBody(command);
      const body = toWorkOrderReleaseBody(command.form.orderQty);
      /* 갖춰지지 않은 입력으로는 아무것도 보내지 않는다 — 잠금이 뚫려도 여기서 멈춘다. */
      if (createBody === undefined || body === undefined) return;

      inFlight.current = true;
      setIsIssuing(true);
      setError(null);
      setReleasedNo(null);
      setIsCreateUncertain(false);

      void (async () => {
        let target: PendingWorkOrder;

        try {
          /*
           * ⭐ **응답을 통째로 받는다 — 토큰이 헤더로만 온다.** 경로별 보관소로도 들어오지만
           * 발행은 «목록» 경로로 나가므로 거기 적히고, 그 자리는 다음 발행이 덮는다.
           * 행에 속한 값이라 **그 W/O 와 함께** 들고 다닌다.
           */
          const createResult = await runRequestWithResponse<WorkOrder | undefined>(() =>
            client.POST('/production/work-orders', {
              params: {
                header: { 'Idempotency-Key': createKeyFor(JSON.stringify(createBody)) },
              },
              body: createBody,
            }),
          );
          const created = createResult.data;

          /*
           * ⛔ **성공했는데 번호를 못 읽은 경우를 실패로 말하지 않는다.** 응답이 2xx 였다면
           * **지시는 이미 만들어졌을 수 있다** — 그것을 「발행 실패」로 말하면 사용자가 한 번 더
           * 발행해 긴급 지시가 둘이 된다. 번호를 모르니 재시도도 낼 수 없어, 확인을 청한다.
           */
          if (created === undefined || typeof created.workOrderId !== 'number') {
            throw new ReleaseFailure('unknown', undefined);
          }

          target = {
            workOrderId: created.workOrderId,
            workOrderNo: created.workOrderNo,
            body,
            /*
             * ⚠ **없으면 `null` 로 두고 지어내지 않는다.** 빈 토큰으로 배포하면 계약 위반이라
             * 서버가 거부하고, 그 거부는 「배포가 반려됐다」로 읽힌다 — 실제로는 물어보지도
             * 못한 것이다. `null` 이면 배포 걸음이 상세를 불러 제대로 얻는다.
             */
            ifMatch: createResult.response.headers.get('ETag'),
            failedAt: null,
          };
        } catch (cause) {
          if (cause instanceof ReleaseFailure) {
            /* 만들어졌는지 모르는 상태 — 번호가 없어 대상으로 삼을 수 없다. */
            setIsCreateUncertain(true);
            setError(toApiError(cause.cause));
          } else {
            setError(toApiError(cause));
          }
          inFlight.current = false;
          setIsIssuing(false);
          return;
        }

        /*
         * ⭐ **만들어진 순간부터 「배포 안 끝남」으로 둔다.** 배포가 성공해야 지운다 — 반대로
         * 두면(실패했을 때 표시) 배포 도중 화면이 끊긴 W/O 가 아무 데도 남지 않는다.
         */
        setPending(target);
        await runRelease(target);
        inFlight.current = false;
        setIsIssuing(false);
      })();
    },
    [client, pending, runRelease],
  );

  const retryRelease = useCallback((): void => {
    if (inFlight.current || pending === null) return;

    inFlight.current = true;
    setIsIssuing(true);
    setError(null);

    void (async () => {
      await runRelease(pending);
      inFlight.current = false;
      setIsIssuing(false);
    })();
  }, [pending, runRelease]);

  return { issue, retryRelease, isIssuing, releasedNo, pending, isCreateUncertain, error };
};
