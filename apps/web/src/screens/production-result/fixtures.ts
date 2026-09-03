import type { InspectionRequest, Lot, WorkOrder } from './types';

/** 합성값이다 — 실 운영 값을 쓰지 않는다. */
export const WORK_ORDER_ID = 1001;
export const TERMINAL_ID = 7;
export const PROCESS_ID = 42;
export const WORKER_NO = '900123';
export const LOT_ID = 2002;
export const UOM_ID = 10;
export const ORDER_QTY = 500;

/** 생산 LOT 번호. 34자리 자재 LOT 규칙에 걸리지 않는 모양이다. */
export const LOT_NO = 'PLOT-2026-0902-0007';

export const makeLot = (patch: Partial<Lot> = {}): Lot =>
  ({
    lotId: LOT_ID,
    lotNo: LOT_NO,
    itemId: 1,
    lotTypeCode: 'PRODUCTION',
    plantId: 1,
    initialQty: 0,
    uomId: UOM_ID,
    sourceTypeCode: 'WORK_ORDER',
    sourceId: WORK_ORDER_ID,
    statusCode: 'NORMAL',
    ...patch,
  }) as Lot;

export const makeWorkOrder = (goodQty: number | null = 120): WorkOrder =>
  ({
    workOrderId: WORK_ORDER_ID,
    workOrderNo: 'WO-2026-0902-004',
    productionPlanId: 1,
    routingOperationId: PROCESS_ID,
    itemId: 1,
    itemCode: 'ITM-0001',
    orderQty: ORDER_QTY,
    uomId: UOM_ID,
    workOrderTypeCode: 'NORMAL',
    priorityNo: 100,
    statusCode: 'IN_PROGRESS',
    /* `withProgress` 를 켜지 않은 응답을 흉내 낼 때는 `null` 을 넘긴다 — 「모르는 것」이다. */
    ...(goodQty === null
      ? {}
      : {
          progress: {
            goodQty,
            achievementRate: goodQty / ORDER_QTY,
            varianceQty: ORDER_QTY - goodQty,
            completionJudgmentCode: 'UNDER',
          },
        }),
  }) as WorkOrder;

export const makePendingPqc = (): InspectionRequest =>
  ({
    inspectionRequestId: 5005,
    inspectionTypeCode: 'PQC',
    statusCode: 'REQUESTED',
  }) as InspectionRequest;
