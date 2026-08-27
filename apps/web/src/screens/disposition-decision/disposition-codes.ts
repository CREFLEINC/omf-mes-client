import { messages } from '@omf-mes/i18n';

export interface CodeOption {
  value: string;
  label: string;
}

/**
 * G-2 — 값 목록이 확정되기 전에는 코드 문자열을 지어내지 않는다.
 *
 * 처분(재작업·폐기·정상)의 실제 코드 값이 미정이라 선택지가 비어 있다. 필드를 감추지 않고
 * **비활성 + 사유**로 두며, 선택지가 없으면 저장 버튼도 함께 잠근다(스펙 §6).
 *
 * ⛔ 선별(sorting)은 값이 와도 받지 않는다 — 1차 범위 밖이고 실행할 화면이 없다.
 * 값 목록이 도착하면 이 상수 한 곳만 채우면 화면 전체가 열린다.
 */
export const DISPOSITION_TYPE_CODES: readonly string[] = [];

/** 심각도·부적합 상태도 같은 사정이다 — 확정 전까지 코드 값을 그대로 보인다. */
export const SEVERITY_CODES: readonly string[] = [];
export const NONCONFORMANCE_STATUS_CODES: readonly string[] = [];

export const toCodeOptions = (codes: readonly string[]): CodeOption[] =>
  codes.map((code) => ({ value: code, label: code }));

/** 선택지가 비었을 때 판정 컨트롤에 붙일 잠금 사유. 있으면 잠그지 않는다. */
export const dispositionLockReason = (codes: readonly string[]): string | undefined =>
  codes.length === 0 ? messages.dispositionDecision.dispositionPending : undefined;

/**
 * 심각도·상태 코드를 이름 없이 그대로 보이는 동안 목록 머리에 다는 안내.
 *
 * ⚠ **비어 있는 쪽을 이름으로 지목한다.** 둘 다 비었을 때만 안내하면, 한쪽 값 목록이 먼저
 * 도착했을 때 남은 쪽이 사유 없이 날코드로 남는다 — G-2가 막으려는 상태 그대로다.
 */
export const scopeWarning = (
  severityCodes: readonly string[],
  statusCodes: readonly string[],
): string | undefined => {
  const t = messages.dispositionDecision.scopeWarning;

  if (severityCodes.length === 0 && statusCodes.length === 0) return t.both;
  if (severityCodes.length === 0) return t.severity;
  if (statusCodes.length === 0) return t.status;

  return undefined;
};
