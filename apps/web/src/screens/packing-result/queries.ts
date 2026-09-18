import type { ApiClient } from '@omf-mes/api-client';
import { useMutation, useQuery, type UseMutationResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import { remainingOf } from './packing-draft';

import type {
  HandlingUnit,
  MatchedLot,
  Shipment,
  ShipmentEntry,
  ShipmentLotAllocation,
} from './types';

/**
 * 이 화면의 읽기 — **스캔 둘 · 포장 유형 · 진행**.
 *
 * ⭐ **두 스캔은 «조회»가 아니라 «액션»이다.** 작업자가 읽힌 순간에만 일어나고 같은 코드를
 * 다시 읽으면 다시 나가야 한다 — 그래서 `useMutation` 이다. 캐시에 앉히면 두 번째 스캔이
 * 조용히 지난 결과를 되돌려 준다.
 *
 * ⛔ **매칭 판정을 화면이 하지 않는다.** 둘째 스캔은 `shipmentId`+`lotQ` 로 물어 서버의
 * `match` 를 그대로 받는다(스펙 §5-1 · 공유계약 C-6).
 *
 * 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch`가 경로를 리터럴 타입으로 요구한다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

type Client = ApiClient['client'];

/** 포장 유형 값 목록의 그룹 코드. ⚠ 채번 식별자(`codeGroupId`)를 쓰지 않는다 — 환경마다 다르다. */
export const HANDLING_UNIT_TYPE_GROUP_CODE = 'HANDLING_UNIT_TYPE';

/** 한 번에 받아 둘 최대 건수. 포장 유형·상위 후보가 이보다 많을 일은 없다. */
const OPTION_SIZE = 100;

interface PageResponse<T> {
  items: T[];
  page: { page: number; size: number; total: number };
}

/**
 * 목록을 화면 로컬 기본 쪽으로 잘라 쓰지 않는다. P-04-01은 출하 전체 진행과 배분을 판단하므로
 * `page.total`까지 전건을 완성하지 못하면 부분 목록을 성공으로 내보내지 않는다.
 */
const collectAllPages = async <T>(
  fetchPage: (page: number, size: number) => Promise<PageResponse<T>>,
): Promise<T[]> => {
  const first = await fetchPage(1, OPTION_SIZE);
  const pageSize = Math.max(1, first.page.size);
  const totalPages = Math.ceil(first.page.total / pageSize);
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, totalPages - 1) }, (_, index) => index + 2).map((page) =>
      fetchPage(page, pageSize),
    ),
  );
  const items = [first, ...rest].flatMap((response) => response.items);

  if (items.length < first.page.total) {
    throw new Error('출하 관련 목록 전체를 불러오지 못했습니다.');
  }

  return items.slice(0, first.page.total);
};

export const packingResultKeys = {
  typeOptions: ['packing-result', 'handling-unit-types'] as const,
  progress: (shipmentId: number) => ['packing-result', 'progress', shipmentId] as const,
  /*
   * ⭐ **진행 키 «아래»에 둔다.** 포장을 확정하면 이 수도 함께 바뀌는데, 확정 뒤 무효화는
   *    `progress(shipmentId)` 하나를 지운다(`mutations.ts`) — 접두사가 같으면 그 한 번에 둘 다
   *    낡은 것으로 표시된다. 따로 두면 방금 담은 상자가 이 수에 며칠이고 안 잡힌다.
   */
  unassignedBoxes: (shipmentId: number) =>
    ['packing-result', 'progress', shipmentId, 'unassigned-boxes'] as const,
  uoms: ['packing-result', 'uoms'] as const,
  todayShipments: (businessDate: string) =>
    ['packing-result', 'today-shipments', businessDate] as const,
};

/** 번호로 좁힌 목록 한 쪽 — 부분 일치라 같은 번호 조각을 가진 건이 몇 개 따라올 수 있다. */
const SHIPMENT_SEARCH_SIZE = 50;

const localDate = (now: Date): string => {
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const unpackedAllocations = async (
  client: Client,
  shipmentId: number,
): Promise<ShipmentLotAllocation[]> =>
  collectAllPages((page, size) =>
    runRequest(() =>
      client.GET('/logistics/shipment-lot-allocations', {
        params: { query: { shipmentId, unpackedOnly: true, page, size } },
      }),
    ),
  );

const entryOfShipment = async (client: Client, shipment: Shipment): Promise<ShipmentEntry> => ({
  shipmentId: shipment.shipmentId,
  shipmentNo: shipment.shipmentNo,
  allocations: await unpackedAllocations(client, shipment.shipmentId),
});

/*
 * ⛔ **출하번호 정확 일치 «조회»를 두지 않는다**(사용자 지시 2026-09-18 · #1351). 화면의 스캔이
 *    출하대상 목록 안으로 들어가(`PopSelect` 의 `scannable`) 서버를 다시 부를 일이 없어졌다.
 *
 * ⚠ **걷어낸 진짜 이유는 「두 번째 조회」였다.** 이 훅은 아래 `useTodayShipments` 와 같은
 *   오퍼레이션을 부르면서 **`shipDateTo` 만 빼고** 나갔다 — 그래서 「목록엔 없는데 찍으면 잡히는
 *   출하」가 생겼고, 「목록에 없으면 직접 입력한다」는 성립하지 않았다. 고를 수 있는 것은 목록
 *   하나로 정의한다(`docs/decisions.md` 18).
 *
 * ⚠ **되살릴 자리가 생길 수 있다.** 원본 계약에는 `shipmentNo` 정확 일치 파라미터가 있었고
 *   「그 조회는 기간을 생략할 수 있다」고 적혀 있었는데 서버 구현 기준(v0.1.2)에서 사라졌다
 *   (통보 219). 그것이 돌아오면 **고를 수 «없는» 출하의 사유**(피킹 미완·기간 밖·없는 번호)를
 *   말하는 데 쓴다 — 고르는 길을 하나 더 내는 데가 아니다.
 */

/** 현재 영업일 피킹 완료 출하. 선택 팝업의 검색은 PopSelect가 로컬에서만 수행한다. */
export const useTodayShipments = (): {
  shipments: Shipment[];
  isPending: boolean;
  isError: boolean;
} => {
  const { client } = useApiClient();
  const businessDate = localDate(new Date());
  const query = useQuery({
    queryKey: packingResultKeys.todayShipments(businessDate),
    queryFn: () =>
      collectAllPages((page, size) =>
        runRequest(() =>
          client.GET('/logistics/shipments', {
            params: {
              query: {
                pickedOnly: true,
                shipDateFrom: businessDate,
                shipDateTo: businessDate,
                page,
                size,
              },
            },
          }),
        ),
      ),
  });

  return { shipments: query.data ?? [], isPending: query.isPending, isError: query.isError };
};

/**
 * 아직 어느 출하 단위에도 들어가지 않은 **포장 완료 상자 수**(SHIP-UNIT-01 P5).
 *
 * ⭐ **서버가 센다.** 한 상자가 배분 여럿에 걸릴 수 있어 화면이 배분으로 세면 겹쳐 세거나
 *    빠뜨린다 — 계약도 상자 기준으로 센다고 못박았다.
 *
 * ⛔ **상세로 묻지 않는다.** 계약이 「목록에서만 채운다(상세는 세지 않는다)」고 적었다 —
 *    상세로 물으면 값이 늘 `undefined` 로 와서 **0 으로 읽힌다.**
 * ⭐ 그래서 목록을 `hasUnassignedPackedBox=true` 로 묻고 이 출하가 그 안에 있는지 본다 —
 *    없으면 남은 상자가 **없다**는 뜻이라 0 이다. 그 축을 함께 주면 기간이 선택이 된다(v4).
 * ⚠ `q` 는 부분 일치다 — 번호가 정확히 같은 것만 다시 골라낸다. 그러지 않으면 번호 조각이
 *   같은 다른 출하의 상자 수를 이 출하의 것으로 읽는다.
 *
 * ⛔ **못 받은 것을 0 으로 떨어뜨리지 않는다.** 0 은 「담을 것이 없다」는 업무 사실이고, 못
 *    받은 것은 「모른다」다 — 섞으면 담당은 구성할 상자가 없다고 읽고 다음 화면으로 가지 않는다.
 */
export const useUnassignedPackedBoxCount = (
  shipmentId: number | null,
  shipmentNo: string | null,
): { count: number | null; isError: boolean } => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: packingResultKeys.unassignedBoxes(shipmentId ?? 0),
    enabled: shipmentId !== null && shipmentNo !== null,
    queryFn: async () => {
      if (shipmentNo === null) throw new Error('출하번호를 모르면 미구성 상자를 세지 않습니다.');

      const data = await runRequest(() =>
        client.GET('/logistics/shipments', {
          params: {
            query: {
              hasUnassignedPackedBox: true,
              q: shipmentNo,
              page: 1,
              size: SHIPMENT_SEARCH_SIZE,
            },
          },
        }),
      );

      return (
        data.items.find((item) => item.shipmentNo === shipmentNo)?.unassignedPackedBoxCount ?? 0
      );
    },
  });

  return { count: query.data ?? null, isError: query.isError };
};

export const useShipmentSelection = (): UseMutationResult<ShipmentEntry, Error, Shipment> => {
  const { client } = useApiClient();

  return useMutation({ mutationFn: (shipment: Shipment) => entryOfShipment(client, shipment) });
};

/** ② 생산LOT 스캔의 입력 — 출하 축은 **첫 스캔 응답의 `shipmentId`** 를 그대로 쓴다. */
export interface LotScanInput {
  shipmentId: number;
  code: string;
}

/**
 * ② 생산LOT 스캔.
 *
 * ⭐ **판정이 응답의 `match` 에 실려 온다.** 배분이 걸리지 않아도 `matched: false` 로 오므로
 * 화면은 목록의 길이로 판정하지 않는다 — 사유(`reasonCode`)가 문구를 가른다.
 */
const lookupLot = async (client: Client, input: LotScanInput): Promise<MatchedLot> => {
  const data = await runRequest(() =>
    client.GET('/logistics/shipment-lot-allocations', {
      params: {
        query: { shipmentId: input.shipmentId, lotQ: input.code, page: 1, size: OPTION_SIZE },
      },
    }),
  );

  /*
   * ⛔ **`match` 가 없으면 «맞다»로 읽지 않는다.** 계약은 `lotQ` 를 준 요청에만 이 칸을
   * 싣는다고 적었으므로 정상 경로에서는 늘 오지만, 없을 때 통과시키면 판정을 못 받은 스캔이
   * 담기까지 간다 — 「모르는 것」을 「통과」로 처리하지 않는다(공유계약 F-6).
   */
  const verdict = data.match ?? { matched: false };
  const items = data.items ?? [];

  /* 다르다는 판정의 문구(품목 불일치)는 출하의 품목을 말하므로 출하 배분 하나를 그대로 넘긴다. */
  if (!verdict.matched) return { allocation: items[0], verdict };

  /*
   * ⛔ **첫 줄을 스캔한 LOT 으로 읽지 않는다.** 서버는 `lotQ` 로 목록을 거르지 않고 판정만
   * 싣는다 — `items` 는 이 출하의 배분 전건이다(계약 `lotQ` 설명). 첫 줄을 쓰면 다른 LOT 의
   * 잔여가 뜨고 그 LOT 이 상자에 담긴다(실서버 실측 2026-09-17). 서버 판정과 같은 기준
   * (LOT 번호 정확 일치)으로 고르고, 같은 LOT 이 여러 배분에 걸리면 잔여가 남은 줄을 먼저 쓴다.
   */
  const pick = (candidates: readonly ShipmentLotAllocation[]) => {
    const same = candidates.filter((allocation) => allocation.lotNo === input.code);

    return same.find((allocation) => remainingOf(allocation) > 0) ?? same[0];
  };
  const onFirstPage = pick(items);

  if (
    (onFirstPage !== undefined && remainingOf(onFirstPage) > 0) ||
    items.length >= data.page.total
  ) {
    return { allocation: onFirstPage, verdict };
  }

  const all = await collectAllPages((page, size) =>
    runRequest(() =>
      client.GET('/logistics/shipment-lot-allocations', {
        params: { query: { shipmentId: input.shipmentId, page, size } },
      }),
    ),
  );

  return { allocation: pick(all), verdict };
};

export const useLotScan = (): UseMutationResult<MatchedLot, Error, LotScanInput> => {
  const { client } = useApiClient();

  return useMutation({ mutationFn: (input: LotScanInput) => lookupLot(client, input) });
};

export interface CodeOption {
  value: string;
  label: string;
}

/**
 * 포장 유형 선택지 — **고객의 공통코드 마스터에서 받는다**(공유계약 G-32 · `omf-mes#198`).
 *
 * ⛔ **값 목록을 화면에 박지 않는다.** 지어 넣으면 마스터에 유형이 늘어난 날 그 유형으로는
 * 포장을 만들 수 없는데 화면은 멀쩡해 보인다.
 */
export interface TypeOptions {
  options: CodeOption[];
  isPending: boolean;
  /** 조회가 실패했거나 값이 하나도 오지 않았다 — 사용자가 할 수 있는 일이 같으므로 묶는다. */
  isUnavailable: boolean;
}

export const useHandlingUnitTypeOptions = (): TypeOptions => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: packingResultKeys.typeOptions,
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/mdm/code-values', {
          params: {
            query: { codeGroupCode: HANDLING_UNIT_TYPE_GROUP_CODE, size: OPTION_SIZE },
          },
        }),
      );

      return data.items.map((item) => ({ value: item.code, label: item.codeName }));
    },
  });

  const options = query.data ?? [];

  return {
    options,
    isPending: query.isPending,
    isUnavailable: query.isError || (!query.isPending && options.length === 0),
  };
};

/**
 * 이 출하의 진행(스펙 §3 ④) — 배분 전건을 받아 화면이 센다.
 *
 * ⭐ **세는 것과 재는 것이 둘 다 서버 값에서 나온다** — 포장 개수는 비어 있지 않은
 * `handlingUnitId` 의 서로 다른 개수, 미포장은 `allocatedQty − packedQty` 의 합이다.
 */
export const useShipmentAllocations = (
  shipmentId: number | null,
): { allocations: ShipmentLotAllocation[]; refetch: () => void } => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: packingResultKeys.progress(shipmentId ?? 0),
    enabled: shipmentId !== null,
    queryFn: async () => {
      if (shipmentId === null) throw new Error('출하를 모르면 진행을 조회하지 않습니다.');

      return collectAllPages((page, size) =>
        runRequest(() =>
          client.GET('/logistics/shipment-lot-allocations', {
            params: { query: { shipmentId, page, size } },
          }),
        ),
      );
    },
  });

  return {
    allocations: query.data ?? [],
    refetch: () => {
      void query.refetch();
    },
  };
};

/**
 * 단위별 **소수 자릿수** — 수량 키패드에 소수점 키를 그릴지 정한다.
 *
 * ⛔ **화면이 정하지 않는다.** 개수로 세는 단위(EA·BOX)에 소수점 키를 두면 서버가 거부할 값을
 * 넣게 되고, 무게·부피 단위(KG·L)에 없으면 값을 넣을 길이 사라진다. 마스터가 그 자릿수를
 * 들고 있으므로 그대로 따른다.
 *
 * ⚠ **모르면 «받지 않는» 쪽으로 둔다** — 못 받은 상태에서 소수를 열어 두면 쓰기가 거부된다.
 */
export const useUomDecimals = (): ((uomId: number | undefined) => boolean) => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: packingResultKeys.uoms,
    queryFn: async (): Promise<Map<number, number>> => {
      const data = await runRequest(() =>
        client.GET('/mdm/uoms', { params: { query: { size: OPTION_SIZE } } }),
      );

      return new Map(data.items.map((uom) => [uom.uomId, uom.decimalScale]));
    },
  });

  return (uomId) => (uomId === undefined ? false : (query.data?.get(uomId) ?? 0) > 0);
};
