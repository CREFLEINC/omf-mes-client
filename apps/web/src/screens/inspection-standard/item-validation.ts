import { messages } from '@omf-mes/i18n';

import type { ItemDraft } from './types';

const t = messages.inspectionStandard.validation;

/**
 * 검사 항목 편집 창이 소유한 입력칸 이름.
 *
 * 전체 치환의 서버 오류는 **어느 행의 오류인지 계약이 알려 주지 않는다** —
 * 그래서 그 실패는 전부 배너로 올리고, 이 목록은 편집 창 안의 로컬 검증에만 쓴다.
 */
export const ITEM_FORM_FIELDS: readonly string[] = [
  'inspectionItemCode',
  'inspectionItemName',
  'dataTypeCode',
  'uomId',
  'targetValue',
  'lowerLimit',
  'upperLimit',
  'measurementCount',
  'inspectionMethodCode',
  'defaultInspectionEquipmentId',
];

/** 빈 값은 「지정하지 않음」이라 검사 대상이 아니다. 0과 구분해야 한다. */
const isBlank = (value: string): boolean => value === '';

const POSITIVE_INTEGER = /^\d+$/;

/**
 * **저장을 막는** 검사 셋.
 *
 * ① 항목코드 버전 내 중복 — 계약에 유일 제약이 없어 막는 곳이 화면과 서버뿐이다
 * ② 상한 ≥ 하한(둘 다 있을 때만) — 계약 `ck_inspection_limits`가 막는다
 * ③ 측정 횟수 ≥ 1인 정수 — 계약 CHECK > 0
 *
 * **목표값이 범위 밖인 것은 여기서 막지 않는다** — 계약이 경고 등급으로 정했고
 * 화면이 막으면 서버가 허용한 값을 넣을 방법이 없어진다(`warnItemDraft` 참조).
 *
 * `siblings`에는 **자기 자신을 포함한 목록 전체**를 넘긴다 — 자기 자신은 초안 키로 걸러낸다.
 */
export const validateItemDraft = (
  draft: ItemDraft,
  siblings: ItemDraft[],
): Record<string, string> => {
  const errors: Record<string, string> = {};

  const code = draft.inspectionItemCode.trim();

  if (isBlank(draft.inspectionItemCode) || code === '') {
    errors.inspectionItemCode = t.required;
  } else if (
    siblings.some(
      (sibling) =>
        sibling.draftId !== draft.draftId && sibling.inspectionItemCode.trim() === code,
    )
  ) {
    errors.inspectionItemCode = t.itemCodeDuplicated;
  }

  if (draft.inspectionItemName.trim() === '') {
    errors.inspectionItemName = t.required;
  }

  // 계약이 둘 다 있을 때만 성립하는 제약으로 정했다 — 한쪽만 있으면 막지 않는다.
  if (!isBlank(draft.lowerLimit) && !isBlank(draft.upperLimit)) {
    const lower = Number(draft.lowerLimit);
    const upper = Number(draft.upperLimit);

    if (Number.isFinite(lower) && Number.isFinite(upper) && upper < lower) {
      // 짝 제약이라 두 칸 모두에 낸다 — 한쪽만 표시하면 어느 쪽을 고쳐야 하는지 알 수 없다.
      errors.lowerLimit = t.limitsReversed;
      errors.upperLimit = t.limitsReversed;
    }
  }

  if (isBlank(draft.measurementCount)) {
    errors.measurementCount = t.required;
  } else if (
    !POSITIVE_INTEGER.test(draft.measurementCount.trim()) ||
    Number(draft.measurementCount) < 1
  ) {
    errors.measurementCount = t.measurementCountInvalid;
  }

  return errors;
};

/**
 * **저장을 막지 않는** 경고.
 *
 * 계약이 「목표가 범위 밖인 것은 데이터베이스가 막지 않는다. 서버가 경고한다」로 정했다 —
 * 관리 한계와 규격 한계가 다른 경우가 업무상 정상이라 서버가 허용하기로 한 것이고,
 * 화면이 막으면 그 값을 넣을 방법이 없어진다.
 */
export const warnItemDraft = (draft: ItemDraft): Record<string, string> => {
  if (isBlank(draft.targetValue)) return {};

  const target = Number(draft.targetValue);

  if (!Number.isFinite(target)) return {};

  const belowLower = !isBlank(draft.lowerLimit) && target < Number(draft.lowerLimit);
  const aboveUpper = !isBlank(draft.upperLimit) && target > Number(draft.upperLimit);

  return belowLower || aboveUpper ? { targetValue: t.targetOutOfRange } : {};
};

/**
 * 목록에 저장할 수 없는 행이 섞여 있는가.
 *
 * **서버가 준 값도 대상이다** — 화면이 만든 행만 검사하면, 값이 어긋난 채 저장된 옛 행이나
 * 이미 중복인 코드가 전체 치환에 그대로 실려 나가 저장 전체가 거부된다.
 */
export const hasInvalidItemDraft = (drafts: ItemDraft[]): boolean =>
  drafts.some((draft) => Object.keys(validateItemDraft(draft, drafts)).length > 0);
