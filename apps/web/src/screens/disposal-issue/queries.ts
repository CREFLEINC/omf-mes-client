import type { ApiClient, components } from '@omf-mes/api-client';
import { useQueries, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { useMasterWrite, type MasterWriteResult } from '../../patterns/master';
import { runRequest, toApiError } from '../../patterns/request';
import type { Submission } from './approval-progress';
import type { ReceiptFilterQuery } from './filters';
import type { IssueFilterQuery } from './history-filters';
import { isTruncated } from './lookups';
import type { BalanceSource } from './on-hand';
import {
  toBalanceView,
  toIssueDetailResult,
  toIssueView,
  toReceiptLineView,
  toReceiptView,
  type ApprovalRequestDetailResponse,
  type IssueDetailResult,
  type IssueListResult,
  type ReceiptDetailResult,
  type ReceiptListResult,
} from './types';
import { DISPOSAL_FORM_FIELDS, SUBMIT_FORM_FIELDS } from './validation';

/**
 * 이 화면의 요청 — **이 회차에는 읽기 일곱이다**(참조 다섯은 `lookups.ts`).
 *
 * | 언제 | 무엇 |
 * | --- | --- |
 * | 「품의 발의」 탭 첫 진입 | 폐기 대상 입고 전표 목록 · **창고 목록**(`lookups.ts`) |
 * | 전표를 고르면 | **그 전표의 상세** — 헤더와 라인이 한 번에 온다 |
 * | 전표를 고르면 | **그 전표의 품목별 재고 잔액** — 폐기 수량의 상한을 만든다 |
 * | 「처리 이력」 탭에 서면 | **출고 전표 목록** — 이미 올라간 품의를 찾는다 |
 * | 품의를 고르면 | **그 전표의 상세** — 헤더와 라인이 한 번에 온다 |
 * | 그 품의에 승인 요청 값이 있으면 | **승인 요청 상세** — 결재 진행이 함께 온다 |
 * | 「품의 등록」·「상신」·「기타출고 처리」 | 쓰기 셋 — **뒤 회차에서 생긴다** |
 *
 * **보이지 않는 탭의 조회는 나가지 않는다.** 두 탭의 조건과 선택이 한 주소에 함께 살아 있어
 * (수명 표 8행) 값만으로는 조회가 성립하므로, 훅마다 **탭이 서 있는가**를 함께 받는다 —
 * 받지 않으면 숨은 탭의 목록·상세·승인 요청이 배경에서 왕복한다.
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
 * 함께 무효화되고, 그때 상세 응답이 새 참조로 오면서 **치던 값이 사라진다**
 * (`omf-mes#43`의 형태 · 감지기 M30). 초안이 생긴 이 회차부터 그 위험이 실제 피해다.
 */
const RECEIPT_LIST_KEY = ['disposal-issue-goods-receipts', 'list'] as const;

export const receiptKeys = {
  list: (query: ReceiptListQuery) => [...RECEIPT_LIST_KEY, query] as const,
  detail: (goodsReceiptId: number | null) =>
    ['disposal-issue-goods-receipts', 'detail', goodsReceiptId] as const,
};

/**
 * 이력 목록 조회의 쿼리 전체. **채운 조건만 키가 실린다.**
 */
export type IssueListQuery = IssueFilterQuery & {
  /** 첫 쪽이면 싣지 않는다 — 서버 기본값이 1이다. */
  page?: number;
};

/**
 * 출고 전표(= 폐기 품의) 쪽의 캐시 키.
 *
 * **입고 쪽 키와 앞머리를 갈라 둔다** — 겹치면 한 탭의 무효화가 다른 탭의 조회를 함께 끌고
 * 간다. 목록과 상세도 갈라 둔다: 목록만 다시 부르려는데 상세까지 무효화되면, 그때 도착하는
 * 새 참조가 초안을 되돌린다(`omf-mes#43`).
 *
 * **뿌리를 상수로 따로 두는 이유**는 쓰기가 붙는 회차에 **성공 뒤 이 하나를 무효화**하기
 * 위해서다 — 목록·상세가 함께 갱신돼야 「상신했는데 미상신으로 보이는」 상태가 생기지 않는다.
 */
const ISSUE_ROOT_KEY = 'disposal-issue-goods-issues';

export const issueKeys = {
  all: [ISSUE_ROOT_KEY] as const,
  list: (query: IssueListQuery) => [ISSUE_ROOT_KEY, 'list', query] as const,
  detail: (goodsIssueId: number | null) => [ISSUE_ROOT_KEY, 'detail', goodsIssueId] as const,
};

/**
 * 승인 요청 쪽의 캐시 키.
 *
 * **출고 전표 키와 갈라 둔다** — 다른 계약(`/app/**`)의 자원이고, 이 화면은 그것을 읽기만 한다.
 */
export const approvalKeys = {
  /**
   * 이 자원의 조회를 덮는 뿌리 키. **쓰기가 붙는 회차에 상신·전기 성공 뒤 이 하나를 무효화한다** —
   * 결재 진행이 함께 갱신돼야 「상신했는데 아직 상신되지 않았다고 말하는」 화면이 생기지 않는다.
   * 지금은 소비처가 없고, 그 사실을 적어 두는 것이 「쓰이지 않는 자리」와 「아직 쓰이지 않는
   * 자리」를 가른다.
   */
  all: ['disposal-issue-approval-requests'] as const,
  detail: (approvalRequestId: number | null) =>
    ['disposal-issue-approval-requests', 'detail', approvalRequestId] as const,
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
 * 앞머리를 상수로 따로 두는 이유는 **쓰기 성공 뒤 잔액 전체를 한 번에 무효화**하기 위해서다
 * (뒤 회차). 짝을 일일이 세어 무효화하면 화면이 그때 들고 있던 품목만 새로 받고, 그 사이에
 * 줄 구성이 바뀌었으면 새 품목의 상한이 낡은 채로 남는다.
 */
const BALANCE_KEY = ['disposal-issue-balances'] as const;

export const balanceKeys = {
  onHand: (warehouseId: number, itemId: number) => [...BALANCE_KEY, warehouseId, itemId] as const,
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
 * 폐기 대상이 될 수 있는 입고 전표 목록.
 *
 * **조건이 하나도 없어도 조회한다.** 화면에 들어오면 곧바로 폐기할 수 있는 입고가 보여야
 * 사용자가 무엇을 고를 수 있는지 안다 — 빈 화면으로 시작하면 조건을 먼저 정해야 하는 줄 안다.
 *
 * **기본 기간을 심지 않는다** — 첫 요청에 날짜 조건이 실리지 않는다.
 *
 * **창고를 화면이 골라 싣지 않는다.** 「불량창고」를 가리는 값 목록이 확정되지 않아 화면이
 * 그 판정을 할 수 없다(계획 결정 2) — 창고 조건은 **사용자가 고른 값**으로만 실린다.
 *
 * **이미 폐기된 전표를 가려내지 않는다.** 계약에 그 조건이 없고 상태 코드로 거르는 것은
 * 공유계약이 금지한다 — 화면이 값을 해석하면 값이 정해질 때 조용히 틀린다.
 *
 * **「품의 발의」 탭이 서 있을 때만 부른다.** 탭을 함께 받는 것을 선택으로 두지 않는 이유는,
 * 기본값이 참이면 새 탭이 생길 때 이 자리를 고치는 것을 잊어도 아무 신호가 없기 때문이다 —
 * 그때 숨은 탭의 목록이 배경에서 왕복한다.
 */
export const useGoodsReceipts = (
  query: ReceiptListQuery,
  enabled: boolean,
): UseQueryResult<ReceiptListResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: receiptKeys.list(query),
    enabled,
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
 * **고르기 전에는 부르지 않는다**(감지기 M17). 캐시 키가 고른 번호를 담으므로 같은 전표를
 * 다시 그려도 요청이 한 번을 넘지 않는다.
 *
 * **이 조회가 단계 판정의 근거다**(계획 결정 3). 200이면 S1, 404면 S4다 —
 * 목록에 그 전표가 있는지로 판정하지 않는다. `gr`는 경로 조각이라 목록과 무관하게 상세를
 * 부를 수 있고, 목록 소속으로 판정하면 **조건이 좁아 목록에 없는 전표를 고른 상태가 지워진다.**
 */
export const useGoodsReceiptDetail = (
  goodsReceiptId: number | null,
  enabled: boolean,
): UseQueryResult<ReceiptDetailResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: receiptKeys.detail(goodsReceiptId),
    enabled: enabled && goodsReceiptId !== null,
    queryFn: () => {
      if (goodsReceiptId === null) {
        throw new Error('입고 전표를 고르기 전에는 상세를 조회하지 않습니다.');
      }

      return fetchGoodsReceiptDetail(client, goodsReceiptId);
    },
  });
};

const fetchGoodsIssues = async (
  client: Client,
  query: IssueListQuery,
): Promise<IssueListResult> => {
  const data = await runRequest(() => client.GET('/logistics/goods-issues', { params: { query } }));

  return { items: data.items.map(toIssueView), page: data.page };
};

/**
 * 이미 올라간 폐기 품의(출고 전표) 목록.
 *
 * **「처리 이력」 탭이 서 있을 때만 부른다.** 두 탭의 조건이 한 주소에 함께 살아 있어 값만으로는
 * 조회가 성립한다 — 탭을 함께 보지 않으면 숨은 탭의 목록이 배경에서 왕복하고, 「이 탭에 있는
 * 동안 저 목록을 부르지 않는다」를 잴 수도 없다.
 *
 * **유형으로 좁혀 부르지 않는다.** 「기타 출고만 보인다」로 좁히려면 출고 유형 코드 값을 화면이
 * 정해야 하는데 그 값 목록이 확정되지 않았다(`omf-mes#64`) — 좁힘은 사용자가 조건으로 건다.
 *
 * **정렬을 열지 않는다** — 계약의 출고 목록에 정렬 파라미터가 없고(실측), 화면 안에서만
 * 정렬하면 쪽과 어긋난다.
 */
export const useGoodsIssues = (
  query: IssueListQuery,
  enabled: boolean,
): UseQueryResult<IssueListResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: issueKeys.list(query),
    enabled,
    queryFn: () => fetchGoodsIssues(client, query),
  });
};

const fetchGoodsIssueDetail = async (
  client: Client,
  goodsIssueId: number,
): Promise<IssueDetailResult> => {
  const data = await runRequest(() =>
    client.GET('/logistics/goods-issues/{goodsIssueId}', {
      params: { path: { goodsIssueId } },
    }),
  );

  return toIssueDetailResult(data);
};

/**
 * 고른 품의의 상세 — **헤더와 라인이 한 번에 온다.**
 *
 * **이 조회가 단계 판정의 근거다**(계획 결정 3). 200이면 H1, 404면 H2다 — 목록에 그 전표가
 * 있는지로 판정하지 않는다. `gi`는 경로 조각이라 목록과 무관하게 상세를 부를 수 있고, 목록
 * 소속으로 판정하면 **조건이 좁아 목록에 없는 품의를 고른 상태가 지워진다.**
 *
 * **결재 진행의 뿌리도 이 응답이다** — 여기 실려 오는 승인 요청 값이 있어야 그 조회가 성립한다
 * (계획 결정 10). 그래서 상세를 건너뛰고 목록 행에서 바로 결재 진행을 열지 않는다.
 *
 * **잠금 토큰도 이 응답으로만 온다**(실측 — 목록 200에는 `ETag`가 없다). 쓰기가 붙는 회차의
 * 상신·전기가 이 경로에서 토큰을 꺼낸다.
 */
export const useGoodsIssueDetail = (
  goodsIssueId: number | null,
  enabled: boolean,
): UseQueryResult<IssueDetailResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: issueKeys.detail(goodsIssueId),
    enabled: enabled && goodsIssueId !== null,
    queryFn: () => {
      if (goodsIssueId === null) {
        throw new Error('품의를 고르기 전에는 상세를 조회하지 않습니다.');
      }

      return fetchGoodsIssueDetail(client, goodsIssueId);
    },
  });
};

/**
 * 고른 품의의 **결재 진행** — 승인 요청 상세 하나로 온다(계약이 `steps`를 함께 내린다).
 *
 * **전표가 준 식별자로 곧바로 부른다**(계획 결정 10 · 승인 기록 §13-4 안 A). 승인 요청 **목록**을
 * 대상 유형·대상 번호로 걸러 찾는 길은 지금 성립하지 않는다 — 대상 유형 코드의 값 목록이
 * 확정되지 않아 조건을 실을 수 없고, 대상 번호만 실으면 유형이 다른 문서의 요청이 섞인다.
 *
 * **상신 판정을 인자로 받는다.** 「부를 수 있는가」는 `approval-progress.ts` 한 곳이 정하고
 * 이 훅은 그 결과를 나른다 — 여기서 다시 판정하면 두 자리가 갈리고, 갈리는 순간
 * `/app/approval-requests/0` 같은 요청이 나간다.
 *
 * **응답의 `ETag`를 쓰지 않는다** — 이 화면은 승인 요청에 쓰기를 하지 않는다.
 */
export const useApprovalRequest = (
  submission: Submission,
  enabled: boolean,
): UseQueryResult<ApprovalRequestDetailResponse> => {
  const { client } = useApiClient();
  const approvalRequestId = submission.kind === 'submitted' ? submission.approvalRequestId : null;

  return useQuery({
    queryKey: approvalKeys.detail(approvalRequestId),
    enabled: enabled && approvalRequestId !== null,
    queryFn: () => {
      if (approvalRequestId === null) {
        throw new Error('상신되지 않은 품의의 결재 진행은 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/app/approval-requests/{approvalRequestId}', {
          params: { path: { approvalRequestId } },
        }),
      );
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
 * **폐기 수량의 상한을 만드는 데만 쓴다** — 목록으로 그리지 않는다. 상한을 만드는 규칙 자체는
 * `on-hand.ts` 한 곳에 있고 이 훅은 자료만 나른다.
 *
 * **`groupBy=LOT`으로 받는다.** 폐기 라인은 자재 LOT 단위이고, 계약이 축을 하나만 채워 내리므로
 * (`groupBy`가 LOT이면 위치가 빈다) 위치까지 좁힌 상한은 얻을 수 없다 — 그 한계는
 * `on-hand.ts`가 적어 두었다.
 *
 * **`includeZero=true`가 중요하다.** 끄면 보유가 0인 LOT이 아예 오지 않아 「0이라 없다」와
 * 「잘려서 없다」를 가를 수 없고, 화면은 0인 줄을 **확인하지 못한 줄**로 읽어 막지 않는다 —
 * 없는 자재를 폐기하게 된다.
 *
 * **품목마다 한 번 부른다**(감지기 M21). 번호 여러 개로 한 번에 조회하는 수단이 계약에 없다
 * (실측). 캐시 키가 창고+품목이라 같은 품목의 줄이 여럿이어도 요청은 한 번이다.
 *
 * **창고는 「고른 전표의 창고」다**(부르는 자리가 상세 응답의 값을 넘긴다). 조건 줄의 창고가
 * 아니다 — 조건은 비어 있을 수 있고, 값 목록이 확정되면 그 선택지가 폐기 대상 유형으로
 * **좁혀진다**(PR ①의 좁힘). 좁힌 조건을 축으로 쓰면 좁힘 밖 창고의 전표를 골랐을 때
 * **남의 창고 잔액이 상한이 된다.**
 *
 * **전표를 고르기 전에는 부르지 않는다**(감지기 M20). 창고 번호가 상세 응답에서 오므로
 * 그전에는 조건을 만들 수 없다 — `?? 0` 같은 대체값으로 메우면 **없는 창고의 조건으로 요청이
 * 나간다.**
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

/**
 * 그 입고 전표가 **없는가**(404).
 *
 * 다른 실패와 갈라야 하는 이유는 사용자가 할 조치가 다르기 때문이다 — 없는 전표는 다시
 * 시도해도 나타나지 않으므로 「다시 시도」가 아니라 **주소 정리와 다시 고르기**로 안내한다
 * (계획 결정 3의 S4 · 수명 표 5행).
 *
 * **상세 조회의 실패 갈래는 404뿐이다**(실측 — 이 오퍼레이션의 응답은 200과 404 둘이다).
 * **403 갈래를 만들지 않는다**(완료 조건 C20) — 계약에 없어 닿을 수 없는 가지가 된다.
 * 그래도 다른 갈래를 남겨 둔다: 네트워크 끊김과 게이트웨이 오류는 계약에 적히지 않는다.
 */
export const isReceiptNotFound = (error: unknown): boolean => {
  const apiError = toApiError(error);

  return apiError.kind === 'http' && apiError.status === 404;
};

/**
 * 그 출고 전표가 **없는가**(404).
 *
 * **출고 상세의 실패 갈래도 404뿐이다**(실측 — 응답이 200과 404 둘이다). **403 갈래를 만들지
 * 않는다** — 계약에 없어 닿을 수 없는 가지가 된다. 403이 있는 것은 **승인 요청 상세뿐**이고
 * 그 갈래는 결재 진행 구획이 갖는다.
 */
export const isIssueNotFound = (error: unknown): boolean => {
  const apiError = toApiError(error);

  return apiError.kind === 'http' && apiError.status === 404;
};

/**
 * 결재 진행을 **볼 권한이 없는가**(403).
 *
 * 계약이 「승인자도 상신자도 아니면 403」이라고 적었다 — 같은 권한으로 다시 불러도 같은 답이
 * 오므로 **「다시 시도」를 붙이지 않는다.** 404·네트워크와 갈라야 하는 이유는 사용자가 할
 * 조치가 다르기 때문이다.
 */
export const isApprovalForbidden = (error: unknown): boolean => {
  const apiError = toApiError(error);

  return apiError.kind === 'http' && apiError.status === 403;
};

/** 그 승인 요청이 **없는가**(404). 전표는 값을 가리키는데 요청이 사라진 자리다. */
export const isApprovalNotFound = (error: unknown): boolean => {
  const apiError = toApiError(error);

  return apiError.kind === 'http' && apiError.status === 404;
};

type GoodsIssueCreate = components['schemas']['GoodsIssueCreate'];
type GoodsIssueDetailResponse = components['schemas']['GoodsIssueDetailResponse'];
type ApprovalRequestCreate = components['schemas']['ApprovalRequestCreate'];
type ApprovalRequestRef = components['schemas']['ApprovalRequestRef'];

/**
 * 출고 상세의 요청 경로 — **잠금 토큰이 앉는 유일한 자리다.**
 *
 * 토큰 보관소가 **요청 URL의 경로별로** `ETag`를 담으므로(실측) 상신의 `If-Match`는 이 경로에서
 * 꺼내야 한다. 컬렉션 경로(`/logistics/goods-issues`)를 주면 **목록 조회와 열쇠가 겹치고**,
 * 액션 경로(`…:request-approval`)를 주면 토큰이 늘 비어 훅이 요청을 만들지 않고 멈춘다 —
 * 「눌러도 아무 일이 없다」가 그 증상이다(전례 W-CO-02·W-06-15 · 감지기 M58).
 *
 * **등록 201도 `ETag`를 준다**(실측). 그 토큰은 **컬렉션 경로**에 앉으므로 쓰지 않는다 —
 * 지금은 목록이 토큰을 주지 않아 우연히 덮이지 않을 뿐이고, 그 우연에 기대는 결합을 만들지 않는다.
 */
export const issueDetailPath = (goodsIssueId: number): string =>
  `/logistics/goods-issues/${String(goodsIssueId)}`;

/**
 * 상신 직전에 **출고 상세를 한 번 부른다** — 잠금 토큰을 그 경로에 앉히는 자리다.
 *
 * 「품의 상신」 한 번이 요청 둘을 잇는데(승인 기록 정정 1-1) 둘째 요청의 `If-Match`는 계약이
 * 「같은 리소스의 **상세 GET 200**이 내려주는 값」이라고 못 박았다. 그래서 연쇄 가운데에 이
 * 조회가 선다 — 없으면 방금 만든 전표의 토큰이 어디에도 없어 상신이 시작조차 되지 않는다.
 *
 * **캐시를 함께 채운다.** 같은 열쇠(`issueKeys.detail`)로 부르므로 사용자가 「이 품의 열기」로
 * 이력 탭에 가면 그 전표가 이미 와 있다 — 조회를 두 벌로 만들지 않는 것이 요점이다.
 *
 * **실패해도 던지는 것을 부르는 자리가 받는다.** 토큰을 못 얻은 채 상신하면 공통 훅이 요청을
 * 만들지 않고 「최신 상태를 불러오지 못했습니다」를 세운다 — 그 자리가 이미 있으므로 여기서
 * 갈래를 새로 만들지 않는다.
 */
export const useIssueDetailFetcher = (): ((goodsIssueId: number) => Promise<IssueDetailResult>) => {
  const { client } = useApiClient();
  const queryClient = useQueryClient();

  return (goodsIssueId) =>
    queryClient.fetchQuery({
      queryKey: issueKeys.detail(goodsIssueId),
      queryFn: () => fetchGoodsIssueDetail(client, goodsIssueId),
    });
};

export interface CreateGoodsIssueOptions {
  onSuccess: (data: IssueDetailResult) => void;
}

/**
 * 폐기 품의 전표를 만든다 — **연쇄의 첫째 요청**이다.
 *
 * **전기하지 않는다**(`postImmediately: false` · `issue-request.ts`). 이 화면의 업무는 승인을
 * 먼저 받는 것이고, 재고가 움직이는 것은 승인 뒤의 「기타출고 처리」다.
 *
 * **일반 출고와 경로를 나누지 않는다**(착수 이슈 §6). 일반 출고·반품·기타 출고가 같은 경로를
 * 쓰고 `issueTypeCode`로만 갈린다.
 *
 * **잠금 토큰을 보내지 않는다**(`etagPath: null`). 새 전표라 매길 버전이 없고 계약도 이 자리의
 * `If-Match`를 선택으로 두었다 — 화면이 들고 있는 토큰은 **다른 자원**(고른 입고 전표나 앞서
 * 다룬 품의)의 것이라 실으면 서로 다른 자원의 버전을 비교하게 된다.
 *
 * **성공 뒤 이 슬라이스의 출고 뿌리를 무효화한다.** 방금 만든 전표가 이력 목록에 있어야
 * 사용자가 이어서 다룰 수 있다. **잔액은 무효화하지 않는다** — 전기하지 않았으므로 재고가
 * 움직이지 않았고, 무효화하면 「바뀌지도 않은 값을 다시 받는」 요청이 늘 뿐이다.
 *
 * **응답을 화면 타입으로 옮겨 넘긴다**(`toIssueDetailResult`) — 상세 조회와 같은 자리를 지나야
 * 방금 만든 전표와 다시 읽은 전표가 서로 다른 값을 보이지 않는다.
 */
export const useCreateGoodsIssue = (
  options: CreateGoodsIssueOptions,
): MasterWriteResult<GoodsIssueCreate> => {
  const { client } = useApiClient();

  return useMasterWrite<GoodsIssueCreate, GoodsIssueDetailResponse>({
    request: (body, headers) =>
      client.POST('/logistics/goods-issues', {
        params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
        body,
      }),
    etagPath: null,
    invalidateKeys: [issueKeys.all],
    knownFields: DISPOSAL_FORM_FIELDS,
    onSuccess: (data) => {
      options.onSuccess(toIssueDetailResult(data));
    },
  });
};

export interface RequestApprovalOptions {
  /**
   * 상신할 전표. **연쇄에서는 방금 만든 전표**이고 이력 탭에서는 고른 품의다 —
   * 두 자리가 같은 훅을 지나므로 규칙이 갈리지 않는다.
   */
  goodsIssueId: number | null;
  onSuccess: (data: ApprovalRequestRef) => void;
}

/**
 * 만들어진 전표를 결재에 올린다 — **연쇄의 둘째 요청**이자 이력 탭의 재상신이다.
 *
 * **`If-Match`가 필수다**(계약 · 목이 없는 요청을 400으로 되돌린다 — 실측). 토큰은 **늘 출고
 * 상세 경로**에서 꺼낸다(`issueDetailPath`).
 *
 * **응답에 `ETag`가 없다**(실측). 그래서 성공 뒤 **뿌리 키를 무효화해 상세를 다시 부른다** —
 * 다시 부르지 않으면 다음 쓰기가 낡은 토큰으로 나가 409가 된다(감지기 M59).
 *
 * **승인 요청도 함께 무효화한다.** 상신으로 생기는 것이 그 요청이고, 결재 진행 구획이 그것을
 * 읽는다 — 무효화하지 않으면 「상신했는데 아직 상신되지 않았다고 말하는」 화면이 남는다.
 *
 * **결재선이 없으면 400이다**(계약 명시 · 승인 기록 정정 1-5). 그 갈래를 코드로 가르지 않고
 * **서버 문구를 그대로** 배너에 낸다 — 원인을 화면이 지어내면 다른 이유로 온 400에도 같은
 * 안내가 붙는다(계획 결정 16).
 *
 * **응답이 내부 식별자 하나뿐이다**(`ApprovalRequestRef`) — 화면에 낼 번호가 없다(`omf-mes#44`).
 * 승인 요청**번호**는 결재 진행 조회가 얻는다.
 */
export const useRequestApproval = (
  options: RequestApprovalOptions,
): MasterWriteResult<ApprovalRequestCreate> => {
  const { client } = useApiClient();

  return useMasterWrite<ApprovalRequestCreate, ApprovalRequestRef>({
    request: (body, headers) => {
      /*
       * **없는 값을 0으로 메우지 않는다**(승인 기록 정정 4-① · 리뷰 Nit C3).
       *
       * `etagPath`가 `null`이 되면 공통 훅은 그것을 「잠금이 필요 없다」로 읽어 요청을 **그대로
       * 내보낸다** — 대체값을 두면 `…/0:request-approval`이 실제로 나갈 수 있는 모양이 된다.
       * 지금은 두 호출부가 그렇게 부르지 않지만, 그 사실에 기대는 대신 **여기서 멈춘다**
       * (조회 훅의 가드와 같은 형태).
       */
      if (options.goodsIssueId === null) {
        throw new Error('상신할 전표를 고르기 전에는 상신하지 않습니다.');
      }

      return client.POST('/logistics/goods-issues/{goodsIssueId}:request-approval', {
        params: {
          path: { goodsIssueId: options.goodsIssueId },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': headers['If-Match'] ?? '',
          },
        },
        body,
      });
    },
    etagPath: options.goodsIssueId === null ? null : issueDetailPath(options.goodsIssueId),
    invalidateKeys: [issueKeys.all, approvalKeys.all],
    knownFields: SUBMIT_FORM_FIELDS,
    onSuccess: options.onSuccess,
  });
};
