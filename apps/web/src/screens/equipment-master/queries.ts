import type { components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { IN_SERVICE_STATUS_CODE, type CodeValue } from './code-options';
import { runRequest } from '../../patterns/request';
import type {
  EquipmentFilters,
  EquipmentInspectionItem,
  GroupFilters,
  InspectionItemAssignment,
  LookupEntries,
  LookupEntry,
} from './types';

type PageMeta = components['schemas']['PageMeta'];
type EquipmentGroup = components['schemas']['EquipmentGroup'];
type EquipmentGroupDetailResponse = components['schemas']['EquipmentGroupDetailResponse'];
type Equipment = components['schemas']['Equipment'];
type EquipmentDetailResponse = components['schemas']['EquipmentDetailResponse'];

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

export interface EquipmentListResponse {
  items: Equipment[];
  page: PageMeta;
}

export const equipmentKeys = {
  all: ['equipments'] as const,
  list: (equipmentGroupId: number, filters: EquipmentFilters) =>
    ['equipments', 'list', equipmentGroupId, filters] as const,
  detail: (equipmentId: number) => ['equipments', 'detail', equipmentId] as const,
};

/** ETag가 보관된 경로. 설비 쓰기의 If-Match는 언제나 이 경로에서 꺼낸다. */
export const equipmentDetailPath = (equipmentId: number): string =>
  `/mdm/equipments/${String(equipmentId)}`;

/**
 * 설비 상세. **잠금 토큰·코드 편집 가부·계층 텍스트가 이 응답으로 온다** —
 * 목록 행만으로는 저장을 시작할 수도, 위치를 그릴 수도 없다.
 */
export const useEquipmentDetail = (
  equipmentId: number | null,
): UseQueryResult<EquipmentDetailResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: equipmentKeys.detail(equipmentId ?? 0),
    enabled: equipmentId !== null,
    queryFn: () => {
      if (equipmentId === null) {
        throw new Error('설비를 고르기 전에는 상세를 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/mdm/equipments/{equipmentId}', { params: { path: { equipmentId } } }),
      );
    },
  });
};

/**
 * 고른 설비 그룹의 설비 목록.
 *
 * ⭐ **계약의 조건 이름은 `productionLineId` 이고 값은 설비 그룹 식별자와 같다** — 저장처의
 * 이름이 `production_line` 이라 필드가 그것을 따르고 있을 뿐이다. 화면 용어와 갈리는 자리를
 * 여기와 `mappers.ts` 둘로 묶어 둔다.
 *
 * 그룹을 고르기 전에는 조회하지 않는다 — 대상이 정해지지 않았다.
 */
export const useEquipmentList = (
  equipmentGroupId: number | null,
  filters: EquipmentFilters,
): UseQueryResult<EquipmentListResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: equipmentKeys.list(equipmentGroupId ?? 0, filters),
    enabled: equipmentGroupId !== null,
    queryFn: () => {
      if (equipmentGroupId === null) {
        throw new Error('설비 그룹을 고르기 전에는 설비를 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/mdm/equipments', {
          params: {
            query: {
              productionLineId: equipmentGroupId,
              ...(filters.q === '' ? {} : { q: filters.q }),
              ...(filters.equipmentTypeCode === ''
                ? {}
                : { equipmentTypeCode: filters.equipmentTypeCode }),
              ...(filters.calibrationRequired ? { calibrationRequired: true } : {}),
              /*
               * ⭐ 기본은 운용 중인 것만 부른다(설계 omf-mes#185). 「폐기 포함」을 켜면
               * 조건을 아예 빼 전부 받는다 — 폐기만 보는 조건은 계약에 없고, 마스터가
               * 필요로 하는 것은 「감추지 않기」이지 「폐기만 보기」가 아니다.
               */
              ...(filters.includeDisposed ? {} : { statusCode: IN_SERVICE_STATUS_CODE }),
              includeInactive: filters.includeInactive,
            },
          },
        }),
      );
    },
  });
};

/** 한 코드 그룹의 값 수 상한. 자산 상태는 둘이고 다른 그룹도 이 자릿수를 넘지 않는다. */
const CODE_VALUES_PAGE_SIZE = 200;

export const codeValueKeys = {
  /** **그룹 이름이 곧 열쇠다** — 화면이 정수 id 를 알지 않는다. */
  group: (codeGroupCode: string) => ['code-values', codeGroupCode] as const,
};

/**
 * 공통코드 값 목록을 부른다 — **그룹을 이름으로 가리킨다.**
 *
 * ⛔ `codeGroupId` 정수를 코드에 박지 않는다: **환경마다 다르다**(설계 `omf-mes#179`).
 * 계약이 둘 중 «정확히 하나»만 받으므로 이름만 보낸다.
 *
 * ⛔ **목록이 비어도 화면을 감추지 않는다**(공유계약 G-2). 시드가 아직 안 들어가 빌 수 있고
 * (설계 `omf-mes#182`), 그때는 비활성 + 사유로 둔다 — 감추면 그 자리가 왜 없는지 알 수 없다.
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
 * 선택 목록 둘. includeInactive=true로 한 번 받아 두고 화면이 표시 규칙을 정한다 —
 * 기본 조회는 사용 중인 것만 내려주므로, 미사용 값을 참조하는 그룹을 열면 선택칸이 비어 보인다.
 *
 * ⚠ **좁혀 받지 않는다.** 조회를 좁히면 좁힘 밖의 정상 자료가 이름 풀이에서 「알 수 없음」이 된다
 * — 좁힘은 선택지 한 자리에만 건다(`selectableOptions`).
 */
export const useLookupOptions = (): LookupResult => {
  const { client } = useApiClient();

  const processes = useQuery({
    queryKey: lookupKeys.list('processes'),
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/processes', { params: { query: { includeInactive: true } } }),
      ),
  });

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
      processes:
        processes.data?.items.map((item) => ({
          value: String(item.processId),
          label: item.processName,
          isActive: item.isActive,
        })) ?? EMPTY_ENTRIES,
    },
    truncated: isListTruncated(plants.data) || isListTruncated(processes.data),
    isError: plants.isError || processes.isError,
    isLoading: plants.isPending || processes.isPending,
  };
};

export const inspectionKeys = {
  all: ['equipment-inspection-items'] as const,
  master: (q: string) => ['equipment-inspection-items', 'master', q] as const,
  groupAssignments: (equipmentGroupId: number) =>
    ['equipment-inspection-items', 'group', equipmentGroupId] as const,
};

/**
 * 부여의 ETag 가 보관된 경로. **부여는 그룹 상세와 «다른» 자원이다** — 그룹의 토큰으로
 * 부여를 저장하면 서로의 변경을 못 본 채 덮어쓴다.
 */
export const groupInspectionPath = (equipmentGroupId: number): string =>
  `/mdm/equipment-groups/${String(equipmentGroupId)}/inspection-items`;

/**
 * 점검 항목 **마스터** 목록 — 부여 창에서 고를 것을 채운다.
 *
 * ⛔ **사용 중지된 항목을 고르게 두지 않는다** — `includeInactive` 를 보내지 않아 서버가
 * 살아 있는 것만 준다. 이미 부여된 줄이 나중에 사용 중지되면 그 줄은 부여 응답으로 오므로
 * 화면에서 사라지지 않는다.
 */
export const useInspectionItemMaster = (
  enabled: boolean,
): UseQueryResult<EquipmentInspectionItem[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: inspectionKeys.master(''),
    enabled,
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/equipment-inspection-items', { params: { query: {} } }),
      ).then((response) => response.items),
  });
};

/** 이 그룹에 부여된 점검 항목. 그룹을 고르기 전에는 조회하지 않는다. */
export const useGroupInspectionItems = (
  equipmentGroupId: number | null,
): UseQueryResult<InspectionItemAssignment[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: inspectionKeys.groupAssignments(equipmentGroupId ?? 0),
    enabled: equipmentGroupId !== null,
    queryFn: () => {
      if (equipmentGroupId === null) {
        throw new Error('그룹을 고르기 전에는 점검 항목을 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/mdm/equipment-groups/{equipmentGroupId}/inspection-items', {
          params: { path: { equipmentGroupId } },
        }),
      ).then((response) => response.items);
    },
  });
};
