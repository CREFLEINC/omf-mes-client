import type { ApiClient, components, paths } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { useMasterWrite, type MasterWriteResult, type WriteHeaders } from '../../patterns/master';
import { runRequest, toApiError, type ApiCallResult } from '../../patterns/request';
import type { Submission } from './approval-progress';
import { CANCEL_FORM_FIELDS } from './cancel-reason-draft';
import type { DetailSelection } from './detail-selection';
import type { CancelResource } from './document-types';
import type { DocumentProgressListQuery } from './filters';
import {
  toCancelExecutionView,
  toDocumentProgressDetailView,
  toDocumentProgressView,
  type ApprovalRequestDetailResponse,
  type CancelExecutionView,
  type DocumentProgressDetailView,
  type DocumentProgressListResult,
} from './types';

/**
 * 이 화면의 요청 — **읽기 넷과 쓰기 둘이다.**
 *
 * | 언제 | 무엇 |
 * | --- | --- |
 * | 문서 유형을 고르면 | 그 유형의 진행현황 목록 |
 * | 문서를 고르면 | 그 문서의 처리 경과와 후속 목록 |
 * | 문서를 골랐고 **그 유형에 취소 경로가 있으면** | 그 문서의 **리소스 상세** — 잠금 토큰을 얻는다 |
 * | 고른 문서에 **취소 요청이 진행 중이면** | 그 요청의 승인 진행 |
 * | 「취소 요청 올리기」 | 취소 요청 상신(202) |
 * | 「취소 실행하기」 | ⛔ **취소 실행**(200) — 원장에서 수량을 되돌린다 |
 *
 * ⭐ **유형을 고르기 전에는 아무것도 부르지 않는다.** `documentTypeCode`가 계약의 **필수**
 * 질의값이라 유형 없이 부를 방법 자체가 없다. 조회가 성립하는가는 `filters.ts`의 `toListQuery`가 한 곳에서 판정하고
 * (`null`이면 성립하지 않는다) 이 훅은 그 결과를 나른다. 여기서 다시 판정하면 두 자리가 갈린다.
 *
 * ⭐ **상세를 둘 부른다 — 역할이 다르다.** 진행현황 상세는 경과·후속을 주고 **잠금 토큰을 주지
 * 않는다**(그 200에 `ETag`가 없다 — 실측). 토큰은 **문서 리소스 상세**(`/logistics/goods-receipts/{id}`
 * 등) 200에서만 오며, 토큰 보관소가 **응답이 온 URL 경로**를 열쇠로 쓰므로(`packages/api-client/src/client.ts`)
 * 잘못된 경로로 꺼내면 언제나 비어 있고 훅이 요청을 **보내지 않은 채** 멈춘다. 두 조회의 캐시
 * 키를 가르는 이유도 같다 — 하나로 묶으면 한쪽 무효화가 다른 쪽을 끌고 간다.
 *
 * **참조 조회를 두지 않는다.** 품목·자재 LOT·창고는 번호로만 좁힌다 — 이름 목록을 얹으면 그
 * 조회의 좁힘·잘림 규칙이 함께 따라오는데, 이 회차의 목록은 그 이름을 그리지 않는다.
 *
 * 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch`가 경로를 리터럴 타입으로 요구해
 * 문자열 변수로 넘기면 타입 검사가 풀린다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

type Client = ApiClient['client'];

type ApprovalRequestCreate = components['schemas']['ApprovalRequestCreate'];
export type ApprovalRequestRef = components['schemas']['ApprovalRequestRef'];
type CancelResultResponse = components['schemas']['CancelResult'];
type DocumentProgressQuery = NonNullable<
  paths['/logistics/document-progress']['get']['parameters']['query']
>;
type DocumentTypeCode = DocumentProgressQuery['documentTypeCode'];

/**
 * 이 자원의 조회를 덮는 뿌리 키.
 *
 * **목록과 상세의 앞머리를 갈라 둔다** — 하나로 묶으면 목록만 다시 부르려 해도 상세까지 함께
 * 무효화된다.
 *
 * ⭐ **이 회차부터 `all`과 `list`의 앞머리가 어긋나면 화면이 갈린다.** 취소 요청 성공 뒤
 * `documentProgressKeys.all`을 무효화해 목록과 상세를 함께 다시 부르므로, 앞머리가 갈리는 순간
 * 「취소를 올렸는데 목록·후속이 그대로인」 화면이 된다 — 단위 ①의 뮤테이션에서 등가였던 자리가
 * 여기서 감지기의 대상이 됐다(`screen.test.tsx`의 「202 뒤 목록·상세·리소스 상세를 다시 부른다」).
 */
const ALL_KEY = ['document-progress'] as const;

export const documentProgressKeys = {
  /**
   * 뿌리 키 — **취소 요청 성공 뒤 이 하나를 무효화한다.** 목록과 상세가 함께 갱신돼야
   * 「취소를 올렸는데 아직 안 올린 것으로 보이는」 화면이 생기지 않는다. 후속 때문에 막힌
   * 400에서 후속 목록을 다시 부르는 자리도 이 키를 쓴다(`screen.tsx`).
   */
  all: ALL_KEY,
  list: (query: DocumentProgressListQuery) => [...ALL_KEY, 'list', query] as const,
  /**
   * 상세 키 — **유형과 번호 둘 다** 들어간다(계약 경로가 둘을 열쇠로 쓴다).
   *
   * 번호만 쓰면 유형이 다른 같은 번호의 문서가 **한 캐시 항목을 나눠 쓴다** — 유형을 바꾼 뒤
   * 같은 번호를 고르면 앞 유형의 상세가 그대로 보이고, 그 화면은 실제로 다른 문서다.
   */
  detail: (documentTypeCode: string, documentId: number) =>
    [...ALL_KEY, 'detail', documentTypeCode, documentId] as const,
};

const fetchDocumentProgressList = async (
  client: Client,
  query: DocumentProgressListQuery,
): Promise<DocumentProgressListResult> => {
  const data = await runRequest(() =>
    client.GET('/logistics/document-progress', {
      params: { query: query as DocumentProgressQuery },
    }),
  );

  return { items: data.items.map(toDocumentProgressView), page: data.page };
};

/**
 * 조회가 성립하지 않을 때의 캐시 키 자리.
 *
 * **키에 `null`을 그대로 넣지 않는다** — 그러면 키의 모양이 성립할 때와 달라져, 「부르지 않는
 * 동안」과 「부르는 동안」이 서로 다른 캐시 항목을 가리키는지 읽기 어려워진다. 어차피 `enabled`가
 * 거짓이라 이 키로는 아무 요청도 나가지 않으며, `documentTypeCode`가 빈 문자열인 것이 곧
 * 「고른 유형이 없다」는 사실이다.
 */
const EMPTY_QUERY: DocumentProgressListQuery = { documentTypeCode: '', cancellableOnly: false };

/**
 * 고른 유형의 진행현황 목록.
 *
 * **질의가 `null`이면 부르지 않는다.** 「부를 수 있는가」의 판정은 `toListQuery` 한 곳이 하고,
 * 여기서는 그 결과를 `enabled`로 옮길 뿐이다 — `queryFn`의 가드는 그 규약이 깨졌을 때
 * **조용히 요청을 내보내지 않고 멈추게** 하는 둘째 겹이다.
 *
 * **정렬을 열지 않는다** — 계약의 이 조회에 정렬 파라미터가 없고(실측), 화면 안에서만 정렬하면
 * 쪽과 어긋난다.
 */
export const useDocumentProgressList = (
  query: DocumentProgressListQuery | null,
): UseQueryResult<DocumentProgressListResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: documentProgressKeys.list(query ?? EMPTY_QUERY),
    enabled: query !== null,
    queryFn: () => {
      if (query === null) {
        throw new Error('문서 유형을 고르기 전에는 진행현황을 조회하지 않습니다.');
      }

      return fetchDocumentProgressList(client, query);
    },
  });
};

const fetchDocumentProgressDetail = async (
  client: Client,
  selection: DetailSelection,
): Promise<DocumentProgressDetailView> => {
  const data = await runRequest(() =>
    client.GET('/logistics/document-progress/{documentTypeCode}/{documentId}', {
      params: {
        path: {
          documentTypeCode: selection.documentTypeCode as DocumentTypeCode,
          documentId: selection.documentId,
        },
      },
    }),
  );

  return toDocumentProgressDetailView(data);
};

/**
 * 고른 문서의 처리 경과와 후속 목록.
 *
 * ⭐ **목록 응답을 기다리지 않는다.** 대상은 주소에서 나오므로(`toDetailSelection`) 주소만 들고
 * 처음 그리는 경우 — 새로고침·주소 공유·뒤로가기 — 에도 이 조회가 곧바로 나간다. 고른 행에서
 * 대상을 읽으면 목록이 도착할 때까지 상세가 서지 않고, **목록이 실패하면 영영 서지 않는다.**
 *
 * **잠금 토큰을 여기서 얻지 못한다.** 이 조회의 200에는 `ETag`가 없다(실측) — 취소가 쓸 토큰은
 * 문서 리소스 상세에서만 오며, 그것이 아래 `useCancelResourceLock`이 따로 있는 이유다.
 */
export const useDocumentProgressDetail = (
  selection: DetailSelection | null,
): UseQueryResult<DocumentProgressDetailView> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: documentProgressKeys.detail(
      selection?.documentTypeCode ?? '',
      selection?.documentId ?? 0,
    ),
    enabled: selection !== null,
    queryFn: () => {
      if (selection === null) {
        throw new Error('고른 문서가 없으면 진행현황 상세를 조회하지 않습니다.');
      }

      return fetchDocumentProgressDetail(client, selection);
    },
  });
};

/**
 * 고른 문서가 **사라졌는가** — 상태 코드 404 하나로만 판정한다.
 *
 * 계약이 이 조회의 실패 응답을 404 하나만 두었다. 다른 실패(권한·서버 오류)와 갈라야 하는
 * 이유는 **할 일이 다르기 때문**이다 — 404는 다시 눌러도 같은 답이 오므로 주소에 남은 선택을
 * 정리하고 그 사실을 말해야 하고, 나머지는 「다시 시도」가 유효하다.
 *
 * ⛔ **정규화 갈래(`kind`)로 판정하지 않는다.** `normalizeApiError`는 본문에 유효한 `errors`
 * 배열이 있으면 상태와 무관하게 `validation`을 내고 **상태 코드를 버린다** — 그 갈래로 받으면
 * 404가 아닌 실패까지 「사라진 문서」로 접힌다(목록 쪽 400 판정과 같은 규율).
 */
export const isDocumentProgressNotFound = (error: unknown): boolean => {
  const apiError = toApiError(error);

  return apiError.kind === 'http' && apiError.status === 404;
};

/**
 * 이 화면이 **덮지 않는 문서 유형**인가 — **상태 코드 400 하나로만 판정한다.**
 *
 * 계약이 이 조회의 실패 응답을 400 하나만 두었고 그 설명에 「덮지 않는 문서 유형이면 여기로
 * 온다」라고 적었다. 그래서 400을 일반 조회 실패와 갈라야 한다 — 「불러오지 못했습니다」로
 * 뭉개면 사용자가 「다시 시도」를 되풀이하는데 몇 번을 눌러도 같은 답이 온다.
 *
 * ⛔ **정규화 갈래(`kind`)로 판정하지 않는다.** `normalizeApiError`는 본문에 유효한 `errors`
 * 배열이 있으면 **상태와 무관하게** `validation`을 내고 **상태 코드를 버린다**. 계약은 403·404·
 * 500에도 같은 `ErrorResponse{ errors }`를 쓰므로, `kind === 'validation'`을 이 갈래로 받으면
 * 세 가지가 한꺼번에 무너진다 — 권한 없음이 「덮지 않는 문서 유형」으로 보이고, 서버가 준
 * 메시지가 버려지고, **재시도가 유효한 유일한 갈래(500)에서 「다시 시도」가 사라진다.**
 *
 * 그래서 `validation`은 **일반 갈래로 보낸다.** 계약의 400 설명도 「검증 실패 — 덮지 않는 문서
 * 유형**이면** 여기로 온다」이지 400이 곧 유형 오류라는 뜻이 아니어서, 항목 사유가 실려 온
 * 400은 그 사유를 그대로 내는 편이 더 정확하다(`describeLoadError`의 `validation` 갈래).
 *
 * ⚠ **남는 한계**: 상태를 잃지 않는 정규화가 있어야 「400이면서 항목 사유가 실린」 응답까지
 * 이 갈래로 받을 수 있다. 그 고침은 `packages/api-client` 소관이라 이 슬라이스에서 하지 않는다.
 */
export const isUnsupportedDocumentType = (error: unknown): boolean => {
  const apiError = toApiError(error);

  return apiError.kind === 'http' && apiError.status === 400;
};

/* ─────────────────────────────────────────────────────────────────────────────
 * 취소 축 — 잠금 토큰과 취소 요청 상신
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * 취소 조작의 대상. **리소스와 번호가 함께여야 성립한다.**
 *
 * 리소스는 유형 표가 정하고(`cancelResourceOf`) 번호는 주소가 정한다 — 둘 중 하나라도 없으면
 * 이 화면에는 취소할 대상이 없다.
 */
export interface CancelTarget {
  resource: CancelResource;
  documentId: number;
}

const CANCEL_RESOURCE_KEY = ['document-cancel-resource'] as const;

/**
 * 리소스 상세(잠금 토큰) 쪽의 캐시 키.
 *
 * **진행현황 키와 앞머리를 갈라 둔다** — 다른 자원이고 역할도 다르다. 겹치면 진행현황만 다시
 * 부르려 해도 토큰 조회까지 끌려가고, 그 반대도 마찬가지다.
 *
 * **리소스와 번호가 함께 열쇠다** — 번호만 쓰면 리소스가 다른 같은 번호의 문서가 한 캐시 항목을
 * 나눠 쓴다. 그것은 실제로 **다른 문서의 잠금 토큰**이며, 그 토큰으로 쓰기를 보내면 남의 문서를
 * 상대로 낙관적 잠금을 건다.
 */
export const cancelResourceKeys = {
  /**
   * 뿌리 키 — **취소 요청 성공 뒤 이 하나를 무효화한다.** 상신은 문서의 `version_no`를 올리므로
   * 다시 부르지 않으면 다음 쓰기가 **낡은 토큰**으로 나가 409가 된다(전례 `disposal-issue`가
   * 상신 200에 `ETag`가 없어 같은 처리를 한다).
   */
  all: CANCEL_RESOURCE_KEY,
  detail: (resource: CancelResource, documentId: number) =>
    [...CANCEL_RESOURCE_KEY, resource, documentId] as const,
};

/**
 * 대상이 없을 때 캐시 키가 앉는 자리.
 *
 * **키의 모양을 성립할 때와 같게 둔다**(목록 쪽 `EMPTY_QUERY`와 같은 규율) — 모양이 달라지면
 * 「부르지 않는 동안」과 「부르는 동안」이 서로 다른 캐시 항목을 가리키는지 읽기 어려워진다.
 * 번호 `0`은 이 화면의 어떤 대상도 될 수 없고(주소 판정이 1 이상만 받는다) `enabled`가 거짓이라
 * 이 키로는 아무 요청도 나가지 않는다.
 *
 * ⛔ **이 메움은 캐시 키에만 쓴다.** 쓰기의 `etagPath`와 경로 조각에는 없는 값을 메우지 않는다 —
 * 거기서 메우면 `…/0:request-cancel`이 **실제로 나갈 수 있는 모양**이 된다.
 */
const NO_CANCEL_TARGET: CancelTarget = { resource: 'goods-receipts', documentId: 0 };

/**
 * ⭐ **잠금 토큰을 꺼낼 경로 — 이 화면에서 가장 조용히 틀릴 수 있는 자리다.**
 *
 * 토큰 보관소는 **응답이 온 URL 경로**를 열쇠로 쓴다(`packages/api-client/src/client.ts`).
 * 그래서 이 문자열이 아래 상세 조회가 실제로 두드리는 주소와 **글자 하나까지 같아야** 한다 —
 * 어긋나면 보관소가 늘 비어 있고, 공통 쓰기 훅은 「최신 정보를 불러오는 중입니다」를 세운 채
 * **요청을 아예 보내지 않는다.** 증상이 「눌러도 아무 일이 없다」라 알아채기 어렵다.
 */
export const cancelResourceDetailPath = (resource: CancelResource, documentId: number): string =>
  `/logistics/${resource}/${String(documentId)}`;

/**
 * 리소스별 오퍼레이션 묶음.
 *
 * ⭐ **리소스 세 값을 고르는 `switch`가 이 화면에 하나뿐이다.** `openapi-fetch`가 경로를 리터럴
 * 타입으로 요구해 오퍼레이션마다 주소를 적어야 하는데, 그 갈림을 여기 한 곳에 모아 두면
 * ① 값이 늘 때 고칠 자리가 하나이고 ② 「어느 리소스로 나가는가」를 재는 감지기의 대상이 하나다.
 * ⭐ **취소 실행(단위 ④)이 이 묶음에 오퍼레이션을 더했다** — 앞 회차가 예고한 대로 **새 `switch`를
 * 만들지 않았다.** 세 리소스 × 세 오퍼레이션이 한 표로 읽힌다.
 *
 * ⛔ **유형 코드로 분기하지 않는다.** 유형↔리소스는 `document-types.ts`의 표가 정하고, 여기서는
 * 이미 정해진 리소스를 받아 주소로 옮기기만 한다 — 유형에서 리소스를 지어내는 분기가 곧
 * 금지된 관계표다(공유계약 A-10 보강).
 */
interface CancelResourceApi {
  /**
   * 잠금 토큰을 얻는 상세 조회.
   *
   * **본문을 쓰지 않는다** — 토큰은 `ETag` 응답 헤더로 오고 보관소가 경로를 열쇠로 갖는다.
   * 본문까지 화면에 들이면 입고·출고 상세의 표시 규약을 이 화면이 함께 떠안게 된다.
   */
  fetchDetail: () => Promise<ApiCallResult<unknown>>;
  /** 취소 요청 상신 — 본문은 사유 하나이고 헤더 둘이 필수다. */
  requestCancel: (
    body: ApprovalRequestCreate,
    headers: WriteHeaders,
  ) => Promise<ApiCallResult<ApprovalRequestRef>>;
  /**
   * ⛔ **취소 실행** — 원장에서 수량을 되돌리는, 화면에서 되돌릴 수 없는 쓰기다.
   *
   * ⭐ **본문이 없다**(계약이 `requestBody`를 두지 않았다 — 완료 조건 C4-11). 보낼 값이 없다는
   * 사실이 곧 이 조작의 성질이다: 무엇을 되돌릴지는 이미 승인된 요청이 정했고, 지금 남은 것은
   * 「그것을 지금 실행한다」는 사람의 확인뿐이다. 헤더 둘은 그대로 필수다.
   */
  executeCancel: (headers: WriteHeaders) => Promise<ApiCallResult<CancelResultResponse>>;
}

const cancelResourceApiOf = (
  client: Client,
  resource: CancelResource,
  documentId: number,
): CancelResourceApi => {
  /*
   * 헤더는 공통 훅이 만들어 준다. `If-Match`가 비어 있는 모양은 여기까지 오지 않는다 —
   * 훅이 토큰을 못 찾으면 요청을 만들지 않고 멈추기 때문이다(전례와 같은 형태).
   */
  const headerOf = (headers: WriteHeaders) => ({
    'Idempotency-Key': headers['Idempotency-Key'],
    'If-Match': headers['If-Match'] ?? '',
  });

  switch (resource) {
    case 'goods-receipts':
      return {
        fetchDetail: () =>
          client.GET('/logistics/goods-receipts/{goodsReceiptId}', {
            params: { path: { goodsReceiptId: documentId } },
          }),
        requestCancel: (body, headers) =>
          client.POST('/logistics/goods-receipts/{goodsReceiptId}:request-cancel', {
            params: { path: { goodsReceiptId: documentId }, header: headerOf(headers) },
            body,
          }),
        executeCancel: (headers) =>
          client.POST('/logistics/goods-receipts/{goodsReceiptId}:cancel', {
            params: { path: { goodsReceiptId: documentId }, header: headerOf(headers) },
          }),
      };
    case 'inbound-receipts':
      return {
        fetchDetail: () =>
          client.GET('/logistics/inbound-receipts/{inboundReceiptId}', {
            params: { path: { inboundReceiptId: documentId } },
          }),
        requestCancel: (body, headers) =>
          client.POST('/logistics/inbound-receipts/{inboundReceiptId}:request-cancel', {
            params: { path: { inboundReceiptId: documentId }, header: headerOf(headers) },
            body,
          }),
        executeCancel: (headers) =>
          client.POST('/logistics/inbound-receipts/{inboundReceiptId}:cancel', {
            params: { path: { inboundReceiptId: documentId }, header: headerOf(headers) },
          }),
      };
    case 'goods-issues':
      return {
        fetchDetail: () =>
          client.GET('/logistics/goods-issues/{goodsIssueId}', {
            params: { path: { goodsIssueId: documentId } },
          }),
        requestCancel: (body, headers) =>
          client.POST('/logistics/goods-issues/{goodsIssueId}:request-cancel', {
            params: { path: { goodsIssueId: documentId }, header: headerOf(headers) },
            body,
          }),
        executeCancel: (headers) =>
          client.POST('/logistics/goods-issues/{goodsIssueId}:cancel', {
            params: { path: { goodsIssueId: documentId }, header: headerOf(headers) },
          }),
      };
  }
};

/**
 * 잠금 토큰을 확보했다는 사실.
 *
 * **본문이 아니라 대상을 담는다** — 이 조회의 목적은 표시가 아니라 토큰이고, 토큰은 화면이
 * 만질 수 없는 곳(보관소)에 앉는다. 그래도 값을 내는 이유는 ① `undefined`를 내는 조회를 TanStack
 * Query가 받지 않고 ② **어느 대상의 토큰이 준비됐는지**를 화면이 견줄 수 있어야 하기 때문이다.
 */
export type CancelResourceLock = CancelTarget;

const fetchCancelResourceLock = async (
  client: Client,
  target: CancelTarget,
): Promise<CancelResourceLock> => {
  await runRequest(() =>
    cancelResourceApiOf(client, target.resource, target.documentId).fetchDetail(),
  );

  return target;
};

/**
 * 고른 문서의 **잠금 토큰**을 확보한다.
 *
 * ⭐ **이 200이 오기 전에는 취소 요청을 올릴 수 없다.** 계약이 `If-Match`를 필수로 두었고 토큰의
 * 원천이 이 조회뿐이라, 화면이 버튼을 먼저 열면 눌러도 아무 일이 없는 자리가 생긴다.
 *
 * ⛔ **`cancellable`로 이 조회를 막지 않는다.** 취소 요청이 진행 중이면 서버가 `cancellable`을
 * 거짓으로 내리는데(`CANCEL_IN_PROGRESS`), 그때가 바로 **취소 실행**이 토큰을 필요로 하는
 * 순간이다(단위 ④ · 계획 §5-2). 여기서 막으면 그 회차에 실행 버튼이 영영 서지 않는다.
 *
 * **취소 경로가 없는 유형에서는 나가지 않는다** — 대상이 `null`이면 부를 주소 자체가 없다.
 */
export const useCancelResourceLock = (
  target: CancelTarget | null,
): UseQueryResult<CancelResourceLock> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: cancelResourceKeys.detail(
      (target ?? NO_CANCEL_TARGET).resource,
      (target ?? NO_CANCEL_TARGET).documentId,
    ),
    enabled: target !== null,
    queryFn: () => {
      if (target === null) {
        throw new Error('취소 대상이 없으면 잠금 토큰을 조회하지 않습니다.');
      }

      return fetchCancelResourceLock(client, target);
    },
  });
};

/**
 * 리소스 상세를 **볼 권한이 없는가**(403).
 *
 * ⚠ 계약은 이 조회의 실패로 404만 적었다. 403은 계약 밖(권한 계층)에서 오는 갈래이며, 갈라야
 * 하는 이유는 **할 일이 다르기 때문**이다 — 같은 권한으로 다시 불러도 같은 답이 오므로
 * 「다시 시도」를 내면 사용자를 헛돌게 하고 해야 할 일(담당자 문의)을 가린다.
 *
 * ⛔ **정규화 갈래(`kind`)가 아니라 상태 코드로 판정한다** — 목록·상세 쪽과 같은 규율이다.
 */
export const isCancelResourceForbidden = (error: unknown): boolean => {
  const apiError = toApiError(error);

  return apiError.kind === 'http' && apiError.status === 403;
};

/**
 * 리소스 상세가 **없는가**(404).
 *
 * 계약이 이 조회의 실패 응답으로 적은 하나다. 「다시 시도」를 남기는 이유는 권한과 달리
 * **다시 부르면 달라질 수 있기 때문**이다 — 방금 만들어진 문서가 아직 보이지 않는 순간이 있고,
 * 유형↔리소스 표가 어긋난 경우라면 표를 고친 뒤 같은 자리에서 다시 시도하게 된다.
 *
 * ⛔ 진행현황 상세의 404와 **다르게 다룬다**. 그쪽은 고른 문서가 사라진 것이라 주소를 정리하지만,
 * 여기서 주소를 정리하면 **읽을 수 있는 진행현황까지 함께 닫힌다** — 실패한 것은 취소 축뿐이다.
 */
export const isCancelResourceNotFound = (error: unknown): boolean => {
  const apiError = toApiError(error);

  return apiError.kind === 'http' && apiError.status === 404;
};

/* ─────────────────────────────────────────────────────────────────────────────
 * 승인 진행 축 — 취소 요청이 어디까지 왔는가
 * ────────────────────────────────────────────────────────────────────────── */

const APPROVAL_KEY = ['document-progress-approval'] as const;

/**
 * 승인 요청 쪽의 캐시 키.
 *
 * **진행현황·리소스 상세와 앞머리를 갈라 둔다** — 다른 계약(`/app/**`)의 자원이고 이 화면은
 * 그것을 읽기만 한다. 겹치면 한쪽만 다시 부르려 해도 다른 쪽이 끌려간다.
 *
 * ⭐ **이 키가 생기면서 무효화 셋이 완성된다.** 앞 회차(단위 ③)는 상신 성공 뒤 진행현황과
 * 리소스 상세만 무효화했다 — 상신으로 **생기는 것**이 그 승인 요청인데 **읽는 조회가 없어**
 * 무효화할 대상이 없었기 때문이다. 그 조회가 이 회차에 생겼으므로, 예고한 대로 두 쓰기의
 * 무효화 목록에 이 뿌리를 **함께** 더한다.
 */
export const approvalKeys = {
  /**
   * 뿌리 키 — **두 쓰기의 성공 뒤 이 하나를 무효화한다.** 상신은 승인 요청을 만들고, 실행은
   * 그 요청을 끝낸다 — 다시 부르지 않으면 「실행했는데 아직 결재 중이라고 말하는」 화면이 남는다.
   */
  all: APPROVAL_KEY,
  detail: (approvalRequestId: number) => [...APPROVAL_KEY, 'detail', approvalRequestId] as const,
};

/**
 * 부를 수 없을 때 캐시 키가 앉는 자리.
 *
 * **키의 모양을 성립할 때와 같게 둔다**(`EMPTY_QUERY`·`NO_CANCEL_TARGET`과 같은 규율).
 * `enabled`가 거짓이라 이 키로는 아무 요청도 나가지 않는다.
 *
 * ⛔ **이 메움은 캐시 키에만 쓴다.** 요청 경로에는 메우지 않는다 — 거기서 메우면
 * `/app/approval-requests/0`이 **실제로 나갈 수 있는 모양**이 되어 남의 요청을 열거나 헛돈다.
 */
const NO_APPROVAL_REQUEST_ID = 0;

/**
 * 취소 요청의 **승인 진행** — 승인 요청 상세 하나로 온다(계약이 `steps`를 함께 내린다).
 *
 * **문서가 준 식별자로 곧바로 부른다.** 승인 요청 **목록**을 대상 유형·대상 번호로 걸러 찾는
 * 길은 지금 성립하지 않는다 — 대상 유형 코드의 값 목록이 확정되지 않아 조건을 실을 수 없고,
 * 대상 번호만 실으면 유형이 다른 문서의 요청이 섞인다.
 *
 * ⭐ **판정을 인자로 받는다**(완료 조건 C4-1·C4-2). 「부를 수 있는가」는 `approval-progress.ts`의
 * `readSubmission` 한 곳이 정하고 이 훅은 그 결과를 나른다 — 여기서 다시 판정하면 두 자리가
 * 갈리고, 갈리는 순간 `/app/approval-requests/0` 같은 요청이 나간다.
 *
 * **응답의 `ETag`를 쓰지 않는다** — 이 화면은 승인 요청에 쓰기를 하지 않는다. 결재(승인·반려)는
 * 결재함(W-CO-09)이 소유한다.
 */
export const useCancelApprovalRequest = (
  submission: Submission,
): UseQueryResult<ApprovalRequestDetailResponse> => {
  const { client } = useApiClient();
  const approvalRequestId = submission.kind === 'submitted' ? submission.approvalRequestId : null;

  return useQuery({
    queryKey: approvalKeys.detail(approvalRequestId ?? NO_APPROVAL_REQUEST_ID),
    enabled: approvalRequestId !== null,
    queryFn: () => {
      if (approvalRequestId === null) {
        throw new Error('조회할 수 있는 승인 요청이 없으면 승인 진행을 조회하지 않습니다.');
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
 * 이 승인 요청의 진행을 **볼 권한이 없는가**(403).
 *
 * 계약이 「승인자도 상신자도 아니면 403」이라 적었다. 갈라야 하는 이유는 **할 일이 다르기
 * 때문**이다 — 같은 권한으로 다시 불러도 같은 답이 오므로 「다시 시도」를 내면 사용자를 헛돌게
 * 하고 해야 할 일(담당자 문의)을 가린다.
 *
 * ⛔ **정규화 갈래(`kind`)가 아니라 상태 코드로 판정한다** — 이 슬라이스의 다른 판정과 같은 규율.
 */
export const isApprovalForbidden = (error: unknown): boolean => {
  const apiError = toApiError(error);

  return apiError.kind === 'http' && apiError.status === 403;
};

/**
 * 그 승인 요청이 **없는가**(404). 문서는 값을 가리키는데 요청이 보이지 않는 자리다.
 *
 * 「다시 시도」를 남기는 이유는 권한과 달리 **다시 부르면 달라질 수 있기 때문**이다 —
 * 방금 올린 요청이 승인 축에 아직 안 보이는 순간이 실재한다.
 */
export const isApprovalNotFound = (error: unknown): boolean => {
  const apiError = toApiError(error);

  return apiError.kind === 'http' && apiError.status === 404;
};

export interface RequestDocumentCancelOptions {
  /** 어느 계약 경로로 나가는가. 유형 표가 정한다 — `null`이면 이 유형에 취소 경로가 없다. */
  resource: CancelResource | null;
  /** 어느 문서인가. 주소가 정한다. */
  documentId: number | null;
  onSuccess: (data: ApprovalRequestRef) => void;
}

/**
 * **취소를 승인에 올린다**(M-1) — 이 회차의 유일한 쓰기다.
 *
 * **`If-Match`가 필수다**(계약). 토큰은 **늘 리소스 상세 경로**에서 꺼낸다
 * (`cancelResourceDetailPath`) — 액션 경로(`…:request-cancel`)로 꺼내면 보관소가 언제나 비어
 * 있어 취소가 통째로 멈춘다.
 *
 * **성공 뒤 세 뿌리를 무효화한다.**
 *
 * | 뿌리 | 왜 |
 * | --- | --- |
 * | 진행현황(목록·상세) | 문서 상태가 취소요청으로 옮겨 가고 `cancellable`·`cancelBlockedReasonCode`가 달라진다. 다시 부르지 않으면 「올렸는데 아직 안 올린 것으로 보이는」 화면이 남는다 |
 * | 리소스 상세(토큰) | 상신이 `version_no`를 올린다. **202 응답에 `ETag`가 없어**(계약) 다시 부르지 않으면 다음 쓰기가 낡은 토큰으로 나가 409다 |
 * | **승인 진행** | ⭐ 상신으로 **생기는 것**이 그 승인 요청이다. 이 회차에 읽는 조회가 생겨(`useCancelApprovalRequest`) 무효화할 대상이 실재하게 됐다 — 앞 회차가 「조회와 **함께** 더한다」고 예고한 자리다 |
 *
 * **응답이 내부 식별자 하나뿐이다**(`ApprovalRequestRef`) — 화면에 낼 번호가 없다(omf-mes#44).
 * 성공 안내는 「올렸습니다」까지만 말한다.
 */
export const useRequestDocumentCancel = (
  options: RequestDocumentCancelOptions,
): MasterWriteResult<ApprovalRequestCreate> => {
  const { client } = useApiClient();
  const { resource, documentId } = options;

  return useMasterWrite<ApprovalRequestCreate, ApprovalRequestRef>({
    request: (body, headers) => {
      /*
       * ⛔ **없는 값을 0으로 메우지 않는다.**
       *
       * `etagPath`가 `null`이 되면 공통 훅은 그것을 「잠금이 필요 없다」로 읽어 요청을 **그대로
       * 내보낸다** — 대체값을 두면 `…/0:request-cancel`이 실제로 나갈 수 있는 모양이 되고,
       * 리소스까지 메우면 **남의 문서에 취소를 상신하는** 요청이 된다. 지금은 호출부가 그렇게
       * 부르지 않지만, 그 사실에 기대는 대신 **여기서 멈춘다**(조회 훅의 가드와 같은 형태).
       */
      if (resource === null || documentId === null) {
        throw new Error('취소할 문서를 고르기 전에는 취소 요청을 올리지 않습니다.');
      }

      return cancelResourceApiOf(client, resource, documentId).requestCancel(body, headers);
    },
    etagPath:
      resource === null || documentId === null
        ? null
        : cancelResourceDetailPath(resource, documentId),
    invalidateKeys: [documentProgressKeys.all, cancelResourceKeys.all, approvalKeys.all],
    knownFields: CANCEL_FORM_FIELDS,
    onSuccess: options.onSuccess,
  });
};

export interface ExecuteDocumentCancelOptions {
  /** 어느 계약 경로로 나가는가. 유형 표가 정한다 — `null`이면 이 유형에 취소 경로가 없다. */
  resource: CancelResource | null;
  /** 어느 문서인가. 주소가 정한다. */
  documentId: number | null;
  onSuccess: (data: CancelExecutionView) => void;
}

/**
 * ⛔ **취소를 실행한다**(M-2) — **원장에서 수량을 되돌리는, 화면에서 되돌릴 수 없는 쓰기다.**
 *
 * 계약이 그렇게 적었다: 전기된 문서는 원장에 역트랜잭션을 만들고, 전기 전이었으면 상태만 바뀐다.
 * 이 화면에는 **취소를 취소하는 경로가 없다** — 그래서 확인 창이 그 사실을 먼저 말한다.
 *
 * ⭐ **본문이 없다**(완료 조건 C4-11). 계약이 `requestBody`를 두지 않았고, 무엇을 되돌릴지는
 * 이미 승인된 요청이 정했다. 그래서 이 훅의 변수 타입이 `void`다 — 보낼 값이 **타입 수준에서**
 * 없다. `If-Match`와 멱등 키는 그대로 필수다.
 *
 * ⭐ **잠금 토큰은 상신과 **같은 경로**에서 꺼낸다**(`cancelResourceDetailPath`). 액션 경로
 * (`…:cancel`)로 꺼내면 보관소가 언제나 비어 있어 눌러도 아무 일이 없다.
 *
 * ⭐ **성공 뒤 세 뿌리를 전부 무효화한다** — 상태(진행현황)·토큰(리소스 상세)·승인 진행이
 * **동시에** 달라지는 유일한 조작이다. 하나라도 빠지면 실행이 끝난 화면이 실행 전 사실을 계속
 * 말한다.
 *
 * ⛔ **인라인으로 낼 칸이 없다**(`knownFields`가 빈 배열이다). 본문이 없으니 서버가 필드 오류를
 * 보내도 붙일 칸이 없다 — 전부 배너로 올려 **어디에도 표시되지 않는 오류**가 생기지 않게 한다.
 */
export const useExecuteDocumentCancel = (
  options: ExecuteDocumentCancelOptions,
): MasterWriteResult<void> => {
  const { client } = useApiClient();
  const { resource, documentId } = options;

  return useMasterWrite<void, CancelResultResponse>({
    request: (_variables, headers) => {
      /*
       * ⛔ **없는 값을 0으로 메우지 않는다** — 상신 쪽과 같은 규율이고, 여기서는 대가가 더 크다.
       * `etagPath`가 `null`이면 공통 훅이 「잠금이 필요 없다」로 읽어 요청을 **그대로 내보내는데**,
       * 이 요청은 원장에서 수량을 되돌린다. 리소스까지 메우면 **남의 문서를 되돌리는** 요청이 된다.
       */
      if (resource === null || documentId === null) {
        throw new Error('취소할 문서를 고르기 전에는 취소를 실행하지 않습니다.');
      }

      return cancelResourceApiOf(client, resource, documentId).executeCancel(headers);
    },
    etagPath:
      resource === null || documentId === null
        ? null
        : cancelResourceDetailPath(resource, documentId),
    invalidateKeys: [documentProgressKeys.all, cancelResourceKeys.all, approvalKeys.all],
    knownFields: [],
    onSuccess: (data) => {
      options.onSuccess(toCancelExecutionView(data));
    },
  });
};
