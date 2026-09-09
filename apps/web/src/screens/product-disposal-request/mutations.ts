import type { ApiError, components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { useApiClient } from '../../patterns/api-context';
import { useMasterWrite, type MasterWriteResult } from '../../patterns/master';
import { ApiRequestError } from '../../patterns/request';
import { disposalRequestKeys } from './queries';
import type { ApprovalRequestCreate, GoodsIssueCreate } from './request-draft';

type GoodsIssue = components['schemas']['GoodsIssue'];

/**
 * 전표는 만들어졌는데 **상신에 쓸 잠금 토큰이 응답에 없었다.**
 *
 * ⭐ **「저장 실패」로 적지 않는다** — 전표는 남아 있다. 실패로만 말하면 사용자가 다시 눌러
 * **전표를 한 벌 더 만든다.** 무엇이 남았고 어디서 이어야 하는지를 말한다.
 */
const missingSubmitTokenError = (): ApiError => ({
  kind: 'validation',
  errors: [
    {
      scope: 'screen',
      code: 'SUBMIT_TOKEN_MISSING',
      message: messages.productDisposalRequest.errors.submitTokenMissing,
    },
  ],
});

/**
 * 이 화면의 쓰기.
 *
 * ⭐ **요청은 두 걸음이다**(§5-7) — 전표를 만들고(`POST /logistics/goods-issues`
 * · `postImmediately=false`) 그 위에 상신한다(`:request-approval`). 계약이 승인 요청을 «문서에»
 * 거는 형태라(`ApprovalRequestCreate` 에 대상 필드가 없다) 전표가 먼저 있어야 한다. 도착지 짝이
 * **앞 호출의 본문**에 실리는 것도 이 순서 때문이다 — `:post` 의 본문은 두 칸뿐이고 전표 헤더를
 * 고칠 `PUT` 이 없다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

/**
 * 한 번의 「승인 요청」이 보내는 **두 본문**.
 *
 * ⭐ **한 변수로 묶는 이유는 멱등 지문 때문이다.** 훅은 `variables` 의 지문이 같으면 키를 그대로
 * 붙든다(`until-applied`). 사유를 여기 함께 담아야 **사유를 고쳐 다시 누른 것**이 같은 쓰기로
 * 접히지 않는다 — 전표 본문만 담으면 사유만 바뀐 재시도가 첫 요청의 응답으로 덮인다.
 */
export interface DisposalRequestPayload {
  issue: GoodsIssueCreate;
  approval: ApprovalRequestCreate;
}

export interface DisposalRequestOptions {
  onSuccess: (goodsIssueId: number) => void;
}

/**
 * 상신 호출의 멱등 키 — **첫 키에서 파생한다.**
 *
 * ⚠ 상신은 «별개 쓰기»라 키를 따로 줘야 한다. 같은 키를 쓰면 원장이 둘을 한 건으로 본다.
 *
 * ⛔ **그렇다고 `crypto.randomUUID()` 를 부르지 않는다.** 매 시도마다 새 키가 되어, 통신이 끊긴
 * 뒤 다시 누른 것이 서버에 **새 상신**으로 읽힌다 — 상신 철회 경로가 승인 계약에 없어(§5-6)
 * 그렇게 생긴 중복 결재는 지워지지 않는다. 첫 키에서 파생하면 **둘 다** 만족한다: 첫 호출과는
 * 다르고, 같은 쓰기의 재시도에서는 같다.
 */
const approvalKeyOf = (issueKey: string): string => `${issueKey}:request-approval`;

/**
 * 전표 생성 + 상신.
 *
 * ⭐ **되돌리기 어려운 쓰기다** — 상신 철회 경로가 승인 계약에 없다(§5-6). 그래서 멱등 키를
 * 적용될 때까지 붙든다: 통신이 끊긴 뒤 다시 눌러도 **결재가 두 벌 올라가지 않는다.**
 *
 * ⚠ **상신 응답은 202 다** — 「접수됐고 결재선이 돈다」는 뜻이다. 오프라인 큐의 202 가 아니다
 * (그 갈래는 계약에서 빠졌다 · `#97`) — 관리웹이라 오프라인 자체가 해당 없음이다(§6).
 */
export const useDisposalRequestMutation = (
  options: DisposalRequestOptions,
): MasterWriteResult<DisposalRequestPayload> => {
  const { client } = useApiClient();

  return useMasterWrite<DisposalRequestPayload, GoodsIssue>({
    request: async (body, headers) => {
      const created = await client.POST('/logistics/goods-issues', {
        params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
        body: body.issue,
      });

      /*
       * 전표를 못 만들었으면 상신하지 않는다 — 상신할 대상이 없다. 오류를 그대로 올려
       * 공통 훅이 배너로 세우게 한다.
       */
      if (created.error !== undefined || created.data === undefined) {
        return { ...created, data: undefined };
      }

      const { goodsIssue } = created.data;

      /*
       * ⛔ **상신은 `If-Match` 를 «필수»로 받는다.** 토큰은 방금 만든 전표의 201 응답이 실어
       * 준다 — 상세를 다시 읽지 않는다(공유계약 B-1 · 그 오퍼레이션 설명이 「같은 리소스의
       * 상세 GET 200」이라 적었으나 생성 응답도 같은 판 번호를 낸다).
       *
       * ⚠ **없으면 상신하지 않는다.** `?? ''` 로 메우면 빈 토큰이 나가고, 서버의 거부가
       * 화면에서 「저장이 반려됐다」로 읽힌다 — 실제로는 **물어보지도 못한 것**이다. 전표는
       * 이미 만들어졌으므로 그 사실이 오류에 담겨야 사용자가 결재함이 아니라 전표를 본다.
       */
      const ifMatch = created.response.headers.get('etag');

      if (ifMatch === null) throw new ApiRequestError(missingSubmitTokenError());

      const submitted = await client.POST(
        '/logistics/goods-issues/{goodsIssueId}:request-approval',
        {
          params: {
            path: { goodsIssueId: goodsIssue.goodsIssueId },
            header: {
              'Idempotency-Key': approvalKeyOf(headers['Idempotency-Key']),
              'If-Match': ifMatch,
            },
          },
          /* ⭐ 사유가 본문이다 — 계약이 `minLength 1` 로 «필수»로 받는다(통지 `#675` §3). */
          body: body.approval,
        },
      );

      /*
       * ⛔ **전표는 만들어졌는데 상신이 실패한 경우를 성공으로 접지 않는다.** 접으면 결재가
       * 돌지 않는 전표가 남고 사용자는 오지 않을 승인을 기다린다. 오류를 그대로 올린다.
       */
      if (submitted.error !== undefined) return { ...submitted, data: undefined };

      return { ...created, data: goodsIssue };
    },
    /*
     * ⛔ **`etagPath` 는 `null` 이다** — 훅이 붙일 잠금 토큰이 없다. 새 전표라 첫 호출에는 매길
     * 판 번호가 없고, 둘째 호출의 토큰은 **첫 호출의 응답에서** 온다(위). 훅에 맡기면 아직
     * 존재하지 않는 리소스의 ETag 를 찾게 된다.
     */
    etagPath: null,
    invalidateKeys: [disposalRequestKeys.all],
    knownFields: ['reasonCode', 'issueTypeCode', 'sourceDocumentTypeCode', 'reason'],
    keyLifetime: 'until-applied',
    onSuccess: (data) => options.onSuccess(data.goodsIssueId),
  });
};
