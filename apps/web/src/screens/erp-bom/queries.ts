import { messages } from '@omf-mes/i18n';
import { useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { masterName } from '../../patterns/master-name';
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
  bomCode?: string;
}

export const erpBomKeys = {
  all: ['erp-bom'] as const,
  list: (query: BomListQuery | null) => ['erp-bom', 'list', query] as const,
  components: (bomId: number | null) => ['erp-bom', 'components', bomId] as const,
  status: ['erp-bom', 'lookup', 'status'] as const,
  uoms: ['erp-bom', 'lookup', 'uoms'] as const,
  item: (itemId: number) => ['erp-bom', 'lookup', 'item', itemId] as const,
};

/**
 * 모품목의 BOM 헤더 전체(코드·Rev 불문). 계약이 모품목을 필수로 요구한다 —
 * **고르기 전에는 부르지 않는다**(`enabled`). 품목당 헤더가 소수라 쪽 나누기가 없다.
 */
export const useBomList = (query: BomListQuery | null): UseQueryResult<Bom[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: erpBomKeys.list(query),
    enabled: query !== null,
    queryFn: async () => {
      if (query === null) {
        throw new Error('모품목을 고르기 전에는 BOM 을 조회하지 않습니다.');
      }
      const data = await runRequest(() => client.GET('/planning/boms', { params: { query } }));
      return data.items;
    },
  });
};

/** 고른 BOM 의 구성품. **고르기 전에는 부르지 않는다**(`enabled`). */
export const useBomComponents = (bomId: number | null): UseQueryResult<ErpBomComponent[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: erpBomKeys.components(bomId),
    enabled: bomId !== null,
    queryFn: async () => {
      if (bomId === null) {
        throw new Error('BOM 을 고르기 전에는 구성품을 조회하지 않습니다.');
      }
      const data = await runRequest(() =>
        client.GET('/planning/boms/{bomId}/components', { params: { path: { bomId } } }),
      );
      return data.items;
    },
  });
};

/** 이름을 못 찾으면 받은 값을 그대로 낸다 — 「알 수 없음」으로 가리면 정보가 준다. */
export type NameOf = (key: string | number) => string;

const toNameOf = (entries: { value: string; label: string }[] | undefined): NameOf => {
  const names = new Map((entries ?? []).map((entry) => [entry.value, entry.label]));
  return (key) => names.get(String(key)) ?? String(key);
};

/**
 * 상태 표시명 — 공통코드 MASTER_VERSION_STATUS(공유계약 G-32). 값을 화면에 박지 않는다.
 * 중지된 값도 받는다 — ERP 수신본이라 지난 값을 참조하는 행이 실제로 온다.
 */
export const useStatusNames = (): NameOf => {
  const { client } = useApiClient();
  const query = useQuery({
    queryKey: erpBomKeys.status,
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/mdm/code-values', {
          params: {
            query: { codeGroupCode: 'MASTER_VERSION_STATUS', includeInactive: true, size: 100 },
          },
        }),
      );
      return data.items.map((value) => ({
        value: value.code,
        label: masterName(value, value.codeName),
      }));
    },
  });
  return toNameOf(query.data);
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
export const useItemLabels = (itemIds: readonly number[]): ((itemId: number) => string) => {
  const { client } = useApiClient();
  const uniqueIds = [...new Set(itemIds)];
  const results = useQueries({
    queries: uniqueIds.map((itemId) => ({
      queryKey: erpBomKeys.item(itemId),
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
