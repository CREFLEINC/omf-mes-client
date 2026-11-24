/**
 * 두 추적 화면의 주소와 다른 화면이 이 화면을 여는 주소(피처 015 R-10).
 * - 자재 LOT → 자재 기준 생산 추적(W-02-13), 그 밖의 LOT(생산 LOT · 반제품 포함) → 제품 기준 역추적(W-02-14)
 * - `?lot=` 으로 들어오면 그 LOT 을 목록에 넣고 고른다. 시리얼로 들어온 줄은 `serial` 이 함께 남는다.
 */
import type { TraceDirection } from './types';

export const MATERIAL_TRACE_PATH = '/production/material-trace';
export const PRODUCT_TRACE_PATH = '/production/product-trace';

export const tracePathOf = (direction: TraceDirection): string =>
  direction === 'FORWARD' ? MATERIAL_TRACE_PATH : PRODUCT_TRACE_PATH;

/** LOT 종류로 갈래 — 자재 LOT 만 자재 기준, 그 밖은 제품 기준. */
export const directionOfLotType = (lotTypeCode: string): TraceDirection =>
  lotTypeCode === 'MATERIAL' ? 'FORWARD' : 'BACKWARD';

/** 한 LOT 을 골라 여는 주소. */
export const traceLotHref = (direction: TraceDirection, lotId: number): string =>
  `${tracePathOf(direction)}?${new URLSearchParams({ lot: String(lotId) }).toString()}`;

/** LOT 상세 창의 [추적 보기] — LOT 종류에 맞는 화면에서 그 LOT 을 골라 연다(FR-017). */
export const lotTraceHref = (lot: { lotId: number; lotTypeCode: string }): string =>
  traceLotHref(directionOfLotType(lot.lotTypeCode), lot.lotId);

/** 번호 하나를 스캔한 것처럼 여는 주소 — 옛 주소에 LOT id 가 없고 번호만 있을 때. */
export const traceScanHref = (direction: TraceDirection, q: string): string =>
  `${tracePathOf(direction)}?${new URLSearchParams({ q }).toString()}`;

/**
 * W-02-09 「LOT 생산 이력 조회」의 옛 주소(`/production/lot-trace?…`)를 새 화면 주소로 옮긴다(FR-018, R-10).
 * - `mlot`(자재 LOT 번호) → 자재 기준, `plot`(제품 LOT 번호) → 제품 기준. 탭이 있던 때의 `tab=forward|backward` 와
 *   그 `lot`·`q`(번호)도 같은 규칙이다.
 * - `selected`(LOT id)가 있으면 그 LOT 을 고른다(`?lot=`). 없고 번호만 있으면 그 번호를 스캔한 것처럼 연다(`?q=`).
 * - LOT 이 정해지지 않은 주소(기간·조건만, 입출고 현황 탭)는 자재 기준 최근 목록이다.
 */
export const legacyTraceHref = (params: URLSearchParams): string => {
  const tab = params.get('tab');
  const text = (key: string): string => (params.get(key) ?? '').trim();
  const materialNo = text('mlot') || (tab === 'forward' ? text('lot') || text('q') : '');
  const productNo = text('plot') || (tab === 'backward' ? text('lot') || text('q') : '');
  const direction: TraceDirection = materialNo === '' && productNo !== '' ? 'BACKWARD' : 'FORWARD';
  const selected = text('selected');
  if (/^[1-9][0-9]*$/.test(selected)) return traceLotHref(direction, Number(selected));
  const lotNo = direction === 'FORWARD' ? materialNo : productNo;
  return lotNo === '' ? MATERIAL_TRACE_PATH : traceScanHref(direction, lotNo);
};
