import type { components } from '@omf-mes/api-client';

import type { LoadingInfoDraft } from './loading-info-pane';
import { lineAllocationIssues, type LineAllocationDraft } from './line-allocation-draft';

type ShipmentCreate = components['schemas']['ShipmentCreate'];
type ShipmentLineCreate = components['schemas']['ShipmentLineCreate'];

/**
 * 초안 전체(라인·상차정보·창고)를 `POST /logistics/shipments`의 본문으로 접는다.
 *
 * **하나라도 어긋나면 `null`을 낸다** — 부분적으로 유효한 요청을 만들지 않는다. 화면은 이 값이
 * `null`이면 [출하 처리]를 비활성으로 둔다. `expedited`는 이 화면에서 언제나 `false`로
 * 고정한다(계획서 결정 — 긴급 직행은 W-04-05 소관).
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

export interface ShipmentRequestPayloadInput {
  shipmentRequestId: number;
  warehouseId: number | null;
  loadingInfo: LoadingInfoDraft;
  lineDrafts: readonly LineAllocationDraft[];
  /** 영업일·발생시각의 기준 시각. 본문을 만드는 쪽이 한 번 정해 넘긴다 — 아래 `toBusinessDate` 참고 */
  now: Date;
}

const pad2 = (value: number): string => String(value).padStart(2, '0');

/** `YYYY-MM-DD` — 단말의 현지 날짜다. 계약이 `format: date`라 시각·시간대를 붙이면 400이다. */
const toLocalDate = (at: Date): string =>
  `${String(at.getFullYear())}-${pad2(at.getMonth() + 1)}-${pad2(at.getDate())}`;

/** RFC3339 with offset — `2026-09-03T17:05:00+09:00`. 서버가 시간대를 잃지 않게 오프셋을 붙인다. */
const toOffsetDateTime = (at: Date): string => {
  const offsetMinutes = -at.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absolute = Math.abs(offsetMinutes);
  const local = `${toLocalDate(at)}T${pad2(at.getHours())}:${pad2(at.getMinutes())}:${pad2(at.getSeconds())}`;

  return `${local}${sign}${pad2(Math.floor(absolute / 60))}:${pad2(absolute % 60)}`;
};

const trimmedOrUndefined = (value: string): string | undefined => {
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

const idOrUndefined = (value: string): number | undefined => {
  if (value === '') return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
};

const toLineCreate = (line: LineAllocationDraft): ShipmentLineCreate => ({
  shipmentRequestLineId: line.shipmentRequestLineId,
  shippedQty: Number(line.shippedQty),
  uomId: line.uomId,
  allocations: line.allocations.map((allocation) => ({
    // lineAllocationIssues가 이미 비어 있음을 보장했으므로 lotId·qty는 안전하게 좁힐 수 있다.
    lotId: allocation.lotId as number,
    allocatedQty: Number(allocation.qty),
    uomId: line.uomId,
  })),
});

export const toShipmentCreatePayload = (
  input: ShipmentRequestPayloadInput,
): ShipmentCreate | null => {
  if (input.warehouseId === null) return null;
  if (input.lineDrafts.length === 0) return null;
  if (input.lineDrafts.some((line) => lineAllocationIssues(line).length > 0)) return null;

  return {
    shipmentRequestId: input.shipmentRequestId,
    warehouseId: input.warehouseId,
    vehicleNo: trimmedOrUndefined(input.loadingInfo.vehicleNo),
    driverName: trimmedOrUndefined(input.loadingInfo.driverName),
    sealNo: trimmedOrUndefined(input.loadingInfo.sealNo),
    transportDocumentNo: trimmedOrUndefined(input.loadingInfo.transportDocumentNo),
    loadingWorkerId: idOrUndefined(input.loadingInfo.loadingWorkerId),
    carrierId: idOrUndefined(input.loadingInfo.carrierId),
    expedited: false,
    /*
     * ⛔ 영업일·발생시각은 계약이 필수로 세웠다(변경 통지 #666 · 공유계약 C-8). 서버가 수신 시각으로
     * 다시 잡지 않으므로 화면이 정해 보내고, **재시도에서도 처음 값을 그대로 보낸다** — 원장의
     * 유일 제약에 영업일이 들어 있어 자정을 넘긴 재시도가 값을 다시 계산하면 전표가 두 벌 생긴다.
     * 그래서 `now`를 안에서 만들지 않고 받는다: 확인 대화상자가 이 본문을 한 번 얼려 두고 쓴다.
     */
    businessDate: toLocalDate(input.now),
    occurredAt: toOffsetDateTime(input.now),
    lines: input.lineDrafts.map(toLineCreate),
  };
};
