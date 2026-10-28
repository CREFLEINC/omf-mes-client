import type { ApiClient, components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest, toApiError } from '../../patterns/request';
import type { Bom, ErpBomComponent } from './types';

/**
 * BOM 조회 (ERP)의 읽기. 경로 리터럴은 이 파일에만 둔다 —
 * `openapi-fetch`가 경로를 리터럴 타입으로 요구해 문자열 변수로 넘기면 타입 검사가 풀린다.
 *
 * 쓰기 경로는 없다. BOM 헤더·구성품의 ERP 원본 열은 ERP 수신본이고, MES 확장 열은 이 화면이
 * 다루지 않는다(품목 확장속성 화면의 몫).
 */

const t = messages.erpBom;

/** 값이 있을 때만 키가 실린다 — 요청 URL이 조건을 그대로 드러내야 무엇으로 조회했는지 읽힌다. */
export interface BomListQuery {
  parentItemId: number;
}

export const erpBomKeys = {
  all: ['erp-bom'] as const,
  list: (query: BomListQuery | null) => ['erp-bom', 'list', query] as const,
  components: (bomId: number | null) => ['erp-bom', 'components', bomId] as const,
  uoms: ['erp-bom', 'lookup', 'uoms'] as const,
  codes: (group: string) => ['erp-bom', 'lookup', 'codes', group] as const,
  item: (itemId: number) => ['erp-bom', 'lookup', 'item', itemId] as const,
};

/** 모품목의 BOM 헤더 전체 — 목록 구획과 트리(자품목의 하위 BOM 찾기)가 같은 조회 키로 나눠 쓴다. */
export const fetchBomList = async ({ client }: ApiClient, query: BomListQuery): Promise<Bom[]> => {
  const data = await runRequest(() => client.GET('/planning/boms', { params: { query } }));
  return data.items;
};

/** BOM 하나의 구성품(한 단계). */
export const fetchBomComponents = async (
  { client }: ApiClient,
  bomId: number,
): Promise<ErpBomComponent[]> => {
  const data = await runRequest(() =>
    client.GET('/planning/boms/{bomId}/components', { params: { path: { bomId } } }),
  );
  return data.items;
};

/**
 * 모품목의 BOM 헤더 전체(코드·Rev 불문). 계약이 모품목을 필수로 요구한다 —
 * **고르기 전에는 부르지 않는다**(`enabled`). 품목당 헤더가 소수라 쪽 나누기가 없다.
 */
export const useBomList = (query: BomListQuery | null): UseQueryResult<Bom[]> => {
  const api = useApiClient();

  return useQuery({
    queryKey: erpBomKeys.list(query),
    enabled: query !== null,
    queryFn: () => {
      if (query === null) {
        throw new Error('모품목을 고르기 전에는 BOM 을 조회하지 않습니다.');
      }
      return fetchBomList(api, query);
    },
  });
};

/** 이름을 못 찾으면 받은 값을 그대로 낸다 — 「알 수 없음」으로 가리면 정보가 준다. */
export type NameOf = (key: string | number) => string;

const toNameOf = (entries: { value: string; label: string }[] | undefined): NameOf => {
  const names = new Map((entries ?? []).map((entry) => [entry.value, entry.label]));
  return (key) => names.get(String(key)) ?? String(key);
};

/** 단위 — 건수가 적어 한 번에 받는다. 못 찾으면 번호를 그대로 낸다. */
export const useUomNames = (): NameOf => {
  const { client } = useApiClient();
  const query = useQuery({
    queryKey: erpBomKeys.uoms,
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/mdm/uoms', { params: { query: { includeInactive: true } } }),
      );
      return data.items.map((item) => ({ value: String(item.uomId), label: item.uomCode }));
    },
  });
  return toNameOf(query.data);
};

const isNotFound = (error: unknown): boolean => {
  const apiError = toApiError(error);
  return apiError.kind === 'http' && apiError.status === 404;
};

/**
 * 품목 표시명 — 마스터가 수천 건이라 목록을 받지 않고 **번호로 하나씩** 푼다.
 * 화면에 뜬 품목(모품목·자품목)만 부른다. 「불러오는 중」·「불러오지 못함」·「알 수 없음」을 가른다 —
 * 셋을 뭉개면 정상 값이 잘못된 값처럼 보인다.
 */
/** 품목 하나를 부르는 값 — 코드(굵게)와 이름을 따로 낸다. 받기 전 · 못 받음이면 코드가 없고 이름 자리에 그 사정을 낸다. */
export interface ItemSummary {
  code: string | null;
  name: string;
  /** 받은 품목 전체(모품목 상세가 쓴다). */
  item: ItemDetail | null;
}

/**
 * 품목 + ERP 원본 칸 둘(서버 #737 · 장부 P-67 이 응답에 실었으나 생성 타입에 아직 없다 — erp-item/types.ts 와 같은 사정).
 * 사본이 같은 이름으로 실려 오면 이 교차를 걷는다.
 */
export type ItemDetail = components['schemas']['Item'] & {
  erpSpec?: string | null;
  erpItemGroupCode?: string | null;
};

export const useItemSummaries = (itemIds: readonly number[]): ((itemId: number) => ItemSummary) => {
  const { client } = useApiClient();
  const uniqueIds = [...new Set(itemIds)];
  const results = useQueries({
    queries: uniqueIds.map((itemId) => ({
      queryKey: erpBomKeys.item(itemId),
      queryFn: () =>
        runRequest(() => client.GET('/mdm/items/{itemId}', { params: { path: { itemId } } })),
    })),
  });
  const summaries = new Map<number, ItemSummary>(
    uniqueIds.map((itemId, index) => {
      const result = results[index];
      if (result === undefined || result.isPending) {
        return [itemId, { code: null, name: t.values.loadingName, item: null }];
      }
      if (result.data !== undefined) {
        const { item } = result.data;
        return [itemId, { code: item.itemCode, name: item.itemName, item }];
      }
      const name = isNotFound(result.error) ? t.values.unknown : t.values.failedName;
      return [itemId, { code: null, name, item: null }];
    }),
  );
  return (itemId) => summaries.get(itemId) ?? { code: null, name: t.values.unknown, item: null };
};

/** 「코드 · 이름」 한 줄. */
export const labelOf = (summary: ItemSummary): string =>
  summary.code === null ? summary.name : `${summary.code} · ${summary.name}`;

export const useItemLabels = (itemIds: readonly number[]): ((itemId: number) => string) => {
  const summaryOf = useItemSummaries(itemIds);
  return (itemId) => labelOf(summaryOf(itemId));
};

/** 코드값 이름 — 품목 유형(ITEM_TYPE) · BOM 상태(MASTER_VERSION_STATUS). 중지된 값도 받는다(ERP 수신본). */
const useCodeNames = (codeGroupCode: string): NameOf => {
  const { client } = useApiClient();
  const query = useQuery({
    queryKey: erpBomKeys.codes(codeGroupCode),
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/mdm/code-values', {
          params: { query: { codeGroupCode, includeInactive: true, size: 100 } },
        }),
      );
      return data.items.map((value) => ({ value: value.code, label: value.codeName }));
    },
  });
  return toNameOf(query.data);
};

export const useItemTypeNames = (): NameOf => useCodeNames('ITEM_TYPE');
export const useStatusNames = (): NameOf => useCodeNames('MASTER_VERSION_STATUS');
