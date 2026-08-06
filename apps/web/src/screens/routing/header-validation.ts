import { messages } from '@omf-mes/i18n';

import type { RoutingHeaderFormValues } from './types';

const t = messages.routing.validation;

/**
 * 헤더 폼이 소유한 입력칸 이름. 서버가 준 필드 오류를 인라인으로 낼지
 * 배너로 올릴지 가르는 기준이며, 목록에 없는 필드명은 삼키지 않고 배너로 간다.
 */
export const ROUTING_HEADER_FORM_FIELDS: readonly string[] = [
  'routingCode',
  'effectiveFrom',
  'effectiveTo',
];

/**
 * 보내기 전에 화면에서 잡을 수 있는 것만 잡는다.
 *
 * 코드 중복과 상태 허용 여부는 검사하지 않는다 — 계약이 그 판정을 서버 몫으로 두었고,
 * 화면이 흉내 내면 서버와 다른 답을 낼 수 있다.
 *
 * 날짜는 `YYYY-MM-DD` 형식이라 문자열 비교가 곧 시간 순서 비교다.
 */
export const validateRoutingHeader = (values: RoutingHeaderFormValues): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (values.routingCode === '') {
    errors.routingCode = t.required;
  } else if (values.routingCode.trim() === '') {
    errors.routingCode = t.codeBlank;
  }

  if (values.effectiveFrom === '') {
    errors.effectiveFrom = t.required;
  }

  /*
   * 짝 제약이라 두 칸 모두에 낸다 — 한쪽만 표시하면 어느 쪽을 고쳐야 하는지 알 수 없다.
   * 유효시작이 비어 있으면 비교할 기준이 없으므로 필수 오류만 남긴다.
   */
  if (
    values.effectiveFrom !== '' &&
    values.effectiveTo !== '' &&
    values.effectiveTo < values.effectiveFrom
  ) {
    errors.effectiveFrom = t.effectiveRangeReversed;
    errors.effectiveTo = t.effectiveRangeReversed;
  }

  return errors;
};
