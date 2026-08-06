import { messages } from '@omf-mes/i18n';

import type { VersionFormValues } from './types';

const t = messages.inspectionStandard.validation;

/**
 * 버전 헤더 폼이 소유한 입력칸 이름. 서버가 준 필드 오류를 인라인으로 낼지
 * 배너로 올릴지 가르는 기준이며, 목록에 없는 필드명은 삼키지 않고 배너로 간다.
 */
export const VERSION_FORM_FIELDS: readonly string[] = [
  'effectiveFrom',
  'effectiveTo',
  'samplingMethodCode',
  'samplingQty',
  'aqlValue',
  'acceptanceNumber',
  'rejectionNumber',
  'inspectionFrequencyCode',
  'frequencyIntervalValue',
  'frequencyIntervalUomCode',
];

/** 빈 값은 「지정하지 않음」이라 검사 대상이 아니다. 0과 구분해야 한다. */
const isBlank = (value: string): boolean => value === '';

/**
 * 보내기 전에 화면에서 잡을 수 있는 것만 잡는다.
 *
 * **`rejectionNumber > acceptanceNumber`를 검사하지 않는다** — 계약에 그 CHECK 가 없다.
 * 화면이 흉내 내면 서버와 다른 답을 낸다.
 *
 * 날짜는 `YYYY-MM-DD` 형식이라 문자열 비교가 곧 시간 순서 비교다.
 */
export const validateVersionForm = (values: VersionFormValues): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (isBlank(values.effectiveFrom)) errors.effectiveFrom = t.required;
  if (isBlank(values.samplingMethodCode)) errors.samplingMethodCode = t.required;
  if (isBlank(values.inspectionFrequencyCode)) errors.inspectionFrequencyCode = t.required;

  /*
   * 짝 제약이라 두 칸 모두에 낸다 — 한쪽만 표시하면 어느 쪽을 고쳐야 하는지 알 수 없다.
   * 유효시작이 비어 있으면 비교할 기준이 없으므로 필수 오류만 남긴다.
   */
  if (
    !isBlank(values.effectiveFrom) &&
    !isBlank(values.effectiveTo) &&
    values.effectiveTo < values.effectiveFrom
  ) {
    errors.effectiveFrom = t.effectiveRangeReversed;
    errors.effectiveTo = t.effectiveRangeReversed;
  }

  /*
   * 주기 값과 단위는 짝이어야 하나 계약이 데이터베이스 CHECK 를 두지 않았다 —
   * 서버가 막아 주지 않으므로 화면이 먼저 막는다.
   */
  if (isBlank(values.frequencyIntervalValue) !== isBlank(values.frequencyIntervalUomCode)) {
    errors.frequencyIntervalValue = t.frequencyPairRequired;
    errors.frequencyIntervalUomCode = t.frequencyPairRequired;
  }

  // 계약 CHECK > 0 — 0은 「없음」이 아니라 위반이다.
  if (!isBlank(values.rejectionNumber)) {
    const rejection = Number(values.rejectionNumber);

    if (!Number.isFinite(rejection) || rejection <= 0) {
      errors.rejectionNumber = t.rejectionNumberInvalid;
    }
  }

  // 계약 CHECK ≥ 0 — 불합격판정개수와 규칙이 다르다. 하나로 뭉뚱그리면 0이 잘못 막힌다.
  if (!isBlank(values.acceptanceNumber)) {
    const acceptance = Number(values.acceptanceNumber);

    if (!Number.isFinite(acceptance) || acceptance < 0) {
      errors.acceptanceNumber = t.acceptanceNumberInvalid;
    }
  }

  // 계약 minimum: 0. 개수이며 계약이 number라 소수를 막지 않는다.
  if (!isBlank(values.samplingQty)) {
    const qty = Number(values.samplingQty);

    if (!Number.isFinite(qty) || qty < 0) {
      errors.samplingQty = t.samplingQtyInvalid;
    }
  }

  return errors;
};
