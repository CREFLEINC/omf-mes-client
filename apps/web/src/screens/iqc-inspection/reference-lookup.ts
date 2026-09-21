import { messages } from '@omf-mes/i18n';
import { useQueries, useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { fetchAllPages } from '../../patterns/fetch-all-pages';
import { masterName } from '../../patterns/master-name';
import { runRequest, toApiError } from '../../patterns/request';

/**
 * 식별자를 **사람이 읽는 말**로 바꾸는 이름표 — 품목과 자재 LOT.
 *
 * ⛔ **내부 번호를 화면에 내지 않는다**(`omf-mes#44`). 이 화면은 그 규칙이 빠져 있어
 *    「품목 12588」·「대상 LOT 45」가 그대로 찍혔다 — 검사자가 **무엇을 검사하는지 알 수 없다**
 *    (omf-all-around#40). 번호는 사용자가 쓰는 말이 아니고, 그것을 내면 그것이 품목명인 줄
 *    알고 읽는다.
 *
 * ⭐ **번호로 하나씩 푼다.** 목록 한 쪽으로 풀면 그 쪽 밖의 값이 전부 「알 수 없음」이 된다 —
 *    품목 마스터가 9,269건인 곳이 있다(omf-all-around#37). 부르는 횟수는 **화면에 실제로 선
 *    줄이 가리키는 수**이고, 같은 값을 가리키는 줄이 여럿이면 요청도 하나다.
 *
 * ⚠ **권한이 없을 수 있다.** 이 화면과 같은 자리의 단위 조회(`uom-lookup.ts`)가 IQC 권한만
 *    가진 사용자에게 403 이 난다고 적어 두었다. 그래서 실패를 **화면을 멈추는 사유로 쓰지
 *    않는다** — 이름 자리에 「이름을 불러오지 못했습니다」만 서고 검사·판정은 그대로 된다.
 *    되풀이해 불러도 같은 답이라 다시 부르지 않는다(`retry: false`).
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */

const t = messages.common.reference;

/** 그 번호의 값이 없다(404). **못 받은 것과 다르다** — 다시 부를 이유가 없다. */
const isNotFound = (error: unknown): boolean => {
  const apiError = toApiError(error);

  return apiError.kind === 'http' && apiError.status === 404;
};

export interface NameLookup {
  /**
   * 한 줄의 표기. **네 갈래를 서로 다른 글자로 낸다** — 뭉치면 사용자가 원인을 반대로 읽는다.
   *
   * | 갈래 | 글자 |
   * | --- | --- |
   * | 값이 없다(`null`) | `—` |
   * | 아직 오지 않았다 | 「이름 불러오는 중」 |
   * | 그 번호의 것이 없다(404) | 「알 수 없음」 |
   * | 못 받았다(권한·연결) | 「이름을 불러오지 못했습니다」 |
   *
   * ⛔ 어느 갈래에도 **번호를 담지 않는다** — 담을 자리가 없으면 화면으로 샐 경로도 없다.
   */
  labelOf: (id: number | null | undefined) => string;
}

type Client = ReturnType<typeof useApiClient>['client'];

const describe = (
  result: { isPending: boolean; isError: boolean; error: unknown; data?: string } | undefined,
): string => {
  if (result === undefined || result.isPending) return t.loading;
  if (result.isError) return isNotFound(result.error) ? t.unknown : t.failed;

  return result.data ?? t.unknown;
};

/** 부르는 횟수를 줄 수가 아니라 **값의 가짓수**로 만든다. 정렬은 요청 순서를 읽기 쉽게 둔다. */
const uniqueOf = (ids: readonly (number | null | undefined)[]): number[] =>
  [...new Set(ids.filter((id): id is number => id !== null && id !== undefined))].sort(
    (left, right) => left - right,
  );

/**
 * 품목 이름 — 「코드 · 이름」으로 낸다.
 *
 * 코드만으로는 무엇인지 알려면 외우고 있어야 하고, 이름만으로는 실물 라벨과 눈으로 대조할 수
 * 없다 — 라벨에 찍히는 것은 코드다.
 */
export const useItemNames = (itemIds: readonly (number | null | undefined)[]): NameLookup => {
  const { client } = useApiClient();
  const ids = uniqueOf(itemIds);

  const results = useQueries({
    queries: ids.map((itemId) => ({
      queryKey: ['iqc-inspection', 'item-name', itemId] as const,
      queryFn: () => fetchItemName(client, itemId),
      retry: false,
      staleTime: Infinity,
    })),
  });

  return {
    labelOf: (id) => {
      if (id === null || id === undefined) return t.empty;

      const index = ids.indexOf(id);

      return describe(index === -1 ? undefined : results[index]);
    },
  };
};

const fetchItemName = async (client: Client, itemId: number): Promise<string> => {
  const data = await runRequest(() =>
    client.GET('/mdm/items/{itemId}', { params: { path: { itemId } } }),
  );

  /* 상세는 봉투로 온다 — 편집 가능 여부(`editability`)는 이 화면이 쓰지 않는다. */
  const item = data.item;

  return `${item.itemCode} · ${masterName(item, item.itemName)}`;
};

/**
 * 자재 LOT 번호.
 *
 * ⭐ **LOT 번호가 이 화면의 열쇠다.** 검사자가 손에 든 라벨과 화면을 대조하는 유일한 값이고,
 *    라벨에 찍히는 것은 `lotNo` 이지 내부 번호가 아니다.
 */
export const useLotNumbers = (lotIds: readonly (number | null | undefined)[]): NameLookup => {
  const { client } = useApiClient();
  const ids = uniqueOf(lotIds);

  const results = useQueries({
    queries: ids.map((lotId) => ({
      queryKey: ['iqc-inspection', 'lot-no', lotId] as const,
      queryFn: () => fetchLotNo(client, lotId),
      retry: false,
      staleTime: Infinity,
    })),
  });

  return {
    labelOf: (id) => {
      if (id === null || id === undefined) return t.empty;

      const index = ids.indexOf(id);

      return describe(index === -1 ? undefined : results[index]);
    },
  };
};

const fetchLotNo = async (client: Client, lotId: number): Promise<string> => {
  const data = await runRequest(() =>
    client.GET('/trace/lots/{lotId}', { params: { path: { lotId } } }),
  );

  return data.lot.lotNo;
};

export interface SupplierOptions {
  options: { value: string; label: string }[];
  isLoading: boolean;
  isError: boolean;
}

/**
 * 공급사 선택지 — 조건 줄의 공급사 칸이 쓴다.
 *
 * ⛔ **사용자에게 번호를 치라고 하지 않는다.** 종전에는 「공급사 번호로 검색」 칸에
 *    `inputMode="numeric"` 으로 내부 번호를 받았다 — 거래처 번호를 외우는 검사자는 없다
 *    (omf-all-around#40).
 *
 * ⭐ **끝까지 받는다**(`fetchAllPages`). 거래처는 936건이라 한 쪽(기본 50건)에 들어가지 않고,
 *    첫 쪽만 받으면 그 너머 공급사를 **고를 수조차 없다**(omf-all-around#38).
 *
 * ⚠ 단위 조회와 같은 이유로 **권한이 없을 수 있다** — 실패해도 화면을 멈추지 않는다.
 *    선택지가 비고 부르는 쪽이 그 사실을 적는다.
 */
export const useSupplierOptions = (): SupplierOptions => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: ['iqc-inspection', 'suppliers'] as const,
    queryFn: () =>
      fetchAllPages((page, size) =>
        runRequest(() =>
          client.GET('/mdm/partners', {
            params: { query: { includeInactive: true, page, size } },
          }),
        ),
      ),
    retry: false,
    staleTime: Infinity,
  });

  return {
    options:
      query.data?.items.map((partner) => ({
        value: String(partner.partnerId),
        /* 거래처에는 언어별 이름 칸이 없다(품목과 다르다) — 원본을 그대로 쓴다. */
        label: `${partner.partnerCode} · ${partner.partnerName}`,
      })) ?? [],
    isLoading: query.isPending,
    isError: query.isError,
  };
};
