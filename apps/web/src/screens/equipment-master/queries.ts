import type { components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { GroupFilters, LookupEntries, LookupEntry } from './types';

type PageMeta = components['schemas']['PageMeta'];
type EquipmentGroup = components['schemas']['EquipmentGroup'];
type EquipmentGroupDetailResponse = components['schemas']['EquipmentGroupDetailResponse'];

export interface GroupListResponse {
  items: EquipmentGroup[];
  page: PageMeta;
}

/**
 * 이 화면이 쓰는 캐시 키. 무효화 범위를 한 곳에서 읽을 수 있게 모아 둔다.
 * all을 무효화하면 목록과 상세가 함께 다시 조회된다.
 */
/** 받은 건수가 전체보다 적으면 목록이 잘린 것이다. */
export const isTruncated = (page: PageMeta, shown: number): boolean => page.total > shown;

const isListTruncated = (data: { items: unknown[]; page: PageMeta } | undefined): boolean =>
  data !== undefined && isTruncated(data.page, data.items.length);

export const groupKeys = {
  all: ['equipment-groups'] as const,
  list: (filters: GroupFilters) => ['equipment-groups', 'list', filters] as const,
  detail: (equipmentGroupId: number) => ['equipment-groups', 'detail', equipmentGroupId] as const,
};

/**
 * ETag가 보관된 경로. 쓰기의 If-Match는 **언제나 이 경로에서** 꺼낸다.
 * 요청 경로(`...:deactivate`)로 꺼내면 언제나 비어 있다.
 */
export const groupDetailPath = (equipmentGroupId: number): string =>
  `/mdm/equipment-groups/${String(equipmentGroupId)}`;

/**
 * 주소에서 온 공장 조건을 숫자로 읽는다. **읽을 수 없으면 조건이 없는 것으로 다룬다.**
 *
 * 조회 조건을 URL이 소유하므로 사람이 손으로 고친 주소(`?plant=abc`)가 그대로 들어온다.
 * 거르지 않으면 `plantId=NaN` 이 질의에 실려 나가 서버가 거절하고, 사용자는 자기가 무엇을
 * 잘못 적었는지 모르는 채 조회 실패만 본다.
 */
const plantIdQuery = (value: string): { plantId: number } | Record<string, never> => {
  if (value === '') return {};
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? { plantId: parsed } : {};
};

/**
 * 설비 그룹 목록. 조건은 서버로 보낸다 — 클라이언트에서 거르면 서버가 자른 뒤의 결과만 걸러진다.
 *
 * ⛔ **`parentGroupId` 를 보내지 않는다.** 계약의 그 조건은 「하위 그룹만 본다」인데,
 * 화면은 계층 전체를 받아 스스로 접었다 편다 — 좁혀 받으면 상위가 빠져 계층이 성립하지 않는다.
 *
 * size는 보내지 않고 서버 기본값을 따른다. 잘림은 page.total로 드러내 안내한다.
 */
export const useGroupList = (filters: GroupFilters): UseQueryResult<GroupListResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: groupKeys.list(filters),
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/equipment-groups', {
          params: {
            query: {
              ...(filters.q === '' ? {} : { q: filters.q }),
              ...plantIdQuery(filters.plantId),
              includeInactive: filters.includeInactive,
            },
          },
        }),
      ),
  });
};

/**
 * 설비 그룹 상세. **잠금 토큰과 코드 편집 가능 여부가 이 응답으로 온다** —
 * 목록 행만으로는 저장을 시작할 수 없다.
 */
export const useGroupDetail = (
  equipmentGroupId: number | null,
): UseQueryResult<EquipmentGroupDetailResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: groupKeys.detail(equipmentGroupId ?? 0),
    enabled: equipmentGroupId !== null,
    queryFn: () => {
      if (equipmentGroupId === null) {
        throw new Error('설비 그룹을 고르기 전에는 상세를 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/mdm/equipment-groups/{equipmentGroupId}', {
          params: { path: { equipmentGroupId } },
        }),
      );
    },
  });
};

export interface GroupOptionsResult {
  /** 이 공장의 그룹 전부. 상위 그룹 선택지와 순환 판정의 재료다 */
  groups: EquipmentGroup[];
  truncated: boolean;
  isError: boolean;
}

const NO_GROUPS: EquipmentGroup[] = [];

/**
 * 상위 그룹 선택지의 재료. **화면의 조회 조건과 별개로 받는다.**
 *
 * ⭐ **좌측 목록을 재사용하면 안 된다.** 그 목록은 검색어로 좁혀져 있어, 조건에 걸리지 않은
 * 정상 그룹이 상위 선택지에서 사라진다 — 좁힘은 목록 한 자리에만 걸어야 한다.
 * 순환 판정도 같은 이유로 이 목록을 쓴다: 후손이 검색에서 빠지면 순환을 못 막는다.
 *
 * `includeInactive` 를 켜 둔다 — 지금 상위로 매인 그룹이 미사용이면 선택칸이 비어 보인다.
 */
export const useGroupOptions = (plantId: string): GroupOptionsResult => {
  const { client } = useApiClient();
  const query = plantIdQuery(plantId);

  const result = useQuery({
    queryKey: ['equipment-groups', 'options', plantId] as const,
    /* 공장을 고르기 전에는 상위로 고를 대상이 정해지지 않는다 — 그룹코드가 공장 안에서 유일하다. */
    enabled: 'plantId' in query,
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/equipment-groups', {
          params: { query: { ...query, includeInactive: true } },
        }),
      ),
  });

  return {
    groups: result.data?.items ?? NO_GROUPS,
    truncated: isListTruncated(result.data),
    isError: result.isError,
  };
};

export const lookupKeys = {
  all: ['lookups'] as const,
  list: (resource: string) => ['lookups', resource] as const,
};

export interface LookupResult {
  entries: LookupEntries;
  /** 어느 선택 목록이라도 잘렸으면 참. 고를 수 없는 값이 생겼다는 뜻이다. */
  truncated: boolean;
  /** 어느 선택 목록이라도 실패했으면 참. 실패를 삼키면 선택칸이 이유 없이 비어 보인다. */
  isError: boolean;
  isLoading: boolean;
}

const EMPTY_ENTRIES: LookupEntry[] = [];

/**
 * 선택 목록. includeInactive=true로 한 번 받아 두고 화면이 표시 규칙을 정한다 —
 * 기본 조회는 사용 중인 것만 내려주므로, 미사용 값을 참조하는 그룹을 열면 선택칸이 비어 보인다.
 *
 * ⚠ **좁혀 받지 않는다.** 조회를 좁히면 좁힘 밖의 정상 자료가 이름 풀이에서 「알 수 없음」이 된다
 * — 좁힘은 선택지 한 자리에만 건다(`selectableOptions`).
 */
export const useLookupOptions = (): LookupResult => {
  const { client } = useApiClient();

  const plants = useQuery({
    queryKey: lookupKeys.list('plants'),
    queryFn: () =>
      runRequest(() => client.GET('/mdm/plants', { params: { query: { includeInactive: true } } })),
  });

  return {
    entries: {
      plants:
        plants.data?.items.map((item) => ({
          value: String(item.plantId),
          label: item.plantName,
          isActive: item.isActive,
        })) ?? EMPTY_ENTRIES,
    },
    truncated: isListTruncated(plants.data),
    isError: plants.isError,
    isLoading: plants.isPending,
  };
};
