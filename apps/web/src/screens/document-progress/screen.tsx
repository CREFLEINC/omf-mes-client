import { Breadcrumb, EmptyState, PageHeader, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { PLACEHOLDER_DOCUMENT_STATUS_CODES, toStatusOptions } from './code-options';
import { DetailPane } from './detail-pane';
import {
  readSelectedDocumentId,
  toDetailSelection,
  withoutSelection,
  withSelection,
} from './detail-selection';
import {
  describeDisabledTypes,
  DOCUMENT_TYPES,
  isDocumentTypeListPending,
  toDocumentTypeOptions,
} from './document-types';
import {
  DEFAULT_PROGRESS_FILTERS,
  readFilters,
  readPage,
  toListQuery,
  toSearchParams,
  type ProgressFilters,
} from './filters';
import { LoadErrorBanner } from './load-error-banner';
import { PageNav } from './page-nav';
import { toPageView } from './pagination';
import { ProgressFilterBar } from './progress-filter-bar';
import { ProgressTable } from './progress-table';
import {
  isDocumentProgressNotFound,
  useDocumentProgressDetail,
  useDocumentProgressList,
} from './queries';
import { SCREEN_ROUTES } from './screen-routes';

const t = messages.documentProgress;

/**
 * W-01-13 물류 문서 진행현황·취소 — **이 회차(작업 단위 ①·②)는 목록과 고른 문서의 상세까지다.**
 *
 * 읽는 것이 주 동작이고 편집 폼이 없어 2단 배치를 쓰지 않는다. 표가 창 폭을 다 쓰고
 * 고른 문서의 상세는 **목록 아래 구획**에 선다(드로어도 창도 아니다 — 디자인 시스템에 드로어가
 * 없고, 창이면 목록이 가려져 「고르고 다시 목록으로 돌아가는」 반복이 매번 열고 닫는 일이 된다).
 * 조회 조건과 고른 문서는 전부 주소가 소유한다 — 새로고침·뒤로가기·공유가 같은 결과를 낸다.
 *
 * ⭐ **지금 이 화면은 요청을 한 번도 보내지 않는다.** 문서 유형 값 목록이 확정되지 않아
 * (omf-mes#64) 자리표시 표가 비어 있고, 계약은 유형을 목록 조회의 **필수** 질의값으로 두었다.
 * 그것이 지금의 정직한 모습이며 화면은 그 사실을 「선택지 준비 중」 안내로 말한다 —
 * 빈 표를 내면 사용자는 조건에 맞는 문서가 없는 줄 안다.
 *
 * **표를 채우면 저절로 살아난다.** 채울 자리는 `document-types.ts` 한 곳이고, 이 파일은
 * 그 표를 **인자로 넘길 뿐** 값을 읽어 분기하지 않는다.
 *
 * **취소 조작은 이 회차에 없다.** 라우트와 사이드바도 아직 열지 않는다 — 취소 실행이
 * 서기 전에 화면을 열면 승인을 받아 놓고 실행할 자리가 없는 상태가 사용자에게 보인다.
 */
export const DocumentProgressScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  /**
   * **주소 키의 수명 — 무엇이 바뀔 때 무엇을 비우는가.**
   *
   * | # | 조작 | `page` | `sel`(고른 문서) | 왜 |
   * | :-: | --- | --- | --- | --- |
   * | 1 | 조건 변경 · 초기화 | **첫 쪽으로** | **비운다** | 결과가 통째로 달라진다. 3쪽을 보다 조건을 좁히면 빈 쪽이 되고, 고른 문서도 새 결과에 없을 수 있다 |
   * | 2 | 쪽 이동 | 옮긴 쪽 | **비운다** | 조건은 그대로지만 고른 문서는 그 쪽에 없다 |
   * | 3 | 문서 고르기·해제 | 유지 | 넣고 뺀다 | 보이는 줄을 바꾸지 않는다 — 3쪽에서 고른 문서를 보는 동안 목록이 1쪽으로 튀면 안 된다 |
   * | 4 | 상세가 404 | 유지 | **비운다**(`replace`) | 사용자가 한 조작이 아니다 — 히스토리를 늘리면 뒤로가기가 없는 문서로 되돌아가 같은 정리가 되풀이된다 |
   * | 5 | **새로고침**(재조회) | 유지 | **유지** | 새로고침은 같은 조회를 다시 하는 것이다. 무언가를 비우면 새로고침이 조건 변경으로 둔갑한다 |
   *
   * **구현 규칙 하나가 1·2행을 함께 지킨다** — `toSearchParams(filters, page)`가 **`sel`을 만들지
   * 않는다.** 조건·쪽을 다시 쓰는 길이 모두 그 함수를 지나므로 비우는 것을 따로 적을 자리가 없고,
   * 고르는 쪽(`withSelection`)만 그 결과에 덧붙인다.
   */
  /*
   * **주소가 바뀔 때만 새 참조를 만든다.** 렌더마다 새 객체를 만들면 내용이 같아도 참조가 달라,
   * 이 값을 되돌림 기준으로 삼는 조건 줄이 **부모가 다시 그려질 때마다** 입력을 덮어쓴다.
   * 조회 응답이 도착하는 순간(대기 → 성공)이 실제로 그 자리이며, 사용자에게는
   * 「치던 값이 갑자기 사라졌다」로 나타난다. `searchParams`는 주소가 바뀔 때만 새 참조다.
   */
  const filters = useMemo<ProgressFilters>(() => readFilters(searchParams), [searchParams]);
  const page = readPage(searchParams);

  /*
   * 자리표시 표는 **여기서 읽어 아래로 넘긴다.** 부품이나 판정 함수가 상수를 직접 읽으면
   * 「값이 확정되면 무엇이 살아나는가」를 화면 수준에서 잴 수 없다.
   */
  const documentTypes = DOCUMENT_TYPES;
  const documentTypeOptions = toDocumentTypeOptions(documentTypes);
  const disabledReasons = describeDisabledTypes(documentTypes);
  const statusOptions = toStatusOptions(PLACEHOLDER_DOCUMENT_STATUS_CODES);

  /*
   * ⭐ **조회가 성립하는가를 한 곳에서 정한다.** `toListQuery`가 `null`을 주면 목록 조회는
   * 나가지 않는다 — 표가 비어 있는 동안에는 어떤 주소로 들어와도 `null`이다.
   */
  const listQuery = toListQuery(filters, documentTypes, page);
  const list = useDocumentProgressList(listQuery);

  const rows = list.data?.items ?? [];
  const pageView = toPageView(list.data?.page ?? { page, size: 0, total: 0 }, rows.length);

  /*
   * ⭐ **고른 문서도 주소에서 나온다 — 목록 응답에서 찾지 않는다.** 대상이 주소에 있으므로
   * 새로고침·주소 공유로 들어와도 상세가 곧바로 나가고(계획 갈래 24), 목록이 실패한 동안에도
   * 고른 문서를 볼 수 있다. 잣대는 목록과 **같은 한 곳**(`findSelectableDocumentType`)이다.
   */
  const selection = toDetailSelection(filters, documentTypes, searchParams);
  const detail = useDocumentProgressDetail(selection);

  /**
   * 없음 안내가 매인 대상 — **조건·쪽의 서명**이다.
   *
   * 안내를 끄는 자리를 클릭 핸들러에 두면 뒤로가기·주소 직접 편집이 그 길을 지나지 않아 문장이
   * 남는다. 서명에 매어 두면 조회 조건이 바뀌는 순간 저절로 걷힌다 — 그 안내가 가리키던 목록이
   * 더는 화면에 없기 때문이다.
   */
  const listContextKey = toSearchParams(filters, page).toString();
  const [missingContextKey, setMissingContextKey] = useState<string | null>(null);

  const isDetailNotFound = detail.isError && isDocumentProgressNotFound(detail.error);

  /*
   * 404면 주소에 남은 선택을 정리하고 **그 순간의 서명**에 안내를 맨다(수명 표 4행).
   *
   * **히스토리를 늘리지 않는다**(`replace`) — 늘리면 뒤로가기가 없는 문서로 되돌아가고, 그
   * 자리에서 다시 404가 나 같은 정리가 되풀이되어 사용자가 갇힌다(사본 체크리스트 1번).
   *
   * **정리를 클릭 핸들러가 아니라 조회 결과에 묶는다.** 뒤로가기·주소 직접 편집은 핸들러를
   * 거치지 않고 주소만 바꾸므로, 핸들러에 두면 그 경로가 통째로 샌다.
   */
  useEffect(() => {
    if (!isDetailNotFound) return;

    setMissingContextKey(listContextKey);
    setSearchParams((prev) => withoutSelection(prev), { replace: true });
  }, [isDetailNotFound, listContextKey, setSearchParams]);

  /** 방금 정리한 그 목록을 아직 보고 있는가. 조건이 바뀌면 안내가 가리킬 것이 없다. */
  const isDetailMissing =
    readSelectedDocumentId(searchParams) === null && missingContextKey === listContextKey;

  /**
   * 조건을 주소에 반영한다. 주소가 정본이라 조회는 주소가 바뀐 결과로 일어난다.
   *
   * **조건이 바뀌면 쪽을 첫 쪽으로 되돌린다**(수명 규칙 1행) — 3쪽을 보다가 조건을 좁히면
   * 결과가 3쪽에 못 미쳐 사용자에게는 「조건을 좁혔더니 아무것도 없다」로 보인다.
   */
  const applyQuery = (nextFilters: ProgressFilters, nextPage = 1): void => {
    setSearchParams(toSearchParams(nextFilters, nextPage));
  };

  /**
   * 문서 고르기·해제(수명 표 3행).
   *
   * **보이는 줄을 바꾸지 않는다** — 조건·쪽을 그대로 두고 `sel`만 넣고 뺀다. 고를 때 첫 쪽으로
   * 튀면 사용자가 3쪽에서 고른 문서의 상세를 보는 동안 목록은 1쪽이 된다.
   */
  const toggleSelect = (documentId: number): void => {
    const base = toSearchParams(filters, page);

    setSearchParams(documentId === selection?.documentId ? base : withSelection(base, documentId));
  };

  /**
   * 문서·후속 열기. **주소는 표(`SCREEN_ROUTES`)가 정하고 화면은 옮기기만 한다.**
   *
   * 지금은 표가 비어 있어 이 자리가 불리지 않는다 — 그래도 판정과 이동을 갈라 두는 이유는,
   * 표에 줄이 생기는 날 **표 한 곳만 고치면** 열기가 살아나게 하기 위해서다.
   */
  const openScreen = (path: string): void => {
    void navigate(path);
  };

  /**
   * 아래 구획. 넷 중 하나만 낸다 — 사용자가 할 조치가 서로 다르다.
   *
   * ⭐ **실패를 로딩보다 앞에서 판정한다**(사본 대조 추가 ①). 먼저 로딩을 보면 실패한 조회가
   * 영원히 「불러오는 중」으로 보이고, 사용자는 기다리면 될 일이라고 읽는다. 404가 그보다도
   * 앞인 이유는 **할 일이 다르기 때문**이다 — 다시 시도가 아니라 다시 조회하고 다시 고르는 것이다.
   *
   * ⭐ **상세가 실패해도 위 목록은 그대로 둔다.** 배너를 이 구획 안에만 내는 것이 그 규칙을
   * 코드로 지키는 형태다 — 화면 전체를 덮으면 사용자가 목록까지 못 쓰게 되는데, 실패한 것은
   * 고른 문서 한 벌뿐이다.
   */
  const detailSlot = (): ReactNode => {
    if (isDetailNotFound || isDetailMissing) {
      return (
        <EmptyState
          size="sm"
          live
          title={t.empty.detailNotFoundTitle}
          description={t.empty.detailNotFoundDescription}
        />
      );
    }

    if (selection === null) {
      return (
        <EmptyState
          size="sm"
          title={t.empty.noSelectionTitle}
          description={t.empty.noSelectionDescription}
        />
      );
    }

    if (detail.isError) {
      return <LoadErrorBanner error={detail.error} onRetry={() => void detail.refetch()} />;
    }

    if (detail.data === undefined) {
      return (
        <div role="status" aria-label={t.loading.detail}>
          <SkeletonText lines={3} />
        </div>
      );
    }

    return <DetailPane detail={detail.data} routes={SCREEN_ROUTES} onOpen={openScreen} />;
  };

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
      />

      {list.isError && <LoadErrorBanner error={list.error} onRetry={() => void list.refetch()} />}

      <section className="pane" aria-label={t.title}>
        {/* 결과가 없어도 조건 줄은 감추지 않는다 — 조건을 고칠 수단이 사라지면 안 된다. */}
        <ProgressFilterBar
          appliedFilters={filters}
          documentTypeOptions={documentTypeOptions}
          disabledTypeNote={
            disabledReasons === undefined ? undefined : t.filters.disabledTypes(disabledReasons)
          }
          statusOptions={statusOptions}
          onSearch={(nextFilters) => {
            applyQuery(nextFilters);
          }}
          onReset={() => {
            applyQuery(DEFAULT_PROGRESS_FILTERS);
          }}
        />

        {/*
         * 조회에 실패했으면 표도 빈 상태도 내지 않는다 — 실패를 「없습니다」로 보이면 사용자가
         * 자료가 없는 줄 알고 조건을 넓힌다.
         */}
        {!list.isError && (
          <>
            <ProgressTable
              rows={rows}
              isLoading={listQuery !== null && list.isPending}
              isTypeListPending={isDocumentTypeListPending(documentTypes)}
              hasDocumentType={listQuery !== null}
              isBeyondLast={pageView.isBeyondLast}
              onFirstPage={() => {
                applyQuery(filters);
              }}
              selectedDocumentId={selection?.documentId ?? null}
              onToggleSelect={toggleSelect}
            />
            {listQuery !== null && !list.isPending && (
              <PageNav
                view={pageView}
                onChange={(nextPage) => {
                  applyQuery(filters, nextPage);
                }}
              />
            )}
          </>
        )}
      </section>

      {/*
       * **아래 구획은 조회가 성립할 때만 낸다.** 유형 표가 비어 있거나 유형을 고르지 않았으면
       * 고를 대상 자체가 없어, 구획을 두면 「고르세요」가 할 수 없는 일을 시키는 안내가 된다.
       *
       * ⭐ **목록이 실패해도 낸다.** 이 구획은 목록 응답을 쓰지 않고 주소가 가리키는 문서를
       * 그린다 — 한쪽이 실패했다고 다른 쪽을 감추면 사용자가 쓸 수 있는 것까지 잃는다.
       */}
      {listQuery !== null && (
        <section className="pane" aria-label={t.panes.detail}>
          {detailSlot()}
        </section>
      )}
    </>
  );
};
