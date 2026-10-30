import { useQuery } from '@tanstack/react-query';

import { useApiClient } from './api-context';
import { runRequest } from './request';
import { useSession } from './session';

/** 공통코드 그룹 — 제품 검사표를 쓰는 공장(OA) 코드(서버 장부 P-102). */
export const OA_PLANT_GROUP = 'INSPECTION_SHEET_PLANT';

/** OA 공장 전용 화면의 주소 — 계정 범위에 OA 공장이 없으면 메뉴에서 감춘다(omf-all-around#89 · 담당자 결정 2026-10-21). */
export const OA_ONLY_PATHS: ReadonlySet<string> = new Set([
  '/master-data/inspection-sheet-template',
  '/quality/inspection-sheets',
]);

/** `checking` = 아직 판단 중 · `unknown` = 판단할 근거를 못 받음(감추지 않고 서버의 403 에 맡긴다). */
export type OaAccess = 'checking' | 'unknown' | 'oa' | 'not-oa';

interface Scope {
  businessUnitId: number;
  plantId?: number;
}

/**
 * 계정 범위가 OA 공장을 덮는가 — 서버(`oa-plant.ts`)와 같은 규칙. 공장 없는 범위는 그 사업부의 모든 공장이다.
 * ⚠ 사업부(VIETNAM)가 부품·OA 두 공장을 함께 가져 공장 코드로 가른다.
 */
export const coversOaPlant = (
  scopes: readonly Scope[],
  plants: readonly { plantId: number; plantCode: string; businessUnitId?: number | null }[],
  oaCodes: ReadonlySet<string>,
): boolean =>
  plants
    .filter((plant) => oaCodes.has(plant.plantCode))
    .some((plant) =>
      scopes.some((scope) =>
        scope.plantId === undefined
          ? scope.businessUnitId === plant.businessUnitId
          : scope.plantId === plant.plantId,
      ),
    );

interface PlantRow {
  plantId: number;
  plantCode: string;
  plantName?: string;
  businessUnitId?: number | null;
}

/** 계정 범위가 덮는 공장 — 공장 없는 범위는 그 사업부의 모든 공장이다(`coversOaPlant` 와 같은 규칙). */
export const plantsInScope = <T extends PlantRow>(
  scopes: readonly Scope[],
  plants: readonly T[],
): T[] =>
  plants.filter((plant) =>
    scopes.some((scope) =>
      scope.plantId === undefined
        ? scope.businessUnitId === plant.businessUnitId
        : scope.plantId === plant.plantId,
    ),
  );

/** 공장 목록과 OA 공장 코드 — OA 판정과 부품 공장 고르기(omf-all-around#211)가 같은 조회를 나눠 쓴다. */
const usePlantsAndOaCodes = () => {
  const { client } = useApiClient();
  const { session } = useSession();
  return useQuery({
    queryKey: ['oa-access', 'plants-and-codes'],
    enabled: session !== null && session !== undefined,
    staleTime: Infinity,
    queryFn: async () => {
      const [codes, plants] = await Promise.all([
        runRequest(() =>
          client.GET('/mdm/code-values', {
            params: { query: { codeGroupCode: OA_PLANT_GROUP, size: 100 } },
          }),
        ),
        runRequest(() => client.GET('/mdm/plants', { params: { query: { size: 100 } } })),
      ]);
      return { codes: new Set(codes.items.map((item) => item.code)), plants: plants.items };
    },
  });
};

export const useOaAccess = (): OaAccess => {
  const { session } = useSession();
  const lookup = usePlantsAndOaCodes();
  if (session === null || session === undefined) return 'unknown';
  if (lookup.isPending) return 'checking';
  if (lookup.data === undefined) return 'unknown';
  return coversOaPlant(session.scopes, lookup.data.plants, lookup.data.codes) ? 'oa' : 'not-oa';
};

export interface ScopedPlant {
  plantId: number;
  plantCode: string;
  plantName: string;
}

/**
 * 계정 범위의 공장을 OA·부품으로 나눈다(omf-all-around#211) — IQC 탭이 공장에 따라 OA 화면·부품 화면을 연다.
 * 판단할 근거를 못 받으면 `null`(`unknown`)이다.
 */
export const useScopedPlants = ():
  | { status: 'checking' }
  | { status: 'unknown' }
  | { status: 'ready'; oa: ScopedPlant[]; parts: ScopedPlant[] } => {
  const { session } = useSession();
  const lookup = usePlantsAndOaCodes();
  if (session === null || session === undefined) return { status: 'unknown' };
  if (lookup.isPending) return { status: 'checking' };
  if (lookup.data === undefined) return { status: 'unknown' };
  const { codes } = lookup.data;
  const scoped = plantsInScope(session.scopes, lookup.data.plants).map((plant) => ({
    plantId: plant.plantId,
    plantCode: plant.plantCode,
    plantName: plant.plantName,
  }));
  return {
    status: 'ready',
    oa: scoped.filter((plant) => codes.has(plant.plantCode)),
    parts: scoped.filter((plant) => !codes.has(plant.plantCode)),
  };
};
