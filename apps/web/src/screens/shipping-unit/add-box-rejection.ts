/**
 * 상자 등록이 막힌 사유를 **다섯 갈래로 가른다**(설계 §5-3).
 *
 * ⭐ **HTTP 상태만으로는 못 가른다.** 여섯 검사가 세 종류 코드로 뭉개진다 — 「마감된 단위」와
 *    「포장 안 된 상자」가 둘 다 `STATE_LOCKED` 다. 그래서 **`field` 를 함께 본다**
 *    (통합 담당 확정 2026-09-16 · 서버 관례상 `ERROR_CODE` 집합은 고정이라 새 코드명을 만들지
 *    않는다).
 *
 * | 무엇 | code | field |
 * | --- | --- | --- |
 * | 마감된 단위 | `STATE_LOCKED` | `shippingUnitId` |
 * | 포장이 끝나지 않은 상자 | `STATE_LOCKED` | `handlingUnitNo` |
 * | 포장 실적이 없는 상자 | `INVALID` | `handlingUnitNo` |
 * | 다른 출하의 상자 | `PAIR` | `handlingUnitNo` |
 * | 이미 다른 단위에 든 상자 | `UNIQUE_VIOLATION` | `handlingUnitNo` |
 * | 취소된 출하 | `STATE_LOCKED` | `shipmentId` |
 * | 없는 상자 | 404 | — |
 *
 * ⛔ **모르는 사유를 다섯 중 하나로 접지 않는다.** 엉뚱한 안내를 하면 담당이 **할 수 없는
 *    조치**를 되풀이한다 — 「새로고침하세요」를 듣고 새로고침해도 안 풀리는 식이다. 모르면
 *    모른다고 하고 서버가 준 말을 그대로 보인다.
 */

import { ApiRequestError } from '../../patterns/request';

import type { AddBoxRejection } from './types';

/** 계약이 오류 봉투에 싣는 칸 — 이 화면이 보는 것만 좁혀 적는다. */
interface ErrorDetail {
  code?: string;
  field?: string;
  message?: string;
}

const SHIPPING_UNIT_FIELD = 'shippingUnitId';
const SHIPMENT_FIELD = 'shipmentId';
const HANDLING_UNIT_FIELD = 'handlingUnitNo';

const HTTP_NOT_FOUND = 404;

/**
 * 봉투에서 갈래를 정하는 한 건을 고른다.
 *
 * ⚠ **첫 건을 그냥 집지 않는다.** 서버가 여러 건을 실을 수 있고, 그중 우리가 아는 짝이
 *   뒤에 올 수 있다 — 아는 짝을 먼저 찾고, 없으면 첫 건으로 사유를 말한다.
 */
const rejectionOf = (detail: ErrorDetail): AddBoxRejection | null => {
  const { code, field } = detail;

  if (code === 'STATE_LOCKED' && field === SHIPPING_UNIT_FIELD) return { kind: 'unitClosed' };
  if (code === 'STATE_LOCKED' && field === SHIPMENT_FIELD) return { kind: 'shipmentCancelled' };
  if (code === 'STATE_LOCKED' && field === HANDLING_UNIT_FIELD) return { kind: 'notPacked' };
  if (code === 'INVALID' && field === HANDLING_UNIT_FIELD) return { kind: 'noAllocation' };
  if (code === 'PAIR' && field === HANDLING_UNIT_FIELD) return { kind: 'otherShipment' };
  if (code === 'UNIQUE_VIOLATION' && field === HANDLING_UNIT_FIELD) {
    return { kind: 'alreadyAssigned' };
  }

  return null;
};

const detailsOf = (error: ApiRequestError): ErrorDetail[] => {
  const { apiError } = error;

  if (apiError.kind === 'validation' || apiError.kind === 'stateLocked') return apiError.errors;

  return [];
};

const messageOf = (error: ApiRequestError, details: readonly ErrorDetail[]): string | null => {
  const spoken = details.find((detail) => (detail.message ?? '').trim() !== '')?.message;

  if (spoken !== undefined) return spoken;

  const { apiError } = error;

  return apiError.kind === 'http' ? (apiError.message ?? null) : null;
};

/**
 * 상자 등록 실패를 화면이 가를 수 있는 사유로 옮긴다.
 *
 * ⚠ 연결 실패(`network`)는 이 함수가 다루지 않는다 — 「상자가 잘못됐다」가 아니라 「묻지
 *   못했다」라서, 부르는 쪽이 먼저 가른다.
 */
export const toAddBoxRejection = (error: unknown): AddBoxRejection => {
  if (!(error instanceof ApiRequestError)) return { kind: 'unknown', message: null };

  if (error.httpStatus === HTTP_NOT_FOUND) return { kind: 'notFound' };

  const details = detailsOf(error);

  for (const detail of details) {
    const matched = rejectionOf(detail);

    if (matched !== null) return matched;
  }

  return { kind: 'unknown', message: messageOf(error, details) };
};
