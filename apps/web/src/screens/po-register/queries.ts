import type { ApiClient } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import { toSourceLineView, toSourceReceiptView, type SourceReceiptResult } from './types';

/**
 * 이 화면의 읽기 — **이 회차에는 하나뿐이다.**
 *
 * 입하 상세 하나로 머리(입하번호·공급사·공장·상태)와 라인이 함께 온다. 라인 경로
 * (`…/{id}/lines`)를 따로 부르지 않는다 — 같은 값을 한 번 더 받는 요청이 된다.
 *
 * 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch`가 경로를 리터럴 타입으로 요구해
 * 문자열 변수로 넘기면 타입 검사가 풀린다.
 *
 * **이 화면은 이 전표에 쓰지 않는다.** 입하 상세의 잠금 토큰(`ETag`)이 함께 오지만
 * 그것은 입하를 고치는 화면의 것이고, 여기서는 읽기만 한다.
 */

type Client = ApiClient['client'];

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
