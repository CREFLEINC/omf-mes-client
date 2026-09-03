import {
  useMutation,
  useQuery,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { useMasterWrite, type MasterWriteResult } from '../../patterns/master';
import { runRequest } from '../../patterns/request';
import type { ShipmentListQuery } from './filters';
import {
  toShipmentRow,
  type GoodsReceiptCreate,
  type GoodsReceiptDetailResponse,
  type Lot,
  type PageMeta,
  type Shipment,
  type ShipmentRow,
} from './types';

/**
 * 이 화면의 읽기·쓰기.
 *
 * | 무엇 | 경로 | 계약 |
 * | --- | --- | --- |
 * | 원 출하 목록 | `GET /logistics/shipments` | 04 |
 * | 원 출하 한 건(배분이 채워진다) | `GET /logistics/shipments/{shipmentId}` | 04 |
 * | LOT 찾기(원 출하 없이) | `GET /trace/lots?lotNo=` | 03 |
 * | 반품 입고 등록 | `POST /logistics/goods-receipts` | 01 |
 *
 * 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch` 가 경로를 리터럴 타입으로 요구한다.
 */

const ROOT = 'return-receipt';

export const returnReceiptKeys = {
  all: [ROOT] as const,
  list: (query: ShipmentListQuery | null) =>
    [ROOT, 'shipments', query === null ? null : { ...query }] as const,
  detail: (shipmentId: number | null) => [ROOT, 'shipment', shipmentId] as const,
};

export interface ShipmentListResult {
  items: ShipmentRow[];
  page: PageMeta;
}

/** 원 출하 목록. ⚠ 기간이 없으면 부르지 않는다(L-3). */
export const useShipmentList = (
  query: ShipmentListQuery | null,
): UseQueryResult<ShipmentListResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: returnReceiptKeys.list(query),
    enabled: query !== null,
    queryFn: async () => {
      if (query === null) throw new Error('기간 없이는 출하를 조회하지 않습니다.');
      const data = await runRequest(() =>
        client.GET('/logistics/shipments', { params: { query } }),
      );

      return { items: data.items.map(toShipmentRow), page: data.page };
    },
  });
};

/** 고른 원 출하 — 라인·배분이 여기서 온다. 목록 응답의 라인은 요약일 뿐 배분 번호를 믿지 않는다. */
export const useShipmentDetail = (shipmentId: number | null): UseQueryResult<Shipment> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: returnReceiptKeys.detail(shipmentId),
    enabled: shipmentId !== null,
    queryFn: () => {
      if (shipmentId === null) throw new Error('출하를 고르기 전에는 상세를 조회하지 않습니다.');

      return runRequest(() =>
        client.GET('/logistics/shipments/{shipmentId}', { params: { path: { shipmentId } } }),
      );
    },
  });
};

/**
 * LOT 번호로 LOT 하나를 찾는다 — 원 출하 없이 등록하는 갈래.
 *
 * **정확히 같은 번호만 받는다.** `lotNo` 질의가 부분 일치로 여러 건을 내더라도 사용자가 적은 번호와
 * 다른 LOT 을 줄에 넣지 않는다 — 다른 LOT 이 반품으로 들어가면 되돌릴 수 없다.
 */
export const useFindLot = (): UseMutationResult<Lot | null, unknown, string> => {
  const { client } = useApiClient();

  return useMutation({
    mutationFn: async (lotNo: string) => {
      const data = await runRequest(() =>
        client.GET('/trace/lots', { params: { query: { lotNo, size: 5 } } }),
      );

      return data.items.find((lot) => lot.lotNo === lotNo) ?? null;
    },
  });
};

/** 화면이 아는 필드 — 서버 필드 오류를 칸에 붙일 때 쓴다. 모르는 필드는 배너로 간다. */
const POST_FORM_FIELDS = [
  'reasonCode',
  'remarks',
  'warehouseId',
  'destinationLocationId',
  'lines',
] as const;

/**
 * 반품 입고 등록 — **이 화면의 유일한 쓰기이고 되돌릴 수 없다.**
 *
 * 잠금 토큰이 없다(`etagPath: null`) — 신규 생성이라 잠글 대상이 없다. 멱등 키는 **적용될 때까지**
 * 지킨다 — 응답을 못 받은 뒤 다시 누르면 같은 키가 나가 서버가 재전송으로 본다.
 */
export const useReturnReceiptPost = (
  onSuccess: (created: GoodsReceiptDetailResponse) => void,
): MasterWriteResult<GoodsReceiptCreate> => {
  const { client } = useApiClient();

  return useMasterWrite<GoodsReceiptCreate, GoodsReceiptDetailResponse>({
    request: (body, headers) =>
      client.POST('/logistics/goods-receipts', {
        params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
        body,
      }),
    etagPath: null,
    invalidateKeys: [returnReceiptKeys.all],
    knownFields: POST_FORM_FIELDS,
    keyLifetime: 'until-applied',
    onSuccess,
  });
};
