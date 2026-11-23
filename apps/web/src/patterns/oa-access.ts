import { useQuery } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

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
 * 범위 줄이 없으면 제한 없음 — 모든 공장(omf-all-around#336).
 * ⚠ 사업부(VIETNAM)가 부품·OA 두 공장을 함께 가져 공장 코드로 가른다.
 */
export const coversOaPlant = (
  scopes: readonly Scope[],
  plants: readonly { plantId: number; plantCode: string; businessUnitId?: number | null }[],
  oaCodes: ReadonlySet<string>,
): boolean =>
  plants
    .filter((plant) => oaCodes.has(plant.plantCode))
    .some(
      (plant) =>
        scopes.length === 0 ||
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

/** 계정 범위가 덮는 공장 — 공장 없는 범위는 그 사업부의 모든 공장, 범위 줄이 없으면 모든 공장(`coversOaPlant` 와 같은 규칙). */
export const plantsInScope = <T extends PlantRow>(
  scopes: readonly Scope[],
  plants: readonly T[],
): T[] =>
  plants.filter(
    (plant) =>
      scopes.length === 0 ||
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

/** OA·부품 공장을 모두 가진 계정이 고른 동작(omf-all-around#336). */
export type PlantMode = 'oa' | 'parts';

/** 저장 키 — 사용자별로 브라우저에 남긴다(공용 PC 에서 다른 사람의 선택을 물려받지 않게). */
const plantModeKey = (userId: number): string => `omf-mes.shell.plant-mode.${userId}`;

const plantModeListeners = new Set<() => void>();

const readPlantMode = (userId: number): PlantMode => {
  try {
    return globalThis.localStorage.getItem(plantModeKey(userId)) === 'parts' ? 'parts' : 'oa';
  } catch {
    return 'oa';
  }
};

const subscribePlantMode = (listener: () => void): (() => void) => {
  plantModeListeners.add(listener);
  return () => {
    plantModeListeners.delete(listener);
  };
};

/** 고른 동작을 남기고 이 탭의 모든 판단 자리에 알린다. 남기지 못해도 이번 판에는 반영한다. */
const memoryPlantMode = new Map<number, PlantMode>();
const writePlantMode = (userId: number, mode: PlantMode): void => {
  memoryPlantMode.set(userId, mode);
  try {
    globalThis.localStorage.setItem(plantModeKey(userId), mode);
  } catch {
    /* 저장이 막힌 브라우저 — 새로고침하면 기본(OA)으로 돌아간다. */
  }
  plantModeListeners.forEach((listener) => {
    listener();
  });
};

/** 계정 범위가 OA 공장과 부품 공장을 모두 덮는가 — 그때만 동작을 고른다. */
export const coversBothPlantKinds = (
  scopes: readonly Scope[],
  plants: readonly PlantRow[],
  oaCodes: ReadonlySet<string>,
): boolean => {
  const scoped = plantsInScope(scopes, plants);
  return (
    scoped.some((plant) => oaCodes.has(plant.plantCode)) &&
    scoped.some((plant) => !oaCodes.has(plant.plantCode))
  );
};

/**
 * OA·부품 동작 고르기(omf-all-around#336 · 사용자 결정 2026-11-23). 범위에 OA·부품 공장이 함께 있는 계정
 * (범위 없음 = 모든 공장 포함)만 `mixed` 이고, 그 계정은 고른 동작을 따른다. 기본은 OA(종전 동작).
 * 한쪽 공장만 가진 계정은 지금처럼 범위로 정한다(#211 「전환 단추 없이」).
 */
export const usePlantMode = (): {
  mixed: boolean;
  mode: PlantMode;
  setMode: (mode: PlantMode) => void;
} => {
  const { session } = useSession();
  const lookup = usePlantsAndOaCodes();
  const userId = session?.userId ?? null;
  const mode = useSyncExternalStore(subscribePlantMode, () =>
    userId === null ? 'oa' : (memoryPlantMode.get(userId) ?? readPlantMode(userId)),
  );
  const mixed =
    session !== null &&
    session !== undefined &&
    lookup.data !== undefined &&
    coversBothPlantKinds(session.scopes, lookup.data.plants, lookup.data.codes);
  return {
    mixed,
    mode: mixed ? mode : 'oa',
    setMode: (next) => {
      if (userId !== null) writePlantMode(userId, next);
    },
  };
};

export const useOaAccess = (): OaAccess => {
  const { session } = useSession();
  const lookup = usePlantsAndOaCodes();
  const plantMode = usePlantMode();
  if (session === null || session === undefined) return 'unknown';
  if (lookup.isPending) return 'checking';
  if (lookup.data === undefined) return 'unknown';
  /* 두 공장 계정이 「부품」을 고르면 부품 계정처럼 본다(#336). */
  if (plantMode.mixed && plantMode.mode === 'parts') return 'not-oa';
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

/**
 * 검사표를 만들 사업부 후보 — 계정 범위의 사업부. 범위 줄이 없으면(제한 없음) OA 공장들의 사업부다(omf-all-around#336).
 */
export const scopeBusinessUnitIds = (
  scopes: readonly Scope[],
  plants: readonly { plantCode: string; businessUnitId?: number | null }[],
  oaCodes: ReadonlySet<string>,
): number[] => {
  if (scopes.length > 0) return scopes.map((scope) => scope.businessUnitId);
  const ids = plants
    .filter((plant) => oaCodes.has(plant.plantCode))
    .map((plant) => plant.businessUnitId)
    .filter((id): id is number => typeof id === 'number');
  return [...new Set(ids)];
};

export const useScopeBusinessUnitIds = (): number[] => {
  const { session } = useSession();
  const lookup = usePlantsAndOaCodes();
  if (session === null || session === undefined) return [];
  if (session.scopes.length > 0) return session.scopes.map((scope) => scope.businessUnitId);
  if (lookup.data === undefined) return [];
  return scopeBusinessUnitIds(session.scopes, lookup.data.plants, lookup.data.codes);
};
