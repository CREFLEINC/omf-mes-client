import type { ApiClient, components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { useMasterWrite, type MasterWriteResult } from '../../patterns/master';
import { runRequest } from '../../patterns/request';
import type { PoFilterQuery } from './filters';
import { toPoLineView, toPoView, type PoLineView, type PoListResult } from './types';
import { RECEIPT_FORM_FIELDS } from './validation';

/**
 * 이 화면의 읽기 — **오퍼레이션이 둘이다.**
 *
 * 계약에는 발주 상세(`GET /logistics/purchase-orders/{id}`)도 있으나 **부르지 않는다.**
 * 상세가 주는 `{purchaseOrder, lines}` 중 `purchaseOrder`는 목록 응답의 행에 이미 들어 있어,
 * 상세를 부르면 같은 값을 한 번 더 받는다. 한 건을 고르면 라인 경로만 부른다 — 요청 1회다.
 *
 * 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch`가 경로를 리터럴 타입으로 요구해
 * 문자열 변수로 넘기면 타입 검사가 풀린다.
 *
 * 쓰기는 하나다 — `POST /logistics/inbound-receipts:split`. 한 트랜잭션으로 두 전표를
 * 만들므로 건별 요청을 나누지 않는다(이슈 §6 — 부분 실패가 없다).
 */

type Client = ApiClient['client'];

/**
 * 목록 조회의 쿼리 전체. **채운 조건만 키가 실린다** —
 * 요청 URL이 조건을 그대로 드러내야 무엇으로 조회했는지 읽을 수 있다.
 *
 * `size`·`plantId`는 싣지 않는다. 쪽 크기는 서버 기본값을 쓰고, 공장은 이 화면의 조건 축이 아니다.
 */
export type PoListQuery = PoFilterQuery & {
  /** 첫 쪽이면 싣지 않는다 — 서버 기본값이 1이다. */
  page?: number;
};

/**
 * 캐시 키.
 *
 * **목록과 라인의 앞머리를 갈라 둔다** — 하나로 묶으면 목록만 다시 부르려 해도 라인까지
 * 함께 무효화되고, 그때 라인 응답이 새 참조로 오면서 **치던 수량이 사라진다**(#43의 형태).
 */
const PO_LIST_KEY = ['purchase-orders', 'list'] as const;

export const poKeys = {
  lists: PO_LIST_KEY,
  list: (query: PoListQuery) => [...PO_LIST_KEY, query] as const,
  lines: (purchaseOrderId: number | null) =>
    ['purchase-orders', 'lines', purchaseOrderId] as const,
};

const fetchPurchaseOrders = async (
  client: Client,
  query: PoListQuery,
): Promise<PoListResult> => {
  const data = await runRequest(() =>
    client.GET('/logistics/purchase-orders', { params: { query } }),
  );

  return { items: data.items.map(toPoView), page: data.page };
};

/**
 * 대상 발주 목록.
 *
 * **조건이 하나도 없어도 조회한다.** 화면에 들어오면 곧바로 「받을 것이 남은 발주」가 보여야
 * 사용자가 무엇을 고를 수 있는지 안다 — 빈 화면으로 시작하면 조건을 먼저 정해야 하는 줄 안다.
 * 기본 조건(`openOnly`)은 `toFilterQuery`가 채운다.
 */
export const usePurchaseOrders = (query: PoListQuery): UseQueryResult<PoListResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: poKeys.list(query),
    queryFn: () => fetchPurchaseOrders(client, query),
  });
};

const fetchPurchaseOrderLines = async (
  client: Client,
  purchaseOrderId: number,
): Promise<PoLineView[]> => {
  const data = await runRequest(() =>
    client.GET('/logistics/purchase-orders/{purchaseOrderId}/lines', {
      params: { path: { purchaseOrderId } },
    }),
  );

  return data.items.map(toPoLineView);
};

/**
 * 고른 발주의 라인.
 *
 * **고르기 전에는 부르지 않는다.** 캐시 키가 고른 번호를 담으므로 같은 발주를 다시 그려도
 * 요청이 한 번을 넘지 않는다 — 렌더마다 부르면 수량을 치는 동안 요청이 계속 나간다.
 *
 * 이 응답의 참조(`data`)가 바뀌는 것이 **초안을 새로 만드는 유일한 신호**다(계획 결정 4).
 */
export const usePurchaseOrderLines = (
  purchaseOrderId: number | null,
): UseQueryResult<PoLineView[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: poKeys.lines(purchaseOrderId),
    enabled: purchaseOrderId !== null,
    queryFn: () => {
      if (purchaseOrderId === null) {
        throw new Error('발주를 고르기 전에는 라인을 조회하지 않습니다.');
      }

      return fetchPurchaseOrderLines(client, purchaseOrderId);
    },
  });
};

type SplitRequest = components['schemas']['InboundReceiptSplitRequest'];
type SplitResponse = components['schemas']['InboundReceiptSplitResponse'];

export interface SplitRegisterOptions {
  /** 등록 뒤 다시 부를 라인. 누적 입하가 늘었으므로 그 결과를 바로 확인할 수 있어야 한다 */
  purchaseOrderId: number | null;
  onSuccess: (data: SplitResponse) => void;
}

/**
 * 초과 입하 분리 등록.
 *
 * **공통 쓰기 훅을 그대로 쓰고 고치지 않는다**(계획 결정 12). 이름에 「마스터」가 들어 있으나
 * 그 훅은 리소스 이름을 알지 않는다 — 요청 함수·잠금 토큰 경로·무효화 키·화면이 아는 필드만 받는다.
 * 입력 형 화면이 둘째로 생기면 `patterns/`의 패턴 이름을 그때 재검토한다. 지금 옮기면
 * 사용처 하나짜리 일반화가 된다.
 *
 * **잠금 토큰이 없다**(`etagPath: null`). 이 오퍼레이션에는 `If-Match`가 없고(실측)
 * 응답 갈래도 201·400·403뿐이라 충돌(409)이 나오지 않는다 — 저장 실패 배너에
 * 「최신 불러오기」가 뜨지 않는 이유가 그것이다.
 *
 * **목록은 무효화하지 않는다.** 등록으로 달라지는 것은 그 발주의 누적 입하인데 목록 표에는
 * 그 값이 없다. 함께 무효화하면 조회 조건에 따라 방금 등록한 발주가 목록에서 사라지고,
 * 결과를 확인하려던 사용자의 아래 구획이 그 자리에서 닫힌다.
 *
 * **남은 위험**: 응답을 받지 못한 뒤 다시 누르면 훅이 **새 멱등 키**를 만들어 서버가
 * 재전송으로 보지 못한다. 제출 단위로 키를 고정하면 풀리는 문제이나 그것은 `patterns/`
 * 변경이라 이번 범위 밖이다 — 화면 차원 완화 셋(전송 중 전 버튼 잠금 · 성공 후 초안 비움 ·
 * 응답 없음 안내)으로 다루고 후속 이슈로 남긴다.
 */
export const useSplitRegister = (
  options: SplitRegisterOptions,
): MasterWriteResult<SplitRequest> => {
  const { client } = useApiClient();

  return useMasterWrite<SplitRequest, SplitResponse>({
    request: (body, headers) =>
      client.POST('/logistics/inbound-receipts:split', {
        params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
        body,
      }),
    etagPath: null,
    invalidateKeys: [poKeys.lines(options.purchaseOrderId)],
    /* 라인 오류는 계약이 어느 행인지 알려 주지 않아 인라인으로 낼 자리가 없다 — 전부 배너로 간다. */
    knownFields: RECEIPT_FORM_FIELDS,
    onSuccess: options.onSuccess,
  });
};
