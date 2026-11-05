import { messages } from '@omf-mes/i18n';

import type { RoutingHeaderFormValues } from './types';

const t = messages.routing.validation;

/**
 * 헤더 폼이 소유한 입력칸 이름. 서버가 준 필드 오류를 인라인으로 낼지
 * 배너로 올릴지 가르는 기준이며, 목록에 없는 필드명은 삼키지 않고 배너로 간다.
 */
export const ROUTING_HEADER_FORM_FIELDS: readonly string[] = ['routingCode'];

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

  // 유효 시작일 · 종료일은 화면에서 받지 않는다 — 검사하지 않는다(#231). 받은 값의 짝 제약은 서버가 지킨다.

  return errors;
};
