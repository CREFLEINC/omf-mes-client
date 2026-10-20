import type { components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import { toLotHistoryBounds } from '../lot-status-history/request-queries';

/*
 * IQC 이력 상세(omf-all-around#85) — W-03-05 의 LOT 찾기와 상세 창의 이력 구획이 읽는 것.
 * 서버 변경은 결과 목록의 `lotId` 질의·`inspectorName` 하나(P-76)이고, 나머지는 이미 있는 조회를 묶는다.
 */

type DefectRecord = components['schemas']['DefectRecord'];
type Nonconformance = components['schemas']['Nonconformance'];
type DispositionDecision = components['schemas']['DispositionDecision'];
export type InspectionPlanVersion = components['schemas']['InspectionPlanVersion'];

const KEY = ['inspection-result-insights', 'history'] as const;

/** 불량·원인 코드 한 쪽 크기 — 공용 마스터라 수백 줄을 넘지 않는다고 본다(IQC 입력 화면과 같은 값). */
const CODE_PAGE_SIZE = 500;
/** 한 회차의 불량 기록은 많아야 몇 줄이다. */
const DEFECT_PAGE_SIZE = 50;
/** 한 LOT 의 부적합은 많아야 몇 건이다. */
const NONCONFORMANCE_PAGE_SIZE = 50;

/**
 * MES LOT 번호(정확히) → id. 없으면 `null`. 목록은 이 id 로 좁힌다(서버 P-76).
 * ⚠ 번호가 공장마다 겹칠 수 있다는 근거는 없지만, 겹치면 첫 건만 쓴다 — 둘째 건은 `total` 로 드러나지 않게 두지 않는다.
 */
export const useLotIdByNo = (lotNo: string): UseQueryResult<number | null> => {
  const { client } = useApiClient();
  const trimmed = lotNo.trim();
  return useQuery({
    queryKey: [...KEY, 'lot-by-no', trimmed],
    enabled: trimmed !== '',
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/trace/lots', { params: { query: { lotNo: trimmed, page: 1, size: 1 } } }),
      );
      return data.items[0]?.lotId ?? null;
    },
  });
};

/** 그 회차 검사기준 버전 — 샘플링 방식을 읽는다. 기준이 없는 의뢰면 부르지 않는다. */
export const useInspectionPlanVersion = (
  inspectionPlanVersionId: number | null,
): UseQueryResult<InspectionPlanVersion> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: [...KEY, 'plan-version', inspectionPlanVersionId],
    enabled: inspectionPlanVersionId !== null,
    queryFn: () =>
      runRequest(() =>
        client.GET('/quality/inspection-plan-versions/{inspectionPlanVersionId}', {
          params: { path: { inspectionPlanVersionId: inspectionPlanVersionId as number } },
        }),
      ).then((response) => response.inspectionPlanVersion),
  });
};

export interface DefectReasonRow {
  defectRecordId: number;
  defectCodeLabel: string;
  qty: number;
  causeLabel: string | null;
  description: string | null;
}

const codeLabel = (code: string, name: string): string => `${code} · ${name}`;

/**
 * 그 회차의 불량 사유 — 불량 기록(`inspectionResultId=` · 서버 P-42)에 불량·원인 코드 이름을 붙인다.
 * 이름을 못 찾은 코드는 id 를 숨기지 않고 그대로 보인다.
 */
export const useResultDefectReasons = (
  inspectionResultId: number,
): UseQueryResult<DefectReasonRow[]> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: [...KEY, 'defects', inspectionResultId],
    queryFn: async () => {
      const [records, defectCodes, causeCodes] = await Promise.all([
        runRequest(() =>
          client.GET('/quality/defect-records', {
            params: { query: { inspectionResultId, page: 1, size: DEFECT_PAGE_SIZE } },
          }),
        ),
        runRequest(() =>
          client.GET('/quality/defect-codes', {
            params: { query: { includeInactive: true, page: 1, size: CODE_PAGE_SIZE } },
          }),
        ),
        runRequest(() =>
          client.GET('/quality/cause-codes', {
            params: { query: { includeInactive: true, page: 1, size: CODE_PAGE_SIZE } },
          }),
        ),
      ]);
      const defectName = new Map(
        defectCodes.items.map((code) => [
          code.defectCodeId,
          codeLabel(code.defectCode, code.defectName),
        ]),
      );
      const causeName = new Map(
        causeCodes.items.map((code) => [
          code.causeCodeId,
          codeLabel(code.causeCode, code.causeName),
        ]),
      );
      return records.items.map((record: DefectRecord) => {
        const causeId = record.suspectedCauseCodeId;
        return {
          defectRecordId: record.defectRecordId,
          defectCodeLabel: defectName.get(record.defectCodeId) ?? String(record.defectCodeId),
          qty: record.defectQty,
          causeLabel: causeId === undefined ? null : (causeName.get(causeId) ?? String(causeId)),
          description: record.defectDescription ?? null,
        };
      });
    },
  });
};

export interface LotRejection {
  nonconformance: Nonconformance;
  decisions: DispositionDecision[];
}

/**
 * 그 LOT 의 부적합마다 처분 판정 이력(폐기·재작업·선별·정상). 부적합 목록은 기간이 필수라 LOT 상태 이력과
 * 같은 «그 LOT 의 전 기간»(W-03-01 `toLotHistoryBounds`)으로 묻는다.
 */
export const useLotRejections = (lotId: number | null): UseQueryResult<LotRejection[]> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: [...KEY, 'rejections', lotId],
    enabled: lotId !== null,
    queryFn: async () => {
      const bounds = toLotHistoryBounds(new Date());
      const list = await runRequest(() =>
        client.GET('/quality/nonconformances', {
          params: {
            query: {
              lotId: lotId as number,
              openedFrom: bounds.occurredFrom,
              openedTo: bounds.occurredTo,
              page: 1,
              size: NONCONFORMANCE_PAGE_SIZE,
            },
          },
        }),
      );
      return Promise.all(
        list.items.map(async (nonconformance) => {
          const decisions = await runRequest(() =>
            client.GET('/quality/nonconformances/{nonconformanceId}/disposition-decisions', {
              params: { path: { nonconformanceId: nonconformance.nonconformanceId } },
            }),
          );
          return { nonconformance, decisions: decisions.items };
        }),
      );
    },
  });
};
