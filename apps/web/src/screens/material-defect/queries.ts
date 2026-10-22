import type { AffectedProductionLots, DefectRecordCreate } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { useMasterWrite, type MasterWriteResult } from '../../patterns/master';
import { runRequest } from '../../patterns/request';
import type { DefectCode } from './defect-code';

/** 불량 기록 원천 — 투입 뒤 발견한 자재 불량(서버 선행 P-52). */
export const MATERIAL_SOURCE = 'MATERIAL';

const DEFECT_CODE_PAGE_SIZE = 200;

const ALL_KEY = ['material-defect'] as const;

export const materialDefectKeys = {
  all: ALL_KEY,
  defectCodes: [...ALL_KEY, 'defect-codes'] as const,
  affected: (lotId: number) => [...ALL_KEY, 'affected', lotId] as const,
};

/** `enabled` — 기록할 LOT 이 정해지기 전에는 부르지 않는다. */
export const useDefectCodes = (enabled = true): UseQueryResult<DefectCode[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: materialDefectKeys.defectCodes,
    enabled,
    queryFn: () =>
      runRequest(() =>
        client.GET('/quality/defect-codes', {
          params: { query: { page: 1, size: DEFECT_CODE_PAGE_SIZE } },
        }),
      ).then((response) => response.items),
  });
};

/**
 * 자재 LOT 이 들어간 생산 LOT. ⚠ **추정이다**(`basis`) — 투입 시각 기준 계보(#166)거나, 계보 이전 작업지시면
 * 그 작업지시의 생산 LOT 전부다. 화면은 어느 쪽인지 밝힌다.
 */
export const useAffectedProductionLots = (
  lotId: number | null,
): UseQueryResult<AffectedProductionLots> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: materialDefectKeys.affected(lotId ?? 0),
    enabled: lotId !== null,
    queryFn: () =>
      runRequest(() =>
        client.GET('/trace/lots/{lotId}/affected-production-lots', {
          params: { path: { lotId: lotId as number } },
        }),
      ),
  });
};

/** 화면이 채우는 몫. 원천은 언제나 자재 불량이다 — 작업지시·공정은 서버가 투입 기록에서 채운다. */
export type MaterialDefectInput = Pick<
  DefectRecordCreate,
  'lotId' | 'defectCodeId' | 'defectQty' | 'uomId' | 'detectedAt' | 'defectDescription'
>;

/**
 * 자재 불량을 기록한다. ⭐ POP 은 사번(`workerNo`)을 싣는다 — 단말 요청은 서버가 그 사번으로 기록자를
 * 정한다. 관리웹은 계정 세션이 기록자라 넘기지 않는다.
 */
export const useRecordMaterialDefect = (
  onRecorded: () => void,
  workerNo?: string,
): MasterWriteResult<MaterialDefectInput> => {
  const { client } = useApiClient();

  return useMasterWrite<MaterialDefectInput, unknown>({
    request: (input, headers) =>
      client.POST('/quality/defect-records', {
        params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
        ...(workerNo === undefined ? {} : { headers: { 'X-Worker-No': workerNo } }),
        body: { ...input, sourceCode: MATERIAL_SOURCE },
      }),
    etagPath: null,
    invalidateKeys: [],
    knownFields: ['defectCodeId', 'defectQty', 'lotId', 'uomId'],
    keyLifetime: 'until-applied',
    onSuccess: onRecorded,
  });
};
