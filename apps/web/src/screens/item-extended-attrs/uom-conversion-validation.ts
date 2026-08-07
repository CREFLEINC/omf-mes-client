import { messages } from '@omf-mes/i18n';

import { duplicateKeyOf, type UomConversionDraft } from './uom-conversion-draft';

/**
 * 단위 환산 편집 창의 검증.
 *
 * **계약의 제약 이름을 그대로 옮긴 것만 만든다**(결정 7).
 *
 * | 로컬에서 막는 것 | 계약 근거 |
 * | --- | --- |
 * | 필수 넷(변환 전·변환 후·환산 비율·유효 시작) | 스키마 `required` |
 * | 변환 전 ≠ 변환 후 | `ck_item_uom_distinct` |
 * | 환산 비율 `> 0` | `exclusiveMinimum: 0` — **0은 허용값이 아니다** |
 * | 유효 종료 ≥ 유효 시작 | `ck_item_uom_dates` |
 * | 중복(변환 전·변환 후·유효 시작) | `uq_item_uom_conversion` |
 *
 * **소수 자릿수를 막지 않는다.** 계약이 `numeric(18,8)`이라 적었으나 스키마에 자릿수 제약이
 * 없고, 화면이 없는 제약을 흉내 내면 서버가 받는 값을 막는다(결정 7).
 */

const t = messages.itemExtendedAttrs.uomConversion.validation;

/** 숫자로 읽을 수 있는가. 빈 문자열을 `Number`가 0으로 읽는 것을 먼저 걸러 낸다. */
const isNumeric = (value: string): boolean => value.trim() !== '' && !Number.isNaN(Number(value));

export const validateUomConversionDraft = (
  draft: UomConversionDraft,
  others: readonly UomConversionDraft[],
): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (draft.fromUomId === '') errors.fromUomId = t.required;
  if (draft.toUomId === '') errors.toUomId = t.required;
  if (draft.effectiveFrom === '') errors.effectiveFrom = t.required;

  if (draft.conversionRate.trim() === '') {
    errors.conversionRate = t.required;
  } else if (!isNumeric(draft.conversionRate) || Number(draft.conversionRate) <= 0) {
    /*
     * 계약 `exclusiveMinimum: 0`. **0을 「비었다」로 다루지 않는다** —
     * 사용자가 실제로 0을 넣었다는 사실과 아무것도 넣지 않았다는 사실은 다르다.
     */
    errors.conversionRate = t.conversionRateInvalid;
  }

  /* `ck_item_uom_distinct`. 필수 오류가 이미 붙은 칸에 두 번째 문구를 덮지 않는다. */
  if (draft.fromUomId !== '' && draft.fromUomId === draft.toUomId && errors.toUomId === undefined) {
    errors.toUomId = t.sameUom;
  }

  /*
   * `ck_item_uom_dates`. **둘 다 있을 때만** 앞뒤를 본다 — 종료를 비우면 무기한이다.
   * 짝 오류는 두 칸에 낸다. 한쪽만 짚으면 다른 칸이 옳다는 뜻이 된다.
   */
  if (
    draft.effectiveFrom !== '' &&
    draft.effectiveTo !== '' &&
    draft.effectiveTo < draft.effectiveFrom
  ) {
    errors.effectiveFrom = t.validRangeReversed;
    errors.effectiveTo = t.validRangeReversed;
  }

  /*
   * `uq_item_uom_conversion` — **유효 종료는 키가 아니다.**
   * 종료만 다른 두 줄은 서버에게 같은 짝이라, 화면이 다르게 세면 저장 시점에야 거부된다.
   * 자기 자신은 세지 않는다 — 수정할 때 세 값을 그대로 두는 것이 정상이다.
   */
  if (errors.fromUomId === undefined && errors.toUomId === undefined) {
    const key = duplicateKeyOf(draft);
    const isDuplicate = others.some(
      (other) => other.draftId !== draft.draftId && duplicateKeyOf(other) === key,
    );

    if (isDuplicate) errors.fromUomId = t.duplicateKey;
  }

  return errors;
};

/**
 * 이미 겹쳐 있는 줄의 초안 키.
 *
 * **서버가 준 목록에 이미 중복이 있을 수 있다**(옛 자료). 그대로 보내면 서버가 거부하므로
 * 저장을 막고 어느 줄이 문제인지 표에서 짚는다 — 저장을 눌러야 알게 하지 않는다.
 */
export const duplicateDraftIds = (drafts: readonly UomConversionDraft[]): Set<string> => {
  const byKey = new Map<string, string[]>();

  for (const draft of drafts) {
    const key = duplicateKeyOf(draft);
    const ids = byKey.get(key);

    if (ids === undefined) {
      byKey.set(key, [draft.draftId]);
    } else {
      ids.push(draft.draftId);
    }
  }

  const duplicates = new Set<string>();

  for (const ids of byKey.values()) {
    if (ids.length > 1) {
      for (const id of ids) duplicates.add(id);
    }
  }

  return duplicates;
};
