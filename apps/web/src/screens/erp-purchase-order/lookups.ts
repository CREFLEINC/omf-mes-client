import { messages } from '@omf-mes/i18n';
import { useQueries, useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { fetchAllPages } from '../../patterns/fetch-all-pages';
import { masterName } from '../../patterns/master-name';
import { runRequest, toApiError } from '../../patterns/request';
import type { SelectOption } from './types';

/**
 * 내부 번호(FK)로 이어진 값을 이름으로 푼다 — 공급사·공장·단위·품목, 그리고 공통코드(상태·ERP 원본 코드).
 *
 * **번호를 화면에 내지 않는다.** 이름을 못 찾으면 「알 수 없음」, 아직 안 왔으면 「불러오는 중」,
 * 못 받았으면 「불러오지 못함」으로 갈라 낸다 — 셋을 뭉개면 정상 값이 잘못된 값처럼 보인다.
 *
 * 전부 `includeInactive=true` 로 받는다. ERP 수신본이라 사용 중지된 값을 참조하는 행이 실제로 온다.
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.erpPurchaseOrder;

export interface NameLookup {
  options: SelectOption[];
  nameOf: (id: number | null | undefined) => string;
  isLoading: boolean;
}

const EMPTY_OPTIONS: SelectOption[] = [];

const toLookup = (
  options: SelectOption[] | undefined,
  isLoading: boolean,
  isError: boolean,
): NameLookup => {
  const names = new Map((options ?? EMPTY_OPTIONS).map((option) => [option.value, option.label]));
  return {
    options: options ?? EMPTY_OPTIONS,
    isLoading,
    nameOf: (id) => {
      if (isError) return t.values.failedName;
      if (isLoading) return t.values.loadingName;
      if (id === null || id === undefined) return t.values.missing;
      return names.get(String(id)) ?? t.values.unknown;
    },
  };
};

export const lookupKeys = {
  suppliers: ['erp-purchase-order', 'lookup', 'partners'] as const,
  plants: ['erp-purchase-order', 'lookup', 'plants'] as const,
  uoms: ['erp-purchase-order', 'lookup', 'uoms'] as const,
  code: (codeGroupCode: string) => ['erp-purchase-order', 'lookup', 'code', codeGroupCode] as const,
  item: (itemId: number) => ['erp-purchase-order', 'lookup', 'item', itemId] as const,
};

/**
 * 공급사. 계약이 거래처를 공급사로 좁히는 조건을 주지 않으므로 전체 거래처를 끝까지 받는다 —
 * 첫 쪽만 받으면 뒤쪽 거래처가 「알 수 없음」으로 찍힌다.
 */
export const useSupplierLookup = (): NameLookup => {
  const { client } = useApiClient();
  const query = useQuery({
    queryKey: lookupKeys.suppliers,
    queryFn: async () => {
      const data = await fetchAllPages((page, size) =>
        runRequest(() =>
          client.GET('/mdm/partners', { params: { query: { includeInactive: true, page, size } } }),
        ),
      );
      return data.items.map((item) => ({
        value: String(item.partnerId),
        label: `${item.partnerCode} · ${item.partnerName}`,
      }));
    },
  });
  return toLookup(query.data, query.isPending, query.isError);
};

export const usePlantLookup = (): NameLookup => {
  const { client } = useApiClient();
  const query = useQuery({
    queryKey: lookupKeys.plants,
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
  return toLookup(query.data, query.isPending, query.isError);
};

/** 단위 — 라인 표만 쓴다. **건을 고르기 전에는 부르지 않는다**(`enabled`). */
export const useUomLookup = (enabled: boolean): NameLookup => {
  const { client } = useApiClient();
  const query = useQuery({
    queryKey: lookupKeys.uoms,
    enabled,
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/mdm/uoms', { params: { query: { includeInactive: true } } }),
      );
      return data.items.map((item) => ({ value: String(item.uomId), label: item.uomCode }));
    },
  });
  return toLookup(query.data, enabled && query.isPending, query.isError);
};

/** 공통코드 이름 찾기. 이름을 못 찾으면 코드를 그대로 낸다 — 「알 수 없음」으로 가리면 정보가 준다. */
export interface CodeLookup {
  options: SelectOption[];
  /** 값이 없으면(`null` · 키 없음 · 빈 문자열) 「-」 */
  nameOf: (code: string | null | undefined) => string;
}

/**
 * 공통코드 그룹 하나의 표시명. 값을 화면에 박지 않는다.
 *
 * `includeInactive=true` — 사용 중지된 코드도 받아야 옛 수신본의 코드가 이름으로 풀린다.
 * 끝까지 받는다 — ERP 수신이 만든 그룹(`SL_TYPE` 등)은 한 쪽을 넘을 수 있다.
 */
export const useCodeLookup = (codeGroupCode: string, enabled = true): CodeLookup => {
  const { client } = useApiClient();
  const query = useQuery({
    queryKey: lookupKeys.code(codeGroupCode),
    enabled,
    queryFn: async () => {
      const data = await fetchAllPages((page, size) =>
        runRequest(() =>
          client.GET('/mdm/code-values', {
            params: { query: { codeGroupCode, includeInactive: true, page, size } },
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
  return {
    options,
    nameOf: (code) => {
      if (code === null || code === undefined || code.trim() === '') return t.values.missing;
      return names.get(code) ?? code;
    },
  };
};

/** 상태 표시명 — 공통코드 LOGISTICS_DOCUMENT_STATUS(공유계약 G-32). */
export const useStatusLookup = (): CodeLookup => useCodeLookup('LOGISTICS_DOCUMENT_STATUS');

const isNotFound = (error: unknown): boolean => {
  const apiError = toApiError(error);
  return apiError.kind === 'http' && apiError.status === 404;
};

/**
 * 품목 — 마스터가 수천 건이라 목록을 받지 않고 **번호로 하나씩** 푼다. 라인에 뜬 품목만 부른다.
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
