import {
  createIdempotencyKey,
  type DepartmentProductionWarehouse,
  type DepartmentProductionWarehouseReplace,
  type DepartmentProductionWarehouseReplaceResult,
} from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { fetchAllPages } from '../../patterns/fetch-all-pages';
import { useMasterWrite, type MasterWriteResult } from '../../patterns/master';
import { runRequest } from '../../patterns/request';
import { departmentKeys } from './department-queries';

/**
 * 부서 생산 창고(003 계획 기반 출고 요청 · 계약 §3)의 조회와 저장.
 * 연결은 부서 정보와 다른 자원이라 키를 따로 둔다 — 부서 저장이 연결 목록을 다시 받지 않게.
 */
export const productionWarehouseKeys = {
  all: ['department-production-warehouses'] as const,
  linked: (departmentId: number) =>
    ['department-production-warehouses', 'linked', departmentId] as const,
  candidates: ['department-production-warehouses', 'candidates'] as const,
  plants: ['department-production-warehouses', 'plants'] as const,
};

/** 고를 수 있는 창고 한 줄. 공장 이름은 공장 목록에서 붙인다. */
export interface WarehouseCandidate {
  warehouseId: number;
  warehouseCode: string;
  warehouseName: string;
  plantId: number;
}

export const useLinkedProductionWarehouses = (
  departmentId: number | null,
): UseQueryResult<DepartmentProductionWarehouse[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: productionWarehouseKeys.linked(departmentId ?? 0),
    enabled: departmentId !== null,
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/departments/{departmentId}/production-warehouses', {
          params: { path: { departmentId: departmentId ?? 0 } },
        }),
      ),
  });
};

/**
 * 후보는 사용 중인 창고 전부다. 창고 유형(불량·외부 등)으로 거르지 않는다 — 명세 가정
 * 「창고 유형으로 생산 창고를 가르지 않는다」(검토 9 확정).
 */
export const useProductionWarehouseCandidates = (
  enabled: boolean,
): UseQueryResult<WarehouseCandidate[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: productionWarehouseKeys.candidates,
    enabled,
    queryFn: async () =>
      (
        await fetchAllPages((page, size) =>
          runRequest(() =>
            client.GET('/mdm/warehouses', {
              params: { query: { includeInactive: false, page, size } },
            }),
          ),
        )
      ).items
        .filter((warehouse) => warehouse.isActive)
        .map(({ warehouseId, warehouseCode, warehouseName, plantId }) => ({
          warehouseId,
          warehouseCode,
          warehouseName,
          plantId,
        })),
  });
};

/** 공장 번호 → 이름. 연결 목록과 후보가 공장 번호만 싣는다. */
export const usePlantNames = (enabled: boolean): UseQueryResult<Map<number, string>> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: productionWarehouseKeys.plants,
    enabled,
    queryFn: async () =>
      new Map(
        (await runRequest(() => client.GET('/mdm/plants', { params: { query: {} } }))).items.map(
          (plant) => [plant.plantId, plant.plantName],
        ),
      ),
  });
};

/**
 * 연결 해제 확인용 미리 보기 — `dryRun=true` 는 저장하지 않고 뺀 창고마다 남은 요청 수만 낸다.
 * 쓰기 훅을 거치지 않는다: 저장이 아니라 확인 창을 띄울지 묻는 조회다.
 */
export const usePreviewProductionWarehouseReplace = () => {
  const { client } = useApiClient();

  return (
    departmentId: number,
    body: DepartmentProductionWarehouseReplace,
  ): Promise<DepartmentProductionWarehouseReplaceResult> =>
    runRequest(() =>
      client.PUT('/mdm/departments/{departmentId}/production-warehouses', {
        params: {
          path: { departmentId },
          query: { dryRun: true },
          header: { 'Idempotency-Key': createIdempotencyKey() },
        },
        body,
      }),
    );
};

/** 전체 교체 저장. 성공하면 연결 목록과 부서 목록(「생산 창고」 수 열)을 다시 받는다. */
export const useReplaceProductionWarehouses = (
  departmentId: number | null,
  onSuccess: (result: DepartmentProductionWarehouseReplaceResult) => void,
): MasterWriteResult<DepartmentProductionWarehouseReplace> => {
  const { client } = useApiClient();

  return useMasterWrite({
    request: (body, headers) =>
      client.PUT('/mdm/departments/{departmentId}/production-warehouses', {
        params: {
          path: { departmentId: departmentId ?? 0 },
          header: { 'Idempotency-Key': headers['Idempotency-Key'] },
        },
        body,
      }),
    etagPath: null,
    invalidateKeys: [productionWarehouseKeys.linked(departmentId ?? 0), departmentKeys.all],
    knownFields: [],
    onSuccess,
  });
};
