import type { components } from '@omf-mes/api-client';
import { useQueries, useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { formatPackageQty } from '../../patterns/package-qty';
import { fetchAllPages } from '../../patterns/fetch-all-pages';
import { runRequest } from '../../patterns/request';
import { useSession } from '../../patterns/session';
import { inDataScope, supplierItemDefaultKeys } from '../supplier-item-default/queries';

type SessionScope = components['schemas']['SessionScope'];

/** 확장 속성 표의 소포장 한 줄 — 항목 칸은 공급사, 설정값 칸은 「봉지 40 × 25 = 1,000 KG」. */
export interface ItemPackageRow {
  key: string;
  label: string;
  value: string;
}

export interface ItemPackages {
  rows: ItemPackageRow[];
  isLoading: boolean;
  isError: boolean;
}

const NO_SCOPES: readonly SessionScope[] = [];

/**
 * 품목의 소포장(사용자 지시 2026-11-24 「품목 탭 확장 속성에서도 확인」) — 공급사·품목 기본 정보(W-06-25)를 이 품목으로
 * 좁혀 읽는다. 기본 정보는 공장마다 따로라 데이터 범위 안의 공장마다 묻는다(공장은 몇 곳뿐). 고치는 것은 그 화면에서다.
 * 공장이 둘 이상 나오면 항목 칸에 공장 코드를 붙여 가른다.
 */
export const useItemPackages = (itemId: number | null): ItemPackages => {
  const { client } = useApiClient();
  const { session } = useSession();
  const scopes = session?.scopes ?? NO_SCOPES;
  /* 품목을 고르기 전에는 공장도 묻지 않는다 — 공급사·품목 기본 정보 화면과 같은 범위 규칙(`inDataScope`). */
  const plants = useQuery({
    queryKey: [...supplierItemDefaultKeys.plants, 'item-packages'] as const,
    enabled: itemId !== null,
    queryFn: async () =>
      (
        await fetchAllPages((page, size) =>
          runRequest(() => client.GET('/mdm/plants', { params: { query: { page, size } } })),
        )
      ).items,
  });
  const plantList = (plants.data ?? []).filter(
    (plant) => plant.isActive && inDataScope(plant, scopes),
  );

  const results = useQueries({
    queries: plantList.map((plant) => ({
      queryKey: [...supplierItemDefaultKeys.all, 'item', plant.plantId, itemId ?? 0] as const,
      enabled: itemId !== null,
      queryFn: async () =>
        (
          await runRequest(() =>
            client.GET('/mdm/supplier-item-defaults', {
              params: {
                query: { plantId: plant.plantId, itemId: itemId ?? 0, page: 1, size: 200 },
              },
            }),
          )
        ).items,
    })),
  });

  const found = results.flatMap((result, index) =>
    (result.data ?? []).map((row) => ({ row, plantCode: plantList[index]?.plantCode ?? '' })),
  );
  const manyPlants = new Set(found.map((each) => each.plantCode)).size > 1;

  return {
    rows: found.map(({ row, plantCode }) => ({
      key: String(row.supplierItemDefaultId),
      label: manyPlants ? `${plantCode} · ${row.supplierName}` : row.supplierName,
      value: formatPackageQty(
        row.lotQty,
        row.uomCode,
        row.package === null
          ? null
          : {
              uomCode: row.package.uomCode,
              uomName: row.package.uomName ?? null,
              count: row.package.count,
              qtyPerPackage: row.package.qtyPerPackage,
            },
      ),
    })),
    isLoading: plants.isLoading || results.some((result) => result.isLoading),
    isError: plants.isError || results.some((result) => result.isError),
  };
};
