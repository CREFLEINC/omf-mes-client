import { messages } from '@omf-mes/i18n';

export interface CodeOption {
  value: string;
  label: string;
}

/** 고정 OpenAPI가 닫은 처분 유형. 선별(sorting)은 계약 값에 없으므로 추가하지 않는다. */
export const DISPOSITION_TYPE_CODES = ['REWORK', 'SCRAP', 'NORMAL'] as const;

/** 심각도·부적합 상태도 같은 사정이다 — 확정 전까지 코드 값을 그대로 보인다. */
export const SEVERITY_CODES: readonly string[] = [];
export const NONCONFORMANCE_STATUS_CODES: readonly string[] = [];

/**
 * ⭐ 원천은 **위 셋과 사정이 다르다 — 계약이 값을 열거했다**(`PRODUCT`·`RETURN`). 그래서
 * G-2의 「값 목록 미정」에 걸리지 않고 선택지를 처음부터 채운다.
 *
 * ⭐ **저장 컬럼이 아니다** — 서버가 대상 LOT의 입고 유형으로 파생해 내리며, 화면은 이 값을
 * **보내지 않는다**(거르는 축으로만 싣는다). 근거: W-03-10 §5-4 · omf-mes#303.
 *
 * ⛔ **값으로 «행동»을 가르지 않는다.** 여기서 코드를 아는 것은 ⓐ 주소에서 온 모르는 값을
 * 거르고 ⓑ 선택지에 이름을 붙이기 위해서다. 값을 보고 다른 일을 하는 분기는 두지 않는다.
 *
 * ⚠ **이름이 겹친다** — 입고 유형의 `PRODUCT`(제품입고)와 뜻이 다르다.
 */
export const SOURCE_CODES = ['PRODUCT', 'RETURN'] as const;

export const toCodeOptions = (codes: readonly string[]): CodeOption[] =>
  codes.map((code) => ({ value: code, label: code }));

/** 원천만 이름이 있다 — 계약이 값을 열거한 축이라 코드를 그대로 보이지 않아도 된다. */
export const sourceCodeOptions = (): CodeOption[] =>
  SOURCE_CODES.map((code) => ({
    value: code,
    label: messages.dispositionDecision.values.sourceCode[code],
  }));

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
