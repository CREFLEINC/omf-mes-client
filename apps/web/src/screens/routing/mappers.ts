import type { components } from '@omf-mes/api-client';

import type { Routing, RoutingHeaderFormValues } from './types';

type RoutingUpdate = components['schemas']['RoutingUpdate'];
type RoutingCreate = components['schemas']['RoutingCreate'];

/**
 * 계약 표현과 폼 표현 사이의 변환.
 *
 * 폼 값이 전부 문자열인 이유는 DS 입력이 문자열을 다루기 때문이고,
 * 계약은 선택 필드를 널로 표현한다. 그 경계를 여기 한 곳에서 넘는다.
 */

export const routingToFormValues = (routing: Routing): RoutingHeaderFormValues => ({
  routingCode: routing.routingCode,
  effectiveFrom: routing.effectiveFrom,
  // 널·없음을 모두 빈 문자열로 모은다 — 입력칸의 「지정하지 않음」이 하나의 값이어야 한다.
  effectiveTo: routing.effectiveTo ?? '',
});

export const emptyHeaderFormValues = (): RoutingHeaderFormValues => ({
  routingCode: '',
  effectiveFrom: '',
  effectiveTo: '',
});

/**
 * 헤더 수정 요청 본문.
 *
 * **품목·판 번호·상태를 싣지 않는다** — 품목은 등록 후 바꿀 수 없고, 판 번호는 시스템 채번이며,
 * 상태는 전이 오퍼레이션으로만 바뀐다. 실어 보내면 계약 위반이다.
 */
export const toRoutingUpdate = (values: RoutingHeaderFormValues): RoutingUpdate => ({
  // 앞뒤 공백이 붙은 코드는 눈으로 구분되지 않는 다른 코드가 된다.
  routingCode: values.routingCode.trim(),
  effectiveFrom: values.effectiveFrom,
  effectiveTo: values.effectiveTo === '' ? null : values.effectiveTo,
});

/**
 * 첫 Rev 등록 요청 본문. 수정 본문에 품목을 더한 것이 전부다 —
 * 판 번호는 서버가 항상 1로, 상태는 항상 작성중으로 채운다(계약).
 *
 * 품목은 등록할 때만 정할 수 있고 뒤에는 바꿀 수 없어 여기서만 실린다.
 */
export const toRoutingCreate = (
  values: RoutingHeaderFormValues,
  itemId: number,
): RoutingCreate => ({
  ...toRoutingUpdate(values),
  itemId,
});

/** 기준값과 현재 값의 비교. 「고친 것이 있는가」의 판정 근거다. */
export const isSameHeaderValues = (
  a: RoutingHeaderFormValues,
  b: RoutingHeaderFormValues,
): boolean =>
  a.routingCode === b.routingCode &&
  a.effectiveFrom === b.effectiveFrom &&
  a.effectiveTo === b.effectiveTo;
