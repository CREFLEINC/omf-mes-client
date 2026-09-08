import type { ApiClient } from '@omf-mes/api-client';
import { useMutation, useQuery, type UseMutationResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';

import type {
  HandlingUnit,
  MatchedLot,
  Shipment,
  ShipmentEntry,
  ShipmentLotAllocation,
} from './types';

/**
 * 이 화면의 읽기 — **스캔 둘 · 상위 포장 후보 · 포장 유형 · 진행**.
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
  parentsRoot: ['packing-result', 'parents'] as const,
  parents: (warehouseId: number) => ['packing-result', 'parents', warehouseId] as const,
  progress: (shipmentId: number) => ['packing-result', 'progress', shipmentId] as const,
  uoms: ['packing-result', 'uoms'] as const,
  todayShipments: (businessDate: string) =>
    ['packing-result', 'today-shipments', businessDate] as const,
};

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

/** 출하번호 정확 일치 스캔. 부분 검색이나 납품 라벨 q와 의미를 섞지 않는다. */
export const useShipmentScan = (): UseMutationResult<ShipmentEntry | null, Error, string> => {
  const { client } = useApiClient();

  return useMutation({
    mutationFn: async (shipmentNo: string) => {
      const data = await runRequest(() =>
        client.GET('/logistics/shipments', {
          params: { query: { pickedOnly: true, shipmentNo, page: 1, size: 1 } },
        }),
      );
      const shipment = data.items[0];

      return shipment === undefined ? null : entryOfShipment(client, shipment);
    },
  });
};

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

export const useShipmentSelection = (): UseMutationResult<ShipmentEntry, Error, Shipment> => {
  const { client } = useApiClient();

  return useMutation({ mutationFn: (shipment: Shipment) => entryOfShipment(client, shipment) });
};

/** 첫 스캔의 결과. **빈 목록이 「없는 납품라벨」이다** — 계약이 404 를 내지 않는다. */
export type LabelScanOutcome =
  { kind: 'found'; allocations: ShipmentLotAllocation[] } | { kind: 'not-found' };

const lookupLabel = async (client: Client, code: string): Promise<LabelScanOutcome> => {
  const allocations = await collectAllPages((page, size) =>
    runRequest(() =>
      client.GET('/logistics/shipment-lot-allocations', {
        params: { query: { q: code, page, size } },
      }),
    ),
  );

  return allocations.length === 0 ? { kind: 'not-found' } : { kind: 'found', allocations };
};

/** ① 납품라벨 스캔 — 이 라벨이 어느 출하·어느 품목인지가 여기서 정해진다. */
export const useLabelScan = (): UseMutationResult<LabelScanOutcome, Error, string> => {
  const { client } = useApiClient();

  return useMutation({ mutationFn: (code: string) => lookupLabel(client, code) });
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
      params: { query: { shipmentId: input.shipmentId, lotQ: input.code } },
    }),
  );

  /*
   * ⛔ **`match` 가 없으면 «맞다»로 읽지 않는다.** 계약은 `lotQ` 를 준 요청에만 이 칸을
   * 싣는다고 적었으므로 정상 경로에서는 늘 오지만, 없을 때 통과시키면 판정을 못 받은 스캔이
   * 담기까지 간다 — 「모르는 것」을 「통과」로 처리하지 않는다(공유계약 F-6).
   */
  const verdict = data.match ?? { matched: false };

  return { allocation: (data.items ?? [])[0], verdict };
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
 * 상위 포장 후보 — **이 출하 창고로 좁힌다**(스펙 §5-2-1).
 *
 * ⛔ **「부모가 없는 것만」으로 좁히지 않는다.** 계층 깊이가 확정이 아니고(미결 4), 이 화면은
 * 매번 새 취급 단위를 만들어 상위를 고르므로 **자기 하위가 존재할 수 없다** — 순환이 구조적으로
 * 불가능하다. ⚠ **후보가 0건이어도 정상이다.**
 */
export interface ParentCandidates {
  candidates: HandlingUnit[];
  isPending: boolean;
}

export const useParentCandidates = (warehouseId: number | null): ParentCandidates => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: packingResultKeys.parents(warehouseId ?? 0),
    enabled: warehouseId !== null,
    queryFn: async () => {
      if (warehouseId === null)
        throw new Error('창고를 모르면 상위 포장 후보를 조회하지 않습니다.');

      const data = await runRequest(() =>
        client.GET('/inventory/handling-units', {
          params: { query: { warehouseId, size: OPTION_SIZE } },
        }),
      );

      return data.items;
    },
  });

  return { candidates: query.data ?? [], isPending: query.isPending };
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
