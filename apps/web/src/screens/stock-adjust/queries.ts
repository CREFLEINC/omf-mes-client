import type { ApiClient, components } from '@omf-mes/api-client';
import { useQueries, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { useMasterWrite, type MasterWriteResult } from '../../patterns/master';
import { runRequest, toApiError } from '../../patterns/request';
import { ADJUST_FORM_FIELDS } from './adjust-request';
import type { Submission } from './approval-progress';
import { toBalanceRow, type BalanceRow, type BalanceSource } from './balances';
import { SUBMIT_FORM_FIELDS } from './reason-draft';
import { toCountOptionView, toCountVarianceLineView, toCreatedAdjustmentResult } from './types';
import type {
  ApprovalRequestDetailResponse,
  CountOptionView,
  CountVarianceLineView,
  CreatedAdjustmentResult,
  PageMeta,
} from './types';

/**
 * 이 회차의 요청 — **읽기 다섯과 쓰기 둘**이다. 실사 목록 · 실사 차이 라인 · 재고 잔액 ·
 * **조정 상세** · **결재 진행** · 조정 등록 · **조정 상신**.
 *
 * 전기와 처리 이력은 뒤따르는 회차가 붙인다. **`pendingApprovalOnly`를 쓰지 않는다**(⛔ D-3) —
 * 계약에 그 조건이 남아 있으나 승인 대기는 결재함(W-CO-09)이 소유하고, 이 화면에는 그 탭이 없다.
 *
 * 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch`가 경로를 리터럴 타입으로 요구해
 * 문자열 변수로 넘기면 타입 검사가 풀린다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

type Client = ApiClient['client'];
type InventoryAdjustmentCreate = components['schemas']['InventoryAdjustmentCreate'];
type InventoryAdjustmentDetailResponse = components['schemas']['InventoryAdjustmentDetailResponse'];
type ApprovalRequestCreate = components['schemas']['ApprovalRequestCreate'];
type ApprovalRequestRef = components['schemas']['ApprovalRequestRef'];

/**
 * 캐시 키.
 *
 * **읽는 대상마다 앞머리를 갈라 둔다** — 하나로 묶으면 한쪽만 다시 부르려 해도 다른 쪽까지
 * 함께 무효화되고, 그때 응답이 새 참조로 오면서 세운 대상이 다시 서거나 사라진다.
 *
 * `detail`은 **만들어진 조정의 상세**다. 상신이 여기서 잠금 토큰을 얻고(D-14) 상신에 성공하면
 * 이 키가 무효화된다 — 그 토큰이 앉는 경로가 컬렉션이 아니라 상세라는 사실이 이 키의 모양에
 * 그대로 남아 있어야 한다.
 */
export const stockAdjustKeys = {
  counts: ['stock-adjust', 'counts'] as const,
  varianceLines: (inventoryCountId: number | null): readonly unknown[] =>
    ['stock-adjust', 'variance-lines', inventoryCountId] as const,
  /** 잔액은 **창고·위치마다** 캐시가 갈린다 — 요청 하나가 한 위치를 담는다(D-6). */
  balances: (warehouseId: number, locationId: number): readonly unknown[] =>
    ['stock-adjust', 'balances', warehouseId, locationId] as const,
  detail: (inventoryAdjustmentId: number): readonly unknown[] =>
    ['stock-adjust', 'adjustment', inventoryAdjustmentId] as const,
  approvalRequest: (approvalRequestId: number | null): readonly unknown[] =>
    ['stock-adjust', 'approval-request', approvalRequestId] as const,
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

export interface CreateStockAdjustmentOptions {
  onSuccess: (result: CreatedAdjustmentResult) => void;
}

/**
 * 조정 전표를 만든다 — **이 화면에서 되돌릴 수 없는 첫 쓰기**다.
 *
 * **헤더와 라인이 한 요청으로 간다**(D-10 · 미결 #88). 라인 치환 경로(`…/{id}/lines`)를 잇지
 * 않는다 — 그 경로는 이미 만들어진 조정을 고치는 자리이고, 여기서 쓰면 「헤더만 있고 라인이
 * 없는 조정」이 중간 상태로 실재하게 된다. 계약이 `lines`를 등록 **필수**로 두었다.
 *
 * **잠금 토큰을 보내지 않는다**(`etagPath: null` · D-14). 계약 parameters에 `If-Match`가 없고
 * 응답 갈래에 409가 없다(실측) — 새 전표라 견줄 판이 없다. `etagPath`에 경로를 주면 공통 훅이
 * **토큰을 못 찾아 요청을 만들지 않고 멈춘다**(「눌러도 아무 일이 없다」가 그 증상이다).
 *
 * ⚠ **201이 주는 `ETag`는 컬렉션 경로에 앉는다**(토큰 보관소가 요청 URL의 경로를 열쇠로 쓴다 —
 * 실측). 상신·전기가 필요로 하는 열쇠(`/inventory/adjustments/{id}`)가 아니므로, 그 회차는
 * **상세 GET을 먼저 부른다**(D-14). 여기서 그 사실을 적어 두는 이유는, 등록 응답에 토큰이 있다는
 * 것만 보고 이어 쓰려는 길이 실제로 있기 때문이다.
 *
 * **무효화할 키가 없다**(`invalidateKeys: []`). 이 회차는 조정 목록을 그리지 않으므로 다시 부를
 * 조회가 없다. **실사 차이도 무효화하지 않는다**: 그 응답을 다시 받으면 조정 대상이 다시 서고
 * (수명 표 5·6행) 사용자가 방금 보낸 값과 화면의 값이 갈린다.
 *
 * **멱등 키는 호출마다 새로 만들어진다**(공통 훅 실측). 그래서 두 번 누르는 것이 그대로 전표
 * 두 벌이 된다 — 화면은 확인 창·전송 중 잠금·성공 후 잠금 세 겹으로 그 길을 닫는다.
 *
 * **응답을 화면 타입으로 옮겨 넘긴다** — **내부 번호와 표시 타입이 갈린 자리로** 간다
 * (`toCreatedAdjustmentResult`). 상신이 필요로 하는 것은 번호이고 결과 구획이 필요로 하는 것은
 * 표시 타입이라, 한 자루에 뭉개면 내부 번호가 그리는 자리까지 따라간다(`omf-mes#44`).
 */
export const useCreateStockAdjustment = (
  options: CreateStockAdjustmentOptions,
): MasterWriteResult<InventoryAdjustmentCreate> => {
  const { client } = useApiClient();

  return useMasterWrite<InventoryAdjustmentCreate, InventoryAdjustmentDetailResponse>({
    request: (body, headers) =>
      client.POST('/inventory/adjustments', {
        params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
        body,
      }),
    etagPath: null,
    invalidateKeys: [],
    knownFields: ADJUST_FORM_FIELDS,
    onSuccess: (data) => {
      options.onSuccess(toCreatedAdjustmentResult(data));
    },
  });
};

/**
 * 조정 상세의 요청 경로 — **잠금 토큰이 앉는 유일한 자리다**(D-14).
 *
 * 토큰 보관소가 **요청 URL의 경로별로** `ETag`를 담으므로(실측) 상신의 `If-Match`는 이 경로에서
 * 꺼내야 한다. 계약도 「값은 **같은 리소스의 상세 GET 200**이 내려주는 ETag 응답 헤더에서
 * 받는다」로 못 박았다.
 *
 * - **컬렉션 경로**(`/inventory/adjustments`)를 주면 **등록 201이 남긴 토큰**을 집는다. 지금은
 *   이 화면이 조정 목록을 그리지 않아 그 값이 우연히 있을 뿐이고, 그 우연에 기대는 결합을
 *   만들지 않는다 — **두 응답의 토큰이 다른 값일 때 그대로 틀린다**(뮤테이션 M-3이 겨누는 자리).
 * - **액션 경로**(`…:request-approval`)를 주면 토큰이 늘 비어 훅이 요청을 만들지 않고 멈춘다 —
 *   「눌러도 아무 일이 없다」가 그 증상이다.
 *
 * **경로를 한 곳에서 짓는다** — 한 글자만 달라도 토큰을 못 찾은 채 조용히 지나간다.
 */
export const detailPathOf = (inventoryAdjustmentId: number): string =>
  `/inventory/adjustments/${String(inventoryAdjustmentId)}`;

const fetchAdjustmentDetail = async (
  client: Client,
  inventoryAdjustmentId: number,
): Promise<CreatedAdjustmentResult> => {
  const data = await runRequest(() =>
    client.GET('/inventory/adjustments/{inventoryAdjustmentId}', {
      params: { path: { inventoryAdjustmentId } },
    }),
  );

  return toCreatedAdjustmentResult(data);
};

/**
 * 상신 직전에 **조정 상세를 한 번 부른다** — 잠금 토큰을 그 경로에 앉히는 자리다(D-14).
 *
 * 등록 201도 `ETag`를 주지만 그 토큰은 **컬렉션 경로**에 앉는다(실측) — 상신이 필요로 하는
 * 열쇠가 아니다. 이 조회가 없으면 방금 만든 전표의 토큰이 어디에도 없어 상신이 시작조차 되지
 * 않는다.
 *
 * **캐시가 신선해도 다시 부른다**(`staleTime: 0`). 앱의 기본 신선도는 30초인데(`providers.tsx`)
 * 이 조회의 목적은 값이 아니라 **토큰**이다 — 요청이 나가지 않으면 `ETag`가 갱신되지 않아,
 * 409를 받고 다시 눌러도 30초 동안 같은 낡은 토큰으로 다시 부딪힌다.
 *
 * **실패해도 갈래를 새로 만들지 않는다.** 토큰을 못 얻은 채 상신하면 공통 훅이 요청을 만들지
 * 않고 **「최신 정보를 불러오는 중입니다. 잠시 뒤 다시 저장하세요.」**(`messages.save.staleToken`)를
 * 세운다 — 그 자리가 이미 있으므로 부르는 쪽은 거부를 받아 두기만 한다.
 */
export const useAdjustmentDetailFetcher = (): ((
  inventoryAdjustmentId: number,
) => Promise<CreatedAdjustmentResult>) => {
  const { client } = useApiClient();
  const queryClient = useQueryClient();

  return (inventoryAdjustmentId) =>
    queryClient.fetchQuery({
      queryKey: stockAdjustKeys.detail(inventoryAdjustmentId),
      queryFn: () => fetchAdjustmentDetail(client, inventoryAdjustmentId),
      staleTime: 0,
    });
};

export interface RequestApprovalOptions {
  /** 올릴 전표. **등록에 성공한 뒤에만 값이 있다** — 그전에는 올릴 대상 자체가 없다 */
  inventoryAdjustmentId: number | null;
  onSuccess: (data: ApprovalRequestRef) => void;
}

/**
 * 만들어진 조정을 결재에 올린다 — **이 화면의 둘째 쓰기이고 등록과 별개 동작**이다.
 *
 * **`If-Match`가 필수다**(계약 · 목이 없는 요청을 400으로 되돌린다 — 실측). 토큰은 **늘 조정
 * 상세 경로**에서 꺼낸다(`detailPathOf`).
 *
 * **응답에 `ETag`가 없다**(계약 실측). 그래서 성공 뒤 **상세 키를 무효화한다** — 다만 낡은
 * 토큰을 실제로 막는 것은 위 fetcher의 `staleTime: 0`이다(이 키를 구독하는 구획이 없어
 * `fetchQuery`로만 부른다). 무효화를 남겨 두는 이유는 **캐시에 남은 값이 상신 전의 것**이라,
 * 이 키를 그리는 구획이 생기는 날 낡은 값을 그대로 그리지 않게 하려는 것이다 — 두 줄은 서로를
 * 대신하지 못한다.
 *
 * **실사 차이는 무효화하지 않는다**: 그 응답을 다시 받으면 조정 대상이 다시 서고(수명 표 6행)
 * 사용자가 보고 있던 값이 갈린다.
 *
 * **본문이 사유 하나다**(`ApprovalRequestCreate`). 승인 유형·승인자·결재선을 싣지 않는다 —
 * 승인 주체는 결재선 정의(W-06-15)가 정한 대로 전개되고 화면이 정하지 않는다(D-12).
 *
 * **응답이 내부 식별자 하나뿐이다**(`ApprovalRequestRef`) — 화면에 낼 업무 번호가 여기 없다
 * (`omf-mes#44`). 그 번호는 결재 진행 조회가 따로 가져온다.
 */
export const useRequestAdjustmentApproval = (
  options: RequestApprovalOptions,
): MasterWriteResult<ApprovalRequestCreate> => {
  const { client } = useApiClient();

  return useMasterWrite<ApprovalRequestCreate, ApprovalRequestRef>({
    request: (body, headers) => {
      /*
       * **없는 값을 0으로 메우지 않는다.**
       *
       * `etagPath`가 `null`이면 공통 훅은 그것을 「잠금이 필요 없다」로 읽어 요청을 **그대로
       * 내보낸다** — 대체값을 두면 `…/0:request-approval`이 실제로 나갈 수 있는 모양이 된다.
       * 지금은 결과 구획이 등록 뒤에만 서지만, 그 사실에 기대는 대신 **여기서 멈춘다.**
       */
      if (options.inventoryAdjustmentId === null) {
        throw new Error('만들어진 조정 전표가 없으면 결재에 올리지 않습니다.');
      }

      return client.POST('/inventory/adjustments/{inventoryAdjustmentId}:request-approval', {
        params: {
          path: { inventoryAdjustmentId: options.inventoryAdjustmentId },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': headers['If-Match'] ?? '',
          },
        },
        body,
      });
    },
    etagPath:
      options.inventoryAdjustmentId === null ? null : detailPathOf(options.inventoryAdjustmentId),
    invalidateKeys:
      options.inventoryAdjustmentId === null
        ? []
        : [stockAdjustKeys.detail(options.inventoryAdjustmentId)],
    knownFields: SUBMIT_FORM_FIELDS,
    onSuccess: options.onSuccess,
  });
};

/**
 * 올린 요청의 **결재 진행** — 승인 요청 상세 하나로 온다(계약이 `steps`를 함께 내린다).
 *
 * **상신 202가 준 식별자로 곧바로 부른다.** 승인 요청 **목록**을 대상 유형·대상 번호로 걸러
 * 찾는 길은 지금 성립하지 않는다 — 대상 유형 코드의 값 목록이 확정되지 않아 조건을 실을 수 없고,
 * 대상 번호만 실으면 유형이 다른 문서의 요청이 섞인다.
 *
 * ⛔ **등록 응답의 값으로 부르지 않는다**(C36 · §5.2.5). 목이 등록 201에 승인 요청 번호를 채워
 * 주므로 그 값으로 부르면 **상신하지 않은 전표의 결재 진행**을 열게 된다 — 화면이 확인하지
 * 않은 사실이다. 부를 수 있는가는 `approval-progress.ts`의 `readSubmission` 한 곳이 정하고
 * 이 훅은 그 결과를 나른다.
 *
 * **응답의 `ETag`를 쓰지 않는다** — 이 화면은 승인 요청에 쓰기를 하지 않는다.
 */
export const useApprovalRequest = (
  submission: Submission,
): UseQueryResult<ApprovalRequestDetailResponse> => {
  const { client } = useApiClient();
  const approvalRequestId = submission.kind === 'submitted' ? submission.approvalRequestId : null;

  return useQuery({
    queryKey: stockAdjustKeys.approvalRequest(approvalRequestId),
    enabled: approvalRequestId !== null,
    queryFn: () => {
      if (approvalRequestId === null) {
        throw new Error('상신되지 않은 조정의 결재 진행은 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/app/approval-requests/{approvalRequestId}', {
          params: { path: { approvalRequestId } },
        }),
      );
    },
  });
};

/**
 * 결재 진행을 **볼 권한이 없는가**(403).
 *
 * 계약이 「승인자도 상신자도 아니면 403」이라 적었다 — 같은 권한으로 다시 불러도 같은 답이
 * 오므로 그 갈래에는 재시도를 붙이지 않는다.
 */
export const isApprovalForbidden = (error: unknown): boolean => {
  const apiError = toApiError(error);

  return apiError.kind === 'http' && apiError.status === 403;
};

/** 그 승인 요청이 **없는가**(404). 전표는 값을 가리키는데 요청이 지금 보이지 않는 자리다. */
export const isApprovalNotFound = (error: unknown): boolean => {
  const apiError = toApiError(error);

  return apiError.kind === 'http' && apiError.status === 404;
};
