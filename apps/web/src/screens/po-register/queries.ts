import type { ApiClient, components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

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
import { PO_FORM_FIELDS } from './validation';

/**
 * 이 화면의 요청 — 읽기 하나(입하 상세)와 **쓰기 하나**(등록)다.
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
 * 두면 보낼 곳 없는 값을 화면이 들고 있게 된다. 승인 요청 자체는 뒤따르는 회차가 붙인다.
 */

type Client = ApiClient['client'];
type PurchaseOrderCreate = components['schemas']['PurchaseOrderCreate'];
type PurchaseOrderDetailResponse = components['schemas']['PurchaseOrderDetailResponse'];

/**
 * 캐시 키.
 *
 * **읽는 대상마다 앞머리를 갈라 둔다** — 하나로 묶으면 한쪽만 다시 부르려 해도 다른 쪽까지
 * 함께 무효화되고, 그때 응답이 새 참조로 오면서 치던 값이 사라진다.
 *
 * `detail`은 **만들어진 발주의 상세**다. 이 회차에서 부르는 자리는 아직 없고, 승인 요청이
 * 붙는 회차가 여기서 잠금 토큰을 얻는다(계획 결정 10) — 그 토큰이 앉는 경로가
 * 컬렉션이 아니라 상세라는 사실이 이 키의 모양에 그대로 남아 있어야 한다.
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
