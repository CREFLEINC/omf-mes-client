import { createIdempotencyKey, type components } from '@omf-mes/api-client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { useMasterWrite, type MasterWriteResult } from '../../patterns/master';
import { runRequest, type ApiCallResult } from '../../patterns/request';
import type { QueueListQuery } from '../iqc-inspection/filters';
import { toInspectionQueueResult, type InspectionQueueResult } from '../iqc-inspection/types';

type InspectionResult = components['schemas']['InspectionResult'];
type MeasurementInput = components['schemas']['InspectionMeasurementInput'];
type DefectInput = components['schemas']['InspectionDefectInput'];

const ALL_KEY = ['parts-iqc-inspection'] as const;

type Client = ReturnType<typeof useApiClient>['client'];
type AttachmentUpload = NonNullable<Parameters<Client['POST']>[1]>['body'];

export const partsIqcKeys = {
  all: ALL_KEY,
  queue: (query: PartsQueueQuery) => [...ALL_KEY, 'queue', query] as const,
  drawings: (versionId: number) => [...ALL_KEY, 'drawings', versionId] as const,
  inbound: (requestId: number) => [...ALL_KEY, 'inbound', requestId] as const,
  plan: (planId: number) => [...ALL_KEY, 'plan', planId] as const,
};

/** OA 화면의 목록 질의(`toListQuery`)에 LOT 의 공장을 더한다(서버 P-152 `plantId`). */
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
 * 검사기준 버전의 도면(서버 P-152) — 기준서 엑셀을 올릴 때 「Bản vẽ」 칸 그림을 붙였다. 바이트까지 받아 `blob:` 주소로 낸다.
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
  uomId: number;
  inspectedAt: string;
  inspectedQty: number;
  rejectedQty: number;
  overallJudgmentCode: string;
  measurements: MeasurementInput[];
  defects: DefectInput[];
  judgmentChangeReason?: string;
  remarks: string;
  xrfReport: File | null;
}

/**
 * 제출 한 번 = 임시 저장(측정값 포함) → XRF 성적서 올리기 → 확정.
 *
 * ⭐ 앞 단계가 성공한 회차를 기억한다 — 확정이 실패한 뒤 다시 누르면 새 회차를 만들지 않고 그 회차를 고쳐 확정한다.
 * ⛔ 확정은 되돌릴 수 없다 — 키를 적용될 때까지 쓴다(서버가 두 번 실행하지 않는다).
 */
export const useSubmitInspection = (onDone: () => void): MasterWriteResult<SubmitVariables> => {
  const { client } = useApiClient();
  const queryClient = useQueryClient();
  const saved = useRef<{
    requestId: number;
    resultId: number;
    versionNo: number;
    uploaded: boolean;
  } | null>(null);

  return useMasterWrite<SubmitVariables, InspectionResult>({
    request: async (v, headers): Promise<ApiCallResult<InspectionResult>> => {
      const quantities = {
        acceptedQty: v.inspectedQty - v.rejectedQty,
        rejectedQty: v.rejectedQty,
        heldQty: 0,
        inspectedAt: v.inspectedAt,
        overallJudgmentCode: v.overallJudgmentCode,
        measurements: v.measurements,
        // 불합격이 아니면 빈 배열 — 앞서 임시 저장한 사유를 지운다.
        defects: v.overallJudgmentCode === 'REJECTED' ? v.defects : [],
      };
      const prior = saved.current?.requestId === v.inspectionRequestId ? saved.current : null;
      // 남은 작성중 회차는 지금 판 번호를 읽어 고친다(잠금 토큰).
      const existing =
        prior ??
        (v.draftResultId === null
          ? null
          : {
              requestId: v.inspectionRequestId,
              resultId: v.draftResultId,
              versionNo:
                (
                  await runRequest(() =>
                    client.GET('/quality/inspection-results/{inspectionResultId}', {
                      params: { path: { inspectionResultId: v.draftResultId as number } },
                    }),
                  )
                ).versionNo ?? 0,
              uploaded: false,
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
                overallJudgmentCode: quantities.overallJudgmentCode,
                measurements: quantities.measurements,
                // 새 회차에 빈 배열은 실을 까닭이 없다 — 지울 기록이 없다.
                ...(quantities.defects.length === 0 ? {} : { defects: quantities.defects }),
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
              body: quantities,
            });
      if (draft.error !== undefined) return draft;
      const result = draft.data;
      const current = {
        requestId: v.inspectionRequestId,
        resultId: result.inspectionResultId,
        versionNo: result.versionNo ?? 0,
        uploaded: existing?.uploaded ?? false,
      };
      saved.current = current;

      if (v.xrfReport !== null && !current.uploaded) {
        const form = new FormData();
        form.append('targetTypeCode', 'INSPECTION_RESULT');
        form.append('targetId', String(result.inspectionResultId));
        form.append('file', v.xrfReport);
        const uploaded = await client.POST('/app/attachments', {
          params: { header: { 'Idempotency-Key': createIdempotencyKey() } },
          body: form as unknown as AttachmentUpload,
        });
        if (uploaded.error !== undefined)
          return uploaded as unknown as ApiCallResult<InspectionResult>;
        current.uploaded = true;
      }

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
          ...(v.judgmentChangeReason === undefined
            ? {}
            : { judgmentChangeReason: v.judgmentChangeReason }),
        },
      });
    },
    etagPath: null,
    invalidateKeys: [ALL_KEY, ['iqc-inspection']],
    knownFields: ['judgmentChangeReason', 'defectRecords', 'X-Worker-No'],
    keyLifetime: 'until-applied',
    onSuccess: () => {
      saved.current = null;
      void queryClient.invalidateQueries({ queryKey: ALL_KEY });
      onDone();
    },
  });
};
