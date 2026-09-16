import type { ApiClient, components } from '@omf-mes/api-client';
import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { useMasterWrite, type MasterWriteResult } from '../../patterns/master';
import { runRequest } from '../../patterns/request';

/**
 * 이 화면이 **세션을 닫는다** — 마지막 LOT 을 마감해 더 생산할 것이 남지 않았을 때다.
 *
 * ⭐ **자동 종료만 여기 있다.** 사람이 눌러서 닫는 [세션 종료] 단추는 `P-02-10`(작업 중단)
 *    소관이고 거기 이미 서 있다(2026-09-06 게이트 승인 · `omf-mes#79`). 같은 단추를 이 화면에
 *    또 두지 않는다 — 세션을 닫는 자리가 둘이 되면 어느 쪽이 정본인지 정할 근거가 없다.
 *
 * ⛔ **세션을 열지 않는다.** 여는 것은 `P-02-01`(작업 시작) 소관이다.
 *
 * ⚠ **오프라인 큐에 싣지 않는다**(사용자 결정 2026-09-16). 계약은 `:end` 를 오프라인 대상으로
 *   두지만 이 화면의 큐는 «작업실적 등록» 한 종류만 담는 모양이라, 종류를 늘리려면 전송 순서
 *   규약(C-16 — 큐에서 가장 먼저 보낸다)까지 손대야 한다. 되돌릴 수 없는 실적 저장 경로를
 *   건드리는 값이 아니므로, 여기서는 **바로 부르고 실패하면 다시 부를 길을 낸다.**
 */

type Client = ApiClient['client'];
type WorkSession = components['schemas']['WorkSession'];
type WorkSessionEnd = components['schemas']['WorkSessionEnd'];

export const workSessionKeys = {
  open: (workOrderId: number) => ['production-flow', 'work-session', workOrderId] as const,
};

/** 끝 시각이 비어 있어야 열린 세션이다(공유계약 G-16). */
const isOpen = (session: WorkSession): boolean =>
  session.endedAt === undefined || session.endedAt === '';

const fetchOpenSession = async (
  client: Client,
  workOrderId: number,
): Promise<WorkSession | null> => {
  const data = await runRequest(() =>
    client.GET('/production/work-sessions', {
      /* 기본이 열린 세션이지만 명시한다 — 기본값이 바뀌면 닫힌 세션을 또 닫으려 든다. */
      params: { query: { workOrderId, open: true } },
    }),
  );

  /*
   * ⚠ **받은 것을 한 번 더 거른다.** 「열린 것만」으로 물었어도 닫힌 세션이 섞여 오면 이미 닫힌
   *   구간에 종료를 보내게 된다 — 서버는 400 으로 막지만, 화면이 스스로 알 수 있는 것을 굳이
   *   서버에 물어 확인할 이유가 없다(`work-hold-register/queries.ts` 와 같은 판단).
   *
   * ⛔ **시각을 사전순으로 비교하지 않는다.** 오프셋이 섞이면(`+09:00` 과 `Z`) 사전순과
   *   시간순이 갈려 「방금 연 세션」이 아닌 것이 닫힌다.
   */
  const open = data.items.filter(isOpen);

  return (
    [...open].sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt))[0] ??
    null
  );
};

export interface OpenWorkSession {
  session: WorkSession | null;
  refetch: () => void;
}

/**
 * 이 작업지시에서 열려 있는 세션. **여럿이면 가장 늦게 시작한 것**을 쓴다 — 저장 측이 한
 * 작업지시에 열린 세션 하나를 강제하지 않고, 작업자가 지금 서 있는 것은 방금 연 세션이다.
 *
 * ⚠ **조회가 실패해도 실적·마감을 막지 않는다.** 이것은 게이팅이 아니라 「닫을 것이 있는가」를
 *   읽는 조회다 — 모르면 닫지 못할 뿐이고, 그때는 작업 중단 화면에서 사람이 닫으면 된다.
 */
export const useOpenWorkSession = (workOrderId: number | null): OpenWorkSession => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: workSessionKeys.open(workOrderId ?? 0),
    enabled: workOrderId !== null,
    queryFn: () => {
      if (workOrderId === null) {
        throw new Error('작업지시를 모르면 세션을 조회하지 않습니다.');
      }

      return fetchOpenSession(client, workOrderId);
    },
  });

  return {
    session: query.data ?? null,
    refetch: () => {
      void query.refetch();
    },
  };
};

/** 단말 시계로 찍는 끝 시각. 시작보다 앞서면 서버가 400 으로 막는다. */
export const buildSessionEnd = (at: Date): WorkSessionEnd => ({
  /*
   * ⛔ **`stopReasonCode` 를 싣지 않는다** — 계약이 「비우기로 정했다」로 못박았다(A-21 · A-25).
   *    값 목록을 못 정한 것이 아니라 비우기로 «정한» 칸이다.
   */
  endedAt: at.toISOString(),
});

/**
 * 세션 닫기.
 *
 * ⛔ **`If-Match` 를 싣지 않는다.** 계약이 선택으로 두었고(C-9), 이 화면은 세션 «단건» 조회를
 *    하지 않아 그 경로의 잠금 값이 보관소에 아예 없다. 목록으로 받은 값은 `/production/
 *    work-sessions` 자리에 담기므로 꺼내 써도 다른 경로의 판번호다.
 *
 * ⭐ **멱등 키는 적용될 때까지 같은 값을 쓴다**(`until-applied`). 되돌릴 수 없는 전이라,
 *    재시도가 새 키로 나가면 서버가 두 번째 종료로 읽을 여지를 준다.
 */
export const useWorkSessionEnd = ({
  workSessionId,
  workerNo,
  onSuccess,
}: {
  workSessionId: number | null;
  workerNo: string;
  onSuccess: () => void;
}): MasterWriteResult<WorkSessionEnd> => {
  const { client } = useApiClient();

  return useMasterWrite<WorkSessionEnd, WorkSession>({
    request: (body, headers) => {
      if (workSessionId === null) throw new Error('세션이 없으면 종료를 보내지 않습니다.');

      return client.POST('/production/work-sessions/{workSessionId}:end', {
        params: {
          path: { workSessionId },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'X-Worker-No': workerNo,
          },
        },
        body,
      });
    },
    etagPath: null,
    invalidateKeys: [['production-flow', 'work-session']],
    knownFields: [],
    keyLifetime: 'until-applied',
    onSuccess,
  });
};
