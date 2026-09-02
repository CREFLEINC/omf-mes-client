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

/** 화면이 다루는 작업 세션 한 건. */
export interface WorkSessionView {
  workSessionId: number;
  workOrderId: number;
  sessionNo: number;
  startedAt: string;
  /** **비어 있으면 아직 닫히지 않았다.** */
  endedAt: string | null;
  /** 진행·중단·종료. ⚠ 코드 문자열은 계약이 아직 확정하지 않았다 — 표시에만 쓴다. */
  statusCode: string;
  versionNo: number | null;
}

/**
 * 이 세션이 아직 열려 있는가 — **끝 시각의 부재로 판정한다.**
 *
 * ⛔ 상태 코드로 판정하지 않는다. 그 값의 문자열이 계약에서 아직 확정되지 않아(`statusCode`
 * 설명) 화면이 임의의 문자열을 「열림」으로 읽으면, 설계가 승인한 적 없는 판단이 굳는다.
 * 끝 시각은 뜻이 하나뿐이다.
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
