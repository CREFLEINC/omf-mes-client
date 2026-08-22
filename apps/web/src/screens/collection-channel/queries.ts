import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { CodeOption } from './options';
import type {
  CollectionChannel,
  CollectionChannelObservation,
  Equipment,
  EquipmentFilters,
  InspectionItemSpec,
  InspectionPlan,
  InspectionPlanVersion,
  PageMeta,
} from './types';

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

/**
 * 채널 상세 경로. **잠금 토큰이 이 경로에 보관된다** — 쓰기 경로로 꺼내면 늘 비어 있다.
 */
export const channelDetailPath = (collectionChannelId: number): string =>
  `/maintenance/collection-channels/${String(collectionChannelId)}`;

/**
 * 채널 상세. **낙관적 잠금 토큰이 이 응답으로 온다** — 목록 행만으로는 저장을 시작할 수 없다.
 */
export const useChannelDetail = (
  collectionChannelId: number | null,
): UseQueryResult<CollectionChannel> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: channelKeys.detail(collectionChannelId ?? 0),
    enabled: collectionChannelId !== null,
    queryFn: () => {
      if (collectionChannelId === null) {
        throw new Error('채널을 고르기 전에는 상세를 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/maintenance/collection-channels/{collectionChannelId}', {
          params: { path: { collectionChannelId } },
        }),
      );
    },
  });
};

export interface UomLookupResult {
  uoms: CodeOption[];
  truncated: boolean;
  isError: boolean;
}

const NO_UOMS: CodeOption[] = [];

/**
 * 단위 선택 목록.
 *
 * ⭐ **계약이 단위를 «코드»로 받는다**(`unitCode`) — 식별자가 아니다. 그래서 고른 값도
 * `uomCode` 이고, 값 목록이 잘려도 이미 저장된 코드는 그대로 보인다.
 *
 * `includeInactive` 를 켜 둔다 — 미사용 단위를 쓰는 채널을 열면 선택칸이 비어 보인다.
 */
export const useUomLookup = (): UomLookupResult => {
  const { client } = useApiClient();

  const uoms = useQuery({
    queryKey: ['lookups', 'uoms'] as const,
    queryFn: () =>
      runRequest(() => client.GET('/mdm/uoms', { params: { query: { includeInactive: true } } })),
  });

  const data = uoms.data;

  return {
    uoms:
      data?.items.map((uom) => ({
        value: uom.uomCode,
        label: `${uom.uomCode} · ${uom.uomName}`,
      })) ?? NO_UOMS,
    truncated: data !== undefined && data.page.total > data.items.length,
    isError: uoms.isError,
  };
};

/** 검사기준·버전·항목을 좁혀 가는 세 조회의 캐시 키. */
export const inspectionKeys = {
  plans: ['collection-channel-inspection-plans'] as const,
  versions: (inspectionPlanId: number) =>
    ['collection-channel-inspection-plan-versions', inspectionPlanId] as const,
  items: (inspectionPlanVersionId: number) =>
    ['collection-channel-inspection-items', inspectionPlanVersionId] as const,
};

/** 고를 검사기준 수의 상한. 넘으면 잘리고, 잘렸다는 사실을 창이 말한다. */
const PLAN_PAGE_SIZE = 200;

export interface InspectionLookupResult<TItem> {
  items: TItem[];
  truncated: boolean;
  isError: boolean;
  isLoading: boolean;
}

const NO_PLANS: InspectionPlan[] = [];
const NO_VERSIONS: InspectionPlanVersion[] = [];
const NO_SPECS: InspectionItemSpec[] = [];

/** 검사기준 목록. 항목에 닿는 세 칸 중 첫째다. */
export const useInspectionPlans = (enabled: boolean): InspectionLookupResult<InspectionPlan> => {
  const { client } = useApiClient();

  const plans = useQuery({
    queryKey: inspectionKeys.plans,
    enabled,
    queryFn: () =>
      runRequest(() =>
        client.GET('/quality/inspection-plans', { params: { query: { size: PLAN_PAGE_SIZE } } }),
      ),
  });

  const data = plans.data;

  return {
    items: data?.items ?? NO_PLANS,
    truncated: data !== undefined && data.page.total > data.items.length,
    isError: plans.isError,
    isLoading: enabled && plans.isPending,
  };
};

/**
 * 버전 목록. **기준을 고르기 전에는 조회하지 않는다** — 계약이 `inspectionPlanId` 를
 * 필수로 두었다. 쪽이 없어(계약) 잘림을 판정할 자리가 없으므로 늘 거짓이다.
 */
export const useInspectionPlanVersions = (
  inspectionPlanId: number | null,
): InspectionLookupResult<InspectionPlanVersion> => {
  const { client } = useApiClient();

  const versions = useQuery({
    queryKey: inspectionKeys.versions(inspectionPlanId ?? 0),
    enabled: inspectionPlanId !== null,
    queryFn: () => {
      if (inspectionPlanId === null) {
        throw new Error('검사기준을 고르기 전에는 버전을 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/quality/inspection-plan-versions', {
          params: { query: { inspectionPlanId } },
        }),
      );
    },
  });

  return {
    items: versions.data?.items ?? NO_VERSIONS,
    truncated: false,
    isError: versions.isError,
    isLoading: inspectionPlanId !== null && versions.isPending,
  };
};

/** 검사 항목 목록. 버전을 고르기 전에는 조회하지 않는다. */
export const useInspectionItemSpecs = (
  inspectionPlanVersionId: number | null,
): InspectionLookupResult<InspectionItemSpec> => {
  const { client } = useApiClient();

  const specs = useQuery({
    queryKey: inspectionKeys.items(inspectionPlanVersionId ?? 0),
    enabled: inspectionPlanVersionId !== null,
    queryFn: () => {
      if (inspectionPlanVersionId === null) {
        throw new Error('버전을 고르기 전에는 검사 항목을 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/quality/inspection-plan-versions/{inspectionPlanVersionId}/items', {
          params: { path: { inspectionPlanVersionId } },
        }),
      );
    },
  });

  return {
    items: specs.data?.items ?? NO_SPECS,
    truncated: false,
    isError: specs.isError,
    isLoading: inspectionPlanVersionId !== null && specs.isPending,
  };
};

/**
 * 단위 식별자 → 단위 코드. **검사 항목은 단위를 식별자로, 채널은 코드로 든다** —
 * 둘을 견주려면 한쪽을 옮겨야 한다.
 *
 * ⚠ **옮기지 못하는 값이 있다.** 단위 목록이 잘리거나 실패하면 그 식별자는 코드를 얻지
 * 못한다 — 그때 「다르다」고도 「같다」고도 말하지 않는다(`unit-match.ts`).
 */
export const useUomCodeById = (): Map<number, string> => {
  const { client } = useApiClient();

  const uoms = useQuery({
    queryKey: ['lookups', 'uoms'] as const,
    queryFn: () =>
      runRequest(() => client.GET('/mdm/uoms', { params: { query: { includeInactive: true } } })),
  });

  return new Map((uoms.data?.items ?? []).map((uom) => [uom.uomId, uom.uomCode]));
};

export interface ObservationListResponse {
  items: CollectionChannelObservation[];
  totalCount?: number;
}

export const observationKeys = {
  all: ['collection-channel-observations'] as const,
  list: (equipmentId: number, unmappedOnly: boolean) =>
    ['collection-channel-observations', equipmentId, unmappedOnly] as const,
};

/**
 * 이 설비가 최근 보내온 신호.
 *
 * ⭐ **거르는 일을 서버가 한다**(`unmappedOnly`) — 화면이 받아 온 것만 거르지 않으므로,
 * 목록이 잘려도 조건이 반쪽이 되지 않는다. 채널 목록의 「미매핑만 보기」와 다른 점이다.
 *
 * 설비를 고르기 전에는 조회하지 않는다 — 대상이 정해지지 않았다.
 */
export const useObservations = (
  equipmentId: number | null,
  unmappedOnly: boolean,
): UseQueryResult<ObservationListResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: observationKeys.list(equipmentId ?? 0, unmappedOnly),
    enabled: equipmentId !== null,
    queryFn: () => {
      if (equipmentId === null) {
        throw new Error('설비를 고르기 전에는 수신 신호를 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/maintenance/collection-channels/observations', {
          params: {
            query: { equipmentId, ...(unmappedOnly ? { unmappedOnly: true } : {}) },
          },
        }),
      );
    },
  });
};
