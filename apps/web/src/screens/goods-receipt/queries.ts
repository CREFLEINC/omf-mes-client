import type { ApiClient, components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { useMasterWrite, type MasterWriteResult } from '../../patterns/master';
import { runRequest } from '../../patterns/request';
import type { IrFilterQuery } from './filters';
import {
  toIrLineView,
  toIrView,
  toLocationView,
  toWarehouseView,
  type IrLineView,
  type IrListResult,
  type LocationView,
  type PageMeta,
  type WarehouseView,
} from './types';
import { POST_FORM_FIELDS } from './validation';

/**
 * 이 화면의 요청 — **읽기 넷과 쓰기 하나다.**
 *
 * 계약에는 입하 상세(`GET /logistics/inbound-receipts/{id}`)도 있으나 **부르지 않는다.**
 * 상세가 주는 `{inboundReceipt, lines}` 중 헤더는 목록 응답의 행에 이미 들어 있어,
 * 상세를 부르면 같은 값을 한 번 더 받는다. 한 건을 고르면 라인 경로만 부른다 — 요청 1회다.
 *
 * | 언제 | 무엇 |
 * | --- | --- |
 * | 첫 진입 | 입하 전표 목록 · **입고 창고 목록** |
 * | 전표를 고르면 | 그 전표의 라인 |
 * | **창고를 고르면** | 그 창고의 적치 위치(계약이 창고를 고른 뒤에만 조회하게 한다) |
 * | 「입고 처리」 확인 | `POST /logistics/goods-receipts` — **되돌릴 수 없다** |
 * | **성공한 뒤** | 그 자재 LOT의 지금 상태(응답에 LOT 상태가 없다) |
 *
 * 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch`가 경로를 리터럴 타입으로 요구해
 * 문자열 변수로 넘기면 타입 검사가 풀린다.
 */

type Client = ApiClient['client'];

/**
 * 목록 조회의 쿼리 전체. **채운 조건만 키가 실린다** —
 * 요청 URL이 조건을 그대로 드러내야 무엇으로 조회했는지 읽을 수 있다.
 */
export type IrListQuery = IrFilterQuery & {
  /** 첫 쪽이면 싣지 않는다 — 서버 기본값이 1이다. */
  page?: number;
};

/**
 * 캐시 키.
 *
 * **목록과 라인의 앞머리를 갈라 둔다** — 하나로 묶으면 목록만 다시 부르려 해도 라인까지
 * 함께 무효화되고, 그때 라인 응답이 새 참조로 오면서 **치던 값이 사라진다**(#43의 형태).
 * 그 위험은 초안이 생기는 PR ②에서 실제 피해가 되지만, 갈라 두는 것은 지금 한다.
 */
const IR_LIST_KEY = ['inbound-receipts', 'list'] as const;

export const irKeys = {
  lists: IR_LIST_KEY,
  list: (query: IrListQuery) => [...IR_LIST_KEY, query] as const,
  lines: (inboundReceiptId: number | null) =>
    ['inbound-receipts', 'lines', inboundReceiptId] as const,
  /** 창고는 화면당 한 번, 위치는 **창고마다** 갈린다 — 창고를 되돌려도 다시 부르지 않는다. */
  warehouses: ['goods-receipt-warehouses'] as const,
  locations: (warehouseId: number | null) => ['goods-receipt-locations', warehouseId] as const,
  /** 입고 처리 뒤 다시 읽는 자재 LOT. 번호마다 갈린다. */
  lot: (lotId: number | null) => ['goods-receipt-lot', lotId] as const,
};

const fetchInboundReceipts = async (
  client: Client,
  query: IrListQuery,
): Promise<IrListResult> => {
  const data = await runRequest(() =>
    client.GET('/logistics/inbound-receipts', { params: { query } }),
  );

  return { items: data.items.map(toIrView), page: data.page };
};

/**
 * 대상 입하 전표 목록.
 *
 * **조건이 하나도 없어도 조회한다.** 화면에 들어오면 곧바로 받아들일 수 있는 입하가 보여야
 * 사용자가 무엇을 고를 수 있는지 안다 — 빈 화면으로 시작하면 조건을 먼저 정해야 하는 줄 안다.
 *
 * **기본 기간을 심지 않는다**(계획 결정 6). 첫 요청에 날짜가 실리지 않는다.
 */
export const useInboundReceipts = (query: IrListQuery): UseQueryResult<IrListResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: irKeys.list(query),
    queryFn: () => fetchInboundReceipts(client, query),
  });
};

const fetchInboundReceiptLines = async (
  client: Client,
  inboundReceiptId: number,
): Promise<IrLineView[]> => {
  const data = await runRequest(() =>
    client.GET('/logistics/inbound-receipts/{inboundReceiptId}/lines', {
      params: { path: { inboundReceiptId } },
    }),
  );

  return data.items.map(toIrLineView);
};

/**
 * 고른 전표의 라인.
 *
 * **고르기 전에는 부르지 않는다.** 캐시 키가 고른 번호를 담으므로 같은 전표를 다시 그려도
 * 요청이 한 번을 넘지 않는다.
 *
 * 이 응답의 참조(`data`)가 바뀌는 것이 **고른 라인을 다시 판정하는 신호**다 —
 * PR ②에서는 초안을 새로 만드는 신호이기도 하다(계획 결정 6의 수명 표 9행).
 */
export const useInboundReceiptLines = (
  inboundReceiptId: number | null,
): UseQueryResult<IrLineView[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: irKeys.lines(inboundReceiptId),
    enabled: inboundReceiptId !== null,
    queryFn: () => {
      if (inboundReceiptId === null) {
        throw new Error('입하 전표를 고르기 전에는 라인을 조회하지 않습니다.');
      }

      return fetchInboundReceiptLines(client, inboundReceiptId);
    },
  });
};

/**
 * 선택지 목록 하나의 상태.
 *
 * **잘림을 함께 나른다.** 목록이 앞쪽만 오면 **고를 수 없는 값이 생기는데**, 밝히지 않으면
 * 사용자가 「그런 창고가 없다」로 결론짓는다(조용한 잘림 방지 — W-01-03이 세운 규칙).
 */
export interface OptionListResult<TItem> {
  items: TItem[];
  truncated: boolean;
  isError: boolean;
  isLoading: boolean;
  refetch: () => void;
}

/** 서버가 보낸 전체 건수가 받은 건수보다 많으면 잘린 것이다. */
const isTruncated = (page: PageMeta, shown: number): boolean => page.total > shown;

/** 참조가 매 렌더 새로 만들어지면 이 값을 의존성에 둔 계산이 멈추지 않는다. */
const EMPTY_WAREHOUSES: WarehouseView[] = [];
const EMPTY_LOCATIONS: LocationView[] = [];

/**
 * 입고 창고 목록.
 *
 * **임의 필터를 걸지 않는다**(이슈 §6). 품목 유형으로 창고를 제한하는 규칙이 데이터에 없고,
 * 계약의 창고 목록에는 공장 조건 파라미터가 아예 없다(실측 — `q`·`warehouseTypeCode`·
 * `includeInactive`·`page`·`size`뿐). 클라이언트에서 걸러 내지도 않는다.
 *
 * **`includeInactive`를 켜지 않는다.** 참조 풀이와 다른 자리다 — 지금 물건을 넣을 창고를
 * 고르는 칸이라 쓰지 않는 창고가 선택지에 있으면 고를 수 있는 잘못된 자리가 생긴다.
 *
 * **전표를 고르기 전에는 부르지 않는다**(`enabled`). 이 목록을 쓰는 것은 확정 입력뿐이고
 * 그 구획은 줄을 고른 뒤에야 열린다 — 전표를 고르는 시점에 부르면 라인 표가 그려지는 동안
 * 도착할 여유가 있으면서 첫 진입의 요청 수는 늘지 않는다(품목·단위와 같은 시점이다).
 */
export const useWarehouseOptions = (enabled: boolean): OptionListResult<WarehouseView> => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: irKeys.warehouses,
    enabled,
    queryFn: () => runRequest(() => client.GET('/mdm/warehouses', { params: { query: {} } })),
  });

  const data = query.data;

  return {
    items: data?.items.map(toWarehouseView) ?? EMPTY_WAREHOUSES,
    truncated: data !== undefined && isTruncated(data.page, data.items.length),
    isError: query.isError,
    isLoading: enabled && query.isPending,
    refetch: () => {
      void query.refetch();
    },
  };
};

/**
 * 고른 창고의 적치 위치.
 *
 * **창고를 고르기 전에는 부르지 않는다**(`enabled`). 계약이 `warehouseId`를 **필수 쿼리**로
 * 두어(실측) 없이 부르면 422가 온다 — 화면이 스스로 만든 실패를 사용자에게 보이게 된다.
 *
 * 캐시 키가 창고 번호를 담으므로 창고를 되돌려도 요청이 한 번을 넘지 않는다.
 */
export const useLocationOptions = (warehouseId: number | null): OptionListResult<LocationView> => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: irKeys.locations(warehouseId),
    enabled: warehouseId !== null,
    queryFn: () => {
      if (warehouseId === null) {
        throw new Error('창고를 고르기 전에는 적치 위치를 조회하지 않습니다.');
      }

      return runRequest(() => client.GET('/mdm/locations', { params: { query: { warehouseId } } }));
    },
  });

  const data = query.data;

  return {
    items: data?.items.map(toLocationView) ?? EMPTY_LOCATIONS,
    truncated: data !== undefined && isTruncated(data.page, data.items.length),
    isError: query.isError,
    isLoading: warehouseId !== null && query.isPending,
    refetch: () => {
      void query.refetch();
    },
  };
};

/**
 * 입고 처리 뒤 다시 읽은 자재 LOT의 상태. 아직 읽지 않았으면 `statusCode`가 `null`이다.
 *
 * **진행 중 여부를 따로 나르지 않는다.** 이 응답의 `statusCode`는 계약 필수라 값이 오면
 * 반드시 채워진다 — 즉 `null`이 곧 「아직 오지 않았다」이고, 그 위에 `isLoading`을 더 두면
 * 둘 중 하나는 늘 같은 답을 내는 죽은 가지가 된다.
 */
export interface LotStatusResult {
  statusCode: string | null;
  isError: boolean;
}

/**
 * 자재 LOT의 지금 상태.
 *
 * **입고 처리에 성공한 뒤에만 부른다.** 입고 응답에는 LOT 상태가 없어(실측), 화면 이름의
 * 「Release」가 실제로 걸렸는지 확인할 방법이 이 재조회뿐이다 — 한 트랜잭션 안에서 일어나는
 * 다섯 가지 중 화면이 **값으로** 증거를 가질 수 있는 유일한 자리다.
 *
 * **받은 값으로 분기하지 않는다.** 상태 코드의 값 집합이 확정되지 않아(공유계약 G-2)
 * 「이 값이면 Release됐다」를 화면이 판정하면 값이 정해질 때 조용히 틀린다 — 그대로 보인다.
 */
export const useLotStatus = (lotId: number | null): LotStatusResult => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: irKeys.lot(lotId),
    enabled: lotId !== null,
    queryFn: () => {
      if (lotId === null) {
        throw new Error('입고 처리에 성공하기 전에는 자재 LOT을 다시 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/trace/lots/{lotId}', { params: { path: { lotId } } }),
      );
    },
  });

  return {
    statusCode: query.data?.lot.statusCode ?? null,
    isError: query.isError,
  };
};

type GoodsReceiptCreate = components['schemas']['GoodsReceiptCreate'];
type GoodsReceiptDetailResponse = components['schemas']['GoodsReceiptDetailResponse'];

export interface GoodsReceiptPostOptions {
  /** 성공 뒤 다시 부를 라인. 그 줄이 입고됐다는 사실이 라인 상태에 반영된다 */
  inboundReceiptId: number | null;
  onSuccess: (data: GoodsReceiptDetailResponse) => void;
}

/**
 * 입고 처리 — **이 화면의 유일한 쓰기이고 되돌릴 수 없다.**
 *
 * **공통 쓰기 훅을 그대로 쓰고 고치지 않는다**(계획 결정 16). 이름에 「마스터」가 들어 있으나
 * 그 훅은 리소스 이름을 알지 않는다 — 요청 함수·잠금 토큰 경로·무효화 키·화면이 아는 필드만 받는다.
 * **입력 형 둘째 화면(W-01-10)에서 그 이름을 재검토했고**, 이름 변경은 `patterns/` 변경(높은 위험)이라
 * 별도 작업으로 분리했다. 셋째 화면에서 다시 판단하지 말고 그 작업을 먼저 처리한다.
 *
 * **잠금 토큰이 없다**(`etagPath: null`). 이 오퍼레이션에는 `If-Match`가 없고(실측)
 * 응답 갈래도 201·400·403뿐이라 충돌(409)이 나오지 않는다 — 저장 실패 배너에
 * 「최신 불러오기」가 뜨지 않는 이유가 그것이다.
 *
 * **목록은 무효화하지 않는다.** 입고 처리로 달라지는 것은 그 입하 라인의 상태인데 목록 표에는
 * 그 값이 없다. 함께 무효화하면 조회 조건에 따라 방금 처리한 전표가 목록에서 사라지고,
 * 결과를 확인하려던 사용자의 아래 구획이 그 자리에서 닫힌다.
 *
 * **남은 위험**: 응답을 받지 못한 뒤 다시 누르면 훅이 **새 멱등 키**를 만들어 서버가 재전송으로
 * 보지 못한다. 제출 단위로 키를 고정하면 풀리는 문제이나 그것은 `patterns/` 변경이라 범위 밖이다 —
 * 화면 차원 완화 셋(전송 중 전면 잠금 · 성공 후 초안 비움 · 응답 없음 안내)으로 다룬다.
 */
export const useGoodsReceiptPost = (
  options: GoodsReceiptPostOptions,
): MasterWriteResult<GoodsReceiptCreate> => {
  const { client } = useApiClient();

  return useMasterWrite<GoodsReceiptCreate, GoodsReceiptDetailResponse>({
    request: (body, headers) =>
      client.POST('/logistics/goods-receipts', {
        params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
        body,
      }),
    etagPath: null,
    invalidateKeys: [irKeys.lines(options.inboundReceiptId)],
    knownFields: POST_FORM_FIELDS,
    onSuccess: options.onSuccess,
  });
};
