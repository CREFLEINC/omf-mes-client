import type { components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { Mold, ToolFilters } from './types';

type PageMeta = components['schemas']['PageMeta'];
type CodeValue = components['schemas']['CodeValue'];

export interface ToolListResponse {
  items: Mold[];
  page: PageMeta;
}

export const toolKeys = {
  all: ['tools'] as const,
  list: (filters: ToolFilters) => ['tools', 'list', filters] as const,
  detail: (moldId: number) => ['tools', 'detail', moldId] as const,
};

/** 상세 경로. **잠금 토큰이 이 경로에 보관된다** — 쓰기 경로로 꺼내면 늘 비어 있다. */
export const toolDetailPath = (moldId: number): string => `/mdm/molds/${String(moldId)}`;

/** 조회 조건의 공장을 숫자로 읽는다. 읽을 수 없으면 조건이 없는 것으로 다룬다. */
const plantIdQuery = (value: string): { plantId: number } | Record<string, never> => {
  if (value === '') return {};
  const parsed = Number(value);

  return Number.isSafeInteger(parsed) && parsed > 0 ? { plantId: parsed } : {};
};

/**
 * 툴 목록.
 *
 * ⭐ **거르는 일을 서버가 한다** — 적정타수 없는 것만·도래한 것만·정렬 셋이 모두 질의 조건이라
 * 화면이 받아 온 것만 거르지 않는다. 그래서 「목록이 잘리면 조건이 덜 걸린다」는 형제 화면
 * (W-05-11)의 경고가 여기서는 서지 않는다.
 *
 * ⛔ **거짓인 참·거짓 조건을 싣지 않는다** — 끄면 조건 자체를 빼야 서버 기본값과 다투지 않는다.
 */
export const useToolList = (filters: ToolFilters): UseQueryResult<ToolListResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: toolKeys.list(filters),
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/molds', {
          params: {
            query: {
              ...(filters.q === '' ? {} : { q: filters.q }),
              ...plantIdQuery(filters.plantId),
              ...(filters.toolTypeCode === '' ? {} : { toolTypeCode: filters.toolTypeCode }),
              ...(filters.guaranteedShotCountMissing ? { guaranteedShotCountMissing: true } : {}),
              ...(filters.pmDueOnly ? { pmDueOnly: true } : {}),
              sort: filters.sort,
              includeInactive: filters.includeInactive,
            },
          },
        }),
      ),
  });
};

/** 받은 건수가 전체보다 적으면 목록이 잘린 것이다. */
export const isTruncated = (page: PageMeta, shown: number): boolean => page.total > shown;

const isListTruncated = (data: { items: unknown[]; page: PageMeta } | undefined): boolean =>
  data !== undefined && isTruncated(data.page, data.items.length);

/** 한 코드 그룹의 값 수 상한. */
const CODE_VALUES_PAGE_SIZE = 200;

export const codeValueKeys = {
  group: (codeGroupCode: string) => ['code-values', codeGroupCode] as const,
};

/**
 * 공통코드 값 목록 — **그룹을 이름으로 가리킨다.**
 * ⛔ `codeGroupId` 정수를 코드에 박지 않는다: 환경마다 다르다(설계 `omf-mes#179`).
 */
export const useCodeValues = (codeGroupCode: string): UseQueryResult<CodeValue[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: codeValueKeys.group(codeGroupCode),
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/code-values', {
          params: { query: { codeGroupCode, page: 1, size: CODE_VALUES_PAGE_SIZE } },
        }),
      ).then((response) => response.items),
  });
};

export interface PlantLookup {
  value: string;
  label: string;
  isActive: boolean;
}

export interface PlantLookupResult {
  plants: PlantLookup[];
  truncated: boolean;
  isError: boolean;
}

const NO_PLANTS: PlantLookup[] = [];

/**
 * 공장 선택 목록. `includeInactive` 를 켜 둔다 — 미사용 공장에 매인 툴을 열면
 * 선택칸이 비어 보인다. **좁힘은 «고를 목록» 한 자리에만 건다.**
 */
export const usePlantLookup = (): PlantLookupResult => {
  const { client } = useApiClient();

  const plants = useQuery({
    queryKey: ['lookups', 'plants'] as const,
    queryFn: () =>
      runRequest(() => client.GET('/mdm/plants', { params: { query: { includeInactive: true } } })),
  });

  return {
    plants:
      plants.data?.items.map((item) => ({
        value: String(item.plantId),
        label: item.plantName,
        isActive: item.isActive,
      })) ?? NO_PLANTS,
    truncated: isListTruncated(plants.data),
    isError: plants.isError,
  };
};
