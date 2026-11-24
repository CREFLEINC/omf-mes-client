import type { components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { INSPECTION_HUB_COUNTS_KEY } from '../../patterns/inspection-hub-counts';
import { useMasterWrite, type MasterWriteResult } from '../../patterns/master';
import { runRequest, type ApiCallResult } from '../../patterns/request';
import { iqcInspectionKeys } from '../iqc-inspection/queries';
import { oqcInspectionKeys } from './queries';
import {
  toShipmentResultBody,
  toShipmentResultUpdateBody,
  type ShipmentResultInput,
} from './shipment-oqc';
import type { InspectionRequestResponse } from './types';

type ShipmentRequest = components['schemas']['ShipmentRequest'];
type ShipmentRequestLot = components['schemas']['ShipmentRequestLot'];
type SerialInput = components['schemas']['InspectionSerialJudgmentInput'];
type InspectionResult = components['schemas']['InspectionResult'];

/**
 * 출하 OQC 새 흐름(피처 010)의 조회 · 쓰기 — W-04-03 · P-04-06 이 함께 쓴다.
 *
 * 의뢰 상세는 지금 화면의 상세(`toInspectionRequestDetail` — 옛 흐름 칸만 옮긴다)와 따로 원문 그대로 받는다. 피킹 LOT · 결과 ·
 * LOT 판정이 거기 실린다. 고객 · 납품처 · 목표 · 창고 몫 · 교체 근거는 지시서 상세에서 읽는다(참고 — 못 읽어도 판정은 된다).
 */
export const shipmentOqcKeys = {
  detail: (inspectionRequestId: number) =>
    [...oqcInspectionKeys.all, 'shipment-detail', inspectionRequestId] as const,
  shipmentRequest: (shipmentRequestId: number) =>
    [...oqcInspectionKeys.all, 'shipment-request', shipmentRequestId] as const,
};

export const useShipmentOqcRequest = (
  inspectionRequestId: number | null,
): UseQueryResult<InspectionRequestResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: shipmentOqcKeys.detail(inspectionRequestId ?? 0),
    enabled: inspectionRequestId !== null,
    queryFn: () =>
      runRequest(() =>
        client.GET('/quality/inspection-requests/{inspectionRequestId}', {
          params: { path: { inspectionRequestId: inspectionRequestId as number } },
        }),
      ),
  });
};

/** 지시서에서 읽는 참고 값 — 이 품목 라인의 목표 · 피킹 · 피킹 LOT(창고 몫 · 교체 근거)와 고객 · 납품처 이름. */
export interface ShipmentRequestRef {
  shipmentRequestNo: string;
  customerName: string | null;
  shipToName: string | null;
  /** 이 품목 라인의 품목 코드 · 이름 — 의뢰 응답에 없을 때(옛 서버) 머리 품목 칸이 쓴다. */
  itemCode: string | null;
  itemName: string | null;
  targetQty: number;
  pickedQty: number;
  overQty: number;
  /** LOT 번호 → 지시서의 피킹 LOT 행(교체된 행 포함). */
  lotOf: (lotId: number) => ShipmentRequestLot | null;
  /**
   * 피처 012 US3-5 — LOT 이 든 라인과 그 라인의 출고 창고 · 공장. 옛 라인(창고 미지정)은 창고가 `null`.
   * 같은 품목이 창고별 라인으로 나뉘어도 의뢰는 하나(지시서 × 품목)라 LOT 마다 어느 창고인지 보인다.
   */
  lotPlaceOf: (
    lotId: number,
  ) => { lineNo: number; warehouseName: string | null; plantName: string | null } | null;
}

export const toShipmentRequestRef = (
  request: ShipmentRequest,
  itemId: number,
  names: { customer: string | null; shipTo: string | null },
): ShipmentRequestRef => {
  const lines = (request.lines ?? []).filter((line) => line.itemId === itemId);
  const lots = lines.flatMap((line) => line.lots ?? []);
  const targetQty = lines.reduce((sum, line) => sum + line.allocatedQty, 0);
  const pickedQty = lines.reduce((sum, line) => sum + line.pickedQty, 0);

  return {
    shipmentRequestNo: request.shipmentRequestNo,
    customerName: names.customer,
    shipToName: names.shipTo,
    itemCode: lines[0]?.itemCode ?? null,
    itemName: lines[0]?.itemName ?? null,
    targetQty,
    pickedQty,
    overQty: Math.max(0, pickedQty - targetQty),
    /* 같은 LOT 이 교체 뒤 다시 피킹될 수 있다 — 살아 있는 행을 먼저 본다. */
    lotOf: (lotId) =>
      lots.find((lot) => lot.lotId === lotId && lot.statusCode !== 'REPLACED') ??
      lots.find((lot) => lot.lotId === lotId) ??
      null,
    lotPlaceOf: (lotId) => {
      const line = lines.find((candidate) =>
        (candidate.lots ?? []).some((lot) => lot.lotId === lotId && lot.statusCode !== 'REPLACED'),
      );
      if (line === undefined) return null;
      return {
        lineNo: line.lineNo,
        warehouseName: line.warehouse?.warehouseName ?? null,
        plantName: line.warehouse?.plantName ?? null,
      };
    },
  };
};

/** 지시서 참고 값 조회 — 못 읽어도 판정은 된다(칸이 「—」로 선다). */
export interface ShipmentRequestRefQuery {
  data: ShipmentRequestRef | undefined;
  isError: boolean;
}

export const useShipmentRequestRef = (
  shipmentRequestId: number | null,
  itemId: number,
): ShipmentRequestRefQuery => {
  const { client } = useApiClient();
  const request = useQuery({
    queryKey: shipmentOqcKeys.shipmentRequest(shipmentRequestId ?? 0),
    enabled: shipmentRequestId !== null,
    queryFn: () =>
      runRequest(() =>
        client.GET('/logistics/shipment-requests/{shipmentRequestId}', {
          params: { path: { shipmentRequestId: shipmentRequestId as number } },
        }),
      ),
  });
  /* 고객 · 납품처 이름은 지시서 응답의 `customer` · `shipTo` 다 — POP 은 거래처 마스터를 못 읽는다(검증 1회차). */
  return {
    data:
      request.data === undefined
        ? undefined
        : toShipmentRequestRef(request.data, itemId, {
            customer: request.data.customer?.partnerName ?? null,
            shipTo: request.data.shipTo?.partnerName ?? null,
          }),
    isError: request.isError,
  };
};

export interface SaveShipmentResultVariables extends ShipmentResultInput {
  inspectionRequestId: number;
  uomId: number;
  inspectedAt: string;
  serials: readonly SerialInput[];
  /** 고칠 결과 — 새로 더하면 `null`(POP 은 늘 `null`). */
  editing: { inspectionResultId: number; versionNo: number } | null;
}

/**
 * 결과를 더하거나(POST) 작성중 결과를 고친다(PUT · If-Match). 확정이 아니라서 되돌릴 수 있지만 같은 시도의 재시도는
 * 같은 멱등 키로 나가야 결과가 둘 생기지 않는다(`until-applied`).
 *
 * POP 은 사번 헤더(`X-Worker-No`)로 검사자를 정한다 — 관리웹은 계정 세션이라 넘기지 않는다.
 */
export const useSaveShipmentResult = (
  inspectionRequestId: number | null,
  onSaved: (result: InspectionResult) => void,
  workerNo?: string,
): MasterWriteResult<SaveShipmentResultVariables> => {
  const { client } = useApiClient();
  const id = inspectionRequestId ?? 0;

  return useMasterWrite<SaveShipmentResultVariables, InspectionResult>({
    request: (variables, headers): Promise<ApiCallResult<InspectionResult>> => {
      const workerHeaders = workerNo === undefined ? {} : { headers: { 'X-Worker-No': workerNo } };
      if (variables.editing !== null) {
        return client.PUT('/quality/inspection-results/{inspectionResultId}', {
          params: {
            path: { inspectionResultId: variables.editing.inspectionResultId },
            header: {
              'Idempotency-Key': headers['Idempotency-Key'],
              'If-Match': String(variables.editing.versionNo),
            },
          },
          ...workerHeaders,
          /* 관리웹 결과 서랍이 검사일시를 고칠 수 있다 — 고침에도 싣는다(omf-all-around#356). */
          body: { ...toShipmentResultUpdateBody(variables), inspectedAt: variables.inspectedAt },
        });
      }
      return client.POST('/quality/inspection-results', {
        params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
        ...workerHeaders,
        body: toShipmentResultBody(variables),
      });
    },
    etagPath: null,
    invalidateKeys: [
      shipmentOqcKeys.detail(id),
      oqcInspectionKeys.detail(id),
      oqcInspectionKeys.rounds(id),
      oqcInspectionKeys.queues(),
      oqcInspectionKeys.serialRecords(id),
      /* 결과 서랍이 되살리는 측정치(IQC 측정치 조회) — 고친 뒤 다시 열면 새 값으로. */
      [...iqcInspectionKeys.all, 'measurements'],
      INSPECTION_HUB_COUNTS_KEY,
      ['inspection-history', id],
    ],
    knownFields: [],
    keyLifetime: 'until-applied',
    onSuccess: onSaved,
  });
};
