import { messages } from '@omf-mes/i18n';
import { useQueries, useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { fetchAllPages } from '../../patterns/fetch-all-pages';
import { masterName } from '../../patterns/master-name';
import { runRequest, toApiError } from '../../patterns/request';
import type { SelectOption } from './types';

/**
 * 내부 번호(FK)·코드로 이어진 값을 이름으로 푼다 — 사업부·공장·단위·품목, 그리고 상태·창고 코드.
 *
 * **번호를 화면에 내지 않는다.** 이름을 못 찾으면 「알 수 없음」, 아직 안 왔으면 「불러오는 중」,
 * 못 받았으면 「불러오지 못함」으로 갈라 낸다 — 셋을 뭉개면 정상 값이 잘못된 값처럼 보인다.
 *
 * 전부 `includeInactive=true` 로 받는다. ERP 수신본이라 사용 중지된 값을 참조하는 행이 실제로 온다.
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.erpProductionOrder;

export interface NameLookup {
  nameOf: (id: number | null | undefined) => string;
}

const toLookup = (
  options: SelectOption[] | undefined,
  isLoading: boolean,
  isError: boolean,
): NameLookup => {
  const names = new Map((options ?? []).map((option) => [option.value, option.label]));
  return {
    nameOf: (id) => {
      if (id === null || id === undefined) return t.values.missing;
      if (isError) return t.values.failedName;
      if (isLoading) return t.values.loadingName;
      return names.get(String(id)) ?? t.values.unknown;
    },
  };
};

export const lookupKeys = {
  businessUnits: ['erp-production-order', 'lookup', 'business-units'] as const,
  plants: ['erp-production-order', 'lookup', 'plants'] as const,
  uoms: ['erp-production-order', 'lookup', 'uoms'] as const,
  codes: (groupCode: string) => ['erp-production-order', 'lookup', 'codes', groupCode] as const,
  item: (itemId: number) => ['erp-production-order', 'lookup', 'item', itemId] as const,
};

/** 사업부 — 상세에만 보인다. **건을 고르기 전에는 부르지 않는다**(`enabled`). */
export const useBusinessUnitLookup = (enabled: boolean): NameLookup => {
  const { client } = useApiClient();
  const query = useQuery({
    queryKey: lookupKeys.businessUnits,
    enabled,
    queryFn: async () => {
      const data = await fetchAllPages((page, size) =>
        runRequest(() =>
          client.GET('/mdm/business-units', {
            params: { query: { includeInactive: true, page, size } },
          }),
        ),
      );
      return data.items.map((item) => ({
        value: String(item.businessUnitId),
        label: `${item.businessUnitCode} · ${item.businessUnitName}`,
      }));
    },
  });
  return toLookup(query.data, enabled && query.isPending, query.isError);
};

/** 공장 — 상세에만 보인다. **건을 고르기 전에는 부르지 않는다**(`enabled`). */
export const usePlantLookup = (enabled: boolean): NameLookup => {
  const { client } = useApiClient();
  const query = useQuery({
    queryKey: lookupKeys.plants,
    enabled,
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/mdm/plants', { params: { query: { includeInactive: true } } }),
      );
      return data.items.map((item) => ({
        value: String(item.plantId),
        label: `${item.plantCode} · ${item.plantName}`,
      }));
    },
  });
  return toLookup(query.data, enabled && query.isPending, query.isError);
};

/** 단위 — 목록의 「지시 수량」 칸이 수량 뒤에 붙인다. */
export const useUomLookup = (): NameLookup => {
  const { client } = useApiClient();
  const query = useQuery({
    queryKey: lookupKeys.uoms,
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/mdm/uoms', { params: { query: { includeInactive: true } } }),
      );
      return data.items.map((item) => ({ value: String(item.uomId), label: item.uomCode }));
    },
  });
  return toLookup(query.data, query.isPending, query.isError);
};

export interface CodeLookup {
  options: SelectOption[];
  nameOf: (code: string) => string;
}

const EMPTY_OPTIONS: SelectOption[] = [];

/**
 * 공통코드 표시명. 값을 화면에 박지 않는다. 그룹이 크지 않다고 단정하지 않고 끝까지 받는다.
 * 이름을 못 찾으면 코드를 그대로 낸다 — 「알 수 없음」으로 가리면 받은 값이 사라진다.
 */
const useCodeLookup = (groupCode: string): CodeLookup => {
  const { client } = useApiClient();
  const query = useQuery({
    queryKey: lookupKeys.codes(groupCode),
    queryFn: async () => {
      const data = await fetchAllPages((page, size) =>
        runRequest(() =>
          client.GET('/mdm/code-values', {
            params: { query: { codeGroupCode: groupCode, includeInactive: true, page, size } },
          }),
        ),
      );
      return data.items.map((value) => ({
        value: value.code,
        label: masterName(value, value.codeName),
      }));
    },
  });
  const options = query.data ?? EMPTY_OPTIONS;
  const names = new Map(options.map((option) => [option.value, option.label]));
  return { options, nameOf: (code) => names.get(code) ?? code };
};

/** 상태 — 공통코드 `PRODUCTION_ORDER_STATUS`(공유계약 G-32 · 수신/수정됨/취소). */
export const useStatusLookup = (): CodeLookup => useCodeLookup('PRODUCTION_ORDER_STATUS');

/**
 * 창고 — 공통코드 `SL_TYPE`(ERP 수신이 만든 시스템 소유 그룹 · 장부 P-67). 서버는 코드만 싣는다.
 * 이름이 있으면 「코드 · 이름」, 없으면 받은 코드만 낸다.
 */
export const useStorageLocationNames = (): ((code: string) => string) => {
  const lookup = useCodeLookup('SL_TYPE');
  return (code) => {
    const name = lookup.nameOf(code);
    return name === code ? code : `${code} · ${name}`;
  };
};

const isNotFound = (error: unknown): boolean => {
  const apiError = toApiError(error);
  return apiError.kind === 'http' && apiError.status === 404;
};

/**
 * 품목 — 마스터가 수천 건이라 목록을 받지 않고 **번호로 하나씩** 푼다. 화면에 뜬 품목만 부른다.
 */
export const useItemNames = (itemIds: readonly number[]): ((itemId: number) => string) => {
  const { client } = useApiClient();
  const uniqueIds = [...new Set(itemIds)];
  const results = useQueries({
    queries: uniqueIds.map((itemId) => ({
      queryKey: lookupKeys.item(itemId),
      queryFn: () =>
        runRequest(() => client.GET('/mdm/items/{itemId}', { params: { path: { itemId } } })),
    })),
  });
  const labels = new Map(
    uniqueIds.map((itemId, index) => {
      const result = results[index];
      if (result === undefined || result.isPending) return [itemId, t.values.loadingName];
      if (result.data !== undefined) {
        const { itemCode, itemName } = result.data.item;
        return [itemId, `${itemCode} · ${itemName}`];
      }
      return [itemId, isNotFound(result.error) ? t.values.unknown : t.values.failedName];
    }),
  );
  return (itemId) => labels.get(itemId) ?? t.values.unknown;
};
