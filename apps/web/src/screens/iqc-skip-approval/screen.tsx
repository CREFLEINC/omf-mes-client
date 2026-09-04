import { Breadcrumb, Button, EmptyState, PageHeader, SkeletonText, useToast } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { useApiClient } from '../../patterns/api-context';
import { SaveErrorBanner, useMasterWrite } from '../../patterns/master';
import { toApiError } from '../../patterns/request';
import { ApproveDialog } from './approve-dialog';
import {
  IQC_SKIP_APPROVAL_TYPE_CODE,
  PLACEHOLDER_REQUEST_STATUS_CODES,
  toCodeOptions,
  typePendingNote,
} from './code-options';
import {
  DECISION_COMMENT_FIELD,
  DECISION_KNOWN_FIELDS,
  toApproveBody,
  toRejectBody,
  type DecisionKind,
} from './decision-draft';
import { DecisionPane } from './decision-pane';
import {
  EMPTY_FILTERS,
  PENDING_ONLY_DEFAULT,
  clearFilter,
  readFilters,
  readPage,
  readPendingOnly,
  readSelectedRequestId,
  toRequestListQuery,
  toSearchParams,
  toSelectionSearchParams,
  withoutSelection,
  type FilterChipKey,
} from './filters';
import { LoadErrorBanner } from './load-error-banner';
import { toPageView } from './pagination';
import { REJECTION_DECISION_CODES, toRequestProgressView } from './progress';
import { ProgressPane } from './progress-pane';
import {
  iqcSkipApprovalKeys,
  requestDetailPath,
  useRequestDetail,
  useRequestList,
} from './queries';
import { RejectDialog } from './reject-dialog';
import { RequestDetailPane } from './request-detail-pane';
import { RequestFilterBar } from './request-filter-bar';
import { RequestListPane } from './request-list-pane';
import { SCREEN_ROUTES } from './screen-routes';
import { describeTargetName, judgeTargetOpen } from './target';
import { TargetPane } from './target-pane';
import {
  toDecisionSubject,
  toRequestDetailView,
  toRequestRow,
  type ApprovalDecision,
  type ApprovalRejection,
  type ApprovalRequest,
  type ApprovalRequestDetail,
  type RequestFilters,
} from './types';

const t = messages.iqcSkipApproval;

/** 참조가 매 렌더 새로 만들어지면 이 값을 의존성에 둔 계산이 멈추지 않는다. */
const EMPTY_ITEMS: ApprovalRequest[] = [];

/**
 * W-01-02 컨테이너 — **내가 판정할 긴급 IQC 생략 요청을 찾아 고르는 목록**이다.
 *
 * 조회 전용이라 편집 폼이 없다. 배치는 **세로 스택**이다 — 조건 줄 + 목록 + 아래 구획.
 * 2단(좌 목록 / 우 편집)을 쓰지 않는다: 마스터 형은 **고른 것을 고치는** 화면의 배치인데
 * 이 화면에는 고쳐 넣는 폼이 없고, 목록이 **여섯 열에 최소 928px**을 써 좌 칸(약 370px)에
 * 들어가지도 않는다.
 *
 * 조회 조건·「결재 대기만 보기」·쪽·고른 요청은 전부 주소가 소유한다 —
 * 새로고침·뒤로가기·공유가 같은 결과를 낸다.
 *
 * **이 회차가 결재를 세우고 화면을 연다.** 대상의 수량·처리 경과는 그 값을 얻는 길이
 * 계약에 정해진 뒤 별건으로 붙는다(질문 게시 중) — 그것이 없다고 결재를 미루지 않는 이유는
 * 결재 가능 여부의 정본이 서버가 준 `isMyTurn` 하나이기 때문이다.
 *
 * ---
 *
 * **G1 — 고정 승인 유형으로 좁힌다.**
 *
 * 이 화면은 모든 목록 요청에 `approvalTypeCode=IQC_SKIP`을 싣는다. 목록·상세·확인 창에도
 * 유형 코드를 표시해 서버 응답이 요청 조건과 어긋난 경우 사용자가 확인할 수 있게 한다.
 *
 * | # | 방어 | 어디에 |
 * | :-: | --- | --- |
 * | ① | 고정 유형을 요청 조건에 싣는다 | `code-options.ts` · `filters.ts` |
 * | ② | 목록의 **승인 유형 열**(코드 그대로) | `request-list-pane.tsx` |
 * | ③ | 결재 확인 창의 **대상 요약 재확인**(다섯 값) | `decision-subject.tsx` |
 *
 * ---
 *
 * **단계 전이 표 — 화면이 어느 단계에 있는지와 그 근거.**
 *
 * | 단계 | 화면이 이 단계를 아는 근거 | 보이는 것 | 할 수 있는 것 | 주소 |
 * | :-: | --- | --- | --- | --- |
 * | **S0** 고르기 전 | `rq`가 없다 | 조건 줄 · 목록 · 쪽 · 「고르세요」 | 조회 · 초기화 · 대기 전환 · 쪽 이동 · 고르기 | `?st&from&to&q&pd&page` |
 * | **S1** 요청을 골랐다 | `rq`가 있고 **상세가 200** | 위 + 요청 정보 · 대상 · 결재 진행 · 결재 구획 | 위 + 대상 열기 · 의견 적기 · 승인 · 반려 | `+&rq` |
 * | **S2** 그 요청이 없다 | 상세가 **404** | 안내 「찾을 수 없습니다」 | `rq`를 주소에서 정리한다 | `rq` 제거 |
 * | **S3** 그 요청을 볼 권한이 없다 | 상세가 **403** | 안내 「권한이 없습니다」 · **다시 시도 없음** | `rq`를 **정리하지 않는다** | `rq` 유지 |
 *
 * **S1의 「할 수 있는 것」이 이 회차에 다 찼다** — 앞 회차의 읽기 넷에 의견·승인·반려가 붙었다.
 *
 * S2와 S3를 가르는 이유: 계약이 「승인자도 상신자도 아니면 403」이라고 적었다 —
 * 주소를 받아 들어온 사용자가 남의 요청을 가리키는 일이 실제로 있다. 404는 「없는 것」이라
 * 주소를 정리하지만, 403은 **있는데 내 것이 아닌 것**이라 정리하면 무엇을 열려 했는지 잃는다.
 *
 * **「고른 것」과 「보이는 것」은 다르다.** `rq`가 주소에 서 있다고 그 요청이 목록에 있는 것도,
 * 볼 수 있는 것도 아니다 — 그 판정을 **읽는 자리(상세 조회)가 한다.** 목록을 훑어 「없는
 * 번호면 지운다」로 가르지 않는 이유: 목록은 지금 보는 쪽·조건에 걸린 일부라, 확인칸을 켜
 * 둔 사용자에게서 끝난 요청의 선택을 빼앗게 된다.
 */
export const IqcSkipApprovalScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  /**
   * **주소 키의 수명 — 무엇이 바뀔 때 무엇을 비우는가.**
   *
   * 「비운다」와 「비우지 않는다」를 이 표 한 곳에 모은다 — 규칙이 흩어지면 한쪽만 고쳐져
   * 비대칭이 생긴다(확인칸을 바꾸면 선택이 풀리는데 쪽을 옮기면 안 풀리는 식).
   *
   * | # | 조작 | 조건 4종 | `pd` | `page` | `rq` | **의견 초안** | **열린 창** | **실패 배너** |
   * | :-: | --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
   * | 1 | 조건 변경·조회 | 바뀐다 | 유지 | **첫 쪽** | **비운다** | **비운다** | **닫는다** | **비운다** |
   * | 2 | 초기화 | **비운다** | **켠다** | 첫 쪽 | 비운다 | 비운다 | 닫는다 | 비운다 |
   * | 3 | **「결재 대기만 보기」 전환** | 유지 | 바뀐다 | **첫 쪽** | **비운다** | 비운다 | 닫는다 | 비운다 |
   * | 4 | 쪽 이동 | 유지 | 유지 | 옮긴 쪽 | **비운다** | 비운다 | 닫는다 | 비운다 |
   * | 5 | 요청 고르기·해제 | 유지 | 유지 | **유지** | 넣고 뺀다 | **비운다** | 닫는다 | 비운다 |
   * | 6 | **상세가 404** | 유지 | 유지 | 유지 | **비운다** | 비운다 | 닫는다 | 비운다 |
   * | 7 | **상세가 403** | 유지 | 유지 | 유지 | **유지** | 유지 | **닫는다** | 유지 |
   * | 8 | 의견 입력 | 유지 | 유지 | 유지 | 유지 | 바뀐다 | 유지 | **유지** |
   * | 9 | 목록·상세·**대상 처리 현황 응답 도착** | 유지 | 유지 | 유지 | 유지 | **건드리지 않는다** | 유지 | 유지 |
   * | 10 | **다시 조회**(새로고침) | 유지 | 유지 | 유지 | 유지 | **유지** | 유지 | 유지 |
   * | 11 | 창 열기 | 유지 | 유지 | 유지 | 유지 | **유지** | **연다** | **유지** |
   * | 12 | 창 닫기(취소·Escape·스크림) | 유지 | 유지 | 유지 | 유지 | **유지** | **닫는다** | **유지** |
   * | 13 | **승인·반려 성공** | 유지 | 유지 | 유지 | **유지** | 비운다 | **닫는다** | 비운다 |
   * | 14 | 승인·반려 실패 | 유지 | 유지 | 유지 | 유지 | **유지** | **닫는다** | **세운다** |
   * | 15 | **전송 중** | 잠긴다 | 잠긴다 | 잠긴다 | 잠긴다 | 잠긴다 | 유지 | 유지 |
   * | 16 | **상세를 더는 읽을 수 없다**(403·500·재조회 실패) | 유지 | 유지 | 유지 | 유지 | 유지 | **닫는다** | 유지 |
   * | 17 | **대상 처리 현황 조회 실패** | 유지 | 유지 | 유지 | 유지 | **유지** | **유지** | **유지** |
   *
   * **17행 말고 전부 이 회차에 섰다.** 17행이 남은 것은 대상 처리 현황 조회가 아직 없기
   * 때문이며(그 값을 얻는 길이 계약에 정해지지 않았다), 그 조회가 붙는 회차가 이 행을 맡는다.
   * 표를 통째로 적어 두는 이유는 **표에 오르지 않은 상태가 규칙이 닿지 않는 사각**이 되기
   * 때문이며, 열여덟째 조작이 생기면 규칙을 정하기 전에 이 표에 행부터 더한다.
   *
   * **왜 이렇게 정했는가**
   *
   * - **1·3·4행이 `rq`를 비우는 이유**: 조건·범위·쪽이 바뀌면 보이는 행이 달라진다. 남겨 두면
   *   아래 구획이 **목록에 없는 요청**을 가리킨 채 열려 있고, 그것이 어디서 왔는지 알 수 없다.
   * - **6행이 `rq`를 비우는 이유**: 404는 「없는 것」이다. 남겨 두면 새로고침·공유가 같은
   *   빈자리로 되돌아오고, 그 자리에서 다시 404가 나 같은 정리가 되풀이된다.
   * - **7행이 비우지 않는 이유**: 403은 **있는데 내 것이 아닌 것**이다. 지우면 사용자가
   *   무엇을 열려 했는지 잃는다.
   * - **2행이 확인칸을 켜는 이유**: 「초기화」는 **화면을 처음 상태로** 되돌리는 것이다.
   *   확인칸만 남겨 두면 조건은 비었는데 범위는 사용자가 고친 채인 어중간한 자리가 된다.
   * - **3행이 조건을 유지하는 이유**: 확인칸은 「어디까지 볼 것인가」이고 조건은 「무엇인가」다.
   *   범위를 넓혔다고 방금 좁힌 조건을 버리면 사용자가 같은 조건을 다시 친다.
   * - **5행이 쪽을 유지하는 이유**: 고르는 것은 보이는 행을 바꾸지 않는다. 첫 쪽으로 튀면
   *   사용자가 3쪽에서 고른 요청을 보는 동안 목록은 1쪽이 된다.
   * - **10행이 아무것도 비우지 않는 이유**: 새로고침은 **같은 조회를 다시 하는 것**이다.
   *   무언가를 비우면 새로고침이 조건 변경으로 둔갑한다.
   * - **1~7행이 창을 닫고 배너를 비우는 이유**: **배너·창은 자기 대상보다 오래 살지 않는다.**
   *   뒤로가기·주소 직접 편집은 클릭 핸들러를 거치지 않으므로, 거두는 일은 클릭이 아니라
   *   `decisionTargetKey`에 묶인 effect가 한다.
   * - **11·12·14행이 초안을 비우지 않는 이유**: 의견칸이 **구획 인라인**이고 창은 확인 전용이라,
   *   창을 닫는 것은 「고치러 나가는 길」이다. 실패하면 창을 닫아 고칠 자리로 돌려보낸다.
   * - **16행이 리뷰가 찾아 준 사각이다**: 조회 라이브러리는 **재조회가 실패해도 마지막 성공
   *   자료를 남긴다** — 「자료가 있는가」만 묻는 조건은 「지금 읽을 수 있는가」를 묻지 않는다.
   *   그 틈에서 확인 창이 서 있고, 그 확인이 되돌릴 수 없는 결재를 보낸다.
   *
   * **구현 규칙 다섯** — 이 다섯이 표를 코드로 지킨다.
   *
   * 1. `toSearchParams(filters, pendingOnly, page)`가 **`rq`를 만들지 않는다.** 1~4행이 함께 지켜진다.
   * 2. 주소 갱신은 **조작당 한 번**이다. 조건과 쪽을 따로 갱신하면 뒤로가기 기록이 두 칸 늘어
   *    사용자가 뒤로 눌렀는데 같은 자리로 돌아온 것처럼 보인다.
   * 3. 초안·창·배너를 거두는 effect의 의존성은 **`decisionTargetKey` 하나뿐**이다.
   *    `useMemo` 파생 객체·응답 배열·`reset` 함수 참조를 넣지 않는다(넣으면 배너가 렌더마다 지워진다).
   * 4. **보내는 자리가 스스로 한 번 더 본다** — `confirmDecision`이 「지금도 보낼 수 있는가」를
   *    다시 판정하고, 아니면 창을 닫고 보내지 않는다.
   * 5. **사용자가 대상을 바꾸는 길은 전부 한 문(`applyUserNavigation`)을 지난다.** 15행의 잠금이
   *    그 문 하나에만 있어야 조건 칩·쪽·목록 행이 갈리지 않는다.
   */
  /*
   * 주소가 바뀔 때만 새 참조를 만든다 — 주소를 여러 번 읽어 파생시키는 값들이 같은 렌더에서
   * 같은 것을 보게 한다.
   *
   * **#43의 방어는 여기가 아니다.** 「치던 값이 갑자기 사라진다」를 막는 자리는 조건 줄의
   * 되돌림 effect이고, 그 effect가 **객체가 아니라 원시값 넷**에 매여 있는 것이 방어의 실체다
   * (`request-filter-bar.tsx`). 이 `useMemo`를 떼도 그 방어는 그대로 선다 —
   * 이 줄을 #43의 방어로 읽으면, 지워질 때 「방어가 사라졌다」고 믿고 조건 줄의 의존성이
   * 객체로 바뀔 때 「여기가 막아 준다」고 믿는다. 둘 다 틀리다.
   */
  const filters = useMemo<RequestFilters>(() => readFilters(searchParams), [searchParams]);
  const pendingOnly = readPendingOnly(searchParams);
  const page = readPage(searchParams);
  const selectedRequestId = readSelectedRequestId(searchParams);

  /*
   * **조건 없이도 조회한다.** 계약이 어느 파라미터도 필수로 두지 않았고, 이 화면은 들어오자마자
   * 내가 판정할 것을 보여야 하는 자리다 — 고정 축이 이미 범위를 좁히고 있다.
   *
   * **유형 코드를 여기서 넘긴다.** 쿼리 조립이 상수를 직접 읽으면 「값이 확정되면 조건이
   * 실린다」는 전환이 화면 밖에서만 재어진다 — 넘기는 자리를 한 곳으로 두면 그 전환을
   * 화면 수준에서도 잴 수 있다.
   */
  const listQuery = toRequestListQuery(filters, pendingOnly, page, IQC_SKIP_APPROVAL_TYPE_CODE);
  const list = useRequestList(listQuery);
  const items = list.data?.items ?? EMPTY_ITEMS;
  const rows = useMemo(() => items.map(toRequestRow), [items]);
  const pageView = toPageView(list.data?.page ?? { page, size: 0, total: 0 }, items.length);

  /*
   * 고른 요청의 상세. **조회 하나로 요청 정보·대상·결재 진행이 모두 온다**(계약이 `steps`를
   * 함께 실어 준다). 고르기 전에는 열리지 않는다 — `queries.ts`가 그 규칙을 갖는다.
   */
  const detail = useRequestDetail(selectedRequestId);
  const detailError = detail.isError ? toApiError(detail.error) : null;
  const isRequestNotFound =
    detailError !== null && detailError.kind === 'http' && detailError.status === 404;
  const isRequestForbidden =
    detailError !== null && detailError.kind === 'http' && detailError.status === 403;

  /**
   * 404 안내가 매인 대상 — **조건·범위·쪽의 서명**이다.
   *
   * 안내를 세우는 순간 `rq`가 주소에서 사라지므로, 그 뒤에는 오류가 남지 않아 무엇에 매달지가
   * 없어진다. 조작마다 따로 지우면 뒤로가기·주소 직접 편집이 그 길을 지나지 않아 안내가
   * 살아남는다 — 그래서 「이 조건으로 보고 있던 동안」에 맨다.
   */
  const listContextKey = toSearchParams(filters, pendingOnly, page).toString();
  const [missingContextKey, setMissingContextKey] = useState<string | null>(null);

  /**
   * 상세가 404면 주소에 남은 번호를 정리하고 **그 순간의 서명**에 안내를 맨다(수명 표 6행).
   *
   * **클릭 핸들러가 아니라 읽는 자리에 매인 effect가 한다** — 주소를 받아 들어오거나
   * 뒤로가기로 온 사용자는 어느 핸들러도 지나지 않는다.
   *
   * **히스토리를 늘리지 않는다**(`replace`) — 늘리면 뒤로가기가 없는 요청으로 되돌아가고,
   * 그 자리에서 다시 404가 나 같은 정리가 되풀이돼 **사용자가 이 화면을 벗어날 수 없다.**
   *
   * **403은 이 자리를 지나지 않는다.** 지우면 사용자가 무엇을 열려 했는지 잃는다(수명 표 7행).
   * **조건으로 주소를 다시 조립하지 않고 한 칸만 뺀다**(`withoutSelection`) — 다시 조립하면
   * 주소에만 있고 화면은 모르는 값이 함께 사라진다.
   */
  useEffect(() => {
    if (!isRequestNotFound) return;

    setMissingContextKey(listContextKey);
    setSearchParams((prev) => withoutSelection(prev), { replace: true });
  }, [isRequestNotFound, listContextKey, setSearchParams]);

  const isRequestMissing =
    selectedRequestId === null &&
    missingContextKey !== null &&
    missingContextKey === listContextKey;

  /* --------------------------------------------------------------------- *
   * 결재 — **되돌릴 수 없는 쓰기 둘.**
   * --------------------------------------------------------------------- */

  /**
   * **토큰 수명 표 — `If-Match`가 어디서 오고 어디에 남는가.**
   *
   * 토큰 보관소는 **응답이 온 URL 경로**를 열쇠로 쓴다(`packages/api-client/src/client.ts`).
   * 그 사실이 이 표의 전부를 정한다.
   *
   * | 조회·쓰기 | `If-Match` 출처(`etagPath`) | `ETag`를 주는가 | **어느 경로에 남는가** | 성공 뒤 |
   * | --- | --- | :-: | --- | --- |
   * | 목록 `GET /app/approval-requests` | — | **주지 않는다**(실측) | — | — |
   * | **상세 `GET /{id}`** | — | **준다**(실측) | **상세 경로** ← 토큰을 확보하는 **유일한 자리** | — |
   * | 승인 `POST /{id}:approve` | **상세 경로** | 준다(200) | **액션 경로**(`…:approve`) | **뿌리 키 무효화** |
   * | 반려 `POST /{id}:reject` | **상세 경로** | 준다(200) | **액션 경로**(`…:reject`) | 같은 위 |
   *
   * **규칙 둘로 요약된다.**
   *
   * 1. **`etagPath`는 늘 상세 경로다.** 액션 경로를 주면 그 경로의 토큰은 **첫 쓰기 전까지
   *    언제나 비어 있어** 훅이 요청을 만들지 않고 멈춘다 — 「눌러도 아무 일이 없다」가 그
   *    증상이다. `null`을 주면 토큰 없이 나가 400이다.
   * 2. **성공 뒤 이 슬라이스의 조회 뿌리 키 하나를 무효화한다.** 쓰기 200의 `ETag`가 액션
   *    경로에 앉아 **상세 토큰이 낡은 채 남기** 때문이다. 빠뜨리면 방금 결재한 요청의 버튼이
   *    다시 활성으로 남고, 다음 쓰기가 조용히 409가 된다. **뿌리 하나로 무효화하는 이유**는
   *    목록과 상세가 함께 갱신돼야 「승인했는데 목록에 그대로 있는」 어긋남이 생기지 않아서다.
   *
   * **409 뒤의 길**도 같은 규칙 위에 선다 — 「최신 불러오기」가 **상세를 다시 부르고**,
   * 그 재조회가 새 토큰을 확보하므로 다음 시도가 성립한다.
   */
  const { client } = useApiClient();
  const queryClient = useQueryClient();
  const toast = useToast();

  /**
   * 결재에 딸린 것들이 매인 대상 — **이름 하나다.**
   *
   * 의견 초안·열린 창·실패 배너·인라인 오류가 각자 다른 값을 보게 두면, 어느 하나만 늦게
   * 거둬져 **앞 요청의 판정이 다음 요청 위에** 선다. 축을 하나로 두면 그 어긋남이 생길 자리가 없다.
   */
  const decisionTargetKey: string | null =
    selectedRequestId === null ? null : String(selectedRequestId);

  const [comment, setComment] = useState('');
  /** 보내는 자리가 스스로 본 결과. 서버가 준 필드 오류와 **같은 칸**에 선다. */
  const [localCommentError, setLocalCommentError] = useState<string | null>(null);
  const [dialogKind, setDialogKind] = useState<DecisionKind | null>(null);
  /** 마지막으로 보낸 쪽. 배너·알림이 **그 한 쪽**을 본다 — 둘의 결과가 섞이지 않는다. */
  const [sentKind, setSentKind] = useState<DecisionKind | null>(null);
  /** 마지막으로 보낸 쓰기가 **겨눈 대상**. 도착한 되먹임을 지금 대상과 견줄 축이다. */
  const [writeTargetKey, setWriteTargetKey] = useState<string | null>(null);

  /**
   * 결재가 끝난 뒤 — **선택을 유지하고 상세를 응답으로 갈아 끼운다**(수명 표 13행).
   *
   * **선택을 비우지 않는다.** 승인하면 그 요청은 「결재 대기」에서 빠지는데, 그때 `rq`까지
   * 비우면 사용자는 **방금 무엇을 했는지 확인할 자리를 잃는다.** 목록에 없는 선택은
   * 읽는 자리(상세 조회)가 판정하므로 바깥에서 거를 필요가 없다.
   *
   * **응답이 정본이다.** 무효화가 부른 재조회가 도착하기 전까지의 빈 구간을 이 값이 메운다 —
   * 방금 누른 결재가 결재 진행에 곧바로 반영되지 않으면 사용자는 눌리지 않은 줄 안다.
   *
   * **「지금 대상인가」를 여기서 다시 묻지 않는다.** 응답이 앉는 자리가 **보낸 요청의 캐시 키**
   * (`sentRequestId`)라, 사용자가 그사이 어디로 갔든 그 값은 언제나 제 자리에 앉는다 —
   * 가드를 두면 **한 번도 참이 되지 않는 가지**가 된다. 대상이 갈릴 때 가려야 하는 것은
   * *보이는 것*(배너·인라인 오류)이고, 그 몫은 `isWriteResultMine`이 갖는다.
   *
   * **《승인 시 결과》를 알림에 싣지 않는다.** 알림은 사라지고, 그 세 문장은 화면을 보는 내내
   * 참인 사실이라 상시 구획이 제자리다.
   */
  const finishDecision = (
    kind: DecisionKind,
    saved: ApprovalRequestDetail,
    sentRequestId: number,
  ): void => {
    toast.show({
      variant: 'success',
      description: kind === 'approve' ? t.toast.approved : t.toast.rejected,
    });
    setDialogKind(null);
    setComment('');
    setLocalCommentError(null);
    queryClient.setQueryData(iqcSkipApprovalKeys.detail(sentRequestId), saved);
  };

  /**
   * 승인 — 본문이 **비어 있을 수 있다**(계약이 몸통 자체를 선택으로 두었다).
   * 무엇이 실리고 무엇이 실리지 않는지는 `decision-draft.ts` 한 곳이 정한다.
   */
  const approveWrite = useMasterWrite<ApprovalDecision, ApprovalRequestDetail>({
    request: (body, headers) =>
      client.POST('/app/approval-requests/{approvalRequestId}:approve', {
        params: {
          path: { approvalRequestId: selectedRequestId ?? 0 },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': headers['If-Match'] ?? '',
          },
        },
        body,
      }),
    etagPath: selectedRequestId === null ? null : requestDetailPath(selectedRequestId),
    invalidateKeys: [iqcSkipApprovalKeys.all],
    knownFields: DECISION_KNOWN_FIELDS,
    onSuccess: (saved) => {
      finishDecision('approve', saved, selectedRequestId ?? 0);
    },
  });

  /** 반려 — 본문이 **필수**이고 의견이 그 안의 필수 필드다. 규칙은 같은 파일이 갖는다. */
  const rejectWrite = useMasterWrite<ApprovalRejection, ApprovalRequestDetail>({
    request: (body, headers) =>
      client.POST('/app/approval-requests/{approvalRequestId}:reject', {
        params: {
          path: { approvalRequestId: selectedRequestId ?? 0 },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': headers['If-Match'] ?? '',
          },
        },
        body,
      }),
    etagPath: selectedRequestId === null ? null : requestDetailPath(selectedRequestId),
    invalidateKeys: [iqcSkipApprovalKeys.all],
    knownFields: DECISION_KNOWN_FIELDS,
    onSuccess: (saved) => {
      finishDecision('reject', saved, selectedRequestId ?? 0);
    },
  });

  /**
   * **두 쓰기가 한 벌의 잠금 토큰을 나눠 쓴다.** 하나가 나가는 중에는 나머지도 잠근다 —
   * 동시에 나가면 뒤엣것이 반드시 409이고, 그 실패는 사용자가 한 일과 이어지지 않는다.
   */
  const isLocked = approveWrite.isSaving || rejectWrite.isSaving;

  /** 마지막으로 보낸 쪽의 쓰기. 배너·인라인 오류를 한 곳에서 골라 쓴다. */
  const activeWrite = sentKind === 'reject' ? rejectWrite : approveWrite;
  /** 훅에 남아 있는 쓰기 결과가 지금 보는 대상의 것인가. */
  const isWriteResultMine = writeTargetKey === decisionTargetKey;
  const decisionError = isWriteResultMine ? activeWrite.error : null;
  const serverCommentError = isWriteResultMine
    ? activeWrite.fieldErrors[DECISION_COMMENT_FIELD]
    : undefined;

  /**
   * **나가는 중인 쓰기는 건드리지 않는다**(`omf-mes#96`).
   *
   * 공통 훅의 `reset()`은 진행 중 mutation에서 **옵저버를 떼어 낸다**. 옵저버가 떨어지면
   * 그 호출에 매달린 되먹임이 통째로 오지 않는다 — **무효화도, 성공도, 실패도, 공동 잠금의
   * 해제도**. 요청은 이미 서버에 갔는데 화면만 없던 일로 친다.
   *
   * **끊는 것과 감추는 것은 다르다.** 도착한 결과를 화면에 낼지는 `isWriteResultMine`이
   * 정하고, 여기서는 **끝난 것만** 거둔다.
   *
   * `reset()`을 부르는 **모든 자리**가 이 함수를 지난다 — 이 화면에서 그 자리는 아래
   * 하나뿐이다(대상 변경). 창을 여닫는 길은 `reset()`을 부르지 않는다(수명 표 11·12행).
   */
  const resetIfIdle = (write: { isSaving: boolean; reset: () => void }): void => {
    if (write.isSaving) return;

    write.reset();
  };

  /** 결재에 딸린 것을 통째로 거둔다 — 초안 · 인라인 오류 · 열린 창 · 실패 배너. */
  const resetDecision = (): void => {
    resetIfIdle(approveWrite);
    resetIfIdle(rejectWrite);
    setComment('');
    setLocalCommentError(null);
    setDialogKind(null);
  };

  /*
   * 위 함수는 매 렌더 새로 만들어지므로 그대로 의존성에 넣으면 **렌더마다 초기화가 돈다** —
   * 실패 배너가 서자마자 지워져 사용자가 이유를 볼 수 없다. 최신 함수를 참조로 들고
   * **대상에만** 반응하게 한다.
   */
  const resetDecisionRef = useRef(resetDecision);
  resetDecisionRef.current = resetDecision;

  /**
   * 초안·창·배너 수명 규칙의 **유일한 실행 지점**(수명 표 1~7행의 뒤 세 칸).
   *
   * 클릭 핸들러가 아니라 **고른 요청**에 묶는다 — 클릭에만 두면 뒤로가기·앞으로가기·주소
   * 직접 편집처럼 핸들러를 거치지 않는 경로가 샌다. 그 경로에서 창이 살아남으면 **앞 요청을
   * 승인하려고 연 창이 다음 요청을 승인한다**(쓰기 대상은 지금 주소를 읽는다).
   *
   * **의존성은 하나뿐이다**(`omf-mes#43`). 초안·응답 배열·`reset` 함수 참조를 넣으면 의견을
   * 한 글자 칠 때마다 배너가 지워지거나(너무 지움) 아예 보이지 않는다(늘 지움).
   */
  useEffect(() => {
    resetDecisionRef.current();
  }, [decisionTargetKey]);

  /**
   * **실패하면 창을 닫는다**(수명 표 14행).
   *
   * 이 창은 입력을 받지 않는다 — 열어 둔 채로는 사용자가 의견을 고칠 수 없어, 오류를 보여
   * 주고도 손댈 수 없는 막다른 길이 된다. 배너와 인라인 오류는 **고칠 자리 옆**(구획의 입력칸)에 선다.
   *
   * 오류 값이 바뀔 때만 깨어난다 — 실패 한 번에 한 번 돈다.
   */
  useEffect(() => {
    if (decisionError === null && serverCommentError === undefined) return;

    setDialogKind(null);
  }, [decisionError, serverCommentError]);

  /**
   * **상세를 더는 읽을 수 없으면 창을 내린다**(수명 표 16행).
   *
   * 마운트 조건이 그 렌더에서 창을 감추는 것과 **상태를 내리는 것은 다른 일이다.** 감추기만
   * 하면 `dialogKind`가 선 채 남아, 사용자가 「다시 시도」로 상세를 되찾는 순간 **누른 적 없는
   * 확인 창**이 다시 떠 있다 — 되돌릴 수 없는 조작의 확인이 저절로 되살아나는 것이다.
   *
   * 판정이 바뀔 때만 깨어난다. 실패가 이어지는 동안 되풀이 돌지 않는다.
   */
  useEffect(() => {
    if (!detail.isError) return;

    setDialogKind(null);
  }, [detail.isError]);

  /**
   * 조건·범위·쪽을 주소에 반영한다. 주소가 정본이라 조회는 주소가 바뀐 결과로 일어난다.
   *
   * **주소 갱신은 한 번이다** — 조건과 쪽을 따로 갱신하면 뒤로가기 기록이 두 칸 늘어난다.
   * `toSearchParams`가 `rq`를 만들지 않으므로 고른 요청도 여기서 함께 풀린다(수명 표 1~4행).
   *
   * **404 안내를 여기서 함께 거둔다** — 조회·초기화·대기 전환·쪽 이동·고르기가 모두 이 길을
   * 지나므로 조작마다 따로 지울 자리가 없다.
   */
  const applySearchParams = (next: URLSearchParams): void => {
    setMissingContextKey(null);
    setSearchParams(next);
  };

  /**
   * **사용자가** 대상을 바꾸는 길. 전송 중에는 지나가지 못한다(수명 표 15행 · 둘째 겹).
   *
   * 첫째 겹은 컨트롤의 `disabled`인데 **조건 칩·목록 행·쪽 이동은 잠금을 받지 않는다** —
   * 그것들은 결재와 무관한 컨트롤이라 결재 상태를 알 이유가 없다. 그 길로 대상이 바뀌면
   * 나가는 중인 결재의 결과가 **다른 요청의 맥락에** 나타난다.
   *
   * **404 정리는 이 문을 지나지 않는다.** 그것은 사용자의 이동이 아니라 읽는 자리의 판정이다.
   */
  const applyUserNavigation = (next: URLSearchParams): void => {
    if (isLocked) return;

    applySearchParams(next);
  };

  const apply = (nextFilters: RequestFilters, nextPendingOnly: boolean, nextPage = 1): void => {
    applyUserNavigation(toSearchParams(nextFilters, nextPendingOnly, nextPage));
  };

  /**
   * 요청 고르기·해제(수명 표 5행).
   *
   * **보이는 행을 바꾸지 않는다** — 조건·범위·쪽을 그대로 두고 `rq`만 넣고 뺀다.
   */
  const toggleSelect = (approvalRequestId: number): void => {
    applyUserNavigation(
      toSelectionSearchParams(
        filters,
        pendingOnly,
        page,
        approvalRequestId === selectedRequestId ? null : approvalRequestId,
      ),
    );
  };

  /**
   * 다시 조회(수명 표 10행) — **화면이 보고 있는 조회를 전부 다시 한다.**
   *
   * 목록만 다시 부르면 갱신된 목록과 낡은 상세가 한 화면에 섞인다 — 방금 결재된 건이 빠진
   * 목록 옆에서 아래 구획이 결재 전 진행을 보인다(W-01-07이 남긴 결함의 형태).
   *
   * **고르지 않았으면 상세는 부를 대상이 없다** — 읽는 자리에서 판정한다.
   * 조건·범위·쪽·선택은 하나도 바꾸지 않는다. 대상 처리 현황이 붙는 회차에는 그것도 여기서
   * 함께 부른다.
   *
   * **전송 중에도 막지 않는다.** 이것은 대상을 바꾸는 조작이 아니라 같은 것을 다시 읽는
   * 조작이다 — `applyUserNavigation`의 잠금이 여기 걸리면 결재가 나가는 동안 사용자가
   * 진행을 확인할 길이 사라진다.
   */
  const handleReload = (): void => {
    void list.refetch();

    if (selectedRequestId !== null) void detail.refetch();
  };

  /**
   * 409 뒤의 길 — **상세를 다시 부른다.**
   *
   * 「최신 불러오기」가 목록만 부르면 토큰이 그대로라 다음 시도가 또 409다.
   * 새 토큰은 **상세 200에만** 실려 오므로 이 재조회가 곧 다음 시도의 조건이다.
   */
  const reloadDetail = (): void => {
    void detail.refetch();
  };

  /**
   * 의견을 고친다.
   *
   * **그 칸의 오류만 지운다.** 실패 배너는 남는다 — 무엇이 왜 거절됐는지는 의견을 고쳤다고
   * 없던 일이 되지 않고, 사용자는 그 사유를 보면서 고쳐야 한다(수명 표 8행).
   */
  const changeComment = (value: string): void => {
    setComment(value);
    setLocalCommentError(null);
    activeWrite.clearFieldError(DECISION_COMMENT_FIELD);
  };

  /** 창을 닫는다 — **그뿐이다.** 초안도 배너도 건드리지 않는다(수명 표 12행). */
  const closeDecisionDialog = (): void => {
    setDialogKind(null);
  };

  /**
   * 결재를 **실제로 보내는 유일한 자리** — 여기서 한 번 더 본다(다섯 겹의 넷째).
   *
   * 버튼이 이미 막았다고 믿지 않는다. 창이 열려 있는 동안 **화면 밖에서 상태가 바뀔 수
   * 있고**(다시 조회·백그라운드 갱신으로 상세가 새로 온다), 그 사이 벌어진 틈으로 나간
   * 요청은 서버가 400으로 되돌린다 — 사용자에게는 **이유를 알 수 없는 거절**이 된다.
   *
   * 재판정은 넷이고, **그중 둘은 앞선 겹이 이미 막는 둘째 겹이다.** 되돌릴 수 없는 쓰기라
   * 남기되, 어느 것이 홀로 막고 어느 것이 겹인지를 여기 적는다 — 적어 두지 않으면 다음
   * 사람이 **검사되는 방어인 줄 알고** 앞 겹을 걷어 낸다.
   *
   * | # | 무엇 | 홀로 막는가 | 첫째 겹과 그 잣대 |
   * | :-: | --- | :-: | --- |
   * | 1 | **연타·중복** | 아니다(**둘째 겹**) | 확인 버튼의 `disabled={isSaving}` — 「연타해도 요청이 1회이고 컨트롤이 잠긴다」가 잰다 |
   * | 2 | **상세를 읽을 수 있는가** | 아니다(**둘째 겹**) | 창을 내리는 effect(수명 표 16행) — 「상세가 500·403이면 창이 사라지고 쓰기가 나가지 않는다」가 잰다 |
   * | 3 | **내 차례인가** | **그렇다** | 창이 열린 사이 상세가 새로 와 차례가 끝나면 창은 남아 있다 — 여기가 유일한 문이다 |
   * | 4 | **반려 본문이 서는가** | **그렇다** | 창이 열린 사이 의견이 비는 길이 있다. **목이 공백만인 의견을 200으로 받아** 막는 곳이 화면뿐이다 |
   *
   * **대상 처리 현황을 판정에 넣지 않는다.** 이 화면은 판단 근거를 더 그리는 자리라 그것이
   * 조건에 끼기 쉬운데, 결재 가능 여부의 정본은 `isMyTurn` 하나다 — 화면이 조건을 더하면
   * 서버가 여는 것을 화면이 닫는다.
   */
  const confirmDecision = (kind: DecisionKind): void => {
    if (isLocked) return;

    const data = detail.data;

    /*
     * **「자료가 있는가」와 「지금 읽을 수 있는가」는 다르다.** 조회 라이브러리는 재조회가
     * 실패해도 마지막 성공 자료를 남긴다 — `data`만 보면 화면이 「볼 권한이 없습니다」라고
     * 말하는 그 위에서 결재가 나간다(수명 표 16행).
     */
    if (
      data === undefined ||
      detail.isError ||
      selectedRequestId === null ||
      !data.request.isMyTurn
    ) {
      setDialogKind(null);

      return;
    }

    if (kind === 'reject') {
      const body = toRejectBody(comment);

      if (body === null) {
        setLocalCommentError(t.decision.commentRequired);
        setDialogKind(null);

        return;
      }

      /* 지금 보내는 것은 **이 대상의 것**이다 — 도착한 결과를 견줄 축을 여기서 세운다. */
      setSentKind('reject');
      setWriteTargetKey(decisionTargetKey);
      setLocalCommentError(null);
      rejectWrite.write(body);

      return;
    }

    setSentKind('approve');
    setWriteTargetKey(decisionTargetKey);
    setLocalCommentError(null);
    approveWrite.write(toApproveBody(comment));
  };

  /**
   * 결재 실패 배너.
   *
   * **「최신 불러오기」는 409에만 붙는다** — 공통 배너가 그 판정을 갖고 있어 화면이 다시
   * 쓰지 않는다. 다른 실패에 재조회를 권하면 사용자가 적어 둔 의견만 버리게 된다.
   *
   * **「전달됐는지 확인할 수 없습니다」는 네트워크 갈래에만 붙는다.** 응답을 받지 못한
   * 요청만이 「갔는지 모르는」 요청이다 — 400·403·409는 서버가 답한 것이라 결재가 일어나지
   * 않았음이 확실하고, 그 자리에까지 이 문장을 붙이면 사실이 아닌 불안을 만든다.
   */
  const decisionBanner: ReactNode =
    decisionError === null ? null : (
      <>
        <SaveErrorBanner error={decisionError} onReload={reloadDetail} />
        {decisionError.kind === 'network' && (
          <p className="field-note">{t.decision.deliveryUnknown}</p>
        )}
      </>
    );

  /**
   * 아래 구획 — **「고른 것」이 아니라 「읽을 수 있는 것」이 무엇인지에 따라 갈린다.**
   *
   * 갈래 차례가 곧 판정 차례다.
   *
   * | 차례 | 언제 | 무엇을 낸다 |
   * | :-: | --- | --- |
   * | ① | 상세가 404거나 방금 그래서 정리됐다 | 「찾을 수 없습니다」(S2) |
   * | ② | 고르지 않았다 | 「고르세요」(S0) |
   * | ③ | 상세가 403 | 「권한이 없습니다」 · **다시 시도 없음**(S3) |
   * | ④ | 그 밖의 실패 | 배너 + 다시 시도 |
   * | ⑤ | 아직 오지 않았다 | 뼈대 |
   * | ⑥ | 200 | 요청 정보 · 대상 · 결재 진행 · 결재(S1) |
   *
   * **①이 ②보다 먼저인 이유**: 404를 만나면 같은 렌더 안에서 `rq`가 정리되므로, ②를 먼저
   * 보면 안내가 「고르세요」로 바뀌어 사용자가 방금 무슨 일이 있었는지 알 수 없게 된다.
   *
   * **③을 ④에서 갈라내는 이유**: 같은 권한으로 다시 불러도 같은 답이 온다 — 누를 수 있는
   * 조치를 주면 사용자가 그것을 되풀이한다.
   *
   * **어느 갈래에서도 빈 구간이 남지 않는다.** 「고른 것 ≠ 보이는 것」이 이 표로 전부 덮인다.
   */
  const detailSlot = (): ReactNode => {
    if (isRequestNotFound || isRequestMissing) {
      return (
        <EmptyState
          size="sm"
          live
          title={t.empty.notFoundTitle}
          description={t.empty.notFoundDescription}
        />
      );
    }

    if (selectedRequestId === null) {
      return (
        <EmptyState
          size="sm"
          title={t.empty.noSelectionTitle}
          description={t.empty.noSelectionDescription}
        />
      );
    }

    if (isRequestForbidden) {
      return (
        <EmptyState
          size="sm"
          live
          title={t.empty.forbiddenTitle}
          description={t.empty.forbiddenDescription}
        />
      );
    }

    if (detail.isError) {
      return (
        <LoadErrorBanner
          error={detail.error}
          onRetry={() => {
            void detail.refetch();
          }}
        />
      );
    }

    if (detail.data === undefined) {
      return (
        <div role="status" aria-label={t.loading.detail}>
          <SkeletonText lines={5} />
        </div>
      );
    }

    const { request } = detail.data;

    return (
      <>
        {/*
         * 차례가 뜻이다 — **사유가 대상보다 위**다. 사유가 이 리소스의 유일한 업무 값이라
         * 결재 판단의 근거가 거기에만 있고, 대상 이름은 「그 판단이 무엇에 붙는가」다.
         *
         * 대상 처리 현황·상태 이력 자리는 대상 구획 다음에 온다 — 그 값을 얻는 길이
         * 계약에 정해지면 별건이 이 자리를 채운다.
         */}
        <RequestDetailPane view={toRequestDetailView(request)} />
        <TargetPane
          name={describeTargetName(request.target)}
          openState={judgeTargetOpen(request.target, SCREEN_ROUTES)}
          onOpen={(path) => {
            void navigate(path);
          }}
        />
        <ProgressPane view={toRequestProgressView(detail.data, REJECTION_DECISION_CODES)} />
        {/*
         * **의견 입력칸과 결재 액션이 진행 구획 바로 아래에 선다.**
         * 창이 아니라 이 구획 안이라야 사용자가 무엇을 결재하는지 보면서 의견을 쓴다 —
         * 확인 창은 「정말 보낼 것인가」만 묻는 자리로 남는다. 진행 구획 다음인 이유는
         * 의견이 **내 단계에 남는 말**이라 그 단계 목록 바로 옆이 가장 가까운 자리이고,
         * 위의 둘(사유·대상)은 「무엇을 결재하는가」로 축이 다르기 때문이다.
         *
         * **`isMyTurn`을 그대로 넘긴다** — 단계 배열을 훑어 다시 계산하지 않는다(결정 7).
         * 인라인 오류는 **로컬 판정이 먼저**다: 방금 사용자가 부딪힌 벽이 지난 서버 응답보다
         * 지금 무엇을 해야 하는지를 정확히 말한다.
         */}
        <DecisionPane
          isMyTurn={request.isMyTurn}
          comment={comment}
          onChangeComment={changeComment}
          commentError={localCommentError ?? serverCommentError}
          isLocked={isLocked}
          onApprove={() => {
            setDialogKind('approve');
          }}
          onReject={() => {
            setDialogKind('reject');
          }}
          banner={decisionBanner}
        />
      </>
    );
  };

  /**
   * 확인 창 — **열 때만 붙인다.**
   *
   * 디자인 시스템 `Dialog`는 닫혀도 내용이 DOM에 남아 지난 값이 살아 있게 된다.
   * 조건부로 만들면 열릴 때마다 **지금 값**으로 세워진다.
   *
   * **창이 보여 주는 것과 나가는 것이 같은 값에서 온다** — 본문을 만드는 함수가 곧 표시할
   * 의견을 정한다. 둘을 따로 계산하면 「보여 준 것과 다른 것이 나가는」 자리가 생기고,
   * 되돌릴 수 없는 조작에서 그것은 확인의 뜻 자체를 없앤다. **대상 요약도 같은 상세에서
   * 온다** — 목록 행이 아니라 상세다: 목록은 지금 보는 쪽·조건에 걸린 일부라 주소로 들어온
   * 선택이 거기 없을 수 있다.
   *
   * **아래 구획이 요청을 보여 주지 못하면 창도 서지 않는다**(수명 표 16행). 조회 라이브러리는
   * 재조회가 실패해도 마지막 성공 자료를 남기므로 `detail.data`만 보면 **구획이 「볼 권한이
   * 없습니다」로 갈린 그 위에 창이 그대로 뜬다.**
   *
   * **`detail.isError`를 빼도 시험은 전부 통과한다** — 수명 표 16행의 effect가 같은 일을
   * 하기 때문이다. 그래도 두는 이유는 **순서**다: `useEffect`는 그리고 난 **뒤**에 돌아,
   * 이 조건이 없으면 「볼 권한이 없습니다」 위에 확인 창이 **한 번 그려졌다가** 사라진다.
   * 시험 하네스는 렌더와 effect를 한 묶음으로 흘려보내 그 한 프레임을 잴 수 없다 —
   * **잣대가 없는 자리**이니 지울 때 시험이 조용히 통과한다는 것을 알고 지워야 한다.
   */
  const decisionDialog = (): ReactNode => {
    if (dialogKind === null || detail.isError || detail.data === undefined) return null;

    const subject = toDecisionSubject(detail.data.request);

    if (dialogKind === 'approve') {
      return (
        <ApproveDialog
          subject={subject}
          comment={toApproveBody(comment).comment}
          isSaving={isLocked}
          onClose={closeDecisionDialog}
          onConfirm={() => {
            confirmDecision('approve');
          }}
        />
      );
    }

    return (
      <RejectDialog
        subject={subject}
        /*
         * 창이 열린 사이 의견이 비워질 수 있다(버튼은 그 상태를 만들지 않지만 화면 밖 경로가
         * 있다). 그때 창을 **없애지 않는다** — 확인을 누르면 보내는 자리의 재판정이 걸러
         * 인라인 오류를 세우고, 그 길이 사라지면 사용자는 눌러도 아무 일이 없는 창을 본다.
         */
        comment={toRejectBody(comment)?.comment ?? ''}
        isSaving={isLocked}
        onClose={closeDecisionDialog}
        onConfirm={() => {
          confirmDecision('reject');
        }}
      />
    );
  };

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
        actions={
          <Button variant="outlined" size="sm" onClick={handleReload}>
            {t.actions.reload}
          </Button>
        }
      />

      <section className="pane" aria-label={t.panes.list}>
        {/* 결과가 없어도 조건 줄은 감추지 않는다 — 조건을 고칠 수단이 사라지면 안 된다. */}
        <RequestFilterBar
          appliedFilters={filters}
          /*
           * 자리표시 상수를 **화면이 읽어 넘긴다.** 부품이 직접 읽으면 「값이 확정되면 배열만
           * 채운다」는 전환을 화면 수준에서 잴 수 없다.
           */
          statusOptions={toCodeOptions(PLACEHOLDER_REQUEST_STATUS_CODES)}
          pendingOnly={pendingOnly}
          onSearch={(nextFilters) => {
            apply(nextFilters, pendingOnly);
          }}
          /* 수명 표 3행 — 조건은 그대로 두고 쪽과 선택만 되돌린다. */
          onTogglePendingOnly={(nextPendingOnly) => {
            apply(filters, nextPendingOnly);
          }}
          onRemoveFilter={(key: FilterChipKey) => {
            apply(clearFilter(filters, key), pendingOnly);
          }}
          /*
           * 수명 표 2행 — 「처음 상태」에는 켜진 확인칸도 든다.
           * **리터럴을 쓰지 않는다**: 기본값이 뒤집히는 날 이 자리만 남으면
           * 「초기화했더니 조회 범위가 딴판」이 된다.
           */
          onReset={() => {
            apply(EMPTY_FILTERS, PENDING_ONLY_DEFAULT);
          }}
        />

        <RequestListPane
          rows={rows}
          isLoading={list.isPending}
          pageView={pageView}
          onChangePage={(nextPage) => {
            apply(filters, pendingOnly, nextPage);
          }}
          selectedRequestId={selectedRequestId}
          onSelect={toggleSelect}
          typeNote={typePendingNote(IQC_SKIP_APPROVAL_TYPE_CODE)}
          loadError={
            list.isError ? (
              <LoadErrorBanner
                error={list.error}
                onRetry={() => {
                  void list.refetch();
                }}
              />
            ) : null
          }
        />
      </section>

      {/*
       * 아래 구획 — **늘 선다.** 안에 무엇이 오는지만 갈린다(`detailSlot`).
       *
       * 구획 자체를 조건부로 두지 않는 이유: 이 자리가 갖는 상태가 여섯이라(고르기 전·목록
       * 밖·404·403·불러오는 중·200) 구획이 통째로 사라지면 무엇을 골랐는지도, 왜 아무것도
       * 없는지도 화면이 말하지 않는다.
       */}
      <section className="pane" aria-label={t.panes.detail}>
        {detailSlot()}
      </section>

      {decisionDialog()}
    </>
  );
};
