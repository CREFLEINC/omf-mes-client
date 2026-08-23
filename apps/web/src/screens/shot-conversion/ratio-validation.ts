import { messages } from '@omf-mes/i18n';

import type { RatioFormValues } from './types';

const t = messages.shotConversion.validation;

/**
 * 서버가 준 필드 오류를 **인라인으로 낼 수 있는** 칸 이름.
 *
 * ⛔ **오류를 그릴 자리가 없는 칸을 넣지 않는다** — 넣으면 인라인으로 분류된 뒤 아무 데도
 * 그려지지 않아 **어디에도 표시되지 않는 오류**가 된다.
 *
 * ⚠ `policyCode` 는 여기 없다 — 화면이 붙이는 값이라 고칠 칸이 없다.
 */
export const RATIO_FORM_FIELDS: readonly string[] = [
  'valueNumeric',
  'effectiveFrom',
  'effectiveTo',
  'itemId',
  'processId',
  'plantId',
  'businessUnitId',
];

/** 수로 읽는다. 읽을 수 없으면 `null` — 빈 칸과 「읽을 수 없는 글자」를 갈라 다룬다. */
export const parseRatio = (text: string): number | null => {
  const trimmed = text.trim();

  if (trimmed === '') return null;

  const parsed = Number(trimmed);

  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * 저장을 **막는** 것만 여기 담는다.
 *
 * ⭐ **비율 `> 0` 은 화면이 진다**(공유계약 A-9 등급 2) — 데이터베이스에 CHECK 가 없다.
 * **0이면 타발수가 늘 0이라 누계가 안 늘고 예방보전이 영영 오지 않는다.**
 *
 * ⛔ **1 초과는 막지 않는다** — 한 번에 여러 번 타발하는 공정이 있을 수 있다. 경고는
 * `ratioWarning` 이 따로 낸다(막는 것과 알리는 것은 다른 일이다).
 */
export const validateRatio = (values: RatioFormValues): Record<string, string> => {
  const errors: Record<string, string> = {};
  const raw = values.ratio.trim();

  if (raw === '') {
    errors.valueNumeric = t.required;
  } else {
    const ratio = parseRatio(raw);

    if (ratio === null) {
      errors.valueNumeric = t.ratioNumber;
    } else if (ratio <= 0) {
      errors.valueNumeric = t.ratioPositive;
    }
  }

  if (values.effectiveFrom === '') {
    errors.effectiveFrom = t.required;
  }

  /*
   * ⭐ **짝 제약은 두 칸이 다 있을 때만 잰다** — 종료일만 비어 있는 것은 정상이고
   * (끝이 없다는 뜻), 시작일이 비었으면 그것은 이미 위에서 짚었다.
   *
   * ⚠ **시작일 검사는 지금 결과를 바꾸지 않는다**(관찰상 동치) — 빈 문자열보다 작은
   * 날짜 문자열이 없어, 시작일이 비면 뒤 비교가 어차피 거짓이다. 그럼에도 남기는 것은
   * **의도를 문장으로 못박기 위해서**다: 비교 방식이 문자열에서 날짜 값으로 바뀌는 날
   * 이 줄이 없으면 「시작일이 비었는데 종료일을 나무라는」 오류가 조용히 생긴다.
   */
  if (
    values.effectiveFrom !== '' &&
    values.effectiveTo !== '' &&
    values.effectiveTo < values.effectiveFrom
  ) {
    errors.effectiveTo = t.periodOrder;
  }

  return errors;
};

/**
 * 막지는 않되 **알려야 하는** 것.
 *
 * ⚠ 비율이 1을 넘으면 **수량보다 타발수가 많아진다.** 그런 공정이 있을 수 있어 막지 않지만,
 * 잘못 친 0 하나로 그렇게 되는 일이 훨씬 흔하다 — 그래서 말은 한다.
 */
export const ratioWarning = (values: RatioFormValues): string | null => {
  const ratio = parseRatio(values.ratio);

  return ratio !== null && ratio > 1 ? t.ratioOverOne : null;
};
