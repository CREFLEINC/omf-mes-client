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
import { type ReleaseKeyHolder, releaseWorkOrder } from './release-step';

type WorkOrder = components['schemas']['WorkOrder'];

/** 만들어진 W/O. 배포까지 갔는지는 따로 본다. */
export interface IssuedWorkOrder {
  workOrderId: number;
  workOrderNo: string;
}

export interface IssueResult {
  issue: (command: IssueCommand) => void;
  /** 만들어졌으나 배포되지 않은 W/O 를 **배포만** 다시 시도한다. */
  retryRelease: () => void;
  isIssuing: boolean;
  /** 발행·배포가 끝까지 간 W/O. */
  released: IssuedWorkOrder | null;
  /** ⛔ 만들어졌으나 배포되지 않은 W/O. 이것이 있으면 새 발행을 막는다. */
  undelivered: IssuedWorkOrder | null;
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
 * 요구하지 않은 보상을 화면이 발명하는 일이다.
 *
 * ⭐ **그래서 「성공이라고 말하지 않는」 데까지 한다.** 만들어진 번호를 들고 있다가 **배포만**
 * 다시 시도하게 한다. 되돌리기는 시도하지 않는다. 이 처리가 의도한 것인지는 설계 저장소에
 * 물어 두었다(omf-mes#258).
 *
 * ⭐ **공용 쓰기 부품을 쓰지 않는다.** 그 부품은 쓰기 «하나»를 다루고 토큰 경로를 렌더 시점에
 * 정하는데, 여기서는 토큰이 붙을 대상이 **①이 끝나야 정해진다** — 렌더 시점에는 없는 값이라
 * 그 자리에 낡은 값이 실린다. 세 호출의 순서와 중간 상태가 이 화면의 본체라 직접 엮는다.
 */
export const useIssueEmergencyWorkOrder = (): IssueResult => {
  const { client, etags } = useApiClient();
  const queryClient = useQueryClient();
  const [undelivered, setUndelivered] = useState<IssuedWorkOrder | null>(null);
  const [released, setReleased] = useState<IssuedWorkOrder | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [isIssuing, setIsIssuing] = useState(false);

  /**
   * 배포에 쓸 본문. 재시도가 **처음과 같은 값**을 보내야 같은 멱등 키가 뜻을 갖는다.
   * 상태가 아니라 참조로 두는 이유는 발행 직후 같은 흐름 안에서 읽어야 해서다.
   */
  const releaseBody = useRef<WorkOrderReleaseBody | null>(null);
  const releaseKey = useRef<ReleaseKeyHolder['current']>(null);

  const handOver = useCallback(
    async (target: IssuedWorkOrder, body: WorkOrderReleaseBody): Promise<void> => {
      await releaseWorkOrder({
        client,
        etags,
        workOrderId: target.workOrderId,
        body,
        keyHolder: releaseKey,
      });

      /* 배포까지 갔을 때만 「배포 안 됨」을 지운다. */
      releaseKey.current = null;
      setUndelivered(null);
      setReleased(target);
      void queryClient.invalidateQueries({ queryKey: emergencyWorkOrderKeys.all });
    },
    [client, etags, queryClient],
  );

  const issue = useCallback(
    (command: IssueCommand): void => {
      const createBody = toWorkOrderCreateBody(command);
      const body = toWorkOrderReleaseBody(command.form.orderQty);
      /* 갖춰지지 않은 입력으로는 아무것도 보내지 않는다 — 잠금이 뚫려도 여기서 멈춘다. */
      if (createBody === undefined || body === undefined) return;

      setIsIssuing(true);
      setError(null);
      setReleased(null);
      releaseBody.current = body;

      void (async () => {
        let target: IssuedWorkOrder;

        try {
          const created = await runRequest<WorkOrder>(() =>
            client.POST('/production/work-orders', {
              params: { header: { 'Idempotency-Key': crypto.randomUUID() } },
              /*
               * ⚠ 생성 타입이 낡아 계획 참조를 널 불가로 들고 있다(#543). 본문은 정본대로
               * 만들어 두고 **이 한 자리에서만** 낡은 타입에 맞춘다 — 보내는 값은 바뀌지 않고,
               * 감지기가 실제로 `null` 이 실리는지를 고정한다. 생성물이 갱신되면 지운다.
               */
              body: createBody as unknown as components['schemas']['WorkOrderCreate'],
            }),
          );
          target = { workOrderId: created.workOrderId, workOrderNo: created.workOrderNo };
        } catch (cause) {
          setError(toApiError(cause));
          setIsIssuing(false);
          return;
        }

        /*
         * ⭐ **만들어진 순간부터 「배포 안 됨」으로 둔다.** 배포가 성공해야 지운다 — 반대로
         * 두면(실패했을 때 표시) 배포 도중 화면이 끊긴 W/O 가 아무 데도 남지 않는다.
         */
        setUndelivered(target);

        try {
          await handOver(target, body);
        } catch (cause) {
          setError(toApiError(cause));
        } finally {
          setIsIssuing(false);
        }
      })();
    },
    [client, handOver],
  );

  const retryRelease = useCallback((): void => {
    const body = releaseBody.current;
    if (undelivered === null || body === null) return;

    setIsIssuing(true);
    setError(null);
    void handOver(undelivered, body)
      .catch((cause: unknown) => setError(toApiError(cause)))
      .finally(() => setIsIssuing(false));
  }, [handOver, undelivered]);

  return { issue, retryRelease, isIssuing, released, undelivered, error };
};
