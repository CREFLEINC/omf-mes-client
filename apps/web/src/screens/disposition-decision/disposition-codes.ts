import { messages } from '@omf-mes/i18n';

import type { LookupSource } from '../../patterns/lookup-display';
import type { DispositionLookup } from './lookups';

export interface CodeOption {
  value: string;
  label: string;
}

/** 고정 OpenAPI가 닫은 처분 유형. 선별(sorting)은 계약 값에 없으므로 추가하지 않는다. */
export const DISPOSITION_TYPE_CODES = ['REWORK', 'SCRAP', 'NORMAL'] as const;
export type DispositionTypeCode = (typeof DISPOSITION_TYPE_CODES)[number];

/**
 * 처분 셋은 **계약이 `enum` 으로 닫았다** — 공통코드 등록부에 없고 `/mdm/code-values` 를 부르지
 * 않는다(스펙 §4 row 104). 그래서 표시명은 화면이 갖는다(G-33). 모르는 값은 코드 그대로(G-9).
 */
export const dispositionTypeLabel = (code: string): string =>
  (DISPOSITION_TYPE_CODES as readonly string[]).includes(code)
    ? messages.dispositionDecision.values.dispositionType[code as DispositionTypeCode]
    : code;

export const dispositionTypeOptions = (codes: readonly string[]): CodeOption[] =>
  codes.map((code) => ({ value: code, label: dispositionTypeLabel(code) }));

/**
 * 심각도·상태는 **공통코드 그룹**이다(스펙 §4 row 95/97 · G-32) — 값 목록을 화면에 박지 않고
 * `GET /mdm/code-values` 로 받는다. 심각도는 고객이 늘리고(G-31), 상태는 시스템 값이다.
 * 그룹은 코드로 부른다 — 채번 식별자(`codeGroupId`)는 환경마다 다르다.
 */
export const SEVERITY_CODE_GROUP = 'NONCONFORMANCE_SEVERITY';
export const NONCONFORMANCE_STATUS_CODE_GROUP = 'NONCONFORMANCE_STATUS';

/** 필터 선택지 — 활성 값만 고를 수 있다. 이름은 조회가 붙여 준다(`nameKo` → `codeName` → 코드). */
export const codeOptionsOf = (lookup: LookupSource): CodeOption[] =>
  lookup.entries
    .filter((entry) => entry.isActive)
    .map((entry) => ({ value: entry.value, label: entry.label }));

/**
 * 선택칸을 잠글 사유(G-2 — 감추지 않고 사유를 단다). 차례: 못 받음 → 아직 안 옴 → 비어 있음.
 * 없으면 고를 수 있다.
 */
export const codeLockReason = (lookup: DispositionLookup): string | undefined => {
  const t = messages.dispositionDecision.codeLock;

  if (lookup.isError) return t.failed;
  if (lookup.isLoading) return t.loading;

  return codeOptionsOf(lookup).length === 0 ? t.empty : undefined;
};

/** 잘려 왔을 때 선택칸 옆에 두는 안내 — 잠그지는 않는다(받은 값은 고를 수 있다). */
export const codeTruncatedNote = (lookup: DispositionLookup): string | undefined =>
  lookup.truncated ? messages.dispositionDecision.codeTruncated : undefined;

/**
 * 목록 셀의 표시명 — 비활성 값도 이름을 보이고, 모르는 코드는 코드 그대로(G-9). 조회 중·실패에도
 * 코드를 보인다 — 상태 코드는 그 자체가 읽히는 말이라 「알 수 없음」으로 가리지 않는다.
 */
export const codeValueLabel = (lookup: LookupSource, code: string): string =>
  lookup.entries.find((entry) => entry.value === code)?.label ?? code;

/**
 * ⭐ 원천은 **위와 사정이 다르다 — 계약이 값을 열거했다**(`PRODUCT`·`RETURN`). 그래서
 * G-2의 「값 목록 미정」에 걸리지 않고 선택지를 처음부터 채운다.
 *
 * ⭐ **저장 컬럼이 아니다** — 서버가 대상 LOT의 입고 유형으로 파생해 내리며, 화면은 이 값을
 * **보내지 않는다**(거르는 축으로만 싣는다). 근거: W-03-10 §5-4.
 *
 * ⛔ **값으로 «행동»을 가르지 않는다.** 여기서 코드를 아는 것은 ⓐ 주소에서 온 모르는 값을
 * 거르고 ⓑ 선택지에 이름을 붙이기 위해서다. 값을 보고 다른 일을 하는 분기는 두지 않는다.
 *
 * ⚠ **이름이 겹친다** — 입고 유형의 `PRODUCT`(제품입고)와 뜻이 다르다.
 */
export const SOURCE_CODES = ['PRODUCT', 'RETURN'] as const;

/** 원천은 계약이 값을 열거한 축이라 이름을 화면이 갖는다. */
export const sourceCodeOptions = (): CodeOption[] =>
  SOURCE_CODES.map((code) => ({
    value: code,
    label: messages.dispositionDecision.values.sourceCode[code],
  }));

/** 처분 선택지가 비었을 때 판정 컨트롤에 붙일 잠금 사유(방어). 있으면 잠그지 않는다. */
export const dispositionLockReason = (codes: readonly string[]): string | undefined =>
  codes.length === 0 ? messages.dispositionDecision.dispositionPending : undefined;
