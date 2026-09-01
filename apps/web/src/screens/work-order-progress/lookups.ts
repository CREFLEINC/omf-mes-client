import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';

/**
 * 식별자를 사람이 읽는 이름으로 바꾸는 이름표.
 *
 * ⛔ **못 받았을 때 숫자 식별자를 보이지 않는다.** `5001` 은 사용자가 쓰는 말이 아니다 —
 * 그것을 내면 그것이 품목명인 줄 알고 읽는다. 이름을 모르면 **모른다고 적는다.**
 *
 * ⚠ 목록 응답이 이름을 함께 주지 않아 생긴 자리다(omf-mes#265 ④). 서버가 표시용 이름을
 * 실어 주기 시작하면 이 이름표는 **필요 없어진다.**
 */
export interface NameLookup {
  labelOf: (id: number | string | undefined) => string;
  /** 고를 수 있는 값들. 필터의 선택지가 된다. */
  options: { value: string; label: string }[];
  isPending: boolean;
  isError: boolean;
  /**
   * 한 번에 받는 건수를 넘겨 **일부만 받았는가.**
   *
   * ⛔ 이때 화면은 「선택지가 이게 전부」인 척하면 안 된다(A-11). 목록에 없는 것은 이름이
   * 「이름 확인 중」으로 남고, 필터에서는 고를 수조차 없다 — 그 사실을 적어야 한다.
   */
  isTruncated: boolean;
}

export const NAME_UNKNOWN = '이름 확인 중';

/** 한 번에 받아 둘 최대 건수. 넘치면 이름을 못 붙이는 것이 있을 수 있다. */
export const LOOKUP_SIZE = 200;

interface LookupPage {
  entries: { value: string; label: string }[];
  total: number;
}

const toLookup = (
  page: LookupPage | undefined,
  isPending: boolean,
  isError: boolean,
): NameLookup => {
  const entries = page?.entries ?? [];
  const byValue = new Map(entries.map((entry) => [entry.value, entry.label]));

  return {
    labelOf: (id) => {
      if (id === undefined) return NAME_UNKNOWN;

      return byValue.get(String(id)) ?? NAME_UNKNOWN;
    },
    options: entries,
    isPending,
    isError,
    isTruncated: page !== undefined && page.total > entries.length,
  };
};

/** 품목 이름표. 목록의 품목 열과 상세가 함께 쓴다. */
export const useItemLookup = (): NameLookup => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: ['work-order-progress', 'items'] as const,
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/mdm/items', {
          params: { query: { includeInactive: true, size: LOOKUP_SIZE } },
        }),
      );

      return {
        entries: data.items.map((item) => ({
          value: String(item.itemId),
          /* 코드와 이름을 함께 보인다 — 이름만으로는 같은 이름이 여럿일 때 못 가른다. */
          label: `${item.itemCode} · ${item.itemName}`,
        })),
        total: data.page.total,
      };
    },
  });

  return toLookup(query.data, query.isPending, query.isError);
};

/**
 * P/O 이름표. 필터의 선택지로 쓴다.
 *
 * ⚠ **여기서 잘림이 가장 잘 일어난다.** 품목·라인은 마스터라 수가 정해져 있지만 P/O 는
 * 주문이 들어올 때마다 늘어난다. 그래서 「고르려는 P/O 가 목록에 없는」 일이 실제로 생기고,
 * 화면은 `isTruncated` 로 그 사실을 적는다 — 적지 않으면 「그런 P/O 는 없다」로 읽힌다.
 *
 * ⛔ **P/O 는 번호가 곧 이름이라 코드를 덧붙이지 않는다.** 품목·라인처럼 `코드 · 이름` 으로
 * 꾸미면 없는 필드를 지어내는 셈이 된다.
 */
export const useProductionOrderLookup = (): NameLookup => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: ['work-order-progress', 'production-orders'] as const,
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/planning/production-orders', {
          /*
           * ⛔ 하위 P/O 를 함께 받지 않는다 — 참이면 page·total 이 «루트 기준»으로 바뀌어
           * 「몇 건 중 몇 건을 받았나」가 어긋나고, 잘림 판정이 거짓이 된다.
           */
          params: { query: { size: LOOKUP_SIZE } },
        }),
      );

      return {
        entries: data.items.map((order) => ({
          value: String(order.productionOrderId),
          label: order.productionOrderNo,
        })),
        total: data.page.total,
      };
    },
  });

  return toLookup(query.data, query.isPending, query.isError);
};

/** 라인 이름표. 필터의 선택지로 쓴다. */
export const useProductionLineLookup = (): NameLookup => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: ['work-order-progress', 'production-lines'] as const,
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/mdm/production-lines', {
          params: { query: { includeInactive: true, size: LOOKUP_SIZE } },
        }),
      );

      return {
        entries: data.items.map((line) => ({
          value: String(line.productionLineId),
          label: `${line.lineCode} · ${line.lineName}`,
        })),
        total: data.page.total,
      };
    },
  });

  return toLookup(query.data, query.isPending, query.isError);
};
