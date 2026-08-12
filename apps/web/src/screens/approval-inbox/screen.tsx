import {
  Badge,
  Breadcrumb,
  Button,
  EmptyState,
  PageHeader,
  Tabs,
  type TabItem,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useMemo, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';

import {
  PLACEHOLDER_APPROVAL_TYPE_CODES,
  PLACEHOLDER_REQUEST_STATUS_CODES,
  toCodeOptions,
} from './code-options';
import {
  EMPTY_FILTERS,
  clearFilter,
  readFilters,
  readPage,
  readSelectedRequestId,
  readTabParam,
  toRequestListQuery,
  toSearchParams,
  toSelectionSearchParams,
  type FilterChipKey,
} from './filters';
import { LoadErrorBanner } from './load-error-banner';
import { toPageView } from './pagination';
import { useRequestList, usePendingCount } from './queries';
import { RequestFilterBar } from './request-filter-bar';
import { RequestListPane } from './request-list-pane';
import { canSeeAllRequests, readTab, tabLabel, visibleTabs, type InboxTab } from './tabs';
import { toRequestRow, type ApprovalRequest, type InboxFilters } from './types';

const t = messages.approvalInbox;

/** 참조가 매 렌더 새로 만들어지면 이 값을 의존성에 둔 계산이 멈추지 않는다. */
const EMPTY_ITEMS: ApprovalRequest[] = [];

/**
 * W-CO-09 컨테이너 — **올라온 결재를 찾아 고르는 목록**이다.
 *
 * 조회 전용이라 편집 폼이 없다. 배치는 세로 스택이다 — 조건 줄 + 탭(그 안에 목록) + 아래 구획.
 * 2단(좌 목록 / 우 편집)을 쓰지 않는다: 마스터 형은 **고른 것을 고치는** 화면의 배치인데
 * 결재함에는 고쳐 넣는 폼이 없고, 목록 열이 일곱이라 좌 칸(약 370px)에 들어가지도 않는다.
 *
 * 조회 조건·탭·쪽·고른 요청은 전부 주소가 소유한다 — 새로고침·뒤로가기·공유가 같은 결과를 낸다.
 *
 * **이 회차는 목록까지다.** 고른 요청의 상세·결재 진행·대상은 다음 회차가 아래 구획을 채우고,
 * 승인·반려와 라우트 등록은 그다음 회차다. 지금 이 화면은 **라우트에 붙어 있지 않다** —
 * 결재할 수 없는 결재함을 사용자에게 내보이지 않기 위해서다.
 *
 * ---
 *
 * **단계 전이 표 — 화면이 어느 단계에 있는지와 그 근거.**
 *
 * | 단계 | 화면이 이 단계를 아는 근거 | 보이는 것 | 할 수 있는 것 | 주소 |
 * | :-: | --- | --- | --- | --- |
 * | **S0** 고르기 전 | `rq`가 없다 | 조건 줄 · 탭 · 목록 · 쪽 · 「고르세요」 | 조회 · 초기화 · 탭 전환 · 쪽 이동 · 고르기 | `?tab&ty&st&from&to&q&page` |
 * | **S1** 요청을 골랐다 | `rq`가 있고 **상세가 200** | 위 + 요청 정보 · 대상 · 결재 진행 · 결재 액션 | 위 + 대상 열기 · 승인 · 반려 | `+&rq` |
 * | **S2** 그 요청이 없다 | 상세가 **404** | 안내 「찾을 수 없습니다」 | `rq`를 주소에서 정리한다 | `rq` 제거 |
 * | **S3** 그 요청을 볼 권한이 없다 | 상세가 **403** | 안내 「권한이 없습니다」 · **다시 시도 없음** | `rq`를 **정리하지 않는다** | `rq` 유지 |
 *
 * **이 회차가 세우는 것은 S0뿐이다.** S1~S3은 상세 조회가 붙는 다음 회차의 것이며,
 * 지금은 `rq`가 주소에 서기만 하고 아래 구획이 비어 있다. **표를 먼저 적어 두는 이유**는
 * 다음 회차가 상태를 하나 더 만들 때 표에 행부터 더하게 하기 위해서다.
 *
 * S2와 S3를 가르는 이유: 계약이 「승인자도 상신자도 아니면 403」이라고 적었다 —
 * 주소를 받아 들어온 사용자가 남의 요청을 가리키는 일이 실제로 있다. 404는 「없는 것」이라
 * 주소를 정리하지만, 403은 **있는데 내 것이 아닌 것**이라 정리하면 무엇을 열려 했는지 잃는다.
 */
export const ApprovalInboxScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  /**
   * **주소 키의 수명 — 무엇이 바뀔 때 무엇을 비우는가.**
   *
   * 「비운다」와 「비우지 않는다」를 이 표 한 곳에 모은다 — 규칙이 흩어지면 한쪽만 고쳐져
   * 비대칭이 생긴다(탭을 바꾸면 선택이 풀리는데 쪽을 옮기면 안 풀리는 식).
   *
   * | # | 조작 | 조건 5종 | `tab` | `page` | `rq` | **의견 초안** | **열린 창** | **실패 배너** |
   * | :-: | --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
   * | 1 | 조건 변경·조회 | 바뀐다 | 유지 | **첫 쪽** | **비운다** | **비운다** | **닫는다** | **비운다** |
   * | 2 | 초기화 | **비운다** | 유지 | 첫 쪽 | 비운다 | 비운다 | 닫는다 | 비운다 |
   * | 3 | **탭 전환** | **유지** | 바뀐다 | **첫 쪽** | **비운다** | 비운다 | 닫는다 | 비운다 |
   * | 4 | 쪽 이동 | 유지 | 유지 | 옮긴 쪽 | **비운다** | 비운다 | 닫는다 | 비운다 |
   * | 5 | 요청 고르기·해제 | 유지 | 유지 | **유지** | 넣고 뺀다 | **비운다** | 닫는다 | 비운다 |
   * | 6 | **상세가 404** | 유지 | 유지 | 유지 | **비운다** | 비운다 | 닫는다 | 비운다 |
   * | 7 | **상세가 403** | 유지 | 유지 | 유지 | **유지** | 닫는다 | 비운다 | 비운다 |
   * | 8 | 의견 입력 | 유지 | 유지 | 유지 | 유지 | 바뀐다 | 유지 | **유지** |
   * | 9 | 목록·건수·상세 **응답 도착** | 유지 | 유지 | 유지 | 유지 | **건드리지 않는다** | 유지 | 유지 |
   * | 10 | **다시 조회**(새로고침) | 유지 | 유지 | 유지 | 유지 | **유지** | 유지 | 유지 |
   * | 11 | 창 열기 | 유지 | 유지 | 유지 | 유지 | **빈 값으로 세운다** | **연다** | **비운다** |
   * | 12 | 창 닫기(버튼·X·Escape·스크림) | 유지 | 유지 | 유지 | 유지 | **비운다** | **닫는다** | 비운다 |
   * | 13 | **승인·반려 성공** | 유지 | 유지 | 유지 | **유지** | 비운다 | **닫는다** | 비운다 |
   * | 14 | 승인·반려 실패 | 유지 | 유지 | 유지 | 유지 | **유지** | **연 채로 둔다** | **세운다** |
   * | 15 | **전송 중** | 잠긴다 | 잠긴다 | 잠긴다 | 잠긴다 | 잠긴다 | 유지 | 유지 |
   *
   * **이 회차가 세우는 것은 1~5·10행의 앞 넷(조건·탭·쪽·`rq`)뿐이다.** 6~7행은 상세 조회가,
   * 8~15행과 뒤 세 칸(초안·창·배너)은 결재가 붙는 회차의 것이다. 표를 통째로 먼저 적는 이유는
   * **표에 오르지 않은 상태가 규칙이 닿지 않는 사각**이 되기 때문이며, 열여섯째 조작이 생기면
   * 규칙을 정하기 전에 이 표에 행부터 더한다.
   *
   * **왜 이렇게 정했는가**(이 회차에 해당하는 것만)
   *
   * - **1·3·4행이 `rq`를 비우는 이유**: 조건·탭·쪽이 바뀌면 보이는 행이 달라진다. 남겨 두면
   *   아래 구획이 **목록에 없는 요청**을 가리킨 채 열려 있고, 그것이 어디서 왔는지 알 수 없다.
   * - **3행이 조건을 유지하는 이유**: 탭은 「누구의 것인가」이고 조건은 「무엇인가」다.
   *   축을 바꿨다고 방금 좁힌 범위를 버리면 사용자가 같은 조건을 다시 친다.
   * - **5행이 쪽을 유지하는 이유**: 고르는 것은 보이는 행을 바꾸지 않는다. 첫 쪽으로 튀면
   *   사용자가 3쪽에서 고른 요청을 보는 동안 목록은 1쪽이 된다.
   * - **10행이 아무것도 비우지 않는 이유**: 새로고침은 **같은 조회를 다시 하는 것**이다.
   *   무언가를 비우면 새로고침이 조건 변경으로 둔갑한다.
   *
   * **구현 규칙 둘** — 이 둘이 표를 코드로 지킨다.
   *
   * 1. `toSearchParams(filters, tab, page)`가 **`rq`를 만들지 않는다.** 1~4행이 함께 지켜진다.
   * 2. 주소 갱신은 **조작당 한 번**이다. 조건과 쪽을 따로 갱신하면 뒤로가기 기록이 두 칸 늘어
   *    사용자가 뒤로 눌렀는데 같은 자리로 돌아온 것처럼 보인다.
   */
  /*
   * **주소가 바뀔 때만 새 참조를 만든다.** 렌더마다 새 객체를 만들면 내용이 같아도 참조가 달라,
   * 이 값을 되돌림 기준으로 삼는 조건 줄이 **부모가 다시 그려질 때마다** 입력을 덮어쓴다(#43).
   * 조회 응답이 도착하는 순간(대기 → 성공)이 실제로 그 자리다.
   */
  const filters = useMemo<InboxFilters>(() => readFilters(searchParams), [searchParams]);

  /*
   * **탭도 읽는 자리에서 뜻을 판정한다.** 권한이 없으면 `?tab=all`이 기본 탭으로 읽히므로
   * (`tabs.ts`) 화면에 서지 않는 탭의 쿼리가 나가는 일이 없다.
   */
  const tab = readTab(readTabParam(searchParams), canSeeAllRequests);
  const page = readPage(searchParams);
  const selectedRequestId = readSelectedRequestId(searchParams);

  /*
   * **조건 없이도 조회한다.** 계약이 어느 파라미터도 필수로 두지 않았고, 결재함은 들어오자마자
   * 내 결재 대기를 보여야 하는 자리다 — 탭이 이미 범위를 좁히고 있다.
   */
  const listQuery = toRequestListQuery(filters, tab, page);
  const list = useRequestList(listQuery);
  const items = list.data?.items ?? EMPTY_ITEMS;
  const rows = useMemo(() => items.map(toRequestRow), [items]);
  const pageView = toPageView(list.data?.page ?? { page, size: 0, total: 0 }, items.length);

  /*
   * 대기 건수는 **전용 조회**가 갖는다(`queries.ts`에 근거 표가 있다).
   * 탭·조건·쪽과 무관하게 늘 같은 값이라, 다른 탭에 있어도 「지금 내가 결재할 수 있는 것」의
   * 수가 보인다.
   */
  const pendingCount = usePendingCount();
  const pendingTotal = pendingCount.data?.page.total;

  /**
   * 조건·탭·쪽을 주소에 반영한다. 주소가 정본이라 조회는 주소가 바뀐 결과로 일어난다.
   *
   * **주소 갱신은 한 번이다** — 조건과 쪽을 따로 갱신하면 뒤로가기 기록이 두 칸 늘어난다.
   * `toSearchParams`가 `rq`를 만들지 않으므로 고른 요청도 여기서 함께 풀린다(수명 표 1~4행).
   */
  const apply = (nextFilters: InboxFilters, nextTab: InboxTab, nextPage = 1): void => {
    setSearchParams(toSearchParams(nextFilters, nextTab, nextPage));
  };

  /** 탭 전환(수명 표 3행). 조건은 그대로 두고 **쪽과 선택만** 되돌린다. */
  const changeTab = (nextValue: string): void => {
    const nextTab = readTab(nextValue, canSeeAllRequests);

    if (nextTab === tab) return;

    apply(filters, nextTab);
  };

  /**
   * 요청 고르기·해제(수명 표 5행).
   *
   * **보이는 행을 바꾸지 않는다** — 조건·탭·쪽을 그대로 두고 `rq`만 넣고 뺀다.
   */
  const toggleSelect = (approvalRequestId: number): void => {
    setSearchParams(
      toSelectionSearchParams(
        filters,
        tab,
        page,
        approvalRequestId === selectedRequestId ? null : approvalRequestId,
      ),
    );
  };

  /**
   * 대기 건수 뱃지.
   *
   * **0건이면 스스로 사라지고 100 이상은 `99+`가 된다** — 디자인 시스템 `Badge`가 그 규칙을
   * 갖고 있어 화면이 다시 쓰지 않는다. 접근 이름에는 **줄이지 않은 실제 수**를 담는다.
   *
   * **건수 조회가 실패하거나 아직 오지 않으면 뱃지를 내지 않는다.** 뱃지는 보조 표시라
   * 없는 것이 틀린 수를 보이는 것보다 낫고, 실패해도 목록은 그대로 쓸 수 있어야 한다.
   * 「다시 조회」가 이 조회도 함께 부른다.
   */
  const pendingBadge: ReactNode =
    pendingTotal === undefined ? undefined : (
      <Badge count={pendingTotal} aria-label={t.tabs.pendingBadge(pendingTotal)} />
    );

  /**
   * 목록 구획. **조회에 실패하면 표를 그리지 않는다** — 행이 0건인 표는 「없습니다」를 내는데,
   * 실패를 그렇게 말하면 사용자가 자료가 없는 줄 알고 조건을 넓힌다.
   * 조건 줄과 탭은 남긴다: 조건을 고칠 수단까지 사라지면 안 된다.
   */
  const listPane: ReactNode = (
    <RequestListPane
      rows={rows}
      isLoading={list.isPending}
      pageView={pageView}
      onChangePage={(nextPage) => {
        apply(filters, tab, nextPage);
      }}
      selectedRequestId={selectedRequestId}
      onSelect={toggleSelect}
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
  );

  /**
   * 탭. **활성 탭의 `content`에만 목록을 담는다** — `Tabs`는 패널을 전부 렌더하고 비활성만
   * 감추므로, 두 패널에 표를 두면 같은 자료가 두 번 그려지고 접근성 트리에 표가 둘이 된다.
   *
   * 그릴 탭은 `visibleTabs`가 정한다 — 「전체」 탭의 권한 자리표시를 읽는 자리를 한 곳으로
   * 묶어 두어야, 판정이 생겼을 때 고칠 자리가 하나다.
   */
  const tabItems: TabItem[] = visibleTabs(canSeeAllRequests).map((value) => ({
    value,
    label: tabLabel(value),
    /* 대기 건수는 「지금 내가 결재할 수 있는 것」의 수라 그 탭에 붙는다. */
    badge: value === 'pending' ? pendingBadge : undefined,
    content: value === tab ? listPane : null,
  }));

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
        actions={
          <Button
            variant="outlined"
            size="sm"
            onClick={() => {
              /*
               * **화면이 보고 있는 조회를 전부 다시 한다**(수명 표 10행). 목록만 다시 부르면
               * 갱신된 목록과 낡은 대기 건수가 한 화면에 섞인다 — 방금 결재된 건이 빠진
               * 목록 옆에 그 건을 포함한 뱃지가 서 있게 된다.
               *
               * 조건·탭·쪽·선택은 하나도 바꾸지 않는다.
               */
              void list.refetch();
              void pendingCount.refetch();
            }}
          >
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
          approvalTypeOptions={toCodeOptions(PLACEHOLDER_APPROVAL_TYPE_CODES)}
          statusOptions={toCodeOptions(PLACEHOLDER_REQUEST_STATUS_CODES)}
          onSearch={(nextFilters) => {
            apply(nextFilters, tab);
          }}
          onRemoveFilter={(key: FilterChipKey) => {
            apply(clearFilter(filters, key), tab);
          }}
          onReset={() => {
            apply(EMPTY_FILTERS, tab);
          }}
        />

        <Tabs aria-label={t.tabs.label} items={tabItems} value={tab} onChange={changeTab} />
      </section>

      {/*
       * 아래 구획 — **이 회차에는 「고르세요」 안내만 선다.**
       *
       * 고른 뒤의 내용(사유 전문 · 대상 · 결재 진행)은 다음 회차가 이 자리를 채운다. 지금
       * 요청을 고르면 이 구획이 사라지는데, 그것이 「아직 없다」의 정직한 모습이다 —
       * 빈 상자를 남겨 두면 무언가 실패한 것처럼 보이고, 안내를 그대로 두면 이미 고른
       * 사용자에게 다시 고르라고 말한다. **화면이 라우트에 붙어 있지 않아** 사용자가 이
       * 상태에 닿지 않는다.
       */}
      {selectedRequestId === null && (
        <section className="pane" aria-label={t.panes.detail}>
          <EmptyState
            size="sm"
            title={t.empty.noSelectionTitle}
            description={t.empty.noSelectionDescription}
          />
        </section>
      )}
    </>
  );
};
