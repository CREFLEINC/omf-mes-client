import type { components } from '@omf-mes/api-client';

import { useApiClient } from '../../patterns/api-context';
import { useMasterWrite, type MasterWriteResult } from '../../patterns/master';
import { disposalRequestKeys } from './queries';
import type { GoodsIssueCreate } from './request-draft';

type GoodsIssue = components['schemas']['GoodsIssue'];

/**
 * 이 화면의 쓰기.
 *
 * ⭐ **요청은 두 걸음이다** — 전표를 만들고(`POST /logistics/goods-issues`) 그 위에 상신한다
 * (`:request-approval`). 계약이 승인 요청을 «문서에» 거는 형태라(`ApprovalRequestCreate` 에
 * 대상 필드가 없다) 전표가 먼저 있어야 한다.
 *
 * ⛔ **지금은 이 경로가 열리지 않는다** — 전표를 만들 때 필수인 `sourceDocumentTypeCode` 의 값이
 * 아직 확정되지 않았다(G-2 · `codes.ts`). 게이트가 그 앞에서 막고, 본문 조립도 `null` 을 낸다.
 * 값이 도착하면 **`codes.ts` 의 상수 하나만 채우면** 이 경로가 그대로 선다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

export interface DisposalRequestOptions {
  onSuccess: (goodsIssueId: number) => void;
}

/**
 * 전표 생성 + 상신.
 *
 * ⭐ **되돌리기 어려운 쓰기다** — 상신 철회 경로가 승인 계약에 없다(§5-6). 그래서 멱등 키를
 * 적용될 때까지 붙든다: 통신이 끊긴 뒤 다시 눌러도 **결재가 두 벌 올라가지 않는다.**
 *
 * ⚠ **상신 응답은 202 다** — 오프라인 큐가 아니라 진짜 서버 비동기 결재다. 「접수됐고 결재선이
 * 돈다」는 뜻이고 화면이 그렇게 말한다.
 */
export const useDisposalRequestMutation = (
  options: DisposalRequestOptions,
): MasterWriteResult<GoodsIssueCreate> => {
  const { client } = useApiClient();

  return useMasterWrite<GoodsIssueCreate, GoodsIssue>({
    request: async (body, headers) => {
      const created = await client.POST('/logistics/goods-issues', {
        params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
        body,
      });

      /*
       * 전표를 못 만들었으면 상신하지 않는다 — 상신할 대상이 없다. 오류를 그대로 올려
       * 공통 훅이 배너로 세우게 한다.
       */
      if (created.error !== undefined || created.data === undefined) return created;

      const submitted = await client.POST(
        '/logistics/goods-issues/{goodsIssueId}:request-approval',
        {
          params: {
            path: { goodsIssueId: created.data.goodsIssueId },
            /* ⚠ 상신은 «별개 쓰기»라 키를 따로 준다 — 같은 키를 쓰면 원장이 둘을 한 건으로 본다. */
            header: { 'Idempotency-Key': crypto.randomUUID() },
          },
        },
      );

      /*
       * ⛔ **전표는 만들어졌는데 상신이 실패한 경우를 성공으로 접지 않는다.** 접으면 결재가
       * 돌지 않는 전표가 남고 사용자는 승인을 기다린다. 오류를 그대로 올린다.
       */
      if (submitted.error !== undefined) return { ...submitted, data: undefined };

      return created;
    },
    etagPath: null,
    invalidateKeys: [disposalRequestKeys.all],
    knownFields: ['reasonCode', 'issueTypeCode', 'sourceDocumentTypeCode'],
    keyLifetime: 'until-applied',
    onSuccess: (data) => options.onSuccess(data.goodsIssueId),
  });
};
