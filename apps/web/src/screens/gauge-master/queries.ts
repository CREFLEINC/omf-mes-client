import type { components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { Equipment, GaugeFilters } from './types';

type PageMeta = components['schemas']['PageMeta'];
type CodeValue = components['schemas']['CodeValue'];

export interface GaugeListResponse {
  items: Equipment[];
  page: PageMeta;
}

export const gaugeKeys = {
  all: ['gauges'] as const,
  list: (filters: GaugeFilters) => ['gauges', 'list', filters] as const,
};

/** 주소에서 온 공장 조건을 숫자로 읽는다. 읽을 수 없으면 조건이 없는 것으로 다룬다. */
const plantIdQuery = (value: string): { plantId: number } | Record<string, never> => {
  if (value === '') return {};
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? { plantId: parsed } : {};
};

/** 자산이 살아 있음을 뜻하는 코드값(설계 `omf-mes#185`). 목록의 기본 조건이다. */
export const IN_SERVICE_STATUS_CODE = 'IN_SERVICE';

/**
 * 계측기 목록.
 *
 * ⭐ **계측기 전용 경로가 없다** — 설비 경로를 쓰고 `equipmentTypeCode` 로 거른다(스펙 §3-2).
 *
 * ⚠ **유형을 고르지 않았으면 조건을 걸지 않는다.** 값 목록이 아직 없어(설계 질의 `omf-mes#195`)
 * 자리표시 값으로 거르면 **목록이 늘 빈다** — 계측기를 등록해도 보이지 않아 화면이 통째로
 * 죽는다. 대신 「지금 보이는 것이 계측기만은 아니다」를 화면이 밝힌다(G-2).
 *
 * ⛔ **`calibrationRequired` 로 거르지 않는다.** 그것은 「게이트의 판정 대상인가」이지
 * 「이것이 계측기인가」가 아니다 — 검교정을 안 하는 계측기(단순 게이지)가 사라진다(스펙 §3-2).
 */
export const useGaugeList = (filters: GaugeFilters): UseQueryResult<GaugeListResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: gaugeKeys.list(filters),
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/equipments', {
          params: {
            query: {
              ...(filters.q === '' ? {} : { q: filters.q }),
              ...plantIdQuery(filters.plantId),
              ...(filters.equipmentTypeCode === ''
                ? {}
                : { equipmentTypeCode: filters.equipmentTypeCode }),
              ...(filters.includeDisposed ? {} : { statusCode: IN_SERVICE_STATUS_CODE }),
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
 * 공장 선택 목록. `includeInactive` 를 켜 둔다 — 미사용 공장에 매인 계측기를 열면
 * 선택칸이 비어 보인다. **좁힘은 선택지 한 자리에만 건다.**
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
