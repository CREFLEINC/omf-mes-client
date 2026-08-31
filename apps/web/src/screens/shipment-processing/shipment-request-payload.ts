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
}

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
    lines: input.lineDrafts.map(toLineCreate),
  };
};
