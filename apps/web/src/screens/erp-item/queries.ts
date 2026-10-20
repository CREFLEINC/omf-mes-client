import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { masterName } from '../../patterns/master-name';
import { runRequest } from '../../patterns/request';
import type { ErpItem, ErpItemListResult, SelectOption } from './types';

/**
 * 품목정보 조회 (ERP)의 읽기. 경로 리터럴은 이 파일에만 둔다 —
 * `openapi-fetch`가 경로를 리터럴 타입으로 요구해 문자열 변수로 넘기면 타입 검사가 풀린다.
 *
 * 쓰기 경로는 없다. 품목 본체는 ERP 수신본이고, MES 확장 속성은 이 화면이 다루지 않는다.
 */

/** 값이 있을 때만 키가 실린다 — 요청 URL이 조건을 그대로 드러내야 무엇으로 조회했는지 읽힌다. */
export interface ErpItemListQuery {
  q?: string;
  itemTypeCode?: string;
  includeInactive?: boolean;
  /** 첫 쪽이면 싣지 않는다 — 서버 기본값이 1이다. */
  page?: number;
}

export const erpItemKeys = {
  all: ['erp-item'] as const,
  list: (query: ErpItemListQuery) => ['erp-item', 'list', query] as const,
  detail: (id: number | null) => ['erp-item', 'detail', id] as const,
  itemTypes: ['erp-item', 'lookup', 'item-types'] as const,
  uoms: ['erp-item', 'lookup', 'uoms'] as const,
};

export const useErpItemList = (query: ErpItemListQuery): UseQueryResult<ErpItemListResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: erpItemKeys.list(query),
    queryFn: async () => {
      const data = await runRequest(() => client.GET('/mdm/items', { params: { query } }));
      return { items: data.items, page: data.page };
    },
  });
};

/** 품목 상세. 고르기 전에는 조회하지 않는다 — 들어오기만 해도 부르면 쓰지 않는 요청이 나간다. */
export const useErpItemDetail = (id: number | null): UseQueryResult<ErpItem> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: erpItemKeys.detail(id),
    enabled: id !== null,
    queryFn: async () => {
      if (id === null) {
        throw new Error('품목을 고르기 전에는 상세를 조회하지 않습니다.');
      }

      const data = await runRequest(() =>
        client.GET('/mdm/items/{itemId}', { params: { path: { itemId: id } } }),
      );

      // 편집 가능 여부(editability)는 쓰지 않는다 — 이 화면에는 쓰기가 없다.
      return data.item;
    },
  });
};

export interface CodeLookup {
  options: SelectOption[];
  /** 이름을 못 찾으면 받은 값을 그대로 낸다 — 「알 수 없음」으로 가리면 정보가 준다. */
  nameOf: (key: string | number) => string;
}

const EMPTY_OPTIONS: SelectOption[] = [];

const toLookup = (options: SelectOption[] | undefined): CodeLookup => {
  const list = options ?? EMPTY_OPTIONS;
  const names = new Map(list.map((option) => [option.value, option.label]));
  return { options: list, nameOf: (key) => names.get(String(key)) ?? String(key) };
};

/**
 * 품목유형 표시명 — 공통코드 ITEM_TYPE(공유계약 G-32). 값을 화면에 박지 않는다.
 * 중지된 유형도 받는다 — ERP 수신본이라 중지된 값을 참조하는 품목이 실제로 온다.
 */
export const useItemTypeLookup = (): CodeLookup => {
  const { client } = useApiClient();
  const query = useQuery({
    queryKey: erpItemKeys.itemTypes,
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/mdm/code-values', {
          params: { query: { codeGroupCode: 'ITEM_TYPE', includeInactive: true, size: 100 } },
        }),
      );
      return data.items.map((value) => ({
        value: value.code,
        label: masterName(value, value.codeName),
      }));
    },
  });
  return toLookup(query.data);
};

/** 단위 — 건수가 적어 한 번에 받는다. 못 찾으면 번호를 그대로 낸다. */
export const useUomLookup = (): CodeLookup => {
  const { client } = useApiClient();
  const query = useQuery({
    queryKey: erpItemKeys.uoms,
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/mdm/uoms', { params: { query: { includeInactive: true } } }),
      );
      return data.items.map((item) => ({ value: String(item.uomId), label: item.uomCode }));
    },
  });
  return toLookup(query.data);
};
