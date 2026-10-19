import { messages } from '@omf-mes/i18n';
import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { LookupEntry, PageMeta } from './types';

/**
 * 이 화면이 푸는 참조는 **공장 하나**다. 축이 둘뿐이고 하나는 날짜라 목록이 필요한 것은 이것뿐이다.
 *
 * ⚠ **선택지는 사용자의 데이터 범위 안이어야 한다**(설계 D-5 · omf-all-around#120). 계약에 「내 범위
 * 공장만」을 뜻하는 질의가 없어 전체 목록을 받고, 세션의 데이터 범위(`scopes` — 범위 줄 전부)로 거른다.
 * 규칙은 서버(장부 P-62)와 같다 — 줄에 공장이 있으면 그 공장, 없으면 그 사업부의 공장 모두, 줄이 없으면 전체.
 * 서버가 범위 밖 공장을 403 으로 막으므로 이 거름은 고를 수 없는 공장을 보이지 않게 하는 몫이다.
 *
 * `includeInactive`를 켜지 않는다 — 이것은 **고르는 목록**이지 과거 자료를 푸는 목록이 아니다.
 * 쓰지 않는 공장을 골라 대시보드를 그릴 이유가 없다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.dashboard;

export interface PlantLookupResult {
  entries: LookupEntry[];
  /** 목록이 잘렸으면 참. 고를 수 없는 공장이 생겼다는 뜻이다. */
  truncated: boolean;
  isError: boolean;
  isLoading: boolean;
  refetch: () => void;
}

const EMPTY_ENTRIES: LookupEntry[] = [];

const isTruncated = (page: PageMeta, shown: number): boolean => page.total > shown;

/** 세션의 데이터 범위 한 줄 — 계약 `SessionScope`. */
export interface DataScope {
  businessUnitId: number;
  plantId?: number;
}

/** 이 공장이 데이터 범위 안인가. 범위가 하나도 없으면 전체(사용자 결정 2026-10-19 — 지금 동작 유지). */
export const inDataScope = (
  plant: { plantId: number; businessUnitId?: number | null },
  scopes: readonly DataScope[],
): boolean =>
  scopes.length === 0 ||
  scopes.some((scope) =>
    scope.plantId !== undefined
      ? scope.plantId === plant.plantId
      : scope.businessUnitId === plant.businessUnitId,
  );

/**
 * 선택칸 아래에 붙일 안내. 밝히지 않으면 사용자가 불완전한 목록을 완전한 것으로 읽고
 * 찾는 공장이 없으면 「그런 공장이 없다」고 결론짓는다.
 *
 * **실패가 잘림보다 앞선다** — 첫 조회가 잘린 목록을 주고 다시 부르기가 실패하면 낡은 자료와
 * 실패가 함께 참이 된다. 그때 「일부만 보인다」고만 말하면 지금 목록이 낡았다는 사실이 가려진다.
 */
export const plantNote = (lookup: PlantLookupResult): string | undefined => {
  if (lookup.isError) return t.filters.plantLookupFailed;
  if (lookup.truncated) return t.filters.plantLookupTruncated;

  return undefined;
};

export const lookupKeys = {
  plants: ['dashboard-lookups', 'plants'] as const,
};

export const usePlantOptions = (scopes: readonly DataScope[]): PlantLookupResult => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: lookupKeys.plants,
    queryFn: () => runRequest(() => client.GET('/mdm/plants', { params: { query: {} } })),
  });

  const data = query.data;

  return {
    entries:
      data?.items
        .filter((item) => inDataScope(item, scopes))
        .map((item) => ({
          value: String(item.plantId),
          label: `${item.plantCode} · ${item.plantName}`,
          isActive: item.isActive,
        })) ?? EMPTY_ENTRIES,
    truncated: data !== undefined && isTruncated(data.page, data.items.length),
    isError: query.isError,
    isLoading: query.isPending,
    refetch: () => {
      void query.refetch();
    },
  };
};
