import type { components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { fetchAllPages } from '../../patterns/fetch-all-pages';
import { runRequest } from '../../patterns/request';
import type { Defaults, Group } from './types';

type Plant = components['schemas']['Plant'];

export const materialLotIssueKeys = {
  all: ['material-lot-issue'] as const,
  plants: ['material-lot-issue', 'plants'] as const,
  groups: (plantId: number) => ['material-lot-issue', 'groups', plantId] as const,
  defaults: (plantId: number) => ['material-lot-issue', 'defaults', plantId] as const,
};

/** 공장 목록 — 쓰는 공장만, 코드 순. */
export const usePlants = (): UseQueryResult<Plant[]> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: materialLotIssueKeys.plants,
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
 * 공장의 공급사·품목별 대기 자재 관리 LOT(계약 §1 `GET /logistics/waiting-material-lots`).
 * ⭐ 공급사 · 품목 · 「대기 있는 것만」은 화면이 거른다 — 발행 창의 공급사·품목 고르기와 공급사 조건 목록이
 *   공장의 전체 조합을 써야 해서 한 번에 받는다.
 */
export const useWaitingGroups = (plantId: number | null): UseQueryResult<Group[]> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: materialLotIssueKeys.groups(plantId ?? 0),
    enabled: plantId !== null,
    queryFn: async () =>
      (
        await runRequest(() =>
          client.GET('/logistics/waiting-material-lots', {
            params: { query: { plantId: plantId ?? 0 } },
          }),
        )
      ).items,
  });
};

/** 공장의 공급사·품목 기본 정보 전부(계약 §9) — 표의 「기본 정보」 칸. */
export const usePlantDefaults = (plantId: number | null): UseQueryResult<Defaults[]> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: materialLotIssueKeys.defaults(plantId ?? 0),
    enabled: plantId !== null,
    queryFn: async () =>
      (
        await fetchAllPages((page, size) =>
          runRequest(() =>
            client.GET('/mdm/supplier-item-defaults', {
              params: { query: { plantId: plantId ?? 0, page, size } },
            }),
          ),
        )
      ).items,
  });
};
