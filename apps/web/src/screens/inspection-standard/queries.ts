import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { masterName } from '../../patterns/master-name';
import { runRequest, toApiError } from '../../patterns/request';
import { DEFAULT_PAGE_SIZE, type PlanListQuery, toListQuery } from './filters';
import type { VersionAuditEvent } from './version-history';
import type {
  InspectionItemSpec,
  InspectionPlan,
  InspectionPlanVersion,
  LookupEntry,
  PageMeta,
  PlanFilters,
} from './types';

type InspectionPlanDetailResponse = components['schemas']['InspectionPlanDetailResponse'];
type InspectionPlanVersionDetailResponse =
  components['schemas']['InspectionPlanVersionDetailResponse'];

/**
 * 이 화면이 쓰는 조회와 캐시 키. 무효화 범위를 한 곳에서 읽을 수 있게 모아 둔다.
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 키 모듈을 참조하지 않는다.
 */

export interface InspectionPlanListResponse {
  items: InspectionPlan[];
  page: PageMeta;
}

/**
 * 기준의 캐시 키.
 *
 * `all`을 무효화하면 목록·상세가 함께 다시 조회된다 — 승인·사용 중지 응답에는 `ETag`가 없어서
 * 성공 후 재조회로 잠금 토큰을 확보해야 한다.
 */
export const planKeys = {
  all: ['inspection-plans'] as const,
  list: (filters: PlanFilters, page: number, size: number = DEFAULT_PAGE_SIZE) =>
    ['inspection-plans', 'list', filters, page, size] as const,
  detail: (inspectionPlanId: number) => ['inspection-plans', 'detail', inspectionPlanId] as const,
  usageCounts: (filters: PlanFilters) => ['inspection-plans', 'usage-counts', filters] as const,
};

/**
 * 기준 목록. 조건은 서버로 보낸다 — 클라이언트에서 거르면 서버가 자른 뒤의 결과만 걸러진다.
 * 쿼리 구성 규칙(빈 값·꺼진 확인칸·첫 쪽을 싣지 않는다)은 `filters.ts`가 갖는다.
 */
export const useInspectionPlanList = (
  filters: PlanFilters,
  page: number,
  size: number = DEFAULT_PAGE_SIZE,
): UseQueryResult<InspectionPlanListResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: planKeys.list(filters, page, size),
    queryFn: async () => {
      if (!filters.inactiveOnly && !filters.unapprovedOnly) {
        return runRequest(() =>
          client.GET('/quality/inspection-plans', {
            params: { query: toListQuery(filters, page, size) },
          }),
        );
      }

      /*
       * 「미사용만」 · 「미승인만」은 서버 조건이 없다(#208) — 나머지 조건으로 전부 받아 화면이 거르고 쪽을 나눈다.
       * 검사 기준은 품목 · 유형별이라 수가 많지 않다.
       */
      const all = await fetchAllPlans(
        (query) => runRequest(() => client.GET('/quality/inspection-plans', { params: { query } })),
        toListQuery(filters, 1, ALL_PAGE_SIZE),
      );
      const kept = all.filter(
        (plan) =>
          (!filters.inactiveOnly || !plan.isActive) &&
          (!filters.unapprovedOnly || plan.approvedAt === null || plan.approvedAt === undefined),
      );

      return {
        items: kept.slice((page - 1) * size, page * size),
        page: { page, size, total: kept.length },
      };
    },
  });
};

/** 사용 여부 칩의 건수(#208). */
export interface PlanUsageCounts {
  all: number;
  active: number;
  inactive: number;
}

/**
 * 사용 여부 칩마다 붙일 건수 — 지금 걸린 다른 조건(검색어 · 유형 · 품목 · 미승인)을 그대로 따른다(사용자 지시 · #208).
 * 미승인이 꺼져 있으면 서버 건수 두 번(전체 · 사용)으로 센다. 켜져 있으면 서버 조건이 없어 전부 받아 센다.
 */
export const usePlanUsageCounts = (
  filters: PlanFilters,
  /** 칩이 서는 자리(탭 묶음)에서만 센다 — 칩이 없으면 요청도 없다. */
  enabled: boolean,
): UseQueryResult<PlanUsageCounts> => {
  const { client } = useApiClient();
  const base: PlanFilters = { ...filters, includeInactive: false, inactiveOnly: false };

  return useQuery({
    queryKey: planKeys.usageCounts(base),
    enabled,
    queryFn: async () => {
      const list = (query: PlanListQuery & { size?: number }) =>
        runRequest(() => client.GET('/quality/inspection-plans', { params: { query } }));

      if (!base.unapprovedOnly) {
        const [all, active] = await Promise.all([
          list({ ...toListQuery({ ...base, includeInactive: true }, 1), size: 1 }),
          list({ ...toListQuery(base, 1), size: 1 }),
        ]);
        return {
          all: all.page.total,
          active: active.page.total,
          inactive: all.page.total - active.page.total,
        };
      }

      const plans = (
        await fetchAllPlans(list, toListQuery({ ...base, includeInactive: true }, 1, ALL_PAGE_SIZE))
      ).filter((plan) => plan.approvedAt === null || plan.approvedAt === undefined);
      const active = plans.filter((plan) => plan.isActive).length;
      return { all: plans.length, active, inactive: plans.length - active };
    },
  });
};

/** 화면이 거를 때 한 번에 받는 쪽 크기. */
const ALL_PAGE_SIZE = 100;

/** 같은 조건의 쪽을 끝까지 모은다. */
const fetchAllPlans = async (
  request: (query: PlanListQuery & { size?: number }) => Promise<InspectionPlanListResponse>,
  base: PlanListQuery & { size?: number },
): Promise<InspectionPlanListResponse['items']> => {
  const items: InspectionPlanListResponse['items'] = [];

  for (let page = 1; ; page += 1) {
    const response = await request({ ...base, page, size: ALL_PAGE_SIZE });
    items.push(...response.items);
    if (items.length >= response.page.total || response.items.length === 0) return items;
  }
};

/**
 * 목록 줄마다 그 기준의 **가장 높은 버전의 상태 코드**(#208) — 표의 「상태」 칸. 버전이 없으면 `null`,
 * 아직 받는 중이면 `undefined`. 버전 목록은 기준 하나씩만 받는다(계약) — 상세의 버전 목록과 같은 캐시를 쓴다.
 */
export const useLatestVersionStatuses = (
  inspectionPlanIds: readonly number[],
): ((inspectionPlanId: number) => string | null | undefined) => {
  const { client } = useApiClient();
  const results = useQueries({
    queries: inspectionPlanIds.map((inspectionPlanId) => ({
      queryKey: versionKeys.list(inspectionPlanId),
      queryFn: () =>
        runRequest(() =>
          client.GET('/quality/inspection-plan-versions', {
            params: { query: { inspectionPlanId } },
          }),
        ),
    })),
  });

  return (inspectionPlanId) => {
    const data = results[inspectionPlanIds.indexOf(inspectionPlanId)]?.data;
    if (data === undefined) return undefined;
    const latest = [...data.items].sort((left, right) => right.planVersion - left.planVersion)[0];
    return latest === undefined ? null : latest.statusCode;
  };
};

/** 받은 건수가 전체보다 적으면 목록이 잘린 것이다. 선택 목록의 잘림 판정에 쓴다. */
export const isTruncated = (page: PageMeta, shown: number): boolean => page.total > shown;

/**
 * ETag가 보관된 경로. 쓰기의 If-Match는 **언제나 이 경로**에서 꺼낸다.
 * 보관 키가 요청 경로라 `...:approve` 같은 액션 경로로 꺼내면 항상 비어 있다.
 */
export const planDetailPath = (inspectionPlanId: number): string =>
  `/quality/inspection-plans/${String(inspectionPlanId)}`;

/**
 * 기준 상세. 낙관적 잠금 토큰(ETag)과 코드 편집 가능 여부가 이 응답으로 온다 —
 * 목록 행만으로는 저장을 시작할 수 없다.
 */
export const useInspectionPlanDetail = (
  inspectionPlanId: number | null,
): UseQueryResult<InspectionPlanDetailResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: planKeys.detail(inspectionPlanId ?? 0),
    enabled: inspectionPlanId !== null,
    queryFn: () => {
      if (inspectionPlanId === null) {
        throw new Error('기준을 고르기 전에는 상세를 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/quality/inspection-plans/{inspectionPlanId}', {
          params: { path: { inspectionPlanId } },
        }),
      );
    },
  });
};

/** 버전 목록에는 페이지네이션이 없다 — 기준당 버전 수가 소수라 계약이 두지 않았다. */
export interface InspectionPlanVersionListResponse {
  items: InspectionPlanVersion[];
}

/**
 * 버전의 캐시 키.
 *
 * `all`을 무효화하면 목록·상세·항목이 함께 다시 조회된다 — 전이(`:confirm`·`:obsolete`·
 * `:new-revision`) 응답에는 `ETag`가 없어서 성공 후 재조회로 잠금 토큰을 확보해야 한다.
 */
export const versionKeys = {
  all: ['inspection-plan-versions'] as const,
  list: (inspectionPlanId: number) =>
    ['inspection-plan-versions', 'list', inspectionPlanId] as const,
  detail: (inspectionPlanVersionId: number) =>
    ['inspection-plan-versions', 'detail', inspectionPlanVersionId] as const,
  items: (inspectionPlanVersionId: number) =>
    ['inspection-plan-versions', 'items', inspectionPlanVersionId] as const,
};

/** 버전 목록. 계약이 `inspectionPlanId`를 필수로 두므로 기준을 고르기 전에는 조회하지 않는다. */
export const useInspectionPlanVersionList = (
  inspectionPlanId: number | null,
): UseQueryResult<InspectionPlanVersionListResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: versionKeys.list(inspectionPlanId ?? 0),
    enabled: inspectionPlanId !== null,
    queryFn: () => {
      if (inspectionPlanId === null) {
        throw new Error('기준을 고르기 전에는 버전 목록을 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/quality/inspection-plan-versions', {
          params: { query: { inspectionPlanId } },
        }),
      );
    },
  });
};

/**
 * 버전의 ETag가 보관된 경로. 버전 수정은 이 화면에서 `If-Match`를 요구하는 세 경로 중 하나다.
 * 전이 경로(`:confirm` 등)로 꺼내면 보관 키가 달라 항상 비어 있다.
 */
export const versionDetailPath = (inspectionPlanVersionId: number): string =>
  `/quality/inspection-plan-versions/${String(inspectionPlanVersionId)}`;

/**
 * 버전 상세. 낙관적 잠금 토큰(ETag)이 이 응답으로 온다 —
 * 목록 행만으로는 저장을 시작할 수 없다.
 */
export const useInspectionPlanVersionDetail = (
  inspectionPlanVersionId: number | null,
): UseQueryResult<InspectionPlanVersionDetailResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: versionKeys.detail(inspectionPlanVersionId ?? 0),
    enabled: inspectionPlanVersionId !== null,
    queryFn: () => {
      if (inspectionPlanVersionId === null) {
        throw new Error('버전을 고르기 전에는 상세를 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/quality/inspection-plan-versions/{inspectionPlanVersionId}', {
          params: { path: { inspectionPlanVersionId } },
        }),
      );
    },
  });
};

/** 검사 항목 목록에는 페이지네이션이 없다 — 버전당 항목 수가 소수라 계약이 두지 않았다. */
export interface InspectionItemSpecListResponse {
  items: InspectionItemSpec[];
}

/**
 * 검사 항목 목록. 버전을 고르기 전에는 조회하지 않는다.
 *
 * 응답의 순서 값은 서버 채번이며 화면은 그것을 표시하지 않는다 — 표시 번호는 목록 안의 위치다.
 * **확정 가능 여부의 근거이기도 하다**: 저장된 항목이 0건이면 서버가 확정을 거부한다(`LINE_REQUIRED`).
 */
export const useInspectionItemSpecs = (
  inspectionPlanVersionId: number | null,
): UseQueryResult<InspectionItemSpecListResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: versionKeys.items(inspectionPlanVersionId ?? 0),
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
};

/** 선택 목록 조회의 공통 결과 형태. 잘림·실패를 감추지 않고 화면이 안내할 수 있게 함께 낸다. */
export interface LookupResult {
  entries: LookupEntry[];
  /** 목록이 잘렸으면 참. 고를 수 없는 값이 생겼다는 뜻이다. */
  truncated: boolean;
  /** 실패했으면 참. 실패를 삼키면 선택칸이 이유 없이 비어 보인다. */
  isError: boolean;
  isLoading: boolean;
}

const EMPTY_ENTRIES: LookupEntry[] = [];

export const lookupKeys = {
  items: ['inspection-standard-items'] as const,
  itemDetail: (itemId: number) => ['inspection-standard-item-detail', itemId] as const,
  processes: ['inspection-standard-processes'] as const,
  routings: (itemId: number) => ['inspection-standard-routings', itemId] as const,
  uoms: ['inspection-standard-uoms'] as const,
  equipments: ['inspection-standard-equipments'] as const,
  codeValues: (codeGroupCode: string) =>
    ['inspection-standard-code-values', codeGroupCode] as const,
};

/** 단위 선택 목록. 검사 항목의 수치형 값에 붙는다. */
export const useUomOptions = (): LookupResult => {
  const { client } = useApiClient();

  const uoms = useQuery({
    queryKey: lookupKeys.uoms,
    queryFn: () =>
      runRequest(() => client.GET('/mdm/uoms', { params: { query: { includeInactive: true } } })),
  });

  const data = uoms.data;

  return {
    entries:
      data?.items.map((uom) => ({
        value: String(uom.uomId),
        label: `${uom.uomCode} · ${uom.uomName}`,
        isActive: uom.isActive,
      })) ?? EMPTY_ENTRIES,
    truncated: data !== undefined && isTruncated(data.page, data.items.length),
    isError: uoms.isError,
    isLoading: uoms.isPending,
  };
};

/** 지정 검사장비 선택 목록. */
export const useEquipmentOptions = (): LookupResult => {
  const { client } = useApiClient();

  const equipments = useQuery({
    queryKey: lookupKeys.equipments,
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/equipments', { params: { query: { includeInactive: true } } }),
      ),
  });

  const data = equipments.data;

  return {
    entries:
      data?.items.map((equipment) => ({
        value: String(equipment.equipmentId),
        label: equipment.equipmentName,
        isActive: equipment.isActive,
      })) ?? EMPTY_ENTRIES,
    truncated: data !== undefined && isTruncated(data.page, data.items.length),
    isError: equipments.isError,
    isLoading: equipments.isPending,
  };
};

/**
 * 공통코드 선택 목록(공유계약 G-32). 그룹은 코드로 부른다 — 채번 식별자는 환경마다 다르다.
 * 미사용 값도 받는다 — 지난 버전이 고른 값의 이름이 비어 보이지 않게 하고, 고를 수 있는지는 화면이 정한다.
 */
export const useCodeValueOptions = (codeGroupCode: string): LookupResult => {
  const { client } = useApiClient();

  const codeValues = useQuery({
    queryKey: lookupKeys.codeValues(codeGroupCode),
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/code-values', {
          params: { query: { codeGroupCode, includeInactive: true, size: 100 } },
        }),
      ),
  });

  const data = codeValues.data;

  return {
    entries:
      data === undefined
        ? EMPTY_ENTRIES
        : [...data.items]
            .sort((left, right) => left.displayOrder - right.displayOrder)
            .map((value) => ({
              value: value.code,
              label: masterName(value, value.codeName.trim() || value.code),
              isActive: value.isActive,
            })),
    truncated: data !== undefined && isTruncated(data.page, data.items.length),
    isError: codeValues.isError,
    isLoading: codeValues.isPending,
  };
};

const isNotFound = (error: unknown): boolean => {
  const apiError = toApiError(error);

  return apiError.kind === 'http' && apiError.status === 404;
};

/**
 * 품목 선택 목록. `includeInactive=true`로 한 번 받아 두고 화면이 표시 규칙을 정한다 —
 * 기본 조회는 사용 중인 것만 내려주므로, 미사용 품목을 참조하는 기준을 열면 이름이 비어 보인다.
 *
 * ⭐ 목록은 한 쪽만 받는다. 품목이 많은 환경에서는 기준에 지정된 품목이 첫 쪽에 없어
 * 이름이 「알 수 없음」으로 선다(omf-all-around#200). 그때만 그 품목 하나를 상세로 불러 덧붙인다.
 * 없는 품목(404)은 실패가 아니라 「알 수 없음」이다.
 */
export const useItemOptions = (selectedItemId: number | null): LookupResult => {
  const { client } = useApiClient();

  const items = useQuery({
    queryKey: lookupKeys.items,
    queryFn: () =>
      runRequest(() => client.GET('/mdm/items', { params: { query: { includeInactive: true } } })),
  });

  const data = items.data;
  const isMissingSelected =
    data !== undefined &&
    selectedItemId !== null &&
    !data.items.some((item) => item.itemId === selectedItemId);

  const selectedItem = useQuery({
    queryKey: lookupKeys.itemDetail(selectedItemId ?? 0),
    enabled: isMissingSelected,
    /* 상세 머리의 품목 이름(`useItemNameParts`)과 같은 키다 — 받아 둔 것을 다시 부르지 않는다(#196). */
    staleTime: Infinity,
    queryFn: () => {
      if (selectedItemId === null) {
        throw new Error('품목을 고르기 전에는 품목 상세를 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/mdm/items/{itemId}', { params: { path: { itemId: selectedItemId } } }),
      );
    },
  });

  const listed = data?.items ?? [];
  const extra =
    isMissingSelected && selectedItem.data !== undefined ? [selectedItem.data.item] : [];

  return {
    entries:
      data === undefined
        ? EMPTY_ENTRIES
        : [...listed, ...extra].map((item) => ({
            value: String(item.itemId),
            label: `${item.itemCode} · ${item.itemName}`,
            isActive: item.isActive,
          })),
    truncated: data !== undefined && isTruncated(data.page, data.items.length),
    isError:
      items.isError ||
      (isMissingSelected && selectedItem.isError && !isNotFound(selectedItem.error)),
    isLoading: items.isPending || (isMissingSelected && selectedItem.isPending),
  };
};

/** 공정 선택 목록. IQC 기준에는 공정이 없으므로 비우는 것이 정상 값이다. */
export const useProcessOptions = (): LookupResult => {
  const { client } = useApiClient();

  const processes = useQuery({
    queryKey: lookupKeys.processes,
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/processes', { params: { query: { includeInactive: true } } }),
      ),
  });

  const data = processes.data;

  return {
    entries:
      data?.items.map((process) => ({
        value: String(process.processId),
        label: process.processName,
        isActive: process.isActive,
      })) ?? EMPTY_ENTRIES,
    truncated: data !== undefined && isTruncated(data.page, data.items.length),
    isError: processes.isError,
    isLoading: processes.isPending,
  };
};

/**
 * 라우팅 선택 목록.
 *
 * **품목을 고르기 전에는 조회하지 않는다** — 계약이 `itemId`를 필수 쿼리로 두었다.
 * 그런데 기준의 품목은 비울 수 있으므로(「전 품목 공통 기준」) 그 경우에는
 * 고를 수 있는 라우팅 자체가 없고, 화면은 선택칸을 사유와 함께 비활성으로 둔다.
 *
 * Rev 목록에는 페이지네이션이 없다(계약) — 잘림을 판정할 자리가 없으므로 늘 거짓이다.
 */
export const useRoutingOptions = (itemId: number | null): LookupResult => {
  const { client } = useApiClient();

  const routings = useQuery({
    queryKey: lookupKeys.routings(itemId ?? 0),
    enabled: itemId !== null,
    queryFn: () => {
      if (itemId === null) {
        throw new Error('품목을 고르기 전에는 라우팅을 조회하지 않습니다.');
      }

      return runRequest(() => client.GET('/planning/routings', { params: { query: { itemId } } }));
    },
  });

  return {
    entries:
      routings.data?.items.map((routing) => ({
        value: String(routing.routingId),
        label: messages.inspectionStandard.values.routingOption(
          routing.routingCode,
          routing.routingVersion,
        ),
        // 라우팅에는 사용 여부가 없다(상태는 작성중·확정·폐기다) — 전부 고를 수 있는 값으로 둔다.
        isActive: true,
      })) ?? EMPTY_ENTRIES,
    truncated: false,
    isError: routings.isError,
    isLoading: itemId !== null && routings.isPending,
  };
};

/** 품목 표시 — 이름과 코드. 부르는 중 · 못 찾음 · 실패면 `code` 가 null 이고 `name` 이 공용 표기다. */
export interface ItemNameParts {
  name: string;
  code: string | null;
}

/**
 * 품목 번호 → 「이름 (코드)」(omf-all-around#196). 목록 · 상세 머리가 보이는 품목만 하나씩 상세로 푼다 —
 * 품목 선택 목록(`useItemOptions`)은 첫 쪽만 받아 그 밖의 품목이 「알 수 없음」으로 섰다.
 * 부르는 중 · 못 찾음 · 실패는 공용 표기(`messages.common.reference`)로 가른다.
 */
export const useItemNameLabels = (
  itemIds: readonly (number | null | undefined)[],
): ((itemId: number | null | undefined) => string | null) => {
  const partsOf = useItemNameParts(itemIds);

  return (itemId) => {
    const parts = partsOf(itemId);
    if (parts === null) return null;
    return parts.code === null ? parts.name : `${parts.name} (${parts.code})`;
  };
};

/** 같은 조회를 이름 · 코드로 나눠 준다 — 목록 표가 「이름 코드(흐리게)」로 그린다(사용자 시안 · #196). */
export const useItemNameParts = (
  itemIds: readonly (number | null | undefined)[],
): ((itemId: number | null | undefined) => ItemNameParts | null) => {
  const { client } = useApiClient();
  const ids = [...new Set(itemIds.filter((id): id is number => typeof id === 'number'))];

  const results = useQueries({
    queries: ids.map((itemId) => ({
      /* 기본 정보 폼의 품목 상세 조회와 같은 키 — 한 품목을 두 번 부르지 않는다(#196). */
      queryKey: lookupKeys.itemDetail(itemId),
      queryFn: () =>
        runRequest(() => client.GET('/mdm/items/{itemId}', { params: { path: { itemId } } })),
      select: (data: components['schemas']['ItemDetailResponse']) => ({
        name: masterName(data.item, data.item.itemName),
        code: data.item.itemCode,
      }),
      retry: false,
      staleTime: Infinity,
    })),
  });

  return (itemId) => {
    if (itemId === null || itemId === undefined) return null;
    const result = results[ids.indexOf(itemId)];
    if (result === undefined || result.isPending) {
      return { name: messages.common.reference.loading, code: null };
    }
    if (result.isError || result.data === undefined) {
      return { name: messages.common.reference.unknown, code: null };
    }
    return result.data;
  };
};

/** 최근 1년 — 감사 이력 조회가 기간을 요구한다(파티션 · 공유계약 B-5). */
const HISTORY_RANGE_MS = 366 * 24 * 60 * 60 * 1000;

/**
 * 버전 변경 이력(#196) — 서버가 버전 쓰기마다 남긴 감사 이력. 고를 때마다 새로 받는다(저장 뒤 바로 보이게).
 * 한 버전의 이력은 소수라 첫 쪽(100건)만 받는다.
 */
export const useVersionHistory = (
  inspectionPlanVersionId: number | null,
): UseQueryResult<{ items: VersionAuditEvent[] }> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: [...versionKeys.all, 'history', inspectionPlanVersionId ?? 0] as const,
    enabled: inspectionPlanVersionId !== null,
    staleTime: 0,
    queryFn: async () => {
      if (inspectionPlanVersionId === null) {
        throw new Error('버전을 고르기 전에는 변경 이력을 조회하지 않습니다.');
      }
      const now = Date.now();
      const data = await runRequest(() =>
        client.GET('/audit/events', {
          params: {
            query: {
              targetTypeCode: 'INSPECTION_PLAN_VERSION',
              targetId: inspectionPlanVersionId,
              occurredFrom: new Date(now - HISTORY_RANGE_MS).toISOString(),
              occurredTo: new Date(now + 60 * 1000).toISOString(),
              size: 100,
            },
          },
        }),
      );
      return {
        items: data.items.map((item) => ({
          auditEventId: item.auditEventId,
          occurredAt: item.occurredAt,
          eventTypeCode: item.eventTypeCode,
          beforeValue: (item.beforeValue ?? null) as Record<string, unknown> | null,
          afterValue: (item.afterValue ?? null) as Record<string, unknown> | null,
          performedBy: item.performedBy ?? null,
        })),
      };
    },
  });
};

/** 처리자 이름 — 사용자 상세로 푼다. 못 받으면(권한 · 없는 사용자) 호출부가 번호로 낸다. */
export const useUserNames = (
  userIds: readonly (number | null)[],
): ((userId: number) => string | null) => {
  const { client } = useApiClient();
  const ids = [...new Set(userIds.filter((id): id is number => id !== null))];

  const results = useQueries({
    queries: ids.map((appUserId) => ({
      queryKey: ['inspection-standard', 'user-name', appUserId] as const,
      queryFn: async () => {
        const data = await runRequest(() =>
          client.GET('/app/users/{appUserId}', { params: { path: { appUserId } } }),
        );
        return data.appUser.userName;
      },
      retry: false,
      staleTime: Infinity,
    })),
  });

  return (userId) => results[ids.indexOf(userId)]?.data ?? null;
};
