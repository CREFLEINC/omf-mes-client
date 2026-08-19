import { Breadcrumb, PageHeader } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router';

import { PLACEHOLDER_DOCUMENT_STATUS_CODES, toStatusOptions } from './code-options';
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
import { useDocumentProgressList } from './queries';

const t = messages.documentProgress;

/**
 * W-01-13 물류 문서 진행현황·취소 — **이 회차(작업 단위 ①)는 목록까지다.**
 *
 * 읽는 것이 주 동작이고 편집 폼이 없어 2단 배치를 쓰지 않는다. 표가 창 폭을 다 쓰고
 * 조회 조건은 전부 주소가 소유한다 — 새로고침·뒤로가기·공유가 같은 결과를 낸다.
 *
 * ⭐ **지금 이 화면은 요청을 한 번도 보내지 않는다.** 문서 유형 값 목록이 확정되지 않아
 * (omf-mes#64) 자리표시 표가 비어 있고, 계약은 유형을 목록 조회의 **필수** 질의값으로 두었다.
 * 그것이 지금의 정직한 모습이며 화면은 그 사실을 「선택지 준비 중」 안내로 말한다 —
 * 빈 표를 내면 사용자는 조건에 맞는 문서가 없는 줄 안다.
 *
 * **표를 채우면 저절로 살아난다.** 채울 자리는 `document-types.ts` 한 곳이고, 이 파일은
 * 그 표를 **인자로 넘길 뿐** 값을 읽어 분기하지 않는다.
 *
 * **상세 구획·취소 조작은 이 회차에 없다.** 라우트와 사이드바도 아직 열지 않는다 — 취소 실행이
 * 서기 전에 화면을 열면 승인을 받아 놓고 실행할 자리가 없는 상태가 사용자에게 보인다.
 */
export const DocumentProgressScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  /**
   * **주소 키의 수명 — 무엇이 바뀔 때 무엇을 비우는가.**
   *
   * | # | 조작 | `page` | 왜 |
   * | :-: | --- | --- | --- |
   * | 1 | 조건 변경 · 초기화 | **첫 쪽으로** | 결과가 통째로 달라진다. 3쪽을 보다 조건을 좁히면 빈 쪽이 된다 |
   * | 2 | 쪽 이동 | 옮긴 쪽 | 조건은 그대로다 |
   *
   * 고른 문서(상세)의 키는 아직 없다 — 상세 구획이 생기는 회차에서 이 표에 행이 는다.
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

  /**
   * 조건을 주소에 반영한다. 주소가 정본이라 조회는 주소가 바뀐 결과로 일어난다.
   *
   * **조건이 바뀌면 쪽을 첫 쪽으로 되돌린다**(수명 규칙 1행) — 3쪽을 보다가 조건을 좁히면
   * 결과가 3쪽에 못 미쳐 사용자에게는 「조건을 좁혔더니 아무것도 없다」로 보인다.
   */
  const applyQuery = (nextFilters: ProgressFilters, nextPage = 1): void => {
    setSearchParams(toSearchParams(nextFilters, nextPage));
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
    </>
  );
};
