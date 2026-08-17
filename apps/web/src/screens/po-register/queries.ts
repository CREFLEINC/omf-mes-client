import type { ApiClient, components } from '@omf-mes/api-client';
import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { useMasterWrite, type MasterWriteResult } from '../../patterns/master';
import { runRequest } from '../../patterns/request';
import {
  toPoDetailResult,
  toSourceLineView,
  toSourceReceiptView,
  type PoDetailResult,
  type SourceReceiptResult,
} from './types';
import { PO_FORM_FIELDS, SUBMIT_FORM_FIELDS } from './validation';

/**
 * 이 화면의 요청 — 읽기 둘(입하 상세 · 발주 상세)과 **쓰기 둘**(등록 · 상신)이다.
 *
 * 입하 상세 하나로 머리(입하번호·공급사·공장·상태)와 라인이 함께 온다. 라인 경로
 * (`…/{id}/lines`)를 따로 부르지 않는다 — 같은 값을 한 번 더 받는 요청이 된다.
 *
 * 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch`가 경로를 리터럴 타입으로 요구해
 * 문자열 변수로 넘기면 타입 검사가 풀린다.
 *
 * **넘어온 입하 전표에는 쓰지 않는다.** 입하 상세의 잠금 토큰(`ETag`)이 함께 오지만
 * 그것은 입하를 고치는 화면의 것이고, 여기서는 읽기만 한다.
 *
 * **승인 유형·결재선·승인자를 이 화면이 정하지 않는다**(계획 결정 8). 계약의 승인 요청 본문은
 * `reason` 한 칸이고 응답은 식별자 하나라 **보낼 자리도 보일 자리도 없다** — 자리표시 상수를
 * 두면 보낼 곳 없는 값을 화면이 들고 있게 된다.
 *
 * **결재 진행을 조회하지 않는다**(착수 이슈 §6 ③ · 계획 결정 11). `/app/approval-requests`는
 * 결재함(W-CO-09)의 소관이고, 이 화면은 상신 뒤 그 자리를 가리키기만 한다 — 여기에 진행
 * 구획을 두면 같은 사실을 두 화면이 서로 다른 시점의 값으로 말하게 된다.
 */

type Client = ApiClient['client'];
type PurchaseOrderCreate = components['schemas']['PurchaseOrderCreate'];
type PurchaseOrderDetailResponse = components['schemas']['PurchaseOrderDetailResponse'];
type ApprovalRequestCreate = components['schemas']['ApprovalRequestCreate'];
type ApprovalRequestRef = components['schemas']['ApprovalRequestRef'];

/**
 * 캐시 키.
 *
 * **읽는 대상마다 앞머리를 갈라 둔다** — 하나로 묶으면 한쪽만 다시 부르려 해도 다른 쪽까지
 * 함께 무효화되고, 그때 응답이 새 참조로 오면서 치던 값이 사라진다.
 *
 * `detail`은 **만들어진 발주의 상세**다. 상신이 여기서 잠금 토큰을 얻고(계획 결정 10) 상신에
 * 성공하면 이 키가 무효화된다 — 그 토큰이 앉는 경로가 컬렉션이 아니라 상세라는 사실이 이 키의
 * 모양에 그대로 남아 있어야 한다.
 */
export const poRegisterKeys = {
  sourceReceipt: (inboundReceiptId: number | null): readonly unknown[] =>
    ['po-register', 'source-receipt', inboundReceiptId] as const,
  detail: (purchaseOrderId: number): readonly unknown[] =>
    ['po-register', 'purchase-order', purchaseOrderId] as const,
};

const fetchSourceReceipt = async (
  client: Client,
  inboundReceiptId: number,
): Promise<SourceReceiptResult> => {
  const data = await runRequest(() =>
    client.GET('/logistics/inbound-receipts/{inboundReceiptId}', {
      params: { path: { inboundReceiptId } },
    }),
  );

  return {
    receipt: toSourceReceiptView(data.inboundReceipt),
    lines: data.lines.map(toSourceLineView),
  };
};

/**
 * 정산할 초과 입하 전표.
 *
 * **맥락이 없으면 부르지 않는다**(`enabled`). 맥락 없이 들어온 사용자에게는 조회 실패가 아니라
 * 「무엇을 등록하는지 정해지지 않았다」를 보여야 한다 — 없는 번호로 조회하면 그 사정이
 * 서버 오류로 바뀌어 보인다.
 */
export const useSourceReceipt = (
  inboundReceiptId: number | null,
): UseQueryResult<SourceReceiptResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: poRegisterKeys.sourceReceipt(inboundReceiptId),
    enabled: inboundReceiptId !== null,
    queryFn: () => {
      if (inboundReceiptId === null) {
        throw new Error('진입 맥락이 없으면 입하 상세를 조회하지 않습니다.');
      }

      return fetchSourceReceipt(client, inboundReceiptId);
    },
  });
};

export interface CreatePurchaseOrderOptions {
  onSuccess: (data: PoDetailResult) => void;
}

/**
 * P/O를 만든다 — **이 화면에서 되돌릴 수 없는 첫 쓰기**다.
 *
 * **헤더와 라인이 한 요청으로 간다**(착수 이슈 §6 ⑤). 라인 치환 경로(`…/{id}/lines`)를 잇지
 * 않는다 — 그 경로는 이미 만들어진 발주를 고치는 자리이고, 여기서 쓰면 「헤더만 남고 라인이
 * 없는 발주」가 중간 상태로 실재하게 된다.
 *
 * **잠금 토큰을 보내지 않는다**(`etagPath: null`). 계약의 parameters에 `If-Match`가 없고 응답
 * 갈래에 409가 없다(계획 §5.2.1 ③) — 새 전표라 견줄 판이 없다. 화면이 들고 있는 토큰은
 * **넘어온 입하 전표**의 것이라, 실으면 서로 다른 자원의 버전을 비교하게 된다.
 *
 * **무효화할 키가 없다**(`invalidateKeys: []`). 이 화면은 발주 목록을 그리지 않으므로 다시
 * 부를 조회가 없다 — 없는 목록을 무효화하면 「바뀌지도 않은 값을 다시 받는」 요청만 는다.
 * **넘어온 입하 전표도 무효화하지 않는다**: 그 응답을 다시 받으면 승계 초안이 다시 서고
 * (수명 표 6행) 사용자가 방금 등록한 값과 화면의 값이 갈린다.
 *
 * **멱등 키는 호출마다 새로 만들어진다**(공통 훅 실측). 그래서 두 번 누르는 것이 그대로 전표
 * 두 벌이 된다 — 화면은 확인 창·전송 중 잠금·성공 후 잠금 세 겹으로 그 길을 닫는다(계획 결정 12).
 *
 * **응답을 화면 타입으로 옮겨 넘긴다** — 내부 번호(상신용)와 표시 타입이 갈린 채로 전달된다.
 */
export const useCreatePurchaseOrder = (
  options: CreatePurchaseOrderOptions,
): MasterWriteResult<PurchaseOrderCreate> => {
  const { client } = useApiClient();

  return useMasterWrite<PurchaseOrderCreate, PurchaseOrderDetailResponse>({
    request: (body, headers) =>
      client.POST('/logistics/purchase-orders', {
        params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
        body,
      }),
    etagPath: null,
    invalidateKeys: [],
    knownFields: PO_FORM_FIELDS,
    onSuccess: (data) => {
      options.onSuccess(toPoDetailResult(data));
    },
  });
};

/**
 * 발주 상세의 요청 경로 — **잠금 토큰이 앉는 유일한 자리다.**
 *
 * 토큰 보관소가 **요청 URL의 경로별로** `ETag`를 담으므로(실측) 상신의 `If-Match`는 이
 * 경로에서 꺼내야 한다. 계약도 「값은 **같은 리소스의 상세 GET 200**이 내려주는 ETag 응답
 * 헤더에서 받는다」로 못 박았다.
 *
 * - **컬렉션 경로**(`/logistics/purchase-orders`)를 주면 **목록 조회와 열쇠가 겹친다.** 지금은
 *   이 화면이 목록을 그리지 않아 등록 201이 남긴 토큰이 우연히 맞을 뿐이고, 그 우연에 기대는
 *   결합을 만들지 않는다(전례가 같은 자리에서 같은 결론에 도달했다).
 * - **액션 경로**(`…:request-approval`)를 주면 토큰이 늘 비어 훅이 요청을 만들지 않고 멈춘다 —
 *   「눌러도 아무 일이 없다」가 그 증상이다.
 */
export const poDetailPath = (purchaseOrderId: number): string =>
  `/logistics/purchase-orders/${String(purchaseOrderId)}`;

const fetchPurchaseOrderDetail = async (
  client: Client,
  purchaseOrderId: number,
): Promise<PoDetailResult> => {
  const data = await runRequest(() =>
    client.GET('/logistics/purchase-orders/{purchaseOrderId}', {
      params: { path: { purchaseOrderId } },
    }),
  );

  return toPoDetailResult(data);
};

/**
 * 상신 직전에 **발주 상세를 한 번 부른다** — 잠금 토큰을 그 경로에 앉히는 자리다.
 *
 * 등록 201도 `ETag`를 주지만 그 토큰은 **컬렉션 경로**에 앉는다(실측) — 상신이 필요로 하는
 * 열쇠가 아니다. 이 조회가 없으면 방금 만든 전표의 토큰이 어디에도 없어 상신이 시작조차 되지
 * 않는다.
 *
 * **캐시가 신선해도 다시 부른다**(`staleTime: 0`). 앱의 기본 신선도는 30초인데(`providers.tsx`)
 * 이 조회의 목적은 값이 아니라 **토큰**이다 — 요청이 나가지 않으면 `ETag`가 갱신되지 않아,
 * 409를 받고 「최신 불러오기」를 눌러도 30초 동안 같은 낡은 토큰으로 다시 부딪힌다.
 *
 * **실패해도 갈래를 새로 만들지 않는다.** 토큰을 못 얻은 채 상신하면 공통 훅이 요청을 만들지
 * 않고 「최신 상태를 불러오지 못했습니다」를 세운다 — 그 자리가 이미 있으므로 부르는 쪽은
 * 거부를 받아 두기만 한다.
 */
export const usePurchaseOrderDetailFetcher = (): ((
  purchaseOrderId: number,
) => Promise<PoDetailResult>) => {
  const { client } = useApiClient();
  const queryClient = useQueryClient();

  return (purchaseOrderId) =>
    queryClient.fetchQuery({
      queryKey: poRegisterKeys.detail(purchaseOrderId),
      queryFn: () => fetchPurchaseOrderDetail(client, purchaseOrderId),
      staleTime: 0,
    });
};

export interface RequestApprovalOptions {
  /** 올릴 전표. **등록에 성공한 뒤에만 값이 있다** — 그전에는 올릴 대상 자체가 없다 */
  purchaseOrderId: number | null;
  onSuccess: (data: ApprovalRequestRef) => void;
}

/**
 * 만들어진 발주를 결재에 올린다 — **이 화면의 둘째 쓰기이자 등록과 별개 동작**이다
 * (착수 이슈 §6 ③ · 계획 결정 9).
 *
 * **`If-Match`가 필수다**(계약 · 목이 없는 요청을 400으로 되돌린다 — 실측). 토큰은 **늘 발주
 * 상세 경로**에서 꺼낸다(`poDetailPath`).
 *
 * **응답에 `ETag`가 없다**(계약 실측). 그래서 성공 뒤 **상세 키를 무효화한다** — 하지 않으면
 * 다음 쓰기가 낡은 토큰으로 나간다. **입하 전표는 무효화하지 않는다**: 그 응답을 다시 받으면
 * 승계 초안이 다시 서고(화면의 수명 표) 사용자가 보고 있던 값이 갈린다.
 *
 * **본문이 사유 하나다**(`ApprovalRequestCreate`). 승인 유형·승인자·결재선을 싣지 않는다 —
 * 승인 주체는 결재선 정의(W-06-15)가 정한 대로 전개되고 화면이 정하지 않는다(착수 이슈 §6 ④).
 *
 * **응답이 내부 식별자 하나뿐이다**(`ApprovalRequestRef`) — 화면에 낼 번호가 없다(`omf-mes#44`).
 * 진행 상태는 결재함이 정본이다.
 */
export const useRequestApproval = (
  options: RequestApprovalOptions,
): MasterWriteResult<ApprovalRequestCreate> => {
  const { client } = useApiClient();

  return useMasterWrite<ApprovalRequestCreate, ApprovalRequestRef>({
    request: (body, headers) => {
      /*
       * **없는 값을 0으로 메우지 않는다**(계획 결정 10).
       *
       * `etagPath`가 `null`이면 공통 훅은 그것을 「잠금이 필요 없다」로 읽어 요청을 **그대로
       * 내보낸다** — 대체값을 두면 `…/0:request-approval`이 실제로 나갈 수 있는 모양이 된다.
       * 지금은 결과 구획이 등록 뒤에만 서지만, 그 사실에 기대는 대신 **여기서 멈춘다.**
       */
      if (options.purchaseOrderId === null) {
        throw new Error('만들어진 발주가 없으면 결재에 올리지 않습니다.');
      }

      return client.POST('/logistics/purchase-orders/{purchaseOrderId}:request-approval', {
        params: {
          path: { purchaseOrderId: options.purchaseOrderId },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': headers['If-Match'] ?? '',
          },
        },
        body,
      });
    },
    etagPath: options.purchaseOrderId === null ? null : poDetailPath(options.purchaseOrderId),
    invalidateKeys:
      options.purchaseOrderId === null ? [] : [poRegisterKeys.detail(options.purchaseOrderId)],
    knownFields: SUBMIT_FORM_FIELDS,
    onSuccess: options.onSuccess,
  });
};
