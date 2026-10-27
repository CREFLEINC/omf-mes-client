import { Button, Chip, type Column, EmptyState, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { useColumnOrder } from '../../patterns/column-grip-order';
import { useFitColumns } from '../../patterns/column-fit';
import { useColumnWidths } from '../../patterns/column-resize';

import { DEFAULT_PLAN_FILTERS, inspectionTypeLabel } from './code-options';
import { DisabledAction } from './disabled-action';
import { hasAnyFilter } from './filters';
import { PageNav, type PageNavMeta, type PageSize } from '../../patterns/page-nav';
import type { PageView } from './pagination';
import type { InspectionPlan, PlanFilters } from './types';

const t = messages.inspectionStandard;

export interface PlanListPaneProps {
  plans: InspectionPlan[];
  isLoading: boolean;
  /** 적용된 조건 — 0건 안내를 가른다(조건 줄은 `PlanFilterBar` 가 목록 위에 따로 세운다) */
  appliedFilters: PlanFilters;
  /** 0건 안내의 초기화가 호출한다 */
  onApplyFilters: (next: PlanFilters) => void;
  pageView: PageView;
  /** 서버가 준 쪽 정보 — 공용 쪽 이동(총 건수 · 쪽 크기 · 처음/이전/다음/마지막)이 읽는다(#196). */
  pageMeta: PageNavMeta;
  onChangePageSize: (size: PageSize) => void;
  onChangePage: (page: number) => void;
  selectedPlanId: number | null;
  onSelect: (inspectionPlanId: number) => void;
  /** 등록 폼이 이미 열려 있으면 참. 같은 폼을 두 번 열지 않는다 */
  isCreating: boolean;
  onAddPlan: () => void;
  /**
   * 조회 실패 표시. null이 아니면 표·빈 상태 대신 이것을 낸다 —
   * 실패를 「등록된 검사기준이 없습니다」로 보이면 사실과 다른 안내가 된다.
   */
  loadError: ReactNode;
  /** 품목 번호 → 표시 이름. 품목이 없으면(전 품목 공통) null */
  itemLabelOf: (itemId: number | null | undefined) => string | null;
  /** 공정 번호 → 표시 이름. 공정이 없으면 null */
  processLabelOf: (processId: number | null | undefined) => string | null;
}

/**
 * 좌 페인 — 검사기준을 찾아 고르는 자리.
 *
 * **열은 셋뿐이다**(기준코드·기준명·유형). 계약의 목록 행에는 품목·승인 시각·사용 여부도 있으나
 * 이 칸이 `minmax(240px, 1fr)`이라 열을 늘리면 표를 읽을 수 없다 —
 * 승인 여부와 품목은 기준을 고른 뒤 「기준 정보」 구획의 값 표기로 본다.
 *
 * **정렬 가능한 열을 두지 않는다.** 계약의 목록 쿼리에 정렬 파라미터가 없어
 * 화면이 정렬하면 지금 쪽 안에서만 도는 정렬이 되어 사용자를 속인다.
 */
export const PlanListPane = ({
  plans,
  isLoading,
  appliedFilters,
  onApplyFilters,
  pageView,
  pageMeta,
  onChangePageSize,
  onChangePage,
  selectedPlanId,
  onSelect,
  isCreating,
  onAddPlan,
  loadError,
  itemLabelOf,
  processLabelOf,
}: PlanListPaneProps) => {
  const columns: Column<InspectionPlan>[] = [
    {
      key: 'inspectionPlanCode',
      align: 'start',
      header: t.fields.inspectionPlanCode,
      width: '240px',
      /*
       * 기준 코드는 링크 모양을 걷고 본문 글자로 둔다(omf-all-around#196) — 줄 아무 곳이나 눌러 고른다.
       * 단추는 남긴다: 키보드·화면 낭독기가 줄을 고르는 길이고, 고른 줄 표시(`aria-current`)가 여기 실린다.
       */
      render: (row) => (
        <button
          type="button"
          className="inspection-standard-plan-open"
          aria-current={row.inspectionPlanId === selectedPlanId ? 'true' : undefined}
          title={row.inspectionPlanCode}
          onClick={() => onSelect(row.inspectionPlanId)}
        >
          {row.inspectionPlanCode}
        </button>
      ),
    },
    {
      key: 'inspectionPlanName',
      align: 'start',
      header: t.fields.inspectionPlanName,
      width: '280px',
      render: (row) => <span title={row.inspectionPlanName}>{row.inspectionPlanName}</span>,
    },
    {
      key: 'inspectionTypeCode',
      align: 'center',
      header: t.fields.inspectionType,
      width: '136px',
      render: (row) => inspectionTypeLabel(row.inspectionTypeCode),
    },
    /* 목록에서 바로 가를 수 있게 품목 · 공정 · 승인 · 사용 · PQC 생략 허용을 함께 싣는다(사용자 지시 · #196). */
    {
      key: 'itemProcess',
      align: 'start',
      header: t.listColumns.itemProcess,
      width: '240px',
      render: (row) => {
        const label = [itemLabelOf(row.itemId) ?? t.values.allItems, processLabelOf(row.processId)]
          .filter((part): part is string => part !== null)
          .join(' / ');
        return <span title={label}>{label}</span>;
      },
    },
    {
      key: 'approvedAt',
      align: 'center',
      header: t.listColumns.approval,
      width: '96px',
      render: (row) =>
        row.approvedAt === null || row.approvedAt === undefined ? (
          <Chip variant="status" size="sm" status="warning">
            {t.listColumns.notApproved}
          </Chip>
        ) : (
          <Chip variant="status" size="sm" status="success">
            {t.listColumns.approved}
          </Chip>
        ),
    },
    {
      key: 'isActive',
      align: 'center',
      header: t.listColumns.active,
      width: '96px',
      render: (row) => (
        <Chip variant="status" size="sm" status={row.isActive ? 'success' : 'idle'}>
          {row.isActive ? t.detail.chipActive : t.detail.chipInactive}
        </Chip>
      ),
    },
    {
      key: 'pqcSkipAllowed',
      align: 'center',
      header: t.listColumns.pqcSkip,
      width: '96px',
      /* PQC 기준에만 뜻이 있다 — 다른 유형은 빈 표시. */
      render: (row) =>
        row.inspectionTypeCode === 'PQC' && row.pqcSkipAllowed === true
          ? t.listColumns.pqcSkipAllowed
          : messages.common.reference.empty,
    },
  ];

  /* 열 순서·폭은 사용자가 바꾸고 브라우저에 남는다 — 검사 조회·판정 목록과 같다(omf-all-around#196). */
  const ordered = useColumnOrder('omf-mes:inspection-standard:columns:plans:order', columns);
  const resizable = useColumnWidths('omf-mes:inspection-standard:columns:plans', ordered, {
    fitContent: true,
  });
  /* 상자 폭을 넘지 않는다 — 넓혀 둔 열이 많으면 비율대로 줄여 맞춘다. 더 넓히면 표 안에서 가로로 구른다. */
  const fit = useFitColumns(resizable.columns, { scrollX: true });

  /**
   * 빈 상태는 세 갈래다 — **셋을 뭉치면 사실과 다른 안내가 된다.**
   *
   * ① 범위 밖 쪽: 결과는 있는데 이 쪽에 없다. 주소를 손으로 고치거나 조건이 좁아졌을 때 생기며
   *   「등록된 것이 없다」로 내면 거짓말이 된다 — 돌아갈 길(첫 쪽으로)을 함께 준다.
   * ② 조건이 걸린 0건: 조건을 줄이면 나올 수 있다.
   * ③ 조건 없는 0건: 정말로 아무것도 없다.
   *
   * ①을 먼저 본다. 범위 밖은 `total > 0`일 때만 참이라 ②·③과 겹치지 않는다.
   */
  const emptySlot = ((): ReactNode => {
    if (pageView.isBeyondLast) {
      return (
        <EmptyState
          size="sm"
          live
          title={t.empty.beyondLastTitle}
          description={t.empty.beyondLastDescription}
          action={
            <Button variant="outlined" onClick={() => onChangePage(1)}>
              {t.actions.goFirstPage}
            </Button>
          }
        />
      );
    }

    if (hasAnyFilter(appliedFilters)) {
      return (
        <EmptyState
          size="sm"
          live
          title={t.empty.planNoMatchTitle}
          description={t.empty.planNoMatchDescription}
          action={
            <Button variant="outlined" onClick={() => onApplyFilters(DEFAULT_PLAN_FILTERS)}>
              {messages.common.reset}
            </Button>
          }
        />
      );
    }

    return (
      <EmptyState
        size="sm"
        live
        title={t.empty.planNoneTitle}
        description={t.empty.planNoneDescription}
      />
    );
  })();

  /** 조회 실패 → 로딩 → 표 순서로 하나만 낸다. 실패했는데 빈 표를 함께 보이면 안 된다. */
  const listSlot = (): ReactNode => {
    if (loadError !== null && loadError !== undefined) return loadError;

    if (isLoading) {
      return (
        <div role="status" aria-label={t.loading.plans}>
          <SkeletonText lines={3} />
        </div>
      );
    }

    return (
      /*
       * 줄 아무 곳이나 눌러도 고른다 — DS 표에 줄 클릭이 없어 눌린 줄의 기준 코드 단추로 넘긴다(검사 조회·판정과 같다).
       * 키보드·화면 낭독기는 그 단추 하나로 고른다(줄마다 탭 멈춤을 늘리지 않는다).
       */
      <div
        ref={fit.ref}
        className="inspection-queue-table inspection-standard-plan-rows"
        style={resizable.style}
        onClick={(event) => {
          const target = event.target as Element;
          if (target.closest('button, a, input, select, textarea') !== null) return;
          target
            .closest('tbody tr')
            ?.querySelector<HTMLButtonElement>('.inspection-standard-plan-open')
            ?.click();
        }}
      >
        <Table
          density="compact"
          columns={fit.columns}
          rows={plans}
          getRowId={(row) => String(row.inspectionPlanId)}
          empty={emptySlot}
        />
      </div>
    );
  };

  return (
    <section className="pane inspection-standard-list-pane" aria-label={t.panes.plan}>
      {/* 기준 추가 · 엑셀 올리기는 표 위 오른쪽에 선다(omf-all-around#196). */}
      <div className="inspection-standard-list-toolbar">
        <Button variant="outlined" disabled={isCreating} onClick={onAddPlan}>
          {t.actions.addPlan}
        </Button>

        {/*
         * 계약에 올리기 경로가 없고 양식도 정해지지 않았다. 감추면 사용자가
         * 「이 화면에는 없는 기능」으로 오해하고 다른 곳을 찾는다 — 사유와 함께 비활성으로 둔다.
         * 사유는 단추 줄 높이를 늘리지 않게 마우스를 올리면 보인다(화면 낭독기는 설명으로 읽는다).
         */}
        <span title={t.actionReasons.excelUploadUnavailable}>
          <DisabledAction
            label={t.actions.excelUpload}
            reason={t.actionReasons.excelUploadUnavailable}
            className="inspection-standard-tooltip-reason"
          />
        </span>
      </div>

      {listSlot()}

      {(loadError === null || loadError === undefined) && !isLoading && (
        <PageNav meta={pageMeta} onChangePage={onChangePage} onChangeSize={onChangePageSize} />
      )}
    </section>
  );
};
