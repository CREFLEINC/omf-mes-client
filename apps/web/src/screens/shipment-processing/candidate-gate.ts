import type { ShipmentProgressCode, ShipmentRequestCandidate } from './types';

/**
 * 처리 관문 중 「피킹완료」·「출하검사 완료」 둘 — 목록 배지와 상세 게이트가 함께 쓴다.
 *
 * 셋째 관문(라인별 출하수량과 LOT 배분 합)은 `line-allocation-draft.ts`가 갖는다 — 그것은
 * 서버 라인이 아니라 **화면이 만든 초안**을 대상으로 하는 판정이라 자원이 다르다.
 *
 * 피킹 완료 여부는 서버가 계산한 `shipmentProgressCode`를 사용한다. 화면은 라인 수량으로
 * 진행 상태를 다시 계산하지 않는다. 검사 상태는 별도 롤업 축으로 유지한다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

export type ShipmentGateBlocker =
  'LINES_UNAVAILABLE' | 'PICKING_INCOMPLETE' | 'INSPECTION_NOT_PASSED';

/**
 * 피킹 완료 — `PICKED` 이후의 상태만 통과한다. 부분 출하 뒤 남은 수량도 다시 처리할 수 있고,
 * 이미 전량 출하된 건은 서버의 `shippableRemainderOnly` 후보 조회에서 제외된다.
 */
export const isPickingComplete = (progressCode: ShipmentProgressCode): boolean =>
  progressCode === 'PICKED' || progressCode === 'PARTIALLY_SHIPPED' || progressCode === 'SHIPPED';

/** 검사 완료 — 대상이 없거나(NOT_REQUIRED) 전 대상이 합격(PASSED)해야 통과다. */
export const isInspectionPassed = (
  statusCode: ShipmentRequestCandidate['shippingInspectionStatusCode'],
): boolean => statusCode === 'PASSED' || statusCode === 'NOT_REQUIRED';

/**
 * 이 출하작업지시가 막힌 사유 전부. 라인을 못 받았으면(`lines === null`) 다른 판정은
 * 시도하지 않는다 — 근거 없는 「통과」·「막힘」 둘 다 잘못이다.
 */
export const shipmentGateBlockers = (
  candidate: Pick<
    ShipmentRequestCandidate,
    'lines' | 'shipmentProgressCode' | 'shippingInspectionStatusCode'
  >,
): ShipmentGateBlocker[] => {
  if (candidate.lines === null) return ['LINES_UNAVAILABLE'];

  const blockers: ShipmentGateBlocker[] = [];

  if (!isPickingComplete(candidate.shipmentProgressCode)) blockers.push('PICKING_INCOMPLETE');
  if (!isInspectionPassed(candidate.shippingInspectionStatusCode))
    blockers.push('INSPECTION_NOT_PASSED');

  return blockers;
};
