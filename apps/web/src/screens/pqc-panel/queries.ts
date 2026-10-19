import type { components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { InspectionMeasurementResponse } from '../pqc-inspection/measurement-rows';

type InspectionResultResponse = components['schemas']['InspectionResult'];

/** 한 의뢰의 회차가 한 쪽을 넘길 일은 없다 — IQC 화면과 같은 크기다. */
const ROUNDS_PAGE_SIZE = 100;
const MEASUREMENTS_PAGE_SIZE = 500;
const DRAFT = 'DRAFT';

export const pqcPanelKeys = {
  rounds: (inspectionRequestId: number) => ['pqc-panel', 'rounds', inspectionRequestId] as const,
  measurements: (inspectionResultId: number) =>
    ['pqc-panel', 'measurements', inspectionResultId] as const,
};

/**
 * 그 의뢰의 «작성중» 회차 — 마지막 회차가 작성중일 때만 돌려준다(omf-all-around#107 · 서버 장부 P-49).
 *
 * ⭐ 패널이 칸을 되살리는 근거다. 다음 저장은 지금처럼 `POST` 이고, 서버가 그 회차를 덮는다.
 * ⛔ 기간을 보내지 않는다 — 한 의뢰의 회차를 읽는 자리는 `inspectedFrom` 이 필요 없다(계약).
 */
export const useDraftRound = (
  inspectionRequestId: number,
): UseQueryResult<InspectionResultResponse | null> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: pqcPanelKeys.rounds(inspectionRequestId),
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/quality/inspection-results', {
          params: { query: { inspectionRequestId, page: 1, size: ROUNDS_PAGE_SIZE } },
        }),
      );
      const latest = [...data.items].sort((a, b) => b.inspectionRound - a.inspectionRound)[0];
      return latest?.statusCode === DRAFT ? latest : null;
    },
  });
};

/** 작성중 회차에 저장된 측정치. 회차가 없으면 부르지 않는다. */
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
