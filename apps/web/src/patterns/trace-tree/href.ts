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
