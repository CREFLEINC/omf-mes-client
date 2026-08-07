import { messages } from '@omf-mes/i18n';

import type { BuMapDraft } from './bu-map-draft';

/**
 * 사업부 매핑 편집 창의 검증.
 *
 * **계약의 제약 이름을 그대로 옮긴 것만 만든다**(결정 7).
 *
 * | 로컬에서 막는 것 | 계약 근거 |
 * | --- | --- |
 * | 필수 넷(보내는 사업부·받는 사업부·대상 품목·유효 시작) | 스키마 `required` |
 * | 보내는 사업부 ≠ 받는 사업부 | `ck_item_bu_map_distinct` |
 * | 유효 종료 ≥ 유효 시작 | `ck_item_bu_map_dates` |
 *
 * **중복을 막지 않는다.** 계약이 이 표에 유일 제약을 적지 않았다 —
 * 화면이 없는 제약을 흉내 내면 서버가 허용하는 값을 막는다(W-06-02 결정 9 승계).
 * 같은 짝을 두 줄 만들면 서버 400을 배너로 낸다.
 */

const t = messages.itemExtendedAttrs.buMap.validation;

export const validateBuMapDraft = (draft: BuMapDraft): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (draft.fromBusinessUnitId === '') errors.fromBusinessUnitId = t.required;
  if (draft.toBusinessUnitId === '') errors.toBusinessUnitId = t.required;
  if (draft.toItemId === '') errors.toItemId = t.required;
  if (draft.effectiveFrom === '') errors.effectiveFrom = t.required;

  /*
   * `ck_item_bu_map_distinct`. 필수 오류가 이미 붙은 칸에 두 번째 문구를 덮지 않는다 —
   * 「비었다」와 「같으면 안 된다」가 겹치면 무엇을 고쳐야 하는지 흐려진다.
   */
  if (
    draft.fromBusinessUnitId !== '' &&
    draft.fromBusinessUnitId === draft.toBusinessUnitId &&
    errors.toBusinessUnitId === undefined
  ) {
    errors.toBusinessUnitId = t.sameBusinessUnit;
  }

  /*
   * `ck_item_bu_map_dates`. **둘 다 있을 때만** 앞뒤를 본다 —
   * 종료를 비우는 것은 무기한이라 계약이 허용한다.
   *
   * 어느 칸을 고쳐야 하는지 한쪽만 짚으면 다른 칸이 옳다는 뜻이 된다 — 짝 오류는 두 칸에 낸다.
   */
  if (
    draft.effectiveFrom !== '' &&
    draft.effectiveTo !== '' &&
    draft.effectiveTo < draft.effectiveFrom
  ) {
    errors.effectiveFrom = t.validRangeReversed;
    errors.effectiveTo = t.validRangeReversed;
  }

  return errors;
};
