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
  open: (workOrderId: number, terminalId: number) =>
    ['production-flow', 'work-session', workOrderId, terminalId] as const,
};

/**
 * 닫아야 하는가 — **그 판정만 따로 뽑았다.**
 *
 * ⭐ **화면 밖으로 꺼낸 이유가 있다.** 이 판정이 효과 안에 묻혀 있으면 감지기가 붙지 못한다 —
 *    실제로 방아쇠 검사 한 줄을 지워도 화면 시험 전건이 통과했다(독립 검증 2026-09-16 뮤테이션
 *    ⑤). 되돌릴 수 없는 전이를 여는 판정이라 «지우면 실패하는» 자리가 있어야 한다.
 */
export type EndVerdict =
  /** 아직 판정하지 않는다 — 다시 읽는 중이거나, 생산할 LOT 이 남았거나, 방아쇠가 없다. */
  | 'wait'
  /** 보낸다. */
  | 'send'
  /** 이 단말은 작업 완료 권한이 없다 — 닫지 않고, 왜 열린 채인지 말한다. */
  | 'denied'
  /** 닫아야 하는데 닫을 것을 모른다(세션 조회가 아직·실패, 사번 없음) — 다시 시도할 수 있다. */
  | 'unknown';

export interface EndDecision {
  /** 이 화면이 방금 LOT 을 마감했는가. ⛔ 이것이 없으면 «열어 보기만» 해도 세션이 닫힌다. */
  triggered: boolean;
  /** 현재 LOT 을 다시 읽는 중인가. 그 구간에는 옛 값이 나오므로 판정하지 않는다. */
  isFetching: boolean;
  /** 생산할 LOT 이 남아 있는가. */
  hasLot: boolean;
  /** 단말·공정의 작업 완료 권한 판정. */
  gate: 'allowed' | 'denied' | 'unavailable' | 'unidentified' | 'checking';
  hasSession: boolean;
  /** 세션 조회가 아직 답을 주지 않았는가. **모르는 것과 없는 것을 가른다.** */
  isSessionPending: boolean;
  hasWorkerNo: boolean;
}

export const judgeSessionEnd = (decision: EndDecision): EndVerdict => {
  if (!decision.triggered || decision.isFetching || decision.hasLot) return 'wait';

  /*
   * ⚠ **답을 기다리는 중이면 판정하지 않는다.** 아직 안 온 것을 「없다」로 읽으면, 잠시 뒤
   *   도착할 세션을 두고 「못 닫았다」가 먼저 뜬다.
   */
  if (decision.isSessionPending) return 'wait';

  /*
   * ⛔ **거부만 「권한 없음」이다.** 조회 중·조회 실패·단말 미식별은 «모른다»이지 «없다»가
   *    아니다 — 한데 묶으면 권한이 있는 단말에 「권한이 없습니다」가 뜬다(독립 검증 지적 ③).
   */
  if (decision.gate === 'denied') return 'denied';
  if (decision.gate !== 'allowed') return 'unknown';

  return decision.hasSession && decision.hasWorkerNo ? 'send' : 'unknown';
};

/** 끝 시각이 비어 있어야 열린 세션이다(공유계약 G-16). */
const isOpen = (session: WorkSession): boolean =>
  session.endedAt === undefined || session.endedAt === '';

/**
 * 받은 목록에서 **닫을 세션 하나**를 고른다.
 *
 * ⛔ **이 단말의 세션만 고른다.** 한 작업지시를 여러 단말이 나눠 돌 수 있고(계약이 막지 않는다 —
 *    유일성은 `uq(workOrderId, sessionNo)` 뿐이다), 단말로 좁히지 않으면 **옆 단말이 지금
 *    돌리고 있는 구간을 끊는다.** 되돌릴 수 없고, 내 세션은 열린 채 남아 W/O 마감도 여전히
 *    막힌다(독립 검증 2026-09-16 실측).
 *
 * ⚠ **질의 축만 믿지 않는다.** 배포본 서버는 모르는 질의 축을 조용히 무시한다(#1095 실측) —
 *   `terminalId` 를 보내도 전체가 올 수 있으므로 여기서 한 번 더 거른다.
 *
 * ⚠ **닫힌 것도 거른다.** 「열린 것만」으로 물었어도 섞여 오면 이미 닫힌 구간에 종료를 보낸다.
 *
 * ⛔ **시각을 사전순으로 비교하지 않는다.** 오프셋이 섞이면(`+09:00` 과 `Z`) 사전순과 시간순이
 *    갈려 「방금 연 세션」이 아닌 것이 닫힌다.
 */
export const pickOwnOpenSession = (
  items: readonly WorkSession[],
  terminalId: number,
): WorkSession | null => {
  const mine = items.filter((session) => isOpen(session) && session.terminalId === terminalId);

  return (
    [...mine].sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt))[0] ??
    null
  );
};

const fetchOpenSession = async (
  client: Client,
  workOrderId: number,
  terminalId: number,
): Promise<WorkSession | null> => {
  const data = await runRequest(() =>
    client.GET('/production/work-sessions', {
      /* 기본이 열린 세션이지만 명시한다 — 기본값이 바뀌면 닫힌 세션을 또 닫으려 든다. */
      params: { query: { workOrderId, terminalId, open: true } },
    }),
  );

  return pickOwnOpenSession(data.items, terminalId);
};

export interface OpenWorkSession {
  session: WorkSession | null;
  /** 아직 답을 기다리는 중인가. 실패로 끝났으면 «기다리는 중»이 아니다. */
  isPending: boolean;
  refetch: () => void;
}

/**
 * **이 단말이** 이 작업지시에서 열어 둔 세션. 여럿이면 가장 늦게 시작한 것을 쓴다 — 저장 측이
 * 한 작업지시에 열린 세션 하나를 강제하지 않고, 작업자가 지금 서 있는 것은 방금 연 세션이다.
 *
 * ⚠ **조회가 실패해도 실적·마감을 막지 않는다.** 이것은 게이팅이 아니라 「닫을 것이 있는가」를
 *   읽는 조회다 — 모르면 닫지 못할 뿐이다. 다만 **모른 채 넘어가지는 않는다**: 닫아야 할
 *   시점에 답이 없으면 화면이 「못 닫았다」로 말하고 다시 시도할 길을 낸다(`screen.tsx`).
 */
export const useOpenWorkSession = (
  workOrderId: number | null,
  terminalId: number | null,
): OpenWorkSession => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: workSessionKeys.open(workOrderId ?? 0, terminalId ?? 0),
    enabled: workOrderId !== null && terminalId !== null,
    queryFn: () => {
      if (workOrderId === null || terminalId === null) {
        throw new Error('작업지시·단말을 모르면 세션을 조회하지 않습니다.');
      }

      return fetchOpenSession(client, workOrderId, terminalId);
    },
  });

  return {
    session: query.data ?? null,
    /* 조회 중이거나 다시 읽는 중이면 아직 답이 아니다. 실패로 «끝난» 것은 답이다 — 「없다」다. */
    isPending: query.isPending || query.isFetching,
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
