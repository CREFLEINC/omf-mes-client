import {
  AlertBanner,
  Checkbox,
  type Column,
  EmptyState,
  SkeletonText,
  Table,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { hasDuplicateDisplayOrder, sortForDisplay } from './code-value-order';
import type { CodeValue } from './code-value-types';
import { PageNav } from './page-nav';
import type { PageView } from './pagination';

const t = messages.commonCode.codeValue;

export interface CodeValueListPaneProps {
  codeValues: CodeValue[];
  isLoading: boolean;
  /** 코드그룹을 고르지 않았으면 거짓. 조회 자체가 나가지 않은 상태다. */
  isGroupSelected: boolean;
  includeInactive: boolean;
  onIncludeInactiveChange: (includeInactive: boolean) => void;
  pageView: PageView;
  onChangePage: (page: number) => void;
  selectedCodeValueId: number | null;
  onSelect: (codeValueId: number) => void;
  /** 「코드값 추가」 자리. 그룹을 고르지 않았을 때의 비활성 처리는 조립부가 정한다 */
  addAction: ReactNode;
  /**
   * 조회 실패 표시. null이 아니면 표·빈 상태 대신 이것을 낸다 —
   * 실패를 「등록된 코드값이 없습니다」로 보이면 사실과 다른 안내가 된다.
   */
  loadError: ReactNode;
}

/** 유효기간 표기. 한쪽만 있는 것도 계약이 허용한다 — 없는 쪽을 지어내지 않고 자리를 비운다. */
const formatPeriod = (from: string | null | undefined, to: string | null | undefined): string => {
  const empty = messages.commonCode.values.empty;

  if ((from ?? '') === '' && (to ?? '') === '') return empty;

  return t.values.period(from ?? empty, to ?? empty);
};

/**
 * 우 칸 가운데 — 고른 코드그룹의 코드값 목록.
 *
 * **순서 이동 버튼([↑][↓])을 두지 않는다.** 이 화면의 저장은 행 단위이고, 한 번의 이동이
 * 여러 행을 바꾸면 각 행이 자기 잠금 토큰을 요구해 중간에 실패한 채 남는다.
 * 대신 「정렬 순서」 열로 값을 보이고 값은 폼에서 고친다.
 *
 * **정렬은 화면이 한다** — 계약이 목록의 정렬을 명시하지 않았다. 다만 그 정렬은 받은 쪽
 * 안에서만 유효하므로 쪽이 둘 이상이면 그 사실을 안내한다.
 *
 * 코드값 편집 한 벌의 부품이다 — 다른 자원의 부품·타입·주소를 참조하지 않는다.
 */
export const CodeValueListPane = ({
  codeValues,
  isLoading,
  isGroupSelected,
  includeInactive,
  onIncludeInactiveChange,
  pageView,
  onChangePage,
  selectedCodeValueId,
  onSelect,
  addAction,
  loadError,
}: CodeValueListPaneProps) => {
  const rows = sortForDisplay(codeValues);

  const columns: Column<CodeValue>[] = [
    {
      key: 'code',
      header: t.fields.code,
      width: '160px',
      render: (row) => (
        <button
          type="button"
          className="link-cell"
          aria-current={row.codeValueId === selectedCodeValueId ? 'true' : undefined}
          onClick={() => onSelect(row.codeValueId)}
        >
          {row.code}
        </button>
      ),
    },
    {
      key: 'codeName',
      header: t.fields.codeName,
      render: (row) =>
        row.isActive ? row.codeName : `${row.codeName}${messages.commonCode.values.inactiveSuffix}`,
    },
    {
      key: 'displayOrder',
      header: t.fields.displayOrder,
      width: '96px',
      align: 'end',
      render: (row) => String(row.displayOrder),
    },
    {
      key: 'effectivePeriod',
      header: t.fields.effectivePeriod,
      width: '200px',
      render: (row) => formatPeriod(row.effectiveFrom, row.effectiveTo),
    },
  ];

  /**
   * 빈 상태는 세 갈래다 — 셋을 뭉치면 사실과 다른 안내가 된다.
   * ① 범위 밖 쪽 ② 「미사용 포함」이 꺼진 0건(켜면 나올 수 있다) ③ 정말로 0건.
   */
  const emptySlot = ((): ReactNode => {
    if (pageView.isBeyondLast) {
      return (
        <EmptyState
          size="sm"
          live
          title={messages.commonCode.empty.beyondLastTitle}
          description={messages.commonCode.empty.beyondLastDescription}
        />
      );
    }

    if (!includeInactive) {
      return (
        <EmptyState
          size="sm"
          live
          title={t.empty.noMatchTitle}
          description={t.empty.noMatchDescription}
        />
      );
    }

    return (
      <EmptyState size="sm" live title={t.empty.noneTitle} description={t.empty.noneDescription} />
    );
  })();

  /** 조회 실패 → 로딩 → 표 순서로 하나만 낸다. 실패했는데 빈 표를 함께 보이면 안 된다. */
  const listSlot = (): ReactNode => {
    if (loadError !== null && loadError !== undefined) return loadError;

    if (isLoading) {
      return (
        <div role="status" aria-label={t.loading.list}>
          <SkeletonText lines={3} />
        </div>
      );
    }

    return (
      <>
        {/*
         * 열이 넷이라 좁은 칸에서는 짓눌린다 — 지정 폭 합 456px이 `.wide-table`의
         * 최소 폭 안에 들어가므로 모자라면 짓누르는 대신 가로로 넘긴다.
         */}
        <div className="wide-table">
          <Table
            density="compact"
            columns={columns}
            rows={rows}
            getRowId={(row) => String(row.codeValueId)}
            empty={emptySlot}
          />
        </div>
        <PageNav view={pageView} onChange={onChangePage} label={t.pageNavLabel} />
      </>
    );
  };

  if (!isGroupSelected) {
    return (
      <section className="pane" aria-label={t.paneTitle}>
        <EmptyState size="sm" title={t.empty.groupNotSelected} />
        {/*
         * 그룹을 고르기 전에도 「코드값 추가」를 감추지 않는다 — 감추면 사용자가
         * 「이 화면에는 없는 기능」으로 오해하고 다른 곳을 찾는다(배치 규범 4).
         */}
        <div className="filter-bar">{addAction}</div>
      </section>
    );
  }

  return (
    <section className="pane" aria-label={t.paneTitle}>
      {/*
       * 정렬이 이 쪽 안에서만 도는 사실을 감추지 않는다. 한 쪽뿐이면 낼 것이 없다.
       * 겹친 정렬 순서는 서버가 허용하는 값이라 막지 않고 알리기만 한다.
       */}
      {pageView.totalPages > 1 && (
        <div className="banner-slot">
          <AlertBanner variant="info">{t.notices.sortWithinPage}</AlertBanner>
        </div>
      )}

      {hasDuplicateDisplayOrder(rows) && (
        <div className="banner-slot">
          <AlertBanner variant="warning">{t.notices.duplicateDisplayOrder}</AlertBanner>
        </div>
      )}

      <div className="filter-bar">
        {/* 해제 축이라 변경 즉시 적용한다. */}
        <div className="field-cell field-cell-unlabeled">
          <Checkbox
            checked={includeInactive}
            onChange={(event) => onIncludeInactiveChange(event.target.checked)}
          >
            {messages.common.includeInactive}
          </Checkbox>
        </div>
      </div>

      {listSlot()}

      <div className="filter-bar">{addAction}</div>
    </section>
  );
};
