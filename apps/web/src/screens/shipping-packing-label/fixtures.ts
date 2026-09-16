/**
 * 시험용 합성값.
 *
 * ⛔ **계약의 예시값을 그대로 쓰지 않는다** — 공개 저장소라 실 운영 값처럼 보이는 것을 남기지
 * 않는다(저장소 경계). 번호는 전부 지어낸 것이다.
 */

export const SHIPMENT_ID = 9101;
export const WORKER_NO = 'SYN-W-0007';

export const shipment = () => ({
  shipmentId: SHIPMENT_ID,
  shipmentNo: 'SYN-SH-0001',
  shipmentRequestId: 9102,
  warehouseId: 9103,
  statusCode: 'SYN_SHIPMENT_STATUS',
  expedited: false,
});

/** 출하 배분 한 건 — 포장 라벨을 그리는 값이자 취급 단위를 찾는 길. */
export const allocation = (
  shipmentLotAllocationId: number,
  lotId: number,
  lotNo: string | null,
  oqcPassed: boolean,
  handlingUnitId: number | null = null,
) => ({
  shipmentLotAllocationId,
  shipmentLineId: 9201,
  lotId,
  ...(lotNo === null ? {} : { lotNo }),
  ...(handlingUnitId === null ? {} : { handlingUnitId }),
  itemId: 9601,
  /* 계약의 필수 값이다 — 빠뜨리면 스텁이 서버보다 너그러워져 화면의 결손을 덮는다. */
  itemCode: 'F534F50200',
  allocatedQty: 120,
  uomId: 9301,
  oqcPassed,
  packedQty: 120,
});

/** 취급 단위 한 건 — 포장 라벨의 대상. 상세 응답은 봉투로 온다. */
export const handlingUnitDetail = (
  handlingUnitId: number,
  handlingUnitNo: string,
  statusCode = 'SYN_HU_STATUS',
) => ({
  handlingUnit: {
    handlingUnitId,
    handlingUnitNo,
    handlingUnitTypeCode: 'SYN_HU_TYPE',
    statusCode,
  },
  contents: [],
});

/**
 * 출하 단위 한 건 — **납품 라벨의 대상이자 그 라벨 값 전부**(SHIP-UNIT-01).
 *
 * ⚠ 상세 응답이다. 화면이 목록이 아니라 상세를 받는 이유는 `itemTotals` 가 라벨 본문이어서다.
 */
export const shippingUnit = (
  shippingUnitId: number,
  shippingUnitNo: string,
  statusCode: 'OPEN' | 'CLOSED',
  boxCount = 2,
) => ({
  shippingUnitId,
  shippingUnitNo,
  shippingUnitTypeCode: 'SYN_SU_TYPE',
  statusCode,
  shipmentId: SHIPMENT_ID,
  shipmentNo: 'SYN-SH-0001',
  customer: { partnerId: 9701, partnerCode: 'SYN-P-0001', partnerName: 'SYN CUSTOMER' },
  shipTo: { partnerId: 9702, partnerCode: 'SYN-P-0002', partnerName: 'SYN SHIP TO' },
  boxCount,
  versionNo: 1,
  createdAt: '2026-09-17T09:00:00+09:00',
  boxes: [],
  itemTotals: [
    { itemId: 9601, itemCode: 'F534F50200', itemName: 'SYN COVER', qty: 240, uomId: 9301, uomCode: 'EA' },
  ],
});

/** 발행 현황 한 건. `issueCount`가 0보다 크면 그 대상은 재발행이다. */
export const summary = (
  targetId: number,
  issueCount: number,
  lastIssuedAt: string | null = null,
  lastPrintOutcome: 'PENDING' | 'SUCCEEDED' | 'FAILED' | null = null,
) => ({
  targetId,
  issueCount,
  ...(lastIssuedAt === null ? {} : { lastIssuedAt }),
  lastPrintOutcome,
});

/** 발행 기록 한 건. */
export const issueLog = (
  documentIssueLogId: number,
  targetId: number,
  displayName: string,
  issueSeq: number,
) => ({
  documentIssueLogId,
  documentTypeCode: 'DELIVERY_LABEL',
  target: { targetTypeCode: 'SHIPPING_UNIT', targetId, displayName },
  issueSeq,
  issuedAt: '2026-09-02T04:20:00Z',
  printOutcome: 'PENDING',
});

export const printer = (printerName: string, isDefault: boolean) => ({
  printerName,
  displayName: printerName,
  status: 'READY',
  isDefault,
});

export const reissueReason = (code: string, codeName: string) => ({
  codeGroupCode: 'REISSUE_REASON',
  code,
  codeName,
  isActive: true,
});
