import type { ApiClient } from '@omf-mes/api-client';
import { useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../api-context';
import { runRequest } from '../request';

/**
 * 품목 선택 대화상자가 부르는 읽기 — **셋이다.**
 *
 * | 무엇 | 경로 | 언제 |
 * | --- | --- | --- |
 * | 유형 선택지 | `GET /mdm/code-values?codeGroupCode=ITEM_TYPE` | 창이 열릴 때 한 번 |
 * | 품목 검색 | `GET /mdm/items?q=&itemTypeCode=&page=&size=` | 창이 열릴 때 · 「찾기」·쪽 이동마다 |
 * | 가용 재고 | `GET /inventory/balances?itemId=&groupBy=ITEM` | 검색 결과 품목마다 |
 *
 * ⛔ **신설 오퍼레이션이 없다.** 셋 다 이미 있는 것이다.
 */

type Client = ApiClient['client'];

const ROOT = 'item-picker';

/** 한 쪽에 담는 건수. **가용을 품목마다 부르므로 쪽이 곧 요청 수**다(아래 `useItemAvailability`). */
export const ITEM_PAGE_SIZE = 20;

/**
 * 품목 유형의 코드 그룹.
 *
 * ⛔ **값 목록을 화면이 적지 않는다**(공유계약 G-32). 계약이 `itemTypeCode` 에 「⭐ 고객이
 *    늘릴 수 있다 — 아래는 초기값이지 닫힌 목록이 아니다」라고 못박았다 — 화면에 넷을 적어 두면
 *    고객이 유형을 늘렸을 때 **그 유형이 조용히 사라진다.**
 * ⚠ **채번 식별자(`codeGroupId`)를 쓰지 않는다** — 환경마다 다르다(계약 명시).
 */
const ITEM_TYPE_CODE_GROUP = 'ITEM_TYPE';

export const itemPickerKeys = {
  types: [ROOT, 'item-types'] as const,
  search: (
    term: string,
    itemTypeCode: string,
    page: number,
    includeInactive = false,
    hasRouting = false,
  ) => [ROOT, 'search', term, itemTypeCode, page, includeInactive, hasRouting] as const,
  availability: (itemId: number) => [ROOT, 'availability', itemId] as const,
};

export interface ItemTypeOption {
  code: string;
  codeName: string;
}

/** 유형 선택지. 서버가 준 이름을 그대로 쓴다 — 화면이 표시명을 갖지 않는다. */
export const useItemTypeOptions = (enabled: boolean): UseQueryResult<ItemTypeOption[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: itemPickerKeys.types,
    enabled,
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/mdm/code-values', {
          params: { query: { codeGroupCode: ITEM_TYPE_CODE_GROUP, size: 100 } },
        }),
      );

      return data.items.map((item) => ({ code: item.code, codeName: item.codeName }));
    },
  });
};

/** 검색 결과 한 줄. **서버가 준 값만 담는다.** */
export interface ItemRow {
  itemId: number;
  itemCode: string;
  itemName: string;
  itemTypeCode: string;
  /** 기준 단위. 라인을 만들 때 그대로 채운다 — 화면이 단위를 지어내지 않는다. */
  baseUomId: number;
  /** 사용 중지된 품목인가. 중지 품목까지 찾는 창(`includeInactive`)에서만 false 가 온다. */
  isActive: boolean;
}

export interface ItemSearchResult {
  rows: ItemRow[];
  /** 검색 조건에 걸린 전체 건수. 쪽 이동과 「1–20 / 전체 N건」이 쓴다. */
  total: number;
}

/**
 * 품목 검색 — **「찾기」를 눌러야 좁혀진다.**
 *
 * ⭐ **검색어가 비면 «고른 유형의 전체»를 보인다**(사용자 지시 2026-09-18).
 *    ⛔ 종전에는 「검색어가 비면 조회하지 않는다」였다. 그 규칙은 `W-06-05` 인라인 픽커에서
 *    가져온 것이고 근거는 「빈 검색어로 받은 앞 N 건은 고를 만한 후보가 아니다」였는데,
 *    **이 대화상자에는 그 근거가 맞지 않는다** — 그쪽은 결과가 «선택칸 하나»라 앞 N 건 말고는
 *    닿을 길이 없었지만, 이 창은 **쪽 나누기 + 전체 건수 + 이전·다음**을 갖춰 전체를 훑을 길이
 *    실제로 있다. 그 규칙을 그대로 두면 창을 열자마자 **막다른 빈 화면**이라 무엇을 고를 수
 *    있는지 아예 보이지 않는다.
 *    ⚠ `W-06-05` 쪽 규칙은 그대로다 — 그쪽은 근거가 아직 살아 있다.
 * ⛔ **`includeInactive` 를 주지 않는다.** 중지된 품목은 새로 편성할 대상이 아니다 — 종전
 *    인라인 검색이 그것을 켜 두어 중지된 품목까지 후보에 올렸다(2026-09-18 정정).
 *    ⚠ 조회 필터처럼 **지난 자료를 찾는** 창은 `includeInactive` 로 켠다 — 중지된 품목의 LOT 도
 *    찾을 수 있어야 한다(W-03-01 품목 필터 · 2026-09-19). 기본은 그대로 끈다.
 * ⚠ 유형은 **한 번에 하나**만 실린다(계약 `itemTypeCode?: string`). 「전체」면 싣지 않는다.
 */
export const useItemSearch = (
  term: string,
  itemTypeCode: string,
  page: number,
  includeInactive = false,
  /**
   * Routing 이 있는 품목만 찾는다. 만들 수 없는 품목(원자재 등)을 후보로 세우면 고른 뒤에야
   * 막히는 자리에서 켠다(omf-all-around#43 · 긴급 W/O 발행). 기본은 끈다 — 다른 창은
   * 마스터 전체를 골라야 한다.
   */
  hasRouting = false,
): UseQueryResult<ItemSearchResult> => {
  const { client } = useApiClient();
  const trimmed = term.trim();

  return useQuery({
    queryKey: itemPickerKeys.search(trimmed, itemTypeCode, page, includeInactive, hasRouting),
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/mdm/items', {
          params: {
            query: {
              /* 빈 검색어는 축을 아예 싣지 않는다 — 빈 문자열을 검색어로 보내지 않는다. */
              ...(trimmed === '' ? {} : { q: trimmed }),
              ...(itemTypeCode === '' ? {} : { itemTypeCode }),
              ...(includeInactive ? { includeInactive: true } : {}),
              ...(hasRouting ? { hasRouting: true } : {}),
              page,
              size: ITEM_PAGE_SIZE,
            },
          },
        }),
      );

      return {
        rows: data.items.map((item) => ({
          itemId: item.itemId,
          itemCode: item.itemCode,
          itemName: item.itemName,
          itemTypeCode: item.itemTypeCode,
          baseUomId: item.baseUomId,
          isActive: item.isActive,
        })),
        total: data.page.total,
      };
    },
  });
};

/** 한 품목의 가용 재고가 지금 어떤 상태인가. **「모른다」와 「없다」를 가른다.** */
export type AvailabilityState =
  { kind: 'loading' } | { kind: 'failed' } | { kind: 'qty'; value: number };

const fetchAvailability = async (client: Client, itemId: number): Promise<number> => {
  const data = await runRequest(() =>
    client.GET('/inventory/balances', { params: { query: { itemId, groupBy: 'ITEM' } } }),
  );

  /*
   * ⭐ **합산이지 재계산이 아니다**(공유계약 L-2). `availableQty` 는 서버가 계산해 내리는 값이고
   *    여기서는 그것을 다시 유도하지 않고 더하기만 한다. 소유 구분이 갈리면 한 품목이 여러 줄로
   *    오므로(계약 「소유 구분은 어떤 축에서도 합치지 않는다」) 합이 필요하다.
   */
  return data.items.reduce((sum, item) => sum + item.availableQty, 0);
};

/**
 * 보이는 품목들의 가용 재고.
 *
 * ⚠ **품목마다 한 번씩 부른다.** 잔량 조회가 `itemId` 를 하나만 받는다(계약이 창고·품목·LOT 중
 *   하나를 요구하고 목록을 받지 않는다). 그래서 쪽 크기를 `ITEM_PAGE_SIZE` 로 묶고, 목록은
 *   가용을 「조회 중」으로 먼저 그린 뒤 도착하는 대로 채운다 — 편성 표가 이미 같은 방식이다.
 *
 * → 별건으로 서버에 **묶음 조회**를 요청해 두었다. 서면 이 훅이 한 번으로 접힌다.
 */
export const useItemAvailability = (
  itemIds: readonly number[],
): ((itemId: number) => AvailabilityState) => {
  const { client } = useApiClient();
  const uniqueIds = [...new Set(itemIds)];

  const results = useQueries({
    queries: uniqueIds.map((itemId) => ({
      queryKey: itemPickerKeys.availability(itemId),
      queryFn: () => fetchAvailability(client, itemId),
    })),
  });

  return (itemId) => {
    const index = uniqueIds.indexOf(itemId);
    const result = index === -1 ? undefined : results[index];

    if (result === undefined || result.isPending) return { kind: 'loading' };
    if (result.isError) return { kind: 'failed' };
    if (result.data === undefined) return { kind: 'loading' };

    return { kind: 'qty', value: result.data };
  };
};
