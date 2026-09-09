import type { ApiError, components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { useApiClient } from '../../patterns/api-context';
import { requireIfMatch, useMasterWrite, type MasterWriteResult } from '../../patterns/master';
import { ApiRequestError } from '../../patterns/request';
import { disposalRequestKeys, issueDetailPath } from './queries';
import {
  toBusinessDate,
  withOccurrence,
  type ApprovalRequestCreate,
  type GoodsIssueDraft,
} from './request-draft';

type GoodsIssue = components['schemas']['GoodsIssue'];
type PostRequest = components['schemas']['PostRequest'];

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
  /**
   * ⛔ **시각 세 칸이 빠져 있다** — `withOccurrence` 가 보내는 순간에 얹는다.
   *
   * 여기 두면 밀리초까지 지문에 실려 **누를 때마다 지문이 달라지고**, 키를 붙드는 장치가
   * 통째로 무력해진다. 그러면 재시도가 새 폐기 전표가 된다.
   */
  issue: GoodsIssueDraft;
  approval: ApprovalRequestCreate;
}

/**
 * 서버 오류를 **칸 옆에** 놓을 수 있는 자리.
 *
 * 이 둘만 사용자가 고칠 칸을 갖는다. 나머지는 배너 몫이다 — 위 주석 참조.
 */
const INLINE_FIELDS: readonly string[] = ['reasonCode', 'reason'];

/** 인라인으로 낼 자리가 없는 쓰기. 전부 배너로 올린다. */
const NO_INLINE_FIELDS: readonly string[] = [];

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
        /* ⭐ 시각을 «보내는 순간» 얹는다 — 지문에 들어가지 않게(위 주석). */
        body: withOccurrence(body.issue, new Date()),
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
    /*
     * ⛔ **`knownFields` 는 「이 화면에 그 오류를 놓을 칸이 있다」는 선언이다.** 없는 칸을
     * 적으면 서버가 준 사유가 인라인 몫으로 빠지면서 **배너에서도 빠져 어디에도 표시되지
     * 않는다**(저장소가 `packing-work/mutations.ts` 에 같은 함정을 문장으로 못박아 두었다).
     *
     * ⭐ 이 화면에서 칸으로 돌아갈 것은 **둘뿐**이다 — 폐기 사유 선택칸과 요청 사유 입력칸.
     * `issueTypeCode`·`sourceDocumentTypeCode` 는 화면이 정하는 «구조 값»이라 사용자가 고칠
     * 칸이 없다 — 그 자리 오류는 배너로 올려야 사람이 볼 수 있다.
     */
    knownFields: INLINE_FIELDS,
    keyLifetime: 'until-applied',
    onSuccess: (data) => options.onSuccess(data.goodsIssueId),
  });
};

/**
 * 승인이 끝난 폐기 요청을 **실제 출고로 처리한다** — 계약이 「재고가 움직이는 순간」이라 적은 자리다.
 *
 * ⭐ **승인은 자물쇠를 풀 뿐이다**(J-8) — 승인이 끝나도 출고는 여기서 «다시» 눌러야 한다.
 *
 * ⛔ **승인 전이라는 판정을 화면이 흉내 내지 않는다.** 승인 상태 값이 계약에서 아직 열린
 * 문자열이라(`5b3d773` 실측) 앞질러 막으면 **승인이 끝났는데도 열리지 않는다**(통지 `#674` ·
 * 설계서 §8-6). 버튼을 열고 **서버의 400 을 그대로 배너에 낸다** — 코드로 분기해 원인을
 * 지어내면 다른 이유로 온 400 에도 같은 안내가 붙는다.
 *
 * ⛔ **`If-Match` 는 훅이 붙인다**(`etagPath`) — 토큰은 그 전표의 «상세 경로»에 앉는다.
 * 액션 경로를 주면 토큰이 비어 훅이 요청을 만들지 않는다.
 */
export const useDisposalPostMutation = (
  options: DisposalPostOptions,
): MasterWriteResult<DisposalPostPayload> => {
  const { client } = useApiClient();

  return useMasterWrite<DisposalPostPayload, GoodsIssue>({
    request: (body, headers) => {
      /*
       * ⛔ **없는 값을 0 으로 메우지 않는다.** `etagPath` 가 `null` 이 되면 공통 훅은 그것을
       * 「잠금이 필요 없다」로 읽어 요청을 그대로 내보낸다 — `…/0:post` 가 실제로 나갈 수 있는
       * 모양이 된다. 부르는 자리가 그렇게 부르지 않는다는 사실에 기대지 않고 여기서 멈춘다.
       */
      if (options.goodsIssueId === null) {
        throw new Error('전기할 전표를 고르기 전에는 전기하지 않습니다.');
      }

      /*
       * ⚠ **경로와 지문이 «같은» 출처를 본다.** 경로를 `options` 에서, 지문을 `body` 에서
       * 가져오면 고른 전표가 바뀌는 찰나에 **앞 전표의 키로 뒤 전표를 전기**할 수 있다.
       */
      return client.POST('/logistics/goods-issues/{goodsIssueId}:post', {
        params: {
          path: { goodsIssueId: body.goodsIssueId },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': requireIfMatch(headers),
          },
        },
        /* ⭐ 시각을 «보내는 순간» 얹는다 — 지문에 들어가지 않게(위 주석). */
        body: withPostOccurrence(new Date()),
      });
    },
    etagPath: options.goodsIssueId === null ? null : issueDetailPath(options.goodsIssueId),
    /*
     * ⭐ **잔액도 함께 무효화한다** — 전기는 재고를 «움직이는» 쓰기다. 무효화하지 않으면
     * 다음 폐기 요청의 위치 조회가 이미 빠진 재고를 남아 있는 것으로 읽는다.
     */
    invalidateKeys: [disposalRequestKeys.all],
    /*
     * ⛔ **인라인으로 낼 자리가 없다.** 전기 본문의 두 값은 화면이 보내는 순간 만들고 사용자가
     * 고칠 칸이 없다 — 적으면 그 오류가 배너에서도 빠진다.
     */
    knownFields: NO_INLINE_FIELDS,
    keyLifetime: 'until-applied',
    onSuccess: () => options.onSuccess(),
  });
};

/**
 * 전기가 넘기는 것 — **전표 식별자 하나뿐이다.**
 *
 * ⛔ **시각을 여기 두지 않는다.** 두면 밀리초까지 멱등 지문에 실려 누를 때마다 지문이
 * 달라지고, 재시도가 «두 번째 전기»가 된다 — 상신 쪽에서 겪은 것과 **같은 형태**다.
 *
 * ⛔ **그렇다고 비워 두지도 않는다.** 지문이 비면 훅이 키를 붙드는데(`until-applied`), 고른
 * 전표를 바꿔도 **같은 키가 그대로 물려간다** — 다른 전표의 전기가 앞 전표의 키로 나가고
 * 서버가 그것을 재생으로 접으면 **두 번째 전표는 전기되지 않은 채 됐다고 보인다.**
 * 식별자를 지문에 두는 것이 그 둘을 함께 막는 유일한 자리다.
 */
export interface DisposalPostPayload {
  goodsIssueId: number;
}

/**
 * 전기 본문 — 계약의 `PostRequest` 는 **두 값뿐**이다.
 *
 * 보내는 순간에 만든다. 재시도마다 값이 달라지는 것은 괜찮다 — 같은 키로 다시 가면 서버가
 * 최초 응답을 재생하고 본문은 보지 않는다.
 */
const withPostOccurrence = (now: Date): PostRequest => ({
  businessDate: toBusinessDate(now),
  occurredAt: now.toISOString(),
});

export interface DisposalPostOptions {
  /** 전기할 전표. 「처리 이력」에서 고른 것이다 — 이 조작에 다른 출처가 없다. */
  goodsIssueId: number | null;
  onSuccess: () => void;
}
