import type { ApiClient } from '@omf-mes/api-client';
import { useQueries, useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';

/**
 * 품목·단위의 **표시명**을 받아 온다.
 *
 * 스펙 §3 이 《현재 투입》을 `MAT-A  LOT-…0044  180 EA`로 그렸는데, 계약의
 * `MaterialConsumption`·`Lot`은 **번호만 준다**(`itemId` · `uomId`). 현장에서 읽는 화면에
 * `7201`을 낼 이유가 없고, **교체 대상 목록의 선택지 문구가 이 이름으로 선다.**
 *
 * ⚠ **표시와 판정은 다른 문제다.** 이 조회는 어느 판단에도 쓰이지 않는다 — 교체 가부는 서버가
 * 정하고, 여기서 하는 일은 **읽을 수 있게 하는 것**뿐이다. 이름을 못 받아도 화면은 그대로
 * 서고 교체도 막지 않는다.
 *
 * ⛔ **이름을 못 받았다고 번호를 감추지 않는다.** 옮기지 못한 것과 값이 없는 것은 다르고,
 * 번호는 담당자에게 전할 수 있는 유일한 단서다.
 *
 * 이 파일은 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 * 경로 리터럴도 여기에만 둔다.
 */

type Client = ApiClient['client'];

export const referenceLabelKeys = {
  item: (itemId: number) => ['running-change', 'item', itemId] as const,
  lot: (lotId: number) => ['running-change', 'lot', lotId] as const,
  uoms: ['running-change', 'uoms'] as const,
};

/**
 * 품목 하나의 코드. **목록 조회가 아니라 상세 조회를 쓴다.**
 *
 * `GET /mdm/items`에는 번호로 좁히는 질의가 없어 목록을 통째로 받아 걸러야 하는데, 품목
 * 마스터는 현장 규모에 따라 얼마든지 커진다. 상세는 화면에 실제로 선 번호만큼만 나가고
 * 캐시가 중복을 걷는다.
 */
const fetchItemCode = async (client: Client, itemId: number): Promise<string> => {
  const data = await runRequest(() =>
    client.GET('/mdm/items/{itemId}', { params: { path: { itemId } } }),
  );

  return data.item.itemCode;
};

/**
 * LOT 하나의 번호.
 *
 * ⭐ **교체 대상 목록의 선택지가 이 번호로 선다.** 계약의 `MaterialConsumption` 은 `lotId`만
 * 주는데, 작업자가 손에 든 라벨에 적힌 것은 LOT 번호다 — 번호를 못 옮기면 **어느 부품을
 * 교체하는지 화면에서 확인할 방법이 없다.**
 *
 * ⛔ **진척(`withProgress`)을 함께 받지 않는다.** 이 조회는 이름 풀이이고, 목록에 선 줄마다
 * 나가므로 서버에 세게 물을 이유가 없다.
 */
const fetchLotNo = async (client: Client, lotId: number): Promise<string> => {
  const data = await runRequest(() =>
    client.GET('/trace/lots/{lotId}', { params: { path: { lotId } } }),
  );

  return data.lot.lotNo;
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
  /** LOT 번호를 옮긴다. **모르면 번호를 그대로 돌려준다** — 감추면 단서가 사라진다. */
  describeLot: (lotId: number) => string;
  /** 단위 번호를 코드로 옮긴다. **모르면 빈 문자열** — 수량 뒤에 번호가 붙으면 값처럼 읽힌다. */
  describeUom: (uomId: number) => string;
}

/**
 * 화면에 선 번호만큼만 조회한다.
 *
 * ⚠ **번호 목록이 매 렌더 새 배열이어도 조회가 다시 나가지 않는다** — `useQueries`가 키로
 * 캐시를 잡으므로 같은 번호는 한 번만 나간다.
 */
export const useReferenceLabels = (
  itemIds: readonly number[],
  lotIds: readonly number[],
): ReferenceLabels => {
  const { client } = useApiClient();

  const distinctItems = [...new Set(itemIds)];
  const distinctLots = [...new Set(lotIds)];

  const itemQueries = useQueries({
    queries: distinctItems.map((itemId) => ({
      queryKey: referenceLabelKeys.item(itemId),
      queryFn: () => fetchItemCode(client, itemId),
    })),
  });

  const lotQueries = useQueries({
    queries: distinctLots.map((lotId) => ({
      queryKey: referenceLabelKeys.lot(lotId),
      queryFn: () => fetchLotNo(client, lotId),
    })),
  });

  const uoms = useQuery({
    queryKey: referenceLabelKeys.uoms,
    queryFn: () => fetchUomCodes(client),
  });

  const itemCodes = new Map(
    distinctItems.flatMap((itemId, index) => {
      const code = itemQueries[index]?.data;

      return code === undefined ? [] : [[itemId, code] as const];
    }),
  );

  const lotNos = new Map(
    distinctLots.flatMap((lotId, index) => {
      const lotNo = lotQueries[index]?.data;

      return lotNo === undefined ? [] : [[lotId, lotNo] as const];
    }),
  );

  return {
    describeItem: (itemId) => itemCodes.get(itemId) ?? String(itemId),
    describeLot: (lotId) => lotNos.get(lotId) ?? String(lotId),
    describeUom: (uomId) => uoms.data?.get(uomId) ?? '',
  };
};
