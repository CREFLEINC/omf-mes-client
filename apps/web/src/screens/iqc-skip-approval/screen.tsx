import { Breadcrumb, Button, EmptyState, PageHeader } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router';

import {
  IQC_SKIP_APPROVAL_TYPE_CODE,
  PLACEHOLDER_REQUEST_STATUS_CODES,
  toCodeOptions,
  typePendingNote,
} from './code-options';
import {
  EMPTY_FILTERS,
  clearFilter,
  readFilters,
  readPage,
  readPendingOnly,
  readSelectedRequestId,
  toRequestListQuery,
  toSearchParams,
  toSelectionSearchParams,
  type FilterChipKey,
} from './filters';
import { LoadErrorBanner } from './load-error-banner';
import { toPageView } from './pagination';
import { useRequestList } from './queries';
import { RequestFilterBar } from './request-filter-bar';
import { RequestListPane } from './request-list-pane';
import { toRequestRow, type ApprovalRequest, type RequestFilters } from './types';

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
 * **이 회차는 목록까지다.** 고른 요청의 상세·결재 진행·대상은 다음 회차가 아래 구획을 채우고,
 * 승인·반려와 라우트 등록은 그다음 회차다. 지금 이 화면은 **라우트에 붙어 있지 않다** —
 * 결재할 수 없는 판정 화면을 사용자에게 내보이지 않기 위해서다.
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
 * **이 회차가 세우는 것은 S0뿐이다.** S1~S3은 상세 조회가 붙는 다음 회차의 것이며,
 * 지금은 `rq`가 주소에 서기만 한다. **표를 먼저 적어 두는 이유**는 다음 회차가 상태를 하나 더
 * 만들 때 규칙을 정하기 전에 표에 행부터 더하게 하기 위해서다.
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
   * **이 회차가 세우는 것은 1~5·10행의 앞 넷(조건·`pd`·`page`·`rq`)뿐이다.** 6~7·16행은
   * 상세 조회가, 8~15·17행과 뒤 세 칸(초안·창·배너)은 결재가 붙는 회차의 것이다.
   * 표를 통째로 먼저 적는 이유는 **표에 오르지 않은 상태가 규칙이 닿지 않는 사각**이 되기
   * 때문이며, 열여덟째 조작이 생기면 규칙을 정하기 전에 이 표에 행부터 더한다.
   *
   * **왜 이렇게 정했는가**(이 회차에 해당하는 것만)
   *
   * - **1·3·4행이 `rq`를 비우는 이유**: 조건·범위·쪽이 바뀌면 보이는 행이 달라진다. 남겨 두면
   *   아래 구획이 **목록에 없는 요청**을 가리킨 채 열려 있고, 그것이 어디서 왔는지 알 수 없다.
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

  /**
   * 조건·범위·쪽을 주소에 반영한다. 주소가 정본이라 조회는 주소가 바뀐 결과로 일어난다.
   *
   * **주소 갱신은 한 번이다** — 조건과 쪽을 따로 갱신하면 뒤로가기 기록이 두 칸 늘어난다.
   * `toSearchParams`가 `rq`를 만들지 않으므로 고른 요청도 여기서 함께 풀린다(수명 표 1~4행).
   */
  const apply = (nextFilters: RequestFilters, nextPendingOnly: boolean, nextPage = 1): void => {
    setSearchParams(toSearchParams(nextFilters, nextPendingOnly, nextPage));
  };

  /**
   * 요청 고르기·해제(수명 표 5행).
   *
   * **보이는 행을 바꾸지 않는다** — 조건·범위·쪽을 그대로 두고 `rq`만 넣고 뺀다.
   */
  const toggleSelect = (approvalRequestId: number): void => {
    setSearchParams(
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
   * 지금 이 화면이 보고 있는 조회는 목록 하나뿐이다. 회차가 늘어 상세·대상 처리 현황이 붙으면
   * **그것들도 여기서 함께 부른다** — 목록만 다시 부르면 갱신된 목록과 낡은 상세가 한 화면에
   * 섞인다(W-01-07이 남긴 결함의 형태). 조건·범위·쪽·선택은 하나도 바꾸지 않는다.
   */
  const handleReload = (): void => {
    void list.refetch();
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
          /* 수명 표 2행 — 「처음 상태」에는 켜진 확인칸도 든다. */
          onReset={() => {
            apply(EMPTY_FILTERS, true);
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
       * 아래 구획 — **이 회차에는 「고르세요」 안내만 선다.**
       *
       * 고른 뒤의 내용(사유 전문 · 대상 · 결재 진행 · 결재)은 다음 회차들이 이 자리를 채운다.
       * 지금 요청을 고르면 이 구획이 사라지는데, 그것이 「아직 없다」의 정직한 모습이다 —
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
