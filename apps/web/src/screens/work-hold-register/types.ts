import type { components } from '@omf-mes/api-client';

/**
 * P-02-10 화면 슬라이스의 계약.
 *
 * `api-client`는 `import type`으로만 참조한다 — 런타임 코드를 끌어오지 않아야 화면의 순수성이
 * 유지된다. 이 파일은 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 *
 * ⛔ **「진행 중」을 화면이 새로 정의하지 않는다.** 세션 표는 끝 시각과 상태 컬럼을 «둘 다»
 * 갖는다(공유계약 G-16 보완 — 하류에 이미 반대 구조가 있으면 화면은 실재 구조를 쓴다).
 * 그래서 판정을 한 함수에 모은다 — 곳곳에서 다시 쓰면 한 곳이 상태만 보고 다른 곳이 시각만
 * 봐서 같은 세션이 화면마다 다르게 읽힌다.
 */

type WorkSessionResponse = components['schemas']['WorkSession'];
type WorkSessionEventResponse = components['schemas']['WorkSessionEvent'];

/** 이 화면이 보내는 세션 사건 한 건. */
export type WorkSessionEventCreate = components['schemas']['WorkSessionEventCreate'];

/**
 * 세션이 **중단 상태**인가 — 「재개」만 활성이 되는 자리다(스펙 §6).
 *
 * ⭐ 여기서는 상태 코드를 쓴다. 열림/닫힘과 달리 **중단은 끝 시각으로 알 수 없고**, 고정한
 * 계약이 문자열 셋(`RUNNING`·`STOPPED`·`ENDED`)을 확정해 두었다.
 *
 * ⚠ 모르는 문자열이 오면 **중단이 아닌 것으로 읽는다** — 「모른다」를 「중단됐다」로 바꿔
 * 재개 버튼을 열면, 돌고 있는 설비에 재개를 한 번 더 적재한다.
 */
export const RUNNING_STATUS_CODE = 'RUNNING';
export const STOPPED_STATUS_CODE = 'STOPPED';

export const isStoppedSession = (session: Pick<WorkSessionView, 'statusCode'>): boolean =>
  session.statusCode === STOPPED_STATUS_CODE;

/**
 * 지금 **돌고 있는가** — 중단을 걸 수 있는 자리다(스펙 §6).
 *
 * ⛔ **「중단이 아니면 진행 중」으로 읽지 않는다.** 종료(`ENDED`)와 모르는 문자열까지 진행
 * 중으로 삼게 되고, 그러면 이미 끝난 세션에 중단을 걸어 정정할 수 없는 기록을 남긴다.
 */
export const isRunningSession = (session: Pick<WorkSessionView, 'statusCode'>): boolean =>
  session.statusCode === RUNNING_STATUS_CODE;

/** 화면이 다루는 작업 세션 한 건. */
export interface WorkSessionView {
  workSessionId: number;
  workOrderId: number;
  sessionNo: number;
  startedAt: string;
  /** **비어 있으면 아직 닫히지 않았다.** */
  endedAt: string | null;
  /** 진행(`RUNNING`)·중단(`STOPPED`)·종료(`ENDED`). 문자열은 고정한 계약이 확정했다. */
  statusCode: string;
  versionNo: number | null;
}

/**
 * 이 세션이 아직 열려 있는가 — **끝 시각의 부재로 판정한다.**
 *
 * ⛔ 상태 코드로 판정하지 않는다. 열림은 **중단을 포함**하기 때문이다 — `STOPPED` 인 세션도
 * 열려 있고, 그래야 재개할 수 있다. 끝 시각은 뜻이 하나뿐이다.
 */
export const isOpenSession = (session: Pick<WorkSessionView, 'endedAt'>): boolean =>
  session.endedAt === null;

/** 응답 한 건을 화면 타입으로 옮기는 **유일한 지점**이다. */
export const toWorkSessionView = (session: WorkSessionResponse): WorkSessionView => ({
  workSessionId: session.workSessionId,
  workOrderId: session.workOrderId,
  sessionNo: session.sessionNo,
  startedAt: session.startedAt,
  /*
   * 계약이 `null`을 명시하는 자리지만 응답에서 칸 자체가 빠져 올 수도 있다 — 두 모양 다
   * 「닫히지 않았다」이므로 여기서 하나로 접는다. 접지 않으면 `undefined`가 열림 판정을 지나친다.
   */
  endedAt: session.endedAt ?? null,
  statusCode: session.statusCode,
  versionNo: session.versionNo ?? null,
});

/** 화면이 다루는 세션 사건 한 건. */
export interface WorkSessionEventView {
  workSessionEventId: number;
  eventTypeCode: string;
  occurredAt: string;
  reasonCode: string | null;
  /**
   * 서버가 풀어 준 사유 표시명.
   *
   * ⭐ **행마다 사건 유형이 달라 사유의 코드 그룹도 달라진다**(공유계약 A-25). 그래서 표시명을
   * 서버가 내려 준다 — 화면이 자기 목록으로 풀면 남의 유형이 쓰는 사유를 못 푼다.
   */
  reasonName: string | null;
}

export const toWorkSessionEventView = (event: WorkSessionEventResponse): WorkSessionEventView => ({
  workSessionEventId: event.workSessionEventId,
  eventTypeCode: event.eventTypeCode,
  occurredAt: event.occurredAt,
  reasonCode: event.reasonCode ?? null,
  reasonName: event.reasonName ?? null,
});
