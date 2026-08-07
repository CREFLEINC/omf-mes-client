import type { components } from '@omf-mes/api-client';

type ItemUomConversion = components['schemas']['ItemUomConversion'];

/**
 * 단위 환산 초안 — 표에 보이는 목록과 치환 본문 사이의 유일한 통로.
 *
 * ## 치환 본문 규칙 셋 (결정 6 · 세 부속 자원이 똑같이 지킨다)
 *
 * | 규칙 | 근거 |
 * | --- | --- |
 * | **서버 식별자를 싣지 않는다** | 계약의 요청 항목에 `itemUomConversionId`가 **없다** |
 * | **`itemId`를 싣지 않는다** | 경로의 `itemId`가 정본이다 |
 * | **순서 필드가 없다** | 이 표에 순서 컬럼이 없다. 배열 순서는 화면 표시 순서일 뿐이다 |
 *
 * **이 파일은 사업부 매핑·외부 코드의 같은 이름 파일을 참조하지 않는다**(결정 6).
 * 셋은 같은 모양이되 필드도 검증도 다르다 — 이 자원만 **유일 제약이 네 컬럼**이다.
 */

/** 치환 본문의 항목 하나. **계약의 요청 항목이 정확히 다섯이고 식별자가 없다.** */
export interface UomConversionItemPayload {
  fromUomId: number;
  toUomId: number;
  conversionRate: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
}

/**
 * 단위 환산 한 줄의 로컬 초안.
 *
 * **환산 비율도 문자열로 들고 다닌다.** 숫자로 바꾸면 `0.10`처럼 사용자가 친 표기가
 * 입력 도중에 흔들리고, 소수점만 찍은 중간 상태(`1.`)를 표현할 수 없다.
 * 계약과의 경계(숫자·널)는 `toUomConversionsPayload` 한 곳에서 넘는다.
 */
export interface UomConversionDraft {
  /** 표의 행 식별자·React key. **서버로 나가지 않는다** */
  draftId: string;
  fromUomId: string;
  toUomId: string;
  /** `numeric(18,8)` · `CHECK > 0` — 0은 허용값이 아니다 */
  conversionRate: string;
  effectiveFrom: string;
  /** 비우면 무기한이다 — 계약이 널을 허용한다 */
  effectiveTo: string;
}

const optionalText = (value: string | null | undefined): string => value ?? '';

/**
 * 서버 응답을 로컬 초안으로 옮긴다.
 *
 * 환산 비율은 **숫자를 문자열로 옮기기만** 한다. 자릿수를 맞추거나 반올림하면
 * 사용자가 고치지 않은 줄이 저장할 때 다른 값이 된다.
 */
export const toUomConversionDrafts = (items: readonly ItemUomConversion[]): UomConversionDraft[] =>
  items.map((item) => ({
    draftId: `saved:${String(item.itemUomConversionId)}`,
    fromUomId: String(item.fromUomId),
    toUomId: String(item.toUomId),
    conversionRate: String(item.conversionRate),
    effectiveFrom: item.effectiveFrom,
    effectiveTo: optionalText(item.effectiveTo),
  }));

/** 아직 저장되지 않은 줄의 초안 키. 한 세션 안에서만 유일하면 된다. */
let newDraftSequence = 0;

export const createUomConversionDraft = (): UomConversionDraft => {
  newDraftSequence += 1;

  return {
    draftId: `new:${String(newDraftSequence)}`,
    fromUomId: '',
    toUomId: '',
    conversionRate: '',
    effectiveFrom: '',
    effectiveTo: '',
  };
};

/** 이미 있는 키는 **자리를 지킨 채** 값만 바꾼다 — 수정이 순서를 흔들면 사용자가 다시 찾아야 한다. */
export const upsertUomConversionDraft = (
  drafts: UomConversionDraft[],
  draft: UomConversionDraft,
): UomConversionDraft[] => {
  const index = drafts.findIndex((item) => item.draftId === draft.draftId);

  if (index === -1) return [...drafts, draft];

  const next = [...drafts];
  next[index] = draft;

  return next;
};

export const removeUomConversionDraft = (
  drafts: UomConversionDraft[],
  draftId: string,
): UomConversionDraft[] => drafts.filter((draft) => draft.draftId !== draftId);

/** 빈 문자열은 「지정하지 않음」이라 계약의 널로 옮긴다. */
const textToOptionalText = (value: string): string | null =>
  value.trim() === '' ? null : value.trim();

/**
 * 전체 치환 요청 본문의 항목 목록.
 *
 * **키를 하나씩 열거해 만든다.** 초안을 스프레드하면 `draftId`가 그대로 실리고,
 * 조회 응답을 스프레드하면 `itemUomConversionId`·`itemId`가 실린다 —
 * 서버가 그것을 막지 않으므로(계약 실측) 이 자리가 유일한 방어다.
 */
export const toUomConversionsPayload = (
  drafts: readonly UomConversionDraft[],
): UomConversionItemPayload[] =>
  drafts.map((draft) => ({
    fromUomId: Number(draft.fromUomId),
    toUomId: Number(draft.toUomId),
    conversionRate: Number(draft.conversionRate),
    effectiveFrom: draft.effectiveFrom,
    effectiveTo: textToOptionalText(draft.effectiveTo),
  }));

/**
 * 유일 제약의 판정 키.
 *
 * 계약의 `uq_item_uom_conversion`이 **네 컬럼**(`item_id`·`from_uom_id`·`to_uom_id`·
 * `effective_from`)으로 접힌다. 품목은 경로로 고정되므로 화면이 세는 것은 나머지 셋이다.
 * 유효 **종료**는 키가 아니다 — 종료만 다른 두 줄은 서버에게 같은 짝이다.
 */
export const duplicateKeyOf = (draft: UomConversionDraft): string =>
  `${draft.fromUomId}#${draft.toUomId}#${draft.effectiveFrom}`;

const isSameDraft = (a: UomConversionDraft, b: UomConversionDraft | undefined): boolean =>
  b !== undefined &&
  a.draftId === b.draftId &&
  a.fromUomId === b.fromUomId &&
  a.toUomId === b.toUomId &&
  a.conversionRate === b.conversionRate &&
  a.effectiveFrom === b.effectiveFrom &&
  a.effectiveTo === b.effectiveTo;

/** 「고친 것이 있는가」의 판정 근거. */
export const isSameUomConversionDrafts = (
  a: readonly UomConversionDraft[],
  b: readonly UomConversionDraft[],
): boolean => a.length === b.length && a.every((draft, index) => isSameDraft(draft, b[index]));
