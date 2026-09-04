import { messages } from '@omf-mes/i18n';

/**
 * 이 화면이 보내고 거르는 코드 값 — 확정된 것과 서버에서 받는 것을 한 곳에서 가른다.
 *
 * | 값 | 상태 | 근거 |
 * | --- | :-: | --- |
 * | 원천 `PRODUCT`·`RETURN` | ✅ 계약 `enum` | `DispositionCandidate.sourceCode` |
 * | 처분 `REWORK`·`SCRAP`·`NORMAL` | ✅ 계약 `enum` | `DispositionDecision.dispositionTypeCode` |
 * | 부적합 상태 셋 | ✅ 코드 사전 등재 · 값은 서버 코드값 | `NONCONFORMANCE_STATUS` — 고객이 편집할 수 없다 |
 * | 심각도 | 서버 코드값 | `NONCONFORMANCE_SEVERITY` — 고객이 늘린다. 화면이 외우지 않는다 |
 */

export interface CodeOption {
  value: string;
  label: string;
}

/** 원천 두 갈래 — 서버가 대상 LOT의 입고 경로로 파생한다. 화면은 «거르는 축»으로만 쓴다. */
export const SOURCE_CODES = ['RETURN', 'PRODUCT'] as const;
export type SourceCode = (typeof SOURCE_CODES)[number];

export const isSourceCode = (value: string): value is SourceCode =>
  (SOURCE_CODES as readonly string[]).includes(value);

export const sourceCodeOptions = (): CodeOption[] =>
  SOURCE_CODES.map((code) => ({
    value: code,
    label: messages.dispositionRequest.values.sourceCode[code],
  }));

export const sourceCodeLabel = (code: string): string =>
  isSourceCode(code) ? messages.dispositionRequest.values.sourceCode[code] : code;

/**
 * 진입 목록의 단계 배지 넷 — 부적합 유무와 그 상태가 한 목록에서 나온다(스펙 §5-7).
 * `NONE`은 계약 값이 아니라 «부적합이 없다»는 사실의 이름이고, 나머지 셋은 `NONCONFORMANCE_STATUS`다.
 */
export const STAGES = ['NONE', 'NOT_REQUESTED', 'PENDING_DECISION', 'DECIDED'] as const;
export type Stage = (typeof STAGES)[number];

export const isStage = (value: string): value is Stage =>
  (STAGES as readonly string[]).includes(value);

export const stageOptions = (): CodeOption[] =>
  STAGES.map((stage) => ({ value: stage, label: messages.dispositionRequest.values.stage[stage] }));

/**
 * 부적합 상태 코드를 단계로 접는다. 모르는 값은 `null` — 「알 수 없음」으로 그리지 않고 코드를
 * 그대로 보이며(G-9), 의뢰 잠금은 그 사실을 사유로 말한다.
 */
export const stageOf = (statusCode: string | null | undefined): Stage | null => {
  if (statusCode === null || statusCode === undefined) return 'NONE';
  return isStage(statusCode) && statusCode !== 'NONE' ? statusCode : null;
};

export const stageLabel = (stage: Stage | null, rawCode: string | null | undefined): string =>
  stage === null ? (rawCode ?? '') : messages.dispositionRequest.values.stage[stage];

export const DISPOSITION_TYPE_CODES = ['REWORK', 'SCRAP', 'NORMAL'] as const;
export type DispositionTypeCode = (typeof DISPOSITION_TYPE_CODES)[number];

export const dispositionTypeLabel = (code: string): string =>
  (DISPOSITION_TYPE_CODES as readonly string[]).includes(code)
    ? messages.dispositionRequest.values.dispositionType[code as DispositionTypeCode]
    : code;

/** 코드값 그룹 — 채번 식별자(`codeGroupId`)가 아니라 코드로 부른다(계약 명시 · 환경마다 다르다). */
export const SEVERITY_CODE_GROUP = 'NONCONFORMANCE_SEVERITY';

/**
 * A-12 — 내용이 판정자의 유일한 입력이다. 이 길이 아래면 «막지 않고» 경고한다.
 * 「불량」 두 글자를 잡는 것이 목적이라 값은 낮게 둔다 — 형식 유도이지 검열이 아니다.
 */
export const DESCRIPTION_SHORT_THRESHOLD = 10;
