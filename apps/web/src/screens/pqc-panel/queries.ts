import type { components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { InspectionMeasurementResponse } from '../pqc-inspection/measurement-rows';

export type InspectionResultResponse = components['schemas']['InspectionResult'];

/** 한 의뢰의 회차가 한 쪽을 넘길 일은 없다 — IQC 화면과 같은 크기다. */
const ROUNDS_PAGE_SIZE = 100;
const MEASUREMENTS_PAGE_SIZE = 500;

export const pqcPanelKeys = {
  rounds: (inspectionRequestId: number) => ['pqc-panel', 'rounds', inspectionRequestId] as const,
  measurements: (inspectionResultId: number) =>
    ['pqc-panel', 'measurements', inspectionResultId] as const,
  allMeasurements: ['pqc-panel', 'measurements'] as const,
};

/** 그 의뢰의 회차 전부 — 늦은 회차가 앞이다. 마지막 회차와 같은 조회(같은 캐시)를 `select` 로만 나눈다. */
const useRoundsQuery = <T>(
  inspectionRequestId: number,
  select: (rounds: InspectionResultResponse[]) => T,
): UseQueryResult<T> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: pqcPanelKeys.rounds(inspectionRequestId),
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/quality/inspection-results', {
          params: { query: { inspectionRequestId, page: 1, size: ROUNDS_PAGE_SIZE } },
        }),
      );
      return [...data.items].sort((a, b) => b.inspectionRound - a.inspectionRound);
    },
    select,
  });
};

const latestOf = (rounds: InspectionResultResponse[]): InspectionResultResponse | null =>
  rounds[0] ?? null;
const allOf = (rounds: InspectionResultResponse[]): InspectionResultResponse[] => rounds;

/**
 * 그 의뢰의 마지막 회차(omf-all-around#107 · 서버 장부 P-49). 회차가 없으면 `null`.
 *
 * ⭐ 패널이 칸을 되살리는 근거다 — 작성중이면 이어 쓰고(다음 저장도 `POST` 이고 서버가 그 회차를 덮는다), 의뢰가
 *    끝났으면 확정 결과를 읽기 전용으로 보인다. 어느 쪽을 쓸지는 패널이 가른다.
 * ⛔ 기간을 보내지 않는다 — 한 의뢰의 회차를 읽는 자리는 `inspectedFrom` 이 필요 없다(계약).
 */
export const useLatestRound = (
  inspectionRequestId: number,
): UseQueryResult<InspectionResultResponse | null> => useRoundsQuery(inspectionRequestId, latestOf);

/** 그 의뢰의 회차 전부(관리웹 검사 결과 표 · omf-all-around#356) — 늦은 회차가 앞이다. */
export const useRounds = (
  inspectionRequestId: number,
): UseQueryResult<InspectionResultResponse[]> => useRoundsQuery(inspectionRequestId, allOf);

/** 되살릴 회차에 저장된 측정치. 회차가 없으면 부르지 않는다. */
export const useRoundMeasurements = (
  inspectionResultId: number | null,
): UseQueryResult<InspectionMeasurementResponse[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: pqcPanelKeys.measurements(inspectionResultId ?? 0),
    enabled: inspectionResultId !== null,
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/quality/inspection-results/{inspectionResultId}/measurements', {
          params: {
            path: { inspectionResultId: inspectionResultId as number },
            query: { page: 1, size: MEASUREMENTS_PAGE_SIZE },
          },
        }),
      );
      return data.items;
    },
  });
};
