import type { ApiClient, components } from '@omf-mes/api-client';
import { useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { useMasterWrite, type MasterWriteResult } from '../../patterns/master';
import { runRequest, toApiError } from '../../patterns/request';
import type { ReceiptFilterQuery } from './filters';
import { isTruncated } from './lookups';
import type { BalanceSource } from './on-hand';
import {
  toBalanceView,
  toReceiptLineView,
  toReceiptView,
  type ReceiptDetailResult,
  type ReceiptListResult,
} from './types';
import { RETURN_FORM_FIELDS } from './validation';

/**
 * 이 화면의 요청 — **이 회차에는 읽기 셋이다.**
 *
 * | 언제 | 무엇 |
 * | --- | --- |
 * | 첫 진입 | 입고 전표 목록 · **창고 목록**(`lookups.ts`) |
 * | 전표를 고르면 | **그 전표의 상세** — 헤더와 라인이 한 번에 온다 |
 * | 전표를 고르면 | **그 전표의 품목별 재고 잔액** — 반품 수량의 상한을 만든다 |
 * | 「반품 처리」 확인 | `POST /logistics/goods-issues` — **뒤따르는 회차에서 생긴다** |
 *
 * **라인을 따로 부르지 않는다.** 계약의 입고 상세가 `{goodsReceipt, lines}`를 함께 주고
 * **라인 목록에 쪽 정보가 없다**(실측) — 전건이 온다는 뜻이라 라인 잘림 판정이 이 화면에 없다.
 * 라인 전용 경로가 계약에 있으나 부르면 같은 값을 한 번 더 받는다.
 *
 * 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch`가 경로를 리터럴 타입으로 요구해
 * 문자열 변수로 넘기면 타입 검사가 풀린다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

type Client = ApiClient['client'];

/**
 * 목록 조회의 쿼리 전체. **채운 조건만 키가 실린다** —
 * 요청 URL이 조건을 그대로 드러내야 무엇으로 조회했는지 읽을 수 있다.
 */
export type ReceiptListQuery = ReceiptFilterQuery & {
  /** 첫 쪽이면 싣지 않는다 — 서버 기본값이 1이다. */
  page?: number;
};

/**
 * 캐시 키.
 *
 * **목록과 상세의 앞머리를 갈라 둔다** — 하나로 묶으면 목록만 다시 부르려 해도 상세까지
 * 함께 무효화되고, 그때 상세 응답이 새 참조로 오면서 **치던 값이 사라진다**(#43의 형태).
 * 그 위험은 초안이 생기는 다음 회차에서 실제 피해가 되지만, 갈라 두는 것은 지금 한다.
 */
const RECEIPT_LIST_KEY = ['supplier-return-goods-receipts', 'list'] as const;

export const receiptKeys = {
  list: (query: ReceiptListQuery) => [...RECEIPT_LIST_KEY, query] as const,
  detail: (goodsReceiptId: number | null) =>
    ['supplier-return-goods-receipts', 'detail', goodsReceiptId] as const,
};

/**
 * 잔액 조회의 쪽 크기.
 *
 * **이 값에는 계약 근거가 없다** — 생성물이 수치 제약과 쿼리 기본값을 싣지 않는다.
 * 한 품목·한 창고의 LOT이 몇 건인지 화면이 알 수 없으므로 어떤 값을 넣어도 잘릴 수 있다.
 * 잘렸다는 사실을 밝히고 **상한으로 쓰지 않는 것**이 보장이고, 이 값은 그 일이 **덜 일어나게**
 * 할 뿐이다. 서버가 상한을 두고 400을 돌려주면 이 상수부터 의심한다 — 고칠 자리는 하나다.
 */
export const BALANCE_PAGE_SIZE = 200;

/**
 * 잔액은 **창고와 품목마다** 캐시가 갈린다 — 한 요청이 그 짝의 잔액만 담는다.
 *
 * 앞머리를 상수로 따로 두는 이유는 **반품 성공 뒤 잔액 전체를 한 번에 무효화**하기 위해서다.
 * 짝을 일일이 세어 무효화하면 화면이 그때 들고 있던 품목만 새로 받고, 그 사이에 줄 구성이
 * 바뀌었으면 새 품목의 상한이 낡은 채로 남는다.
 */
const BALANCE_KEY = ['supplier-return-balances'] as const;

export const balanceKeys = {
  onHand: (warehouseId: number, itemId: number) =>
    [...BALANCE_KEY, warehouseId, itemId] as const,
};

const fetchGoodsReceipts = async (
  client: Client,
  query: ReceiptListQuery,
): Promise<ReceiptListResult> => {
  const data = await runRequest(() =>
    client.GET('/logistics/goods-receipts', { params: { query } }),
  );

  return { items: data.items.map(toReceiptView), page: data.page };
};

/**
 * 반품 대상이 될 수 있는 입고 전표 목록.
 *
 * **조건이 하나도 없어도 조회한다.** 화면에 들어오면 곧바로 되돌려 보낼 수 있는 입고가 보여야
 * 사용자가 무엇을 고를 수 있는지 안다 — 빈 화면으로 시작하면 조건을 먼저 정해야 하는 줄 안다.
 *
 * **기본 기간을 심지 않는다** — 첫 요청에 날짜 조건이 실리지 않는다.
 *
 * **이미 반품된 전표를 가려내지 않는다.** 계약에 그 조건이 없고 상태 코드로 거르는 것은
 * 공유계약이 금지한다 — 화면이 값을 해석하면 값이 정해질 때 조용히 틀린다.
 */
export const useGoodsReceipts = (query: ReceiptListQuery): UseQueryResult<ReceiptListResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: receiptKeys.list(query),
    queryFn: () => fetchGoodsReceipts(client, query),
  });
};

const fetchGoodsReceiptDetail = async (
  client: Client,
  goodsReceiptId: number,
): Promise<ReceiptDetailResult> => {
  const data = await runRequest(() =>
    client.GET('/logistics/goods-receipts/{goodsReceiptId}', {
      params: { path: { goodsReceiptId } },
    }),
  );

  return {
    receipt: toReceiptView(data.goodsReceipt),
    lines: data.lines.map(toReceiptLineView),
  };
};

/**
 * 고른 입고 전표의 상세 — **헤더와 라인이 한 번에 온다.**
 *
 * **고르기 전에는 부르지 않는다.** 캐시 키가 고른 번호를 담으므로 같은 전표를 다시 그려도
 * 요청이 한 번을 넘지 않는다.
 *
 * **이 조회가 단계 판정의 근거다**(계획 결정 3). 200이면 S1, 404면 S4다 —
 * 목록에 그 전표가 있는지로 판정하지 않는다. `gr`는 경로 조각이라 목록과 무관하게 상세를
 * 부를 수 있고, 목록 소속으로 판정하면 **조건이 좁아 목록에 없는 전표를 고른 상태가 지워진다.**
 */
export const useGoodsReceiptDetail = (
  goodsReceiptId: number | null,
): UseQueryResult<ReceiptDetailResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: receiptKeys.detail(goodsReceiptId),
    enabled: goodsReceiptId !== null,
    queryFn: () => {
      if (goodsReceiptId === null) {
        throw new Error('입고 전표를 고르기 전에는 상세를 조회하지 않습니다.');
      }

      return fetchGoodsReceiptDetail(client, goodsReceiptId);
    },
  });
};

/** 잔액 조회 결과에 복구 경로를 붙인 것. 실패하면 사용자가 할 수 있는 조치가 재시도뿐이다. */
export interface BalanceLookupResult extends BalanceSource {
  refetch: () => void;
}

/** 참조가 매 렌더 새로 만들어지면 이 값을 의존성에 둔 계산이 멈추지 않는다. */
const EMPTY_ITEM_BALANCES: BalanceSource['items'] = [];

/**
 * 고른 전표의 라인이 가리키는 **품목마다** 재고 잔액을 받는다.
 *
 * **반품 수량의 상한을 만드는 데만 쓴다** — 목록으로 그리지 않는다. 상한을 만드는 규칙 자체는
 * `on-hand.ts` 한 곳에 있고 이 훅은 자료만 나른다.
 *
 * **`groupBy=LOT`으로 받는다.** 반품 라인은 자재 LOT 단위이고, 계약이 축을 하나만 채워 내리므로
 * (`groupBy`가 LOT이면 위치가 빈다) 위치까지 좁힌 상한은 얻을 수 없다 — 그 한계는
 * `on-hand.ts`가 적어 두었다.
 *
 * **`includeZero=true`가 중요하다**(감지기 M26). 끄면 보유가 0인 LOT이 아예 오지 않아
 * 「0이라 없다」와 「잘려서 없다」를 가를 수 없고, 화면은 0인 줄을 **확인하지 못한 줄**로 읽어
 * 막지 않는다 — 없는 자재를 되돌려 보내게 된다.
 *
 * **품목마다 한 번 부른다.** 번호 여러 개로 한 번에 조회하는 수단이 계약에 없다(실측).
 * 캐시 키가 창고+품목이라 같은 품목의 줄이 여럿이어도 요청은 한 번이다.
 *
 * **전표를 고르기 전에는 부르지 않는다.** 창고 번호가 상세 응답에서 오므로 그전에는 조건을
 * 만들 수 없다 — `?? 0` 같은 대체값으로 메우면 **없는 창고의 조건으로 요청이 나간다.**
 */
export const useOnHandBalances = (
  warehouseId: number | null,
  itemIds: readonly number[],
): BalanceLookupResult => {
  const { client } = useApiClient();

  /*
   * 중복을 없애는 이유는 요청 수가 아니라 **결과의 모양** 때문이다. 캐시 키가 품목마다
   * 하나라 중복을 남겨도 나가는 요청 수는 같지만, 남기면 같은 품목이 `items`에 여러 번
   * 들어와 상한을 찾는 쪽이 어느 것을 볼지가 순서에 달리게 된다.
   */
  const uniqueItemIds = [...new Set(itemIds)].sort((left, right) => left - right);

  const results = useQueries({
    queries: uniqueItemIds.map((itemId) => ({
      queryKey: balanceKeys.onHand(warehouseId ?? 0, itemId),
      enabled: warehouseId !== null,
      queryFn: () => {
        if (warehouseId === null) {
          throw new Error('입고 전표를 고르기 전에는 재고 잔액을 조회하지 않습니다.');
        }

        return runRequest(() =>
          client.GET('/inventory/balances', {
            params: {
              query: {
                warehouseId,
                itemId,
                groupBy: 'LOT',
                includeZero: true,
                size: BALANCE_PAGE_SIZE,
              },
            },
          }),
        );
      },
    })),
  });

  /*
   * **품목별로 나눠 낸다.** 한 품목의 실패를 전체 실패로 뭉치면 멀쩡히 받은 품목의 줄까지
   * 상한을 잃는다 — 그 줄들은 화면이 막아 줄 수 있는데도 못 막게 된다.
   */
  const items: BalanceSource['items'] =
    warehouseId === null
      ? EMPTY_ITEM_BALANCES
      : uniqueItemIds.map((itemId, index) => {
          const result = results[index];
          const data = result?.data;

          return {
            itemId,
            entries: data?.items.map(toBalanceView) ?? [],
            isLoading: result?.isPending ?? true,
            isError: result?.isError ?? false,
            truncated: data !== undefined && isTruncated(data.page, data.items.length),
          };
        });

  return {
    items,
    isError: results.some((result) => result.isError),
    /*
     * **품목별 판정에서 접어 올린다.** 같은 「잘렸는가」를 두 자리에서 각각 계산하면 한쪽만
     * 고쳐져 「표 아래는 잘렸다는데 줄은 멀쩡하다고 하는」 어긋난 화면이 된다 — 집계는 줄의
     * 사실을 모으는 것이지 다시 재는 것이 아니다.
     */
    truncated: items.some((item) => item.truncated),
    refetch: () => {
      for (const result of results) void result.refetch();
    },
  };
};

type GoodsIssueCreate = components['schemas']['GoodsIssueCreate'];
type GoodsIssueDetailResponse = components['schemas']['GoodsIssueDetailResponse'];

export interface SupplierReturnPostOptions {
  /** 성공 뒤 다시 부를 대상. 반품으로 달라지는 것이 이 전표와 그 창고의 잔액이다 */
  goodsReceiptId: number | null;
  onSuccess: (data: GoodsIssueDetailResponse) => void;
}

/**
 * 반품 처리 — **이 화면의 유일한 쓰기이고 되돌릴 수 없다.**
 *
 * **한 요청이 두 가지 일을 한다**(`postImmediately: true` · `issue-request.ts`) — 출고 전표를
 * 만들고 곧바로 전기한다. 착수 이슈 §6이 2회 호출을 금지했고, 계약의 전기 오퍼레이션을 이
 * 화면은 부르지 않는다.
 *
 * **일반 출고와 경로를 나누지 않는다**(착수 이슈 §6의 ⭐). 일반 출고·반품·기타 출고가 같은
 * 경로를 쓰고 `issueTypeCode`로만 갈린다 — 나누면 같은 전표가 세 벌로 갈라지고 조회가 세 곳을
 * 봐야 한다.
 *
 * **공통 쓰기 훅을 그대로 쓰고 고치지 않는다**(계획 결정 16). 이름에 「마스터」가 들어 있으나
 * 그 훅은 리소스 이름을 알지 않는다 — 요청 함수·잠금 토큰 경로·무효화 키·화면이 아는 필드만 받는다.
 *
 * **잠금 토큰을 보내지 않는다**(`etagPath: null` · 계획 결정 6). 이 요청은 **새 전표를 만들어**
 * 매길 버전이 없고, 화면이 들고 있는 토큰은 **고른 입고 전표**의 것이라 실으면 서로 다른
 * 자원의 버전을 비교하게 된다. 계약이 이 자리의 `If-Match`를 **선택**으로 둔 이유도 같다
 * (오프라인 큐에 쌓인 요청은 토큰을 싣지 않는다 — 공유계약 C-9).
 *
 * **그래도 409를 다룬다.** 계약이 이 오퍼레이션에 409를 두었으므로(실측) 토큰을 안 보내도
 * 서버가 다른 이유로 충돌을 낼 수 있다 — `SaveErrorBanner`가 그 갈래에만 「최신 불러오기」를 낸다.
 *
 * **성공 뒤 세 가지를 다시 부른다.** ① 목록 — 그 전표의 상태가 달라질 수 있다 ② 상세 —
 * 라인이 달라질 수 있다 ③ **잔액** — 방금 차감된 값이 곧 다음 반품의 상한이다. 가르는 잣대는
 * 「화면이 그 값으로 막고 푸느냐」이고, 셋 다 그렇다.
 *
 * **캐시 키의 앞머리가 갈려 있어 이 무효화가 셋만 건드린다**(완료 조건 C48). 목록·상세·잔액이
 * 한 앞머리를 썼다면 목록 하나를 새로 받으려 해도 상세와 잔액이 함께 날아가고, 그때 상세가
 * 새 참조로 와 **치던 값이 사라진다**(#43의 형태). 이름 참조 여섯은 여기 들지 않는다 —
 * 반품으로 창고·품목·거래처의 이름이 달라지지 않는다.
 *
 * **남은 위험**: 응답을 받지 못한 뒤 다시 누르면 훅이 **새 멱등 키**를 만들어 서버가 재전송으로
 * 보지 못한다. 제출 단위로 키를 고정하면 풀리는 문제이나 그것은 `patterns/` 변경이라 범위 밖이다 —
 * 화면 차원 완화 셋(전송 중 전면 잠금 · 성공 후 초안 비움 · **응답 없음 안내**)으로 다룬다.
 */
export const useSupplierReturnPost = (
  options: SupplierReturnPostOptions,
): MasterWriteResult<GoodsIssueCreate> => {
  const { client } = useApiClient();

  return useMasterWrite<GoodsIssueCreate, GoodsIssueDetailResponse>({
    request: (body, headers) =>
      client.POST('/logistics/goods-issues', {
        params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
        body,
      }),
    etagPath: null,
    invalidateKeys: [
      RECEIPT_LIST_KEY,
      receiptKeys.detail(options.goodsReceiptId),
      BALANCE_KEY,
    ],
    knownFields: RETURN_FORM_FIELDS,
    onSuccess: options.onSuccess,
  });
};

/**
 * 그 입고 전표가 **없는가**(404).
 *
 * 다른 실패와 갈라야 하는 이유는 사용자가 할 조치가 다르기 때문이다 — 없는 전표는 다시
 * 시도해도 나타나지 않으므로 「다시 시도」가 아니라 **주소 정리와 다시 고르기**로 안내한다
 * (계획 결정 3의 S4 · 수명 표 5행).
 *
 * **상세 조회의 실패 갈래는 404뿐이다**(실측 — 이 오퍼레이션의 응답은 200과 404 둘이다).
 * 그래도 다른 갈래를 남겨 둔다: 네트워크 끊김과 게이트웨이 오류는 계약에 적히지 않는다.
 */
export const isReceiptNotFound = (error: unknown): boolean => {
  const apiError = toApiError(error);

  return apiError.kind === 'http' && apiError.status === 404;
};
