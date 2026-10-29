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
  /* IQC 수입검사 — 부품 공장은 화면이 달라 따로 만든다(사용자 지시 2026-10-29). */
  '/logistics/iqc-inspection',
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

export const useOaAccess = (): OaAccess => {
  const { client } = useApiClient();
  const { session } = useSession();
  const lookup = useQuery({
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
  if (session === null || session === undefined) return 'unknown';
  if (lookup.isPending) return 'checking';
  if (lookup.data === undefined) return 'unknown';
  return coversOaPlant(session.scopes, lookup.data.plants, lookup.data.codes) ? 'oa' : 'not-oa';
};
