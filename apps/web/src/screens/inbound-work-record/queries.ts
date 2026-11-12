import type { components, InboundLotListQuery } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { fetchAllPages } from '../../patterns/fetch-all-pages';
import { runRequest } from '../../patterns/request';
import type { Candidate, WorkRecordDetail, WorkRecordLot } from './forward-contract';
import type { View } from './types';

type Plant = components['schemas']['Plant'];

const ROOT = ['inbound-work-record'] as const;

export const workRecordKeys = {
  all: ROOT,
  plants: [...ROOT, 'plants'] as const,
  lists: [...ROOT, 'list'] as const,
  list: (view: View, plantId: number, from: string, to: string) =>
    [...ROOT, 'list', view, plantId, from, to] as const,
  detail: (inboundLotId: number) => [...ROOT, 'detail', inboundLotId] as const,
  candidates: (inboundLotId: number) => [...ROOT, 'candidates', inboundLotId] as const,
};

/** 공장 목록 — 쓰는 공장만, 코드 순. */
export const usePlants = (): UseQueryResult<Plant[]> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: workRecordKeys.plants,
    queryFn: async () =>
      (
        await fetchAllPages((page, size) =>
          runRequest(() => client.GET('/mdm/plants', { params: { query: { page, size } } })),
        )
      ).items,
    select: (plants) =>
      plants
        .filter((plant) => plant.isActive)
        .sort((left, right) => left.plantCode.localeCompare(right.plantCode)),
  });
};

/**
 * 보기마다 묻는 조건(계약 §2). **새 흐름(`ON_FINALIZE`)만** — 이전 데이터 입하 LOT 는 나오지 않는다(FR-051).
 * - 마감 승인 대기: `finalizable=true`.
 * - 진행 중: 입하 중 · 입하 완료이면서 `finalizable=false`(C6 정함 — 계약은 참 값만 적었다).
 * - 최종 마감: `statusCode=FINALIZED`.
 */
export const viewQuery = (
  view: View,
): Pick<InboundLotListQuery, 'statusCode' | 'finalizable' | 'erpSendModeCode'> => {
  switch (view) {
    case 'ready':
      return { erpSendModeCode: 'ON_FINALIZE', finalizable: true };
    case 'prog':
      return {
        erpSendModeCode: 'ON_FINALIZE',
        statusCode: ['RECEIVING', 'RECEIVED'],
        finalizable: false,
      };
    case 'final':
      return { erpSendModeCode: 'ON_FINALIZE', statusCode: ['FINALIZED'] };
  }
};

/**
 * 한 보기의 입하 LOT 전부(입하일 기간 안). 공급사 · 품목 · 입하 LOT 찾기는 화면이 거른다 — 탭의 수와 공급사 선택지가
 * 같은 범위를 써야 해서다.
 */
export const useWorkRecordList = (
  view: View,
  plantId: number | null,
  from: string,
  to: string,
): UseQueryResult<WorkRecordLot[]> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: workRecordKeys.list(view, plantId ?? 0, from, to),
    enabled: plantId !== null,
    queryFn: async () =>
      (
        await fetchAllPages((page, size) =>
          runRequest(() =>
            client.GET('/logistics/inbound-lots', {
              params: {
                query: {
                  plantId: plantId ?? 0,
                  receivingDateFrom: from,
                  receivingDateTo: to,
                  ...viewQuery(view),
                  page,
                  size,
                },
              },
            }),
          ),
        )
      ).items,
  });
};

/** 입하 LOT 상세(계약 §2) — 자재 관리 LOT · `finalizeBlockers`. 다른 화면에서 바뀌므로 늘 다시 읽는다. */
export const useWorkRecordDetail = (
  inboundLotId: number | null,
): UseQueryResult<WorkRecordDetail> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: workRecordKeys.detail(inboundLotId ?? 0),
    enabled: inboundLotId !== null,
    staleTime: 0,
    queryFn: () =>
      runRequest(() =>
        client.GET('/logistics/inbound-lots/{inboundLotId}', {
          params: { path: { inboundLotId: inboundLotId as number } },
        }),
      ),
  });
};

/**
 * 매칭 후보 P/O 라인(계약 §5) — 이미 매칭된 라인 포함, 발주일 순. 입하 중이면 매칭이 없어 묻지 않는다.
 */
export const useAllocationCandidates = (
  inboundLotId: number | null,
  enabled: boolean,
): UseQueryResult<Candidate[]> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: workRecordKeys.candidates(inboundLotId ?? 0),
    enabled: inboundLotId !== null && enabled,
    staleTime: 0,
    queryFn: async () =>
      (
        await runRequest(() =>
          client.GET('/logistics/inbound-lots/{inboundLotId}/allocation-candidates', {
            params: { path: { inboundLotId: inboundLotId as number } },
          }),
        )
      ).items,
  });
};
