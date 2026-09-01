import type { ApiClient } from '@omf-mes/api-client';
import { useQueries, useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';

/**
 * 품목·단위의 **표시명**을 받아 온다.
 *
 * 스펙 §3이 목록과 표를 `MAT-A ... 100 EA`로 그렸는데, 계약의 `Lot`·`ShopfloorReceiptLine`은
 * **번호만 준다**(`itemId` · `uomId`). 현장에서 읽는 화면에 `7201`을 낼 이유가 없다.
 *
 * ⚠ **표시와 판정은 다른 문제다**(`lot-status-labels.ts`와 같은 규율). 이 조회는 어느 판단에도
 * 쓰이지 않는다 — 투입 가부는 서버가 정하고(§5-2), 여기서 하는 일은 **읽을 수 있게 하는 것**
 * 뿐이다. 이름을 못 받아도 화면은 그대로 서고 투입도 막지 않는다.
 *
 * ⛔ **이름을 못 받았다고 번호를 감추지 않는다.** 옮기지 못한 것과 값이 없는 것은 다르고,
 * 번호는 담당자에게 전할 수 있는 유일한 단서다.
 *
 * 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch`가 경로를 리터럴 타입으로 요구한다.
 */

type Client = ApiClient['client'];

export const referenceLabelKeys = {
  item: (itemId: number) => ['material-input-scan', 'item', itemId] as const,
  uoms: ['material-input-scan', 'uoms'] as const,
};

/**
 * 품목 하나의 코드. **목록 조회가 아니라 상세 조회를 쓴다.**
 *
 * `GET /mdm/items`에는 번호로 좁히는 질의가 없어 목록을 통째로 받아 걸러야 하는데, 품목
 * 마스터는 현장 규모에 따라 얼마든지 커진다 — 화면에 뜬 몇 건의 이름을 얻자고 전체를 끌어올
 * 이유가 없다. 상세는 화면에 실제로 선 번호만큼만 나가고 캐시가 중복을 걷는다.
 */
const fetchItemCode = async (client: Client, itemId: number): Promise<string> => {
  const data = await runRequest(() =>
    client.GET('/mdm/items/{itemId}', { params: { path: { itemId } } }),
  );

  return data.item.itemCode;
};

/** 단위는 마스터가 작고 잘 바뀌지 않아 **한 번에 받아 둔다.** */
const fetchUomCodes = async (client: Client): Promise<Map<number, string>> => {
  const data = await runRequest(() =>
    client.GET('/mdm/uoms', { params: { query: { size: 200 } } }),
  );

  return new Map(data.items.map((uom) => [uom.uomId, uom.uomCode]));
};

export interface ReferenceLabels {
  /** 품목 번호를 코드로 옮긴다. **모르면 번호를 그대로 돌려준다.** */
  describeItem: (itemId: number) => string;
  /** 단위 번호를 코드로 옮긴다. **모르면 빈 문자열** — 수량 뒤에 번호가 붙으면 값처럼 읽힌다. */
  describeUom: (uomId: number) => string;
}

/**
 * 화면에 선 번호만큼만 조회한다.
 *
 * ⚠ **번호 목록이 매 렌더 새 배열이어도 조회가 다시 나가지 않는다** — `useQueries`가 키로
 * 캐시를 잡으므로 같은 번호는 한 번만 나간다. 그래서 부르는 쪽이 목록을 기억해 둘 필요가 없다.
 */
export const useReferenceLabels = (itemIds: readonly number[]): ReferenceLabels => {
  const { client } = useApiClient();

  const distinct = [...new Set(itemIds)];

  const itemQueries = useQueries({
    queries: distinct.map((itemId) => ({
      queryKey: referenceLabelKeys.item(itemId),
      queryFn: () => fetchItemCode(client, itemId),
    })),
  });

  const uoms = useQuery({
    queryKey: referenceLabelKeys.uoms,
    queryFn: () => fetchUomCodes(client),
  });

  const itemCodes = new Map(
    distinct.flatMap((itemId, index) => {
      const code = itemQueries[index]?.data;

      return code === undefined ? [] : [[itemId, code] as const];
    }),
  );

  return {
    describeItem: (itemId) => itemCodes.get(itemId) ?? String(itemId),
    describeUom: (uomId) => uoms.data?.get(uomId) ?? '',
  };
};
