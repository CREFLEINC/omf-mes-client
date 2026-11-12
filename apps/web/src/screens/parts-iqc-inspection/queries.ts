import {
  createIdempotencyKey,
  type components,
  type FourMChangeForward,
} from '@omf-mes/api-client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { INSPECTION_HUB_COUNTS_KEY } from '../../patterns/inspection-hub-counts';
import { useMasterWrite, type MasterWriteResult } from '../../patterns/master';
import { runRequest, type ApiCallResult } from '../../patterns/request';
import type { QueueListQuery } from '../iqc-inspection/filters';
import { toInspectionQueueResult, type InspectionQueueResult } from '../iqc-inspection/types';

type InspectionResult = components['schemas']['InspectionResult'];
type MeasurementInput = components['schemas']['InspectionMeasurementInput'];
type DefectInput = components['schemas']['InspectionDefectInput'];

const ALL_KEY = ['parts-iqc-inspection'] as const;

export const partsIqcKeys = {
  all: ALL_KEY,
  queue: (query: PartsQueueQuery) => [...ALL_KEY, 'queue', query] as const,
  drawings: (versionId: number) => [...ALL_KEY, 'drawings', versionId] as const,
  inbound: (requestId: number) => [...ALL_KEY, 'inbound', requestId] as const,
  plan: (planId: number) => [...ALL_KEY, 'plan', planId] as const,
};

/** OA 화면의 목록 질의(`toListQuery`)에 LOT 의 공장을 더한다(서버 P-155 `plantId`). */
export type PartsQueueQuery = QueueListQuery & { plantId: number };

/** 부품 공장 LOT 의 IQC 의뢰만 — OA 공장 LOT 은 OA 화면이 다룬다. */
export const usePartsQueue = (query: PartsQueueQuery) => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: partsIqcKeys.queue(query),
    queryFn: (): Promise<InspectionQueueResult> =>
      runRequest(() => client.GET('/quality/inspection-requests', { params: { query } })).then(
        toInspectionQueueResult,
      ),
  });
};

/** 검사기준 버전 — 샘플 기준·AQL·합격판정개수. */
export const usePlanVersion = (versionId: number | null) => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: [...ALL_KEY, 'version', versionId ?? 0] as const,
    enabled: versionId !== null,
    queryFn: () =>
      runRequest(() =>
        client.GET('/quality/inspection-plan-versions/{inspectionPlanVersionId}', {
          params: { path: { inspectionPlanVersionId: versionId as number } },
        }),
      ).then((response) => response.inspectionPlanVersion),
  });
};

/** 검사기준(관리번호·이름) — 화면 머리의 「검사 기준서」 칸. */
export const useInspectionPlan = (planId: number | null) => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: partsIqcKeys.plan(planId ?? 0),
    enabled: planId !== null,
    staleTime: Infinity,
    queryFn: () =>
      runRequest(() =>
        client.GET('/quality/inspection-plans/{inspectionPlanId}', {
          params: { path: { inspectionPlanId: planId as number } },
        }),
      ).then((response) => response.inspectionPlan),
  });
};

/**
 * 검사기준 버전의 도면(서버 P-155) — 기준서 엑셀을 올릴 때 「Bản vẽ」 칸 그림을 붙였다. 바이트까지 받아 `blob:` 주소로 낸다.
 * 도면이 없으면 빈 목록이다.
 */
export const useDrawings = (versionId: number | null) => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: partsIqcKeys.drawings(versionId ?? 0),
    enabled: versionId !== null,
    staleTime: Infinity,
    queryFn: async (): Promise<{ attachmentId: number; blob: Blob }[]> => {
      const listed = await runRequest(() =>
        client.GET('/app/attachments', {
          params: {
            query: { targetTypeCode: 'INSPECTION_PLAN_VERSION', targetId: versionId as number },
          },
        }),
      );
      const rows = [...listed.items].sort((a, b) => a.attachmentId - b.attachmentId);
      return Promise.all(
        rows.map(async (row) => ({
          attachmentId: row.attachmentId,
          blob: (await runRequest(() =>
            client.GET('/app/attachments/{attachmentId}/content', {
              params: { path: { attachmentId: row.attachmentId } },
              parseAs: 'blob',
            }),
          )) as Blob,
        })),
      );
    },
  });
};

export interface InboundInfo {
  receiptNo: string | null;
  receivedAt: string | null;
  supplierLabel: string | null;
}

/**
 * 로트 구역의 공급업체·입고일 — 의뢰의 이력이 입하 번호를 주고(P-55), 그 번호로 입하를 찾는다. 의뢰·LOT 에는 공급사 칸이 없다.
 * 못 찾으면 칸을 비운다(검사는 막지 않는다).
 */
export const useInboundInfo = (requestId: number | null) => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: partsIqcKeys.inbound(requestId ?? 0),
    enabled: requestId !== null,
    queryFn: async (): Promise<InboundInfo> => {
      const history = await runRequest(() =>
        client.GET('/quality/inspection-requests/{inspectionRequestId}/history', {
          params: { path: { inspectionRequestId: requestId as number } },
        }),
      );
      const receiptNo = history.source.documentNo ?? null;
      if (receiptNo === null) return { receiptNo, receivedAt: null, supplierLabel: null };
      const receipts = await runRequest(() =>
        client.GET('/logistics/inbound-receipts', {
          params: { query: { q: receiptNo, page: 1, size: 5 } },
        }),
      );
      const receipt = receipts.items.find((r) => r.inboundReceiptNo === receiptNo);
      if (receipt === undefined) return { receiptNo, receivedAt: null, supplierLabel: null };
      const partner = await runRequest(() =>
        client.GET('/mdm/partners/{partnerId}', {
          params: { path: { partnerId: receipt.supplierId } },
        }),
      ).catch(() => null);
      return {
        receiptNo,
        receivedAt: receipt.receiptDatetime,
        supplierLabel: partner === null ? null : `${partner.partnerCode} · ${partner.partnerName}`,
      };
    },
  });
};

export interface SubmitVariables {
  inspectionRequestId: number;
  /** 이 의뢰에 남은 작성중 회차 — 있으면 그 회차를 고쳐 확정한다(새 회차를 만들지 않는다). */
  draftResultId: number | null;
  /**
   * 그 회차를 불러올 때의 판 번호 — 저장 직전에 다시 읽지 않는다. 다시 읽으면 그사이 다른 사람이 저장한 내용을 말없이 덮는다
   * (#247 클릭 점검). 모르면 `null` — 그때만 지금 판을 읽는다.
   */
  draftVersionNo?: number | null;
  /** 재검사면 앞 회차 — 서버가 회차를 +1 하고 사슬을 잇는다. 아니면 `null` */
  previousResultId: number | null;
  uomId: number;
  inspectedAt: string;
  inspectedQty: number;
  rejectedQty: number;
  overallJudgmentCode: string;
  measurements: MeasurementInput[];
  defects: DefectInput[];
  judgmentChangeReason?: string;
  remarks: string;
  /**
   * 4M 변경품(OA 화면 · omf-all-around#63) — 고쳤을 때만 싣는다. `null` 이면 변경품 아님(기록을 지운다), 생략하면 그대로 둔다.
   */
  fourMChange?: FourMChangeForward | null;
  /** 임시 저장만 하고 확정하지 않는다(#247 · 사용자 지시 2026-11-10). 판정을 아직 고르지 않았으면 `overallJudgmentCode` 는 `''`. */
  draftOnly?: boolean;
  /**
   * 005 새 흐름(입하 LOT 단위) IQC — 이 결과가 본 자재 관리 LOT(계약 §8). 주면 새 흐름 결과로 보고 싣는다(빈 배열 = 매칭 없음).
   * 새 흐름은 결과를 확정하지 않는다(검사 단위 판정 확정) — 부르는 쪽이 `draftOnly` 와 함께 준다. 옛 IQC · PQC · OQC 는 주지 않는다.
   */
  matchedLotIds?: number[];
}

/**
 * 제출 한 번 = 임시 저장(측정값 포함) → 확정. [임시 저장]은 앞 단계만 한다(`draftOnly`).
 *
 * ⭐ 앞 단계가 성공한 회차를 기억한다 — 확정이 실패한 뒤 다시 누르면 새 회차를 만들지 않고 그 회차를 고쳐 확정한다.
 * ⛔ 확정은 되돌릴 수 없다 — 키를 적용될 때까지 쓴다(서버가 두 번 실행하지 않는다).
 */
export const useSubmitInspection = (
  /** 끝난 회차 — 임시 저장만 했으면 `statusCode` 가 `DRAFT` 다. */
  onDone: (result: InspectionResult) => void,
): MasterWriteResult<SubmitVariables> => {
  const { client } = useApiClient();
  const queryClient = useQueryClient();
  const saved = useRef<{
    requestId: number;
    resultId: number;
    versionNo: number;
  } | null>(null);

  return useMasterWrite<SubmitVariables, InspectionResult>({
    request: async (v, headers): Promise<ApiCallResult<InspectionResult>> => {
      /*
       * 불량이 아닌 수량은 판정이 보류면 보류 수량, 아니면 합격 수량이다(#247 클릭 점검) — 보류로 확정하고 합격 수량을 채우면
       * 대시보드 「검사 보류」 수량이 0 이 되고, 수량으로 보는 자동 판정(합격판정개수)과도 어긋난다.
       */
      const good = v.inspectedQty - v.rejectedQty;
      const held = v.overallJudgmentCode === 'HELD';
      const quantities = {
        acceptedQty: held ? 0 : good,
        rejectedQty: v.rejectedQty,
        heldQty: held ? good : 0,
        inspectedAt: v.inspectedAt,
        ...(v.overallJudgmentCode === '' ? {} : { overallJudgmentCode: v.overallJudgmentCode }),
        measurements: v.measurements,
        /* 비고는 임시 저장에도 싣는다 — 다시 열면 칸이 채워진다(#247). */
        remarks: v.remarks.trim(),
        ...(v.fourMChange === undefined ? {} : { fourMChange: v.fourMChange }),
        // 불합격 판정이거나 불합격 수량이 있으면 그 불량 유형(#205), 아니면 빈 배열 — 앞서 임시 저장한 사유를 지운다.
        defects: v.defects,
      };
      const prior = saved.current?.requestId === v.inspectionRequestId ? saved.current : null;
      // 남은 작성중 회차는 불러올 때의 판 번호로 고친다(잠금 토큰) — 모를 때만 지금 판을 읽는다.
      const existing =
        prior ??
        (v.draftResultId === null
          ? null
          : {
              requestId: v.inspectionRequestId,
              resultId: v.draftResultId,
              versionNo:
                v.draftVersionNo ??
                (
                  await runRequest(() =>
                    client.GET('/quality/inspection-results/{inspectionResultId}', {
                      params: { path: { inspectionResultId: v.draftResultId as number } },
                    }),
                  )
                ).versionNo ??
                0,
            });
      const draft =
        existing === null
          ? await client.POST('/quality/inspection-results', {
              params: { header: { 'Idempotency-Key': createIdempotencyKey() } },
              body: {
                inspectionRequestId: v.inspectionRequestId,
                inspectedQty: v.inspectedQty,
                uomId: v.uomId,
                statusCode: 'DRAFT',
                acceptedQty: quantities.acceptedQty,
                rejectedQty: quantities.rejectedQty,
                heldQty: quantities.heldQty,
                inspectedAt: quantities.inspectedAt,
                ...(quantities.overallJudgmentCode === undefined
                  ? {}
                  : { overallJudgmentCode: quantities.overallJudgmentCode }),
                measurements: quantities.measurements,
                ...(quantities.remarks === '' ? {} : { remarks: quantities.remarks }),
                ...(quantities.fourMChange === undefined
                  ? {}
                  : { fourMChange: quantities.fourMChange }),
                ...(v.previousResultId === null ? {} : { previousResultId: v.previousResultId }),
                // 새 회차에 빈 배열은 실을 까닭이 없다 — 지울 기록이 없다.
                ...(quantities.defects.length === 0 ? {} : { defects: quantities.defects }),
                ...(v.matchedLotIds === undefined ? {} : { matchedLotIds: v.matchedLotIds }),
              },
            })
          : await client.PUT('/quality/inspection-results/{inspectionResultId}', {
              params: {
                path: { inspectionResultId: existing.resultId },
                header: {
                  'Idempotency-Key': createIdempotencyKey(),
                  'If-Match': String(existing.versionNo),
                },
              },
              body: {
                ...quantities,
                ...(v.matchedLotIds === undefined ? {} : { matchedLotIds: v.matchedLotIds }),
              },
            });
      if (draft.error !== undefined) return draft;
      const result = draft.data;
      const current = {
        requestId: v.inspectionRequestId,
        resultId: result.inspectionResultId,
        versionNo: result.versionNo ?? 0,
      };
      saved.current = current;
      if (v.draftOnly === true) return draft;

      const remarks = v.remarks.trim();
      return client.POST('/quality/inspection-results/{inspectionResultId}:confirm', {
        params: {
          path: { inspectionResultId: result.inspectionResultId },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': String(current.versionNo),
          },
        },
        body: {
          overallJudgmentCode: v.overallJudgmentCode,
          ...(remarks === '' ? {} : { remarks }),
          ...(v.fourMChange === undefined ? {} : { fourMChange: v.fourMChange }),
          ...(v.judgmentChangeReason === undefined
            ? {}
            : { judgmentChangeReason: v.judgmentChangeReason }),
        },
      });
    },
    etagPath: null,
    /* 위 「대기 · 진행 · 완료」 숫자와 탭 배지도 다시 받는다 — 빠지면 확정 뒤에도 옛 숫자가 남는다. */
    invalidateKeys: [ALL_KEY, ['iqc-inspection'], ['iqc-inbound-lot'], INSPECTION_HUB_COUNTS_KEY],
    // `defects` — 서버가 불량 수량 합계 ≠ 불합격 수량을 400 으로 돌려준다(omf-all-around#205 · P-156). 불량 유형 칸 아래에 붙인다.
    knownFields: ['judgmentChangeReason', 'defectRecords', 'defects', 'X-Worker-No'],
    keyLifetime: 'until-applied',
    onSuccess: (data) => {
      /* 임시 저장만 했으면 그 회차 · 판 번호를 이어 쓴다 — 다음 저장이 내가 방금 쓴 판으로 나간다. */
      if (data.statusCode !== 'DRAFT') saved.current = null;
      void queryClient.invalidateQueries({ queryKey: ALL_KEY });
      onDone(data);
    },
  });
};

type InspectionResultRow = components['schemas']['InspectionResult'];

/**
 * 검사 이력(사용자 지시 2026-10-30) — 이 의뢰의 회차 전부. 검사일시 · 검사자까지 보이려고 회차 목록의 원본 줄을 그대로 쓴다
 * (OA 화면의 `useInspectionRounds` 는 그 칸을 걷는다). 큰 회차가 위다.
 */
export const useRoundHistory = (requestId: number | null) => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: [...ALL_KEY, 'history', requestId ?? 0] as const,
    enabled: requestId !== null,
    queryFn: (): Promise<InspectionResultRow[]> =>
      runRequest(() =>
        client.GET('/quality/inspection-results', {
          params: { query: { inspectionRequestId: requestId as number, page: 1, size: 50 } },
        }),
      ).then((response) =>
        [...response.items].sort((a, b) => b.inspectionRound - a.inspectionRound),
      ),
  });
};
