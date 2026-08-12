import { Breadcrumb, Button, EmptyState, PageHeader, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { toApiError } from '../../patterns/request';
import {
  IQC_SKIP_APPROVAL_TYPE_CODE,
  PLACEHOLDER_REQUEST_STATUS_CODES,
  toCodeOptions,
  typePendingNote,
} from './code-options';
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
import { useRequestDetail, useRequestList } from './queries';
import { RequestDetailPane } from './request-detail-pane';
import { RequestFilterBar } from './request-filter-bar';
import { RequestListPane } from './request-list-pane';
import { SCREEN_ROUTES } from './screen-routes';
import { describeTargetName, judgeTargetOpen } from './target';
import { TargetPane } from './target-pane';
import {
  toRequestDetailView,
  toRequestRow,
  type ApprovalRequest,
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
 * **이 회차는 상세·결재 진행·대상까지다.** 대상 처리 현황과 상태 변경 이력 자리는 다음
 * 회차가, 승인·반려와 라우트 등록은 그다음 회차가 맡는다. 지금 이 화면은 **라우트에 붙어
 * 있지 않다** — 결재할 수 없는 판정 화면을 사용자에게 내보이지 않기 위해서다.
 *
 * ---
 *
 * **G1 — 승인 유형 코드가 비어 있는 동안 아무것도 잠그지 않는다.**
 *
 * 이 화면이 자기 대상을 좁히는 축은 승인 유형 하나인데 그 값이 미확정이다(`omf-mes#64`).
 * 그래도 **잠그지 않는다**: 여기서 조회나 결재를 잠그면 화면이 통째로 무용해지고, 사용자는
 * 결재함으로 옮겨 가 **판단 근거 없이** 같은 건을 결재한다 — 잠금이 위험을 줄이는 것이 아니라
 * 옮긴다. 대신 오결재를 세 자리에서 막는다.
 *
 * | # | 방어 | 어디에 |
 * | :-: | --- | --- |
 * | ① | 목록 위 **상시 안내** — 좁혀지지 않는다는 사실을 화면이 밝힌다 | `code-options.ts`의 `typePendingNote` |
 * | ② | 목록의 **승인 유형 열**(코드 그대로) | `request-list-pane.tsx` |
 * | ③ | 결재 확인 창의 **대상 요약 재확인** | 결재가 붙는 회차 |
 *
 * **값이 오면 상수 한 줄로 좁혀진다** — 조건이 실리고 안내가 사라진다. 그 전환을 두 방향으로
 * 재는 시험이 없으면 이 가지는 죽은 코드이므로, 단위·부품·화면 세 수준에 감지기를 두었다.
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
 * **이 회차가 S0~S3을 전부 세운다.** S1이 보이는 것 가운데 대상 처리 현황·상태 이력 자리와
 * 결재 구획은 뒤 회차가 채우고, 지금 서는 것은 요청 정보·대상·결재 진행 셋이다.
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
   * **이 회차가 세우는 것은 1~7·10행의 앞 넷(조건·`pd`·`page`·`rq`)이다.** 8~9·11~15·17행과
   * 뒤 세 칸(초안·창·배너)은 결재가, 16행은 결재 구획이 생기는 회차가 맡는다.
   * 표를 통째로 먼저 적는 이유는 **표에 오르지 않은 상태가 규칙이 닿지 않는 사각**이 되기
   * 때문이며, 열여덟째 조작이 생기면 규칙을 정하기 전에 이 표에 행부터 더한다.
   *
   * **왜 이렇게 정했는가**(이 회차에 해당하는 것만)
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
   *
   * **구현 규칙 둘** — 이 둘이 이 회차의 표를 코드로 지킨다.
   *
   * 1. `toSearchParams(filters, pendingOnly, page)`가 **`rq`를 만들지 않는다.** 1~4행이 함께 지켜진다.
   * 2. 주소 갱신은 **조작당 한 번**이다. 조건과 쪽을 따로 갱신하면 뒤로가기 기록이 두 칸 늘어
   *    사용자가 뒤로 눌렀는데 같은 자리로 돌아온 것처럼 보인다.
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

  const apply = (nextFilters: RequestFilters, nextPendingOnly: boolean, nextPage = 1): void => {
    applySearchParams(toSearchParams(nextFilters, nextPendingOnly, nextPage));
  };

  /**
   * 요청 고르기·해제(수명 표 5행).
   *
   * **보이는 행을 바꾸지 않는다** — 조건·범위·쪽을 그대로 두고 `rq`만 넣고 뺀다.
   */
  const toggleSelect = (approvalRequestId: number): void => {
    applySearchParams(
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
   */
  const handleReload = (): void => {
    void list.refetch();

    if (selectedRequestId !== null) void detail.refetch();
  };

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
   * | ⑥ | 200 | 요청 정보 · 대상 · 결재 진행(S1) |
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
         * 대상 처리 현황·상태 이력 자리는 대상 구획 다음에, 결재 구획은 결재 진행 다음에
         * 온다 — 뒤 회차가 이 자리를 채운다.
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
      </>
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
    </>
  );
};
