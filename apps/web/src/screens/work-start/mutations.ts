import { useApiClient } from '../../patterns/api-context';
import { useMasterWrite, type MasterWriteResult } from '../../patterns/master';
import { workStartKeys } from './queries';
import type { WorkSession, WorkSessionCreate, WorkSessionEventCreate } from './types';

/**
 * 이 화면의 쓰기 둘 — **작업 시작과 재개는 다른 경로다.**
 *
 * ```
 * POST /production/work-sessions                          작업 시작 — 새 세션을 연다
 * POST /production/work-sessions/{workSessionId}/events   재개 — 같은 세션에 사건을 적재한다
 * ```
 *
 * ⛔ **재개가 새 세션을 열지 않는다**(스펙 §5-4 · 통지 #556). 중단해도 세션은 열려 있고
 * `statusCode` 만 「중단」으로 바뀐다 — 재개는 그 구간 «안의» 사건이다. 새로 열면 중단 구간이
 * 사라지고 `sessionNo` 가 뜻 없이 는다.
 *
 * ⛔ **`POST /production/work-orders/{workOrderId}:resume` 를 부르지 않는다** — 실재하지만
 * 이 화면의 [재개] 가 갈 곳이 아니다(요구서 §3-10 정정).
 *
 * ⛔ **본문에 단말·작업자·교대를 싣지 않는다**(통지 #563 · omf-mes#271). 서버가 인증한 단말
 * 토큰과 귀속 헤더에서 푼다 — 계약이 `terminalId` 를 아예 뺐고, `shiftId` 는 시작 시각과
 * 단말의 공장으로 서버가 채운다. **화면이 교대를 계산하지도, 고르는 칸을 두지도 않는다.**
 *
 * ⛔ **오프라인 큐를 만들지 않는다.** 이 화면은 오프라인에서 거부한다(§6-1 · #556) — 담을
 * 곳이 없고 `202` 는 계약에 없다. 성공 응답은 `201` 하나뿐이다.
 *
 * ⚠ **사번 헤더는 인증이 아니라 귀속이다**(D-5). 없으면 서버가 거부하므로 부르는 쪽이 값을
 * 확보한 뒤에만 쓰기를 연다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

/**
 * 재개를 뜻하는 사건 유형.
 *
 * ⚠ **이것은 작업지시 «상태» 코드가 아니다** — 그쪽은 아직 확정되지 않아 `work-order-status.ts`
 * 한 곳에 모아 두었다. 사건 유형 다섯(`START`·`STOP`·`RESUME`·`END`·`CONTROL_OVERRIDE`)은
 * 계약 오퍼레이션 설명이 열거한 **시스템 소유** 값이고, 통지 #556 과 요구서 §3-10 이 이 화면의
 * [재개] 를 `RESUME` 로 지목했다.
 */
const RESUME_EVENT_TYPE_CODE = 'RESUME';

/** 이 화면이 인라인으로 낼 수 있는 필드 — 입력칸을 가진 것이 없다. */
const KNOWN_FIELDS: readonly string[] = [];

export interface StartWorkOptions {
  workerNo: string;
  onSuccess: (session: WorkSession) => void;
}

/**
 * 작업 시작 — 새 세션을 연다.
 *
 * ⭐ **`START` 사건은 화면이 따로 보내지 않는다** — 세션을 여는 오퍼레이션이 같은 트랜잭션으로
 * 만든다(스펙 §5-4 · 계약 설명).
 *
 * ⛔ **낙관적 잠금을 걸지 않는다**(`etagPath: null`) — 신규 생성이라 대조할 판이 아직 없다.
 * 계약도 `If-Match` 를 선택으로 두었다.
 *
 * ⭐ **멱등 키의 수명은 `until-applied`** — 되돌릴 수 없는 쓰기다. 통신이 끊긴 뒤 다시 누르면
 * 서버가 다른 쓰기로 보고 **세션을 두 번 연다.** 보낼 값이 바뀌면 지문이 새 키를 준다.
 */
export const useStartWork = ({
  workerNo,
  onSuccess,
}: StartWorkOptions): MasterWriteResult<WorkSessionCreate> => {
  const { client } = useApiClient();

  return useMasterWrite<WorkSessionCreate, WorkSession>({
    request: (body, headers) =>
      client.POST('/production/work-sessions', {
        params: {
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'X-Worker-No': workerNo,
          },
        },
        body,
      }),
    etagPath: null,
    /* 세션을 열면 그 작업지시의 「열린 세션」이 생긴다 — 재개 조회가 옛 답을 들고 있지 않게 한다. */
    invalidateKeys: [workStartKeys.all],
    knownFields: KNOWN_FIELDS,
    keyLifetime: 'until-applied',
    onSuccess,
  });
};

export interface ResumeWorkOptions {
  workSessionId: number;
  workerNo: string;
  onSuccess: () => void;
}

/**
 * 재개 — 열려 있는 세션에 `RESUME` 사건을 적재한다.
 *
 * ⭐ **사유는 비운다**(요구서 §3-10) — 중단 사유는 중단할 때 남았고, 재개에 다시 실을 값이
 * 아니다.
 *
 * ⭐ **멱등 키의 수명은 `until-applied`** — 사건 적재도 되돌릴 수 없다. 두 번 적재되면 한
 * 세션에 재개가 둘 남아 이력이 사실과 달라진다.
 */
export const useResumeWork = ({
  workSessionId,
  workerNo,
  onSuccess,
}: ResumeWorkOptions): MasterWriteResult<WorkSessionEventCreate> => {
  const { client } = useApiClient();

  return useMasterWrite<WorkSessionEventCreate, unknown>({
    request: (body, headers) =>
      client.POST('/production/work-sessions/{workSessionId}/events', {
        params: {
          path: { workSessionId },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'X-Worker-No': workerNo,
          },
        },
        body,
      }),
    etagPath: null,
    invalidateKeys: [workStartKeys.all],
    knownFields: KNOWN_FIELDS,
    keyLifetime: 'until-applied',
    onSuccess: () => {
      onSuccess();
    },
  });
};

/** 재개 요청 본문. **사유를 싣지 않는다** — 위 주석의 근거다. */
export const toResumeBody = (occurredAt: string): WorkSessionEventCreate => ({
  eventTypeCode: RESUME_EVENT_TYPE_CODE,
  occurredAt,
});
