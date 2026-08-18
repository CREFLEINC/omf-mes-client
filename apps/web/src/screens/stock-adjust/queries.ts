import type { ApiClient } from '@omf-mes/api-client';
import { useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import { toBalanceRow, type BalanceRow, type BalanceSource } from './balances';
import { toCountOptionView, toCountVarianceLineView } from './types';
import type { CountOptionView, CountVarianceLineView, PageMeta } from './types';

/**
 * 이 회차의 요청 — **읽기 셋**이다. 실사 목록 · 실사 차이 라인 · 재고 잔액.
 *
 * 등록·상신·전기는 뒤따르는 회차가 붙인다. **`pendingApprovalOnly`를 쓰지 않는다**(⛔ D-3) —
 * 계약에 그 조건이 남아 있으나 승인 대기는 결재함(W-CO-09)이 소유하고, 이 화면에는 그 탭이 없다.
 *
 * 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch`가 경로를 리터럴 타입으로 요구해
 * 문자열 변수로 넘기면 타입 검사가 풀린다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

type Client = ApiClient['client'];

/**
 * 캐시 키.
 *
 * **읽는 대상마다 앞머리를 갈라 둔다** — 하나로 묶으면 한쪽만 다시 부르려 해도 다른 쪽까지
 * 함께 무효화되고, 그때 응답이 새 참조로 오면서 세운 대상이 다시 서거나 사라진다.
 */
export const stockAdjustKeys = {
  counts: ['stock-adjust', 'counts'] as const,
  varianceLines: (inventoryCountId: number | null): readonly unknown[] =>
    ['stock-adjust', 'variance-lines', inventoryCountId] as const,
  /** 잔액은 **창고·위치마다** 캐시가 갈린다 — 요청 하나가 한 위치를 담는다(D-6). */
  balances: (warehouseId: number, locationId: number): readonly unknown[] =>
    ['stock-adjust', 'balances', warehouseId, locationId] as const,
};

export interface CountListResult {
  counts: CountOptionView[];
  /** 목록이 잘렸으면 참. **「없는 실사」 판정을 막는 값이다** — 못 본 것과 없는 것은 다르다 */
  truncated: boolean;
}

const fetchCounts = async (client: Client): Promise<CountListResult> => {
  const data = await runRequest(() => client.GET('/inventory/counts', {}));

  return {
    counts: data.items.map(toCountOptionView),
    truncated: isTruncated(data.page, data.items.length),
  };
};

const isTruncated = (page: PageMeta, shown: number): boolean => page.total > shown;

/**
 * 원천으로 고를 실사 목록.
 *
 * **좁히지 않는다.** 계약에 `inProgressOnly`·`statusCode`가 있으나 조정은 **마감된 실사**의
 * 차이에서 시작하는 것이 정상 경로이고(W-01-04 §5-5), 상태 값 목록도 확정되지 않았다
 * (공유계약 G-2) — 좁히면 고를 수 있어야 할 실사가 사라진다.
 */
export const useInventoryCounts = (): UseQueryResult<CountListResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: stockAdjustKeys.counts,
    queryFn: () => fetchCounts(client),
  });
};

/**
 * 실사 차이 라인 조회의 쪽 크기.
 *
 * **이 값에는 계약 근거가 없다** — `size`에 `maximum`이 없어 화면이 정한 완화값이며 보장이
 * 아니다. 계약이 이 오퍼레이션에 「창고 하나의 라인이 수천 건이라 페이지네이션이 필요하다」를
 * 못 박았으므로 **싣지 않으면 서버 기본 쪽 크기에 조용히 잘린다.** 그래도 잘리면 아래
 * `truncated`가 그 사실을 밝힌다 — 완화값은 잘림을 줄일 뿐 없애지 못한다.
 */
export const VARIANCE_LINE_PAGE_SIZE = 200;

export interface CountVarianceLinesResult {
  lines: CountVarianceLineView[];
  /**
   * 앞쪽 일부만 왔는가.
   *
   * **이 값이 이 회차에서 하는 일은 사실을 밝히는 것뿐이다.** 뒤따르는 등록 회차가 같은 값을
   * **등록 잠금 사유**로 소비한다 — 못 받은 줄은 조정 대상에 실리지 않고, 그 차이는 조정되지
   * 않은 채 남기 때문이다(주 사본 `stocktaking`이 잘림을 경고가 아니라 차단으로 다룬 근거).
   * 판정 자리를 지금 세워 두면 그 회차는 소비처만 더하면 된다.
   */
  truncated: boolean;
  /**
   * 서버가 말한 전체 건수.
   *
   * **받은 수만으로는 무엇이 빠졌는지 말할 수 없다.** 「3행을 가져왔다」와 「12행 가운데 3행을
   * 가져왔다」는 사용자가 할 조치가 다르다.
   */
  total: number;
}

const fetchVarianceLines = async (
  client: Client,
  inventoryCountId: number,
): Promise<CountVarianceLinesResult> => {
  const data = await runRequest(() =>
    client.GET('/inventory/counts/{inventoryCountId}/lines', {
      params: {
        path: { inventoryCountId },
        /*
         * **차이가 있는 줄만 받는다.** 조정의 대상은 차이이고, 창고 하나의 라인이 수천 건이라
         * 전부 받으면 사용자가 조정할 줄을 그 안에서 찾아야 한다.
         */
        query: { varianceOnly: true, size: VARIANCE_LINE_PAGE_SIZE },
      },
    }),
  );

  return {
    lines: data.items.map(toCountVarianceLineView),
    truncated: isTruncated(data.page, data.items.length),
    total: data.page.total,
  };
};

/**
 * 실사 차이 라인 — **사용자가 「불러오기」를 누른 뒤에만 부른다.**
 *
 * 실사를 고르는 것만으로 부르지 않는다: 고르는 도중에 스쳐 간 실사마다 요청이 나가고,
 * 그 응답이 도착할 때마다 세운 대상이 다시 서기 때문이다. 「불러오기」는 **대상을 다시 세우는
 * 조작**이라 사용자가 명시해야 한다.
 *
 * **받은 것이 전부인지를 함께 낸다.** 이 목록은 조정 대상 자체를 정하므로, 잘린 줄 모르고
 * 「N행을 가져왔습니다」로 말하면 사용자가 그것을 전부로 읽는다 — 같은 슬라이스가 실사 목록과
 * 참조 다섯에 이미 세운 규율(「못 본 것과 없는 것은 다르다」)을 여기에도 건다.
 */
export const useCountVarianceLines = (
  inventoryCountId: number | null,
): UseQueryResult<CountVarianceLinesResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: stockAdjustKeys.varianceLines(inventoryCountId),
    enabled: inventoryCountId !== null,
    queryFn: () => {
      if (inventoryCountId === null) {
        throw new Error('대상 실사가 없으면 실사 차이를 조회하지 않습니다.');
      }

      return fetchVarianceLines(client, inventoryCountId);
    },
  });
};

/** 위치 하나의 잔액 — 화면이 대조에 쓰는 줄만 남긴다. */
const fetchLocationBalance = async (
  client: Client,
  warehouseId: number,
  locationId: number,
): Promise<BalanceRow[]> => {
  const data = await runRequest(() =>
    client.GET('/inventory/balances', {
      params: {
        query: {
          /*
           * **창고가 필수다.** 계약이 「창고·품목·LOT 중 적어도 하나」를 요구하는데 위치는
           * 그 셋에 들지 않는다 — 위치만 실으면 400이다.
           */
          warehouseId,
          locationId,
          /* LOT까지 갈라 받는다 — 같은 품목의 다른 LOT을 한 줄로 접으면 장부가 남의 것이 된다. */
          groupBy: 'LOT',
          /*
           * **0인 줄도 받는다.** 받지 않으면 「장부가 0인 것」과 「장부에 없는 것」이 화면에서
           * 같아 보이고, 0인 재고를 조정하는 정상 업무가 「못 찾음」으로 보인다.
           */
          includeZero: true,
        },
      },
    }),
  );

  return data.items.map(toBalanceRow);
};

/** 위치별 잔액 한 벌. 화면은 줄마다 이 표에서 자기 위치의 것을 꺼내 쓴다. */
export type BalanceSources = Readonly<Record<number, BalanceSource>>;

export interface LocationBalancesResult {
  sources: BalanceSources;
  /**
   * 실패한 잔액을 다시 부른다.
   *
   * **복구 수단은 그 실패가 보이는 자리에 있어야 한다**(C16). 이것이 없으면 장부 조회가
   * 실패한 사용자에게 남는 조치가 줄을 지웠다 다시 더하거나 새로고침뿐이다 — 같은 위치를
   * 다시 골라도 관측자가 그대로라 요청이 다시 나가지 않는다.
   */
  refetch: () => void;
}

/**
 * 고른 위치들의 장부 — **위치당 요청 하나**다(D-6 · C7).
 *
 * 줄마다 부르지 않는다. 같은 위치의 줄이 셋이면 요청도 셋이 되고, 사용자가 줄을 더할 때마다
 * 그대로 는다 — 위치 단위로 한 번 받아 (품목·LOT)로 국소 대조한다.
 *
 * **실사 갈래에서는 부르지 않는다.** 그쪽 장부는 실사 라인이 이미 들고 왔다 — 여기서 또
 * 부르면 같은 사실을 두 시점의 값으로 말하게 되고, 둘이 갈리면 어느 쪽이 참인지 화면이 모른다.
 */
export const useLocationBalances = (
  warehouseId: number | null,
  locationIds: readonly number[],
): LocationBalancesResult => {
  const { client } = useApiClient();

  /* 같은 위치의 줄이 여럿이면 요청도 여러 번 나간다 — 중복을 먼저 없앤다. */
  const uniqueLocationIds = [...new Set(locationIds)].sort((left, right) => left - right);
  const enabled = warehouseId !== null;

  const results = useQueries({
    queries: uniqueLocationIds.map((locationId) => ({
      queryKey: stockAdjustKeys.balances(warehouseId ?? 0, locationId),
      enabled,
      queryFn: () => {
        if (warehouseId === null) {
          throw new Error('대상 창고를 알기 전에는 장부를 조회하지 않습니다.');
        }

        return fetchLocationBalance(client, warehouseId, locationId);
      },
    })),
  });

  const sources: Record<number, BalanceSource> = {};

  uniqueLocationIds.forEach((locationId, index) => {
    const result = results[index];

    sources[locationId] = {
      rows: result?.data ?? [],
      /* 물었는지와 답이 왔는지를 가른다 — 묻지 않은 줄을 「못 찾음」으로 그리지 않기 위해서다. */
      isAsked: enabled,
      isLoading: enabled && (result?.isPending ?? true),
      isError: result?.isError ?? false,
    };
  });

  return {
    sources,
    refetch: () => {
      for (const result of results) void result.refetch();
    },
  };
};

/** 아직 묻지 않은 위치의 장부. **줄마다 같은 참조를 쓴다** — 매 렌더 새로 만들면 계산이 멈추지 않는다. */
export const UNASKED_BALANCE: BalanceSource = {
  rows: [],
  isAsked: false,
  isLoading: false,
  isError: false,
};
