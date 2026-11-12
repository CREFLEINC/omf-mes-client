import type { components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { fetchAllPages } from '../../patterns/fetch-all-pages';
import { runRequest } from '../../patterns/request';
import type { SupplierItemDefault } from './types';

type Plant = components['schemas']['Plant'];
type SessionScope = components['schemas']['SessionScope'];

export const supplierItemDefaultKeys = {
  all: ['supplier-item-default'] as const,
  plants: ['supplier-item-default', 'plants'] as const,
  list: (plantId: number) => ['supplier-item-default', 'list', plantId] as const,
};

/** 데이터 범위 안인가 — 줄에 공장이 있으면 그 공장, 없으면 그 사업부의 공장 모두, 줄이 없으면 전체. */
export const inDataScope = (plant: Plant, scopes: readonly SessionScope[]): boolean =>
  scopes.length === 0 ||
  scopes.some((scope) =>
    scope.plantId !== undefined
      ? scope.plantId === plant.plantId
      : scope.businessUnitId === plant.businessUnitId,
  );

/** 세션 데이터 범위 안의 사용 중인 공장(공장 코드 차례). 기본 정보는 공장마다 따로 둔다(계약 §9). */
export const usePlants = (scopes: readonly SessionScope[]): UseQueryResult<Plant[]> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: supplierItemDefaultKeys.plants,
    queryFn: async () =>
      (
        await fetchAllPages((page, size) =>
          runRequest(() => client.GET('/mdm/plants', { params: { query: { page, size } } })),
        )
      ).items,
    select: (plants) =>
      plants
        .filter((plant) => plant.isActive && inDataScope(plant, scopes))
        .sort((left, right) => left.plantCode.localeCompare(right.plantCode)),
  });
};

/**
 * 공장의 기본 정보 전부(계약 §9 `GET /mdm/supplier-item-defaults`). 공급사 · 품목 찾기 칸 둘은 받은 행을
 * 화면이 거른다 — 계약의 `q` 는 공급사 · 품목을 한 칸으로 묻고, 기준정보 행 수는 공장마다 수백 건 안이다.
 */
export const useDefaults = (plantId: number | null): UseQueryResult<SupplierItemDefault[]> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: supplierItemDefaultKeys.list(plantId ?? 0),
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
