import type { components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import { IN_SERVICE_STATUS_CODE } from './code-options';
import type { Equipment, GaugeFilters } from './types';

type PageMeta = components['schemas']['PageMeta'];
type CodeValue = components['schemas']['CodeValue'];
type EquipmentDetailResponse = components['schemas']['EquipmentDetailResponse'];
type Calibration = components['schemas']['Calibration'];

export interface GaugeListResponse {
  items: Equipment[];
  page: PageMeta;
}

export const gaugeKeys = {
  all: ['gauges'] as const,
  /**
   * ⛔ **유형 조건도 열쇠에 든다.** 조건이 «조회 뒤에» 도착하는데(코드값 그룹을 따로 받는다)
   * 열쇠가 그것을 모르면 **조건 없이 한 번 나간 결과가 그대로 굳는다** — 계측기가 아닌
   * 설비가 섞인 채로 남는다.
   */
  list: (filters: GaugeFilters, typeCodes: readonly string[]) =>
    ['gauges', 'list', filters, [...typeCodes]] as const,
  detail: (equipmentId: number) => ['gauges', 'detail', equipmentId] as const,
};

/** 상세 경로. **잠금 토큰이 이 경로에 보관된다** — 쓰기 경로로 꺼내면 늘 비어 있다. */
export const gaugeDetailPath = (equipmentId: number): string =>
  `/mdm/equipments/${String(equipmentId)}`;

/** 주소에서 온 공장 조건을 숫자로 읽는다. 읽을 수 없으면 조건이 없는 것으로 다룬다. */
const plantIdQuery = (value: string): { plantId: number } | Record<string, never> => {
  if (value === '') return {};
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? { plantId: parsed } : {};
};

/**
 * 계측기 목록.
 *
 * ⭐ **계측기 전용 경로가 없다** — 설비 경로를 쓰고 `equipmentTypeCode` 로 거른다(스펙 §3-2).
 *
 * ⭐ **첫 조회부터 계열 전체를 건다.** 계약의 `equipmentTypeCode` 가 값 여럿을 받으므로
 * (통지 `client#404`), 유형을 고르지 않았으면 **계측기 계열 그룹의 값 전부**를 싣는다 —
 * 고르면 그 하나만 싣는다. 그래서 이 화면은 언제나 계측기만 보인다.
 *
 * ⛔ **값을 코드에 박지 않는다.** 서버가 준 그룹의 값을 그대로 실으므로, 고객이 공통코드
 * 관리에서 유형을 넷째로 늘려도 이 화면은 손대지 않는다.
 *
 * ⛔ **받아 온 목록을 화면에서 다시 거르지 않는다**(공유계약 L-1). 서버가 페이지로 잘라
 * 주는데 그 안에서 또 거르면 **건수와 「더 있음」 안내가 통째로 거짓**이 된다.
 *
 * ⛔ **`calibrationRequired` 로 거르지 않는다.** 그것은 「게이트의 판정 대상인가」이지
 * 「이것이 계측기인가」가 아니다 — 검교정을 안 하는 계측기(단순 게이지)가 사라진다(스펙 §3-2).
 */
/**
 * 실을 유형 조건.
 *
 * | 사태 | 무엇을 싣나 |
 * | --- | --- |
 * | 유형을 골랐다 | 고른 값 하나 |
 * | 안 골랐고 그룹 값을 받았다 | **그룹 값 전부** — 계열 전체가 조건이 된다 |
 * | 안 골랐고 그룹 값이 아직 없다 | **아무것도 싣지 않는다** |
 *
 * ⛔ **빈 배열을 조건으로 보내지 않는다.** 계약이 `minItems: 1` 이라 빈 배열은 거절당하고,
 * 사용자는 시드가 안 들어왔다는 사실 대신 조회 실패만 본다 — 그 사태는 선택칸이 비활성 +
 * 사유로 이미 말한다(G-2).
 */
const typeCodeQuery = (
  picked: string,
  groupCodes: readonly string[],
): { equipmentTypeCode: string[] } | Record<string, never> => {
  if (picked !== '') return { equipmentTypeCode: [picked] };

  return groupCodes.length === 0 ? {} : { equipmentTypeCode: [...groupCodes] };
};

export const useGaugeList = (
  filters: GaugeFilters,
  /** 계측기 계열 그룹의 값 전부 */
  instrumentTypeCodes: readonly string[],
  /** 그 목록을 실제로 «받았는가». 받지 못한 것과 비어 있는 것은 다르다 */
  typeCodesLoaded: boolean,
): UseQueryResult<GaugeListResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: gaugeKeys.list(filters, instrumentTypeCodes),
    /*
     * ⛔ **코드 목록을 받기 «전»에는 조회하지 않는다.** 먼저 조건 없이 한 번 나가면 계측기가
     * 아닌 설비가 잠깐 목록에 서고, 그 화면을 본 사용자는 이 화면을 「전체 설비 목록」으로
     * 읽는다. ⭐ **못 받은 것과 비어 있는 것은 다르다** — 시드가 없어 «비어 있으면»(`[]`)
     * 조건 없이 조회하고 그 사실은 선택칸이 말한다(G-2).
     */
    enabled: typeCodesLoaded,
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/equipments', {
          params: {
            query: {
              ...(filters.q === '' ? {} : { q: filters.q }),
              ...plantIdQuery(filters.plantId),
              ...typeCodeQuery(filters.equipmentTypeCode, instrumentTypeCodes),
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

/**
 * 계측기 상세. **잠금 토큰·코드 편집 가부가 이 응답으로 온다** — 목록 행만으로는
 * 저장을 시작할 수 없다.
 */
export const useGaugeDetail = (
  equipmentId: number | null,
): UseQueryResult<EquipmentDetailResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: gaugeKeys.detail(equipmentId ?? 0),
    enabled: equipmentId !== null,
    queryFn: () => {
      if (equipmentId === null) {
        throw new Error('계측기를 고르기 전에는 상세를 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/mdm/equipments/{equipmentId}', { params: { path: { equipmentId } } }),
      );
    },
  });
};

/** 한 번에 받아 오는 검교정 이력 건수. 계약 기본값(50)보다 좁게 잡아 창이 길어지지 않게 한다. */
export const CALIBRATION_PAGE_SIZE = 20;

export const calibrationKeys = {
  ofGauge: (equipmentId: number) => ['calibrations', equipmentId] as const,
};

export interface CalibrationHistory {
  items: Calibration[];
  /**
   * 전체 건수. **계약이 이 값을 선택으로 두었다** — 안 주면 «없다»가 아니라 «모른다»다
   * (공유계약 G-9). 그래서 `null` 로 구분해 든다.
   */
  totalCount: number | null;
}

/**
 * 한 계측기의 검교정 이력. **읽기만 한다** — 등록은 검교정 이력 등록 화면(W-05-10)의 몫이다.
 *
 * ⭐ **계측기 전용 경로가 아니라 보전 자원을 `equipmentId` 로 좁힌다** — 계약 주석이
 * 「계측기는 설비의 한 종류라 `/mdm/equipments` 의 `equipmentId` 그대로」라고 못박았다.
 */
export const useCalibrationHistory = (
  equipmentId: number | null,
): UseQueryResult<CalibrationHistory> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: calibrationKeys.ofGauge(equipmentId ?? 0),
    enabled: equipmentId !== null,
    queryFn: () => {
      if (equipmentId === null) {
        throw new Error('계측기를 고르기 전에는 검교정 이력을 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/maintenance/calibrations', {
          params: { query: { equipmentId, page: 1, size: CALIBRATION_PAGE_SIZE } },
        }),
      ).then((response) => ({
        items: response.items,
        totalCount: response.totalCount ?? null,
      }));
    },
  });
};

export interface UomLookup {
  value: string;
  label: string;
  isActive: boolean;
  /** 이 단위가 허용하는 소수 자릿수. 정밀도 입력칸의 판정 근거다 */
  decimalScale: number;
}

export interface UomLookupResult {
  uoms: UomLookup[];
  truncated: boolean;
  isError: boolean;
}

const NO_UOMS: UomLookup[] = [];

/**
 * 정밀도 단위 선택 목록.
 *
 * ⭐ **`decimalScale` 을 함께 든다** — 「이 단위는 소수점 아래 몇 자리까지 쓰는가」를
 * 서버가 정해 두었고, 그것을 넘겨 보내면 잘려서 **적은 것과 다른 값이 저장된다.**
 *
 * 미사용까지 받아 온다 — 미사용 단위에 매인 계측기를 열면 선택칸이 비어 보인다.
 */
export const useUomLookup = (): UomLookupResult => {
  const { client } = useApiClient();

  const uoms = useQuery({
    queryKey: ['lookups', 'uoms'] as const,
    queryFn: () =>
      runRequest(() => client.GET('/mdm/uoms', { params: { query: { includeInactive: true } } })),
  });

  return {
    uoms:
      uoms.data?.items.map((item) => ({
        value: String(item.uomId),
        label: item.uomName,
        isActive: item.isActive,
        decimalScale: item.decimalScale,
      })) ?? NO_UOMS,
    truncated: isListTruncated(uoms.data),
    isError: uoms.isError,
  };
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
