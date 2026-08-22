import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { CollectionChannel, Equipment, EquipmentFilters, PageMeta } from './types';

/**
 * 이 화면이 쓰는 조회와 캐시 키. 무효화 범위를 한 곳에서 읽을 수 있게 모아 둔다.
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 키 모듈을 참조하지 않는다.
 */

export interface EquipmentListResponse {
  items: Equipment[];
  page: PageMeta;
}

/**
 * 채널 목록의 응답 형태.
 *
 * ⚠ **`page` 가 아니라 `totalCount` 이고 그나마 선택이다**(계약) — 형제 화면들과 다르다.
 * 오지 않으면 잘렸는지 알 수 없으므로 「다 보여 준다」고 말하지 않는다(`channel-notes.ts`).
 */
export interface ChannelListResponse {
  items: CollectionChannel[];
  totalCount?: number;
}

/**
 * 한 설비의 채널 수 상한. 넘으면 잘리고, 잘렸다는 사실을 화면이 말한다.
 *
 * ⛔ **내보내서 한 벌만 둔다.** 잘림 판정(`channelLimitNote`)이 「쪽이 꽉 찼는가」를 이 값과
 * 견주므로, 조회에 싣는 값과 판정에 쓰는 값이 갈리면 **판정이 조용히 틀린다** — 서버가 200을
 * 주는데 화면이 50으로 재면 늘 「더 있을 수 있다」가 서고, 반대면 잘린 목록을 전부로 읽는다.
 */
export const CHANNEL_PAGE_SIZE = 200;

/** 설비 선택 목록의 상한. 좌측 페인은 고르는 자리라 전부를 실을 이유가 없다. */
const EQUIPMENT_PAGE_SIZE = 100;

export const equipmentKeys = {
  all: ['collection-channel-equipments'] as const,
  list: (filters: EquipmentFilters) => ['collection-channel-equipments', 'list', filters] as const,
};

export const channelKeys = {
  all: ['collection-channels'] as const,
  list: (equipmentId: number, includeInactive: boolean) =>
    ['collection-channels', 'list', equipmentId, includeInactive] as const,
  detail: (collectionChannelId: number) =>
    ['collection-channels', 'detail', collectionChannelId] as const,
};

/**
 * 조회 조건의 공장을 숫자로 읽는다. **읽을 수 없으면 조건이 없는 것으로 다룬다.**
 *
 * ⛔ **`NaN` 을 조건으로 내보내지 않는다** — 주소나 저장된 조건이 손상됐을 때 `plantId=NaN`
 * 이 나가면 서버가 400으로 되받고, 화면에는 「불러오지 못했습니다」만 남아 **무엇이 잘못됐는지
 * 아무도 모른다.** 조건을 빼면 적어도 전체 목록이 뜬다.
 */
export const plantIdQuery = (value: string): { plantId: number } | Record<string, never> => {
  if (value === '') return {};
  const parsed = Number(value);

  return Number.isSafeInteger(parsed) && parsed > 0 ? { plantId: parsed } : {};
};

/** 왼쪽 설비 목록. 매핑을 매다는 대상이라 조건은 검색어와 공장 둘뿐이다. */
export const useEquipmentList = (
  filters: EquipmentFilters,
): UseQueryResult<EquipmentListResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: equipmentKeys.list(filters),
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/equipments', {
          params: {
            query: {
              ...(filters.q === '' ? {} : { q: filters.q }),
              ...plantIdQuery(filters.plantId),
              size: EQUIPMENT_PAGE_SIZE,
            },
          },
        }),
      ),
  });
};

/**
 * 고른 설비의 수집 채널 목록.
 *
 * ⛔ **거짓인 참·거짓 조건을 싣지 않는다** — 「미사용 포함」을 켜면 `isActive` 조건 **자체를
 * 뺀다.** `isActive=false` 를 보내면 미사용«만» 달라는 뜻이 되어 정반대가 된다.
 *
 * 설비를 고르기 전에는 조회하지 않는다 — 계약이 `equipmentId` 를 조건으로 두었고, 조건 없이
 * 부르면 모든 설비의 채널이 한 표에 섞인다.
 */
export const useChannelList = (
  equipmentId: number | null,
  includeInactive: boolean,
): UseQueryResult<ChannelListResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: channelKeys.list(equipmentId ?? 0, includeInactive),
    enabled: equipmentId !== null,
    queryFn: () => {
      if (equipmentId === null) {
        throw new Error('설비를 고르기 전에는 채널을 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/maintenance/collection-channels', {
          params: {
            query: {
              equipmentId,
              ...(includeInactive ? {} : { isActive: true }),
              size: CHANNEL_PAGE_SIZE,
            },
          },
        }),
      );
    },
  });
};

export interface PlantLookup {
  value: string;
  label: string;
}

export interface PlantLookupResult {
  plants: PlantLookup[];
  truncated: boolean;
  isError: boolean;
}

const NO_PLANTS: PlantLookup[] = [];

/**
 * 공장 선택 목록. `includeInactive` 를 켜 둔다 — 미사용 공장에 매인 설비를 고르면
 * 선택칸이 비어 보인다. **좁힘은 «고를 목록» 한 자리에만 건다.**
 */
export const usePlantLookup = (): PlantLookupResult => {
  const { client } = useApiClient();

  const plants = useQuery({
    queryKey: ['lookups', 'plants'] as const,
    queryFn: () =>
      runRequest(() => client.GET('/mdm/plants', { params: { query: { includeInactive: true } } })),
  });

  const data = plants.data;

  return {
    plants:
      data?.items.map((item) => ({ value: String(item.plantId), label: item.plantName })) ??
      NO_PLANTS,
    truncated: data !== undefined && data.page.total > data.items.length,
    isError: plants.isError,
  };
};
