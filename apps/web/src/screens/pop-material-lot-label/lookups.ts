import type { ApiClient } from '@omf-mes/api-client';
import { useQueries, useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import type { LookupSource } from '../../patterns/lookup-display';
import { runRequest, toApiError } from '../../patterns/request';

/**
 * 이름 풀이 — 계약이 정수 식별자만 주는 자리를 사람이 읽는 값으로 바꾼다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 *
 * ⛔ **마스터 목록의 «첫 쪽»으로 이름을 풀지 않는다**(omf-all-around#27). 그 조회는 한 쪽
 *    (계약 기본 50건 · 실측 상한 200건)만 돌려주는데 고객 기초자료는 품목 9천여 건·거래처
 *    900여 건이라, **첫 쪽 밖 품목·공급사가 통째로 「알 수 없음」**이 됐다. 값은 서버에 멀쩡히
 *    있고 화면만 못 찾는 상태인데, 그 문구는 *자료가 잘못됐다*는 뜻이라 반대로 읽힌다.
 *
 * 무엇으로 푸는지는 **마스터마다 다르고, 그 까닭은 계약과 권한에 있다.**
 *
 * | 마스터 | 푸는 법 | 까닭 |
 * | --- | --- | --- |
 * | 품목 | 보이는 줄의 `itemId` 마다 단건 조회 | 9천여 건이라 다 받을 수 없다 |
 * | 공급사 | 목록을 **마지막 쪽까지** | 단건 조회가 POP 단말 토큰에 401 이다(실측) |
 * | 단위 | 목록 한 번 | 계약에 단건 조회가 없고 전체가 한 쪽에 들어온다 |
 */

type Client = ApiClient['client'];

export const lookupKeys = {
  itemDetail: (itemId: number) => ['pop-material-lot-label', 'item', itemId] as const,
  partners: ['pop-material-lot-label', 'partners'] as const,
  uoms: ['pop-material-lot-label', 'uoms'] as const,
};

const EMPTY_ENTRIES: readonly never[] = [];

/** 아직 답을 받지 못한 식별자의 자리. **「없다」가 아니라 「모른다」** 로 서야 한다. */
const PENDING_SOURCE: LookupSource = { entries: EMPTY_ENTRIES, isError: false, isLoading: true };

/** 이름 풀이 원천 하나를 꺼낸다. 아직 목록에 서지 않은 식별자는 조회 전이다. */
export const nameSource = (sources: ReadonlyMap<number, LookupSource>, id: number): LookupSource =>
  sources.get(id) ?? PENDING_SOURCE;

/** 이름 풀이가 낼 수 있는 값 한 가지. 어느 마스터든 화면에는 이 모양으로만 선다. */
interface ResolvedName {
  label: string;
  isActive: boolean;
}

/**
 * 없는 식별자(404)는 **실패가 아니라 「알 수 없음」**이다. 「이름을 불러오지 못했습니다」는
 * *다시 부르면 될 일*이라는 뜻이라, 지워진 마스터를 가리키는 줄에 그 문구를 세우면 사람이
 * 계속 다시 부른다.
 */
const isNotFound = (error: unknown): boolean => {
  const apiError = toApiError(error);

  return apiError.kind === 'http' && apiError.status === 404;
};

/**
 * 식별자마다 이름 풀이 원천 하나를 낸다 — **줄마다 따로 판정한다.**
 *
 * 한 식별자의 실패가 다른 줄의 이름을 지우지 않는다. 같은 식별자가 여러 줄에 있어도 조회는
 * 한 번이다(중복 제거 + 조회 캐시).
 */
const useNameSources = (
  ids: readonly number[],
  toKey: (id: number) => readonly unknown[],
  fetchName: (client: Client, id: number) => Promise<ResolvedName>,
): ReadonlyMap<number, LookupSource> => {
  const { client } = useApiClient();
  const uniqueIds = [...new Set(ids)];

  const results = useQueries({
    queries: uniqueIds.map((id) => ({
      queryKey: toKey(id),
      queryFn: () => fetchName(client, id),
    })),
  });

  return new Map(
    uniqueIds.map((id, index): [number, LookupSource] => {
      const result = results[index];
      const resolved = result?.data;

      return [
        id,
        {
          entries:
            resolved === undefined
              ? EMPTY_ENTRIES
              : [{ value: String(id), label: resolved.label, isActive: resolved.isActive }],
          isError: result?.isError === true && !isNotFound(result.error),
          isLoading: result === undefined || result.isPending,
        },
      ];
    }),
  );
};

/** 품목 — 입하 라인 줄과 발번 대상 카드가 함께 쓴다. */
export const useItemNameSources = (itemIds: readonly number[]): ReadonlyMap<number, LookupSource> =>
  useNameSources(itemIds, lookupKeys.itemDetail, async (client, itemId) => {
    const data = await runRequest(() =>
      client.GET('/mdm/items/{itemId}', { params: { path: { itemId } } }),
    );

    return {
      label: `${data.item.itemCode} · ${data.item.itemName}`,
      isActive: data.item.isActive,
    };
  });

/**
 * 거래처 목록의 쪽 크기 — **계약 상한이다.**
 *
 * ⚠ 이 값에는 계약 근거가 없다. 계약 정본에는 `size` 상한이 적혀 있지 않으나 실측으로 200 을
 *   넘겨도 200 으로 잘린다. 그러므로 이 숫자는 **받는 쪽 수를 줄이는 완화값이며 보장이 아니다** —
 *   서버가 더 작게 적용해도 아래 되돌이가 `total` 을 보고 마저 받는다.
 */
const PARTNER_PAGE_SIZE = 200;

/**
 * 공급사 — 입하 건의 거래처다. **쪽을 끝까지 받아 이름을 푼다.**
 *
 * ⛔ **품목처럼 단건 조회로 풀지 못한다.** 계약에 `GET /mdm/partners/{partnerId}` 가 있지만
 *    **POP 단말 토큰으로는 401 이다**(실측 2026-09-19 · 현장 서버: 같은 헤더로 목록은 200,
 *    단건은 `PERMISSION_DENIED`). 단건으로 바꾸면 지금까지 «가끔» 나오던 공급사 이름이
 *    «언제나» 「이름을 불러오지 못했습니다」가 된다 — 고치려다 더 나빠지는 자리다.
 *
 * ⛔ **첫 쪽만 받지도 않는다.** 거래처가 900 건이 넘는 현장에서 첫 쪽(기본 50건) 밖 공급사가
 *    「알 수 없음」으로 섰다(omf-all-around#27). 이름 풀이는 목록에 «무엇이 있든» 답해야 한다.
 *
 * ⚠ 그래서 **쪽을 끝까지 받는다.** 화면을 여는 동안 한 번이고 그 뒤로는 조회 캐시가 답한다.
 *   단말 토큰이 단건 조회를 쓸 수 있게 되면 품목과 같은 모양으로 되돌린다.
 *
 * 지금 쓰지 않는 거래처도 함께 받는다(`includeInactive`) — 과거 입하가 그런 거래처를
 * 참조하고 있고, 빼면 그 건의 공급사 칸이 「모름」이 된다.
 */
export const useSupplierLookup = (): LookupSource => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: lookupKeys.partners,
    queryFn: async () => {
      const fetchPage = (page: number) =>
        runRequest(() =>
          client.GET('/mdm/partners', {
            params: { query: { includeInactive: true, page, size: PARTNER_PAGE_SIZE } },
          }),
        );

      const first = await fetchPage(1);
      const items = [...first.items];

      /*
       * 받은 건수와 `total` 을 견준다 — 서버가 요청한 쪽 크기를 낮춰 적용할 수 있어 `size` 로
       * 세면 어긋난다. 빈 쪽이나 엉뚱한 쪽이 오면 더 받아도 새 사실이 없으므로 멈춘다.
       */
      for (let page = 2; items.length < first.page.total; page += 1) {
        const next = await fetchPage(page);

        if (next.items.length === 0 || next.page.page !== page) break;
        items.push(...next.items);
      }

      return items;
    },
  });

  return {
    entries:
      query.data?.map((item) => ({
        value: String(item.partnerId),
        label: `${item.partnerCode} · ${item.partnerName}`,
        isActive: item.isActive,
      })) ?? EMPTY_ENTRIES,
    isError: query.isError,
    isLoading: query.isPending,
  };
};

/**
 * 단위 — 수량 표기에서만 보인다(단위 열을 따로 두지 않는다).
 *
 * ⚠ **여기는 목록 그대로다.** 계약에 단건 조회(`/mdm/uoms/{uomId}`)가 없고, 단위는 전체가 한
 *   쪽에 들어오는 크기라 품목·공급사와 사정이 다르다.
 */
export const useUomLookup = (enabled: boolean): LookupSource => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: lookupKeys.uoms,
    enabled,
    queryFn: () =>
      runRequest(() => client.GET('/mdm/uoms', { params: { query: { includeInactive: true } } })),
  });

  return {
    entries:
      query.data?.items.map((item) => ({
        value: String(item.uomId),
        label: item.uomCode,
        isActive: item.isActive,
      })) ?? EMPTY_ENTRIES,
    isError: query.isError,
    isLoading: enabled && query.isPending,
  };
};
