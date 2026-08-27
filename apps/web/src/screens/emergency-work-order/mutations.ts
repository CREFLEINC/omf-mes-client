import type { ApiError, components } from '@omf-mes/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { runRequest, toApiError } from '../../patterns/request';
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
 * 발행·배포. **한 액션이지만 호출은 셋이다.**
 *
 * ```
 * ① POST /production/work-orders               (멱등 키 · 계획 참조 null)
 * ②③ 배포 한 걸음 — 토큰을 얻고 배포를 낸다
 * ```
 *
 * ⛔ **①과 ③ 사이에는 트랜잭션이 없다.** 서버가 한 트랜잭션으로 묶는 것은 ①의 «안쪽»
 * (내부 P/O·계획·W/O)이다. ①이 성공하고 ③이 실패하면 **배포되지 않은 W/O 가 남고, 화면은
 * 그것을 되돌릴 수 없다** — 이 화면에 취소 액션이 없고, 취소를 끌어다 쓰는 것은 스펙이
 * 요구하지 않은 보상을 화면이 발명하는 일이다. 그래서 **「성공이라고 말하지 않는」 데까지**
 * 한다(omf-mes#258).
 *
 * ⚠ **화면을 떠나면 이 상태가 사라진다.** 만들어진 번호·멱등 키·재시도할 본문이 컴포넌트와
 * 함께 없어져, 배포 안 된 W/O 가 아무 데도 남지 않는다. 되찾을 수단이 계약에 없고(「배포되지
 * 않은 긴급 W/O」를 찾을 축이 없다), 저장소를 붙이는 것은 **스펙에 없는 저장을 화면이
 * 발명하는 일**이라 하지 않았다 — 설계 저장소에 물어 두었다(omf-mes#258).
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
          const created = await runRequest<WorkOrder | undefined>(() =>
            client.POST('/production/work-orders', {
              params: {
                header: { 'Idempotency-Key': createKeyFor(JSON.stringify(createBody)) },
              },
              /*
               * ⚠ 생성 타입이 낡아 계획 참조를 널 불가로 들고 있다(#543). 본문은 정본대로
               * 만들어 두고 **이 한 자리에서만** 낡은 타입에 맞춘다 — 보내는 값은 바뀌지 않고,
               * 감지기가 실제로 `null` 이 실리는지를 고정한다. 생성물이 갱신되면 지운다.
               */
              body: createBody as unknown as components['schemas']['WorkOrderCreate'],
            }),
          );

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
