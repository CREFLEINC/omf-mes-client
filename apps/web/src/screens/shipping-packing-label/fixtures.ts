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

/** 출하 배분 한 건 — 납품 라벨의 대상. */
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

/** 발행 현황 한 건. `issueCount`가 0보다 크면 그 대상은 재발행이다. */
export const summary = (
  targetId: number,
  issueCount: number,
  lastIssuedAt: string | null = null,
) => ({
  targetId,
  issueCount,
  ...(lastIssuedAt === null ? {} : { lastIssuedAt }),
  lastPrintOutcome: null,
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
  target: { targetTypeCode: 'LOT', targetId, displayName },
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
