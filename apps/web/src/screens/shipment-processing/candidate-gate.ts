import type { ShipmentRequestCandidate, ShipmentRequestLineCandidate } from './types';

/**
 * 처리 관문 중 「피킹완료」·「출하검사 완료」 둘 — 목록 배지와 상세 게이트가 함께 쓴다.
 *
 * 셋째 관문(라인별 출하수량과 LOT 배분 합)은 `line-allocation-draft.ts`가 갖는다 — 그것은
 * 서버 라인이 아니라 **화면이 만든 초안**을 대상으로 하는 판정이라 자원이 다르다.
 *
 * `pickingCompleteOnly`·`shippingInspectionStatusCode` 롤업 쿼리가 baseline에 없어
 * 클라이언트가 같은 정의로 재현한다(계획서 미결 항목). 서버 쿼리가 생기면 이 판정을
 * 서버 값으로 바꾸고 이 파일은 걷어낸다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

export type ShipmentGateBlocker =
  'LINES_UNAVAILABLE' | 'PICKING_INCOMPLETE' | 'INSPECTION_NOT_PASSED';

/**
 * 피킹완료 — **전 라인의 `pickedQty === allocatedQty`**(계획서 결정). 라인이 없으면(빈 배열)
 * 완료로 보지 않는다 — 아무것도 배정되지 않은 지시서를 「처리 가능」으로 내면 사용자가
 * 빈 출하를 만들게 된다.
 */
export const isPickingComplete = (lines: readonly ShipmentRequestLineCandidate[]): boolean =>
  lines.length > 0 && lines.every((line) => line.pickedQty === line.allocatedQty);

/** 검사 완료 — 대상이 없거나(NOT_REQUIRED) 전 대상이 합격(PASSED)해야 통과다. */
export const isInspectionPassed = (
  statusCode: ShipmentRequestCandidate['shippingInspectionStatusCode'],
): boolean => statusCode === 'PASSED' || statusCode === 'NOT_REQUIRED';

/**
 * 이 출하작업지시가 막힌 사유 전부. 라인을 못 받았으면(`lines === null`) 다른 판정은
 * 시도하지 않는다 — 근거 없는 「통과」·「막힘」 둘 다 잘못이다.
 */
export const shipmentGateBlockers = (
  candidate: Pick<ShipmentRequestCandidate, 'lines' | 'shippingInspectionStatusCode'>,
): ShipmentGateBlocker[] => {
  if (candidate.lines === null) return ['LINES_UNAVAILABLE'];

  const blockers: ShipmentGateBlocker[] = [];

  if (!isPickingComplete(candidate.lines)) blockers.push('PICKING_INCOMPLETE');
  if (!isInspectionPassed(candidate.shippingInspectionStatusCode))
    blockers.push('INSPECTION_NOT_PASSED');

  return blockers;
};

/**
 * 「피킹완료만」 체크의 클라이언트 필터 — `pickingCompleteOnly` 쿼리가 baseline에 없어
 * 서버가 아니라 이 화면이 **이번 쪽에 받은 결과 안에서만** 걸러낸다(계획서 미결 항목).
 * 그래서 쪽 이동 수치(총 건수 등)는 이 필터를 반영하지 않는다 — 필터 바가 그 사실을 문구로 밝힌다.
 */
export const isCandidateVisible = (
  candidate: Pick<ShipmentRequestCandidate, 'lines' | 'shippingInspectionStatusCode'>,
  pickingCompleteOnly: boolean,
): boolean => {
  if (!pickingCompleteOnly) return true;

  const blockers = shipmentGateBlockers(candidate);
  return !blockers.includes('PICKING_INCOMPLETE') && !blockers.includes('LINES_UNAVAILABLE');
};
