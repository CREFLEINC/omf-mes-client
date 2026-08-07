import type { components } from '@omf-mes/api-client';

/**
 * W-06-11 화면 슬라이스의 계약.
 *
 * `api-client`는 `import type`으로만 참조한다 — 런타임 코드를 끌어오지 않아야 화면의 순수성이 유지된다.
 *
 * 이 화면은 **읽기만 한다.** 계약에 이 자원의 쓰기 오퍼레이션이 없고 상세 조회 경로도 없다 —
 * 목록 응답 한 벌이 표와 변경 내용 창의 유일한 자료다.
 */

/** 계약이 내려주는 변경 이력 한 건. 전후 값의 자료형만 화면 타입으로 옮긴다(아래 참고). */
type AuditEventResponse = components['schemas']['AuditEvent'];

export type PageMeta = components['schemas']['PageMeta'];

/**
 * 계약이 키 구조를 정하지 않은 값. **화면은 해석하지 않고 표기만 한다.**
 *
 * 생성 타입은 이 자리를 `Record<string, never>`로 옮긴다 — `openapi-typescript`가
 * `additionalProperties`가 없는 자유 형식 객체를 그렇게 옮기기 때문이다. 그대로 두면
 * `Object.entries()`의 값이 전부 `never`가 되어 표기 함수에 넘길 수 없고,
 * 테스트 픽스처에 값을 담을 수도 없다.
 */
export type FreeFormValues = Record<string, unknown>;

/**
 * 생성 타입의 `Record<string, never>`를 화면 타입으로 옮긴다.
 *
 * 계약이 자유 형식으로 둔 것을 생성기가 「값이 없는 객체」로 옮겼을 뿐이므로
 * **이 한 곳에서만** 좁힘을 푼다 — 다른 곳에서 단언을 반복하지 않는다.
 * `Record<string, never>`는 `Record<string, unknown>`에 그대로 대입되므로 타입 단언이 필요 없다.
 */
export const toFreeFormValues = (
  value: Record<string, never> | null | undefined,
): FreeFormValues | null => (value === null || value === undefined ? null : value);

/**
 * 화면이 다루는 변경 이력 한 건. 계약 응답과 같되 **전후 값의 자료형만 다르다.**
 *
 * 없는 값은 전부 `null`로 모은다 — 키가 없는 경우와 `null`인 경우를 화면이 갈라 다루면
 * 같은 「받지 못했다」가 두 갈래로 흩어진다.
 */
export interface AuditEventView
  extends Omit<
    AuditEventResponse,
    'beforeValue' | 'afterValue' | 'reason' | 'performedBy' | 'terminalId' | 'correlationId'
  > {
  beforeValue: FreeFormValues | null;
  afterValue: FreeFormValues | null;
  reason: string | null;
  performedBy: number | null;
  terminalId: number | null;
  correlationId: string | null;
}

/** 응답 한 건을 화면 타입으로 옮기는 **유일한 지점**이다. */
export const toAuditEventView = (data: AuditEventResponse): AuditEventView => ({
  auditEventId: data.auditEventId,
  occurredAt: data.occurredAt,
  targetTypeCode: data.targetTypeCode,
  targetId: data.targetId,
  eventTypeCode: data.eventTypeCode,
  beforeValue: toFreeFormValues(data.beforeValue),
  afterValue: toFreeFormValues(data.afterValue),
  reason: data.reason ?? null,
  performedBy: data.performedBy ?? null,
  terminalId: data.terminalId ?? null,
  correlationId: data.correlationId ?? null,
});

/** 목록 조회 결과. `page`는 쪽 이동과 위치 표시의 정본이다. */
export interface AuditEventListResult {
  items: AuditEventView[];
  page: PageMeta;
}
