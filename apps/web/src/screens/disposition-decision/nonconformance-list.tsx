import { Button, Chip, type Column, EmptyState, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { useColumnOrder } from '../../patterns/column-grip-order';
import { useFitColumns } from '../../patterns/column-fit';
import { useColumnWidths } from '../../patterns/column-resize';
import { lookupDisplayLabel, toLookupDisplayState } from '../../patterns/lookup-display';
import { PageNav as ListPageNav, type PageNavMeta } from '../../patterns/page-nav';
import { codeValueLabel } from './disposition-codes';
import { PAGE_SIZE_OPTIONS, type PageSizeOption } from './filters';
import type { DispositionLookup } from './lookups';
import type { PageView } from './pagination';
import { SeverityBadge } from './severity-badge';
import { dispositionProgressLabel, type NonconformanceRow } from './types';
import { PaneEmptyIcon } from '../../patterns/pane-empty-icon';

const ITEM_LABEL_SEPARATOR = ' · '; // ui-check-ignore: C-13 표시명 구분자(lookups.ts 「코드 · 이름」)

/** 품목 표시명 「코드 · 이름」에서 이름만. 이름이 없는 표시명(코드만 · 모르는 품목)은 그대로. */
const itemNameOf = (label: string): string => {
  const [, ...nameParts] = label.split(ITEM_LABEL_SEPARATOR);
  return nameParts.length === 0 ? label : nameParts.join(ITEM_LABEL_SEPARATOR);
};

export interface NonconformanceListProps {
  rows: NonconformanceRow[];
  /** 005 「원천」 칸 글(부적합 id → 글 · G2 L8). 없으면 칸을 두지 않는다. */
  sourceTexts?: ReadonlyMap<number, string>;
  items: DispositionLookup;
  /** 수량 칸 단위 표시명. */
  uoms: DispositionLookup;
  /** 심각도·상태 열의 표시명(G-32). 모르는 코드는 코드 그대로 보인다(G-9). */
  severity: DispositionLookup;
  status: DispositionLookup;
  isLoading: boolean;
  error: ReactNode;
  page: PageView;
  /** 표 아래 쪽 이동 줄 — 다른 목록과 같은 「총 N건 · 처음 · 이전 · n/N · 다음 · 마지막」(#223). */
  meta: PageNavMeta;
  selectedId: number | null;
  onSelect: (nonconformanceId: number) => void;
  onChangePage: (page: number) => void;
  /** 한 쪽 건수 10 · 20 · 50(사용자 지시 · #223). */
  onChangeSize: (size: PageSizeOption) => void;
}

/**
 * ⭐ 「처리 상태」 칸은 `statusCode` 에 서버가 롤업한 `dispositionProgressCode` 의 «일부 판정»을 덧붙인다 —
 * `statusCode`의 「판정 대기」 한 값은 미판정·일부 판정을 가르지 못한다.
 * 근거: W-03-10 §4-A · omf-mes#253(회신 반영) · omf-all-around#275(두 열을 합침).
 */
export const NonconformanceList = ({
  rows,
  sourceTexts,
  items,
  uoms,
  severity,
  status,
  isLoading,
  error,
  page,
  meta,
  selectedId,
  onSelect,
  onChangePage,
  onChangeSize,
}: NonconformanceListProps) => {
  const t = messages.dispositionDecision;
  const columns: Column<NonconformanceRow>[] = [
    {
      key: 'nonconformanceNo',
      align: 'center',
      /* 번호가 잘리지 않는 폭 — 끌어 바꿀 수 있다(omf-all-around#275). 입하 LOT 은 상세에서 본다(#286). */
      width: '180px',
      header: t.fields.nonconformanceNo,
      /* 번호는 글자다 — 고르기는 줄 누르기가 맡는다(사용자 지시 · #223). 고른 줄 표시는 이 칸의 `data-selected` 로 건다. */
      render: (row) => (
        <span
          className="disposition-nc-no"
          data-nc-id={row.nonconformanceId}
          data-selected={row.nonconformanceId === selectedId ? 'true' : undefined}
        >
          {row.nonconformanceNo}
        </span>
      ),
    },
    ...(sourceTexts === undefined
      ? []
      : [
          {
            key: 'source',
            align: 'center',
            width: '150px',
            header: t.inboundLot.sourceColumn,
            render: (row: NonconformanceRow) => sourceTexts.get(row.nonconformanceId) ?? '—',
          } satisfies Column<NonconformanceRow>,
        ]),
    {
      key: 'item',
      align: 'center',
      /* 품목 이름이 덜 잘리게(omf-all-around#275). */
      width: '260px',
      header: t.fields.item,
      /* 품목은 이름만 — 표시명 「코드 · 이름」의 이름 쪽(omf-all-around#286). 이름이 없으면 표시명 그대로. */
      render: (row) => itemNameOf(lookupDisplayLabel(items, row.itemId)),
    },
    {
      key: 'qty',
      width: '110px',
      header: t.detail.affectedQty,
      align: 'center',
      /* 수량을 모르는 행(「—」)과 단위 이름을 아직 못 읽은 때(불러오는 중 · 알 수 없음)는 단위를 붙이지 않는다. */
      render: (row) => {
        const uom = toLookupDisplayState(uoms, row.uomId);
        return row.affectedQtyText === t.values.unknownQty || uom.kind !== 'named'
          ? row.affectedQtyText
          : `${row.affectedQtyText} ${uom.label}`;
      },
    },
    {
      key: 'severity',
      align: 'center',
      width: '100px',
      header: t.fields.severityCode,
      render: (row) => <SeverityBadge severity={severity} code={row.severityCode} />,
    },
    {
      key: 'openedAt',
      align: 'center',
      width: '160px',
      header: t.fields.openedAt,
      /*
       * 머리를 눌러 오름 · 내림차순(#352 사용자 지시) — 품질 승인 처리의 상신일시와 같은 방식. 서버에 정렬 조건이 없어
       * 지금 받은 쪽 안에서 원문(RFC3339)으로 정렬한다.
       */
      sortable: true,
      sortAccessor: (row) => row.openedAt,
      render: (row) => row.openedAtText,
    },
    {
      key: 'status',
      align: 'center',
      width: '120px',
      header: t.fields.statusCode,
      /*
       * 「판정 현황」 열을 합쳤다(omf-all-around#275) — 일부 처분이 없어져(FR-038) 미판정 · 완료는 상태와 같은 말이다.
       * 상태 한 값이 가르지 못하는 «일부 판정»(예전 데이터)만 뒤에 덧붙인다.
       */
      /* 라벨로 — 상세 머리의 상태 라벨과 같은 색(판정 완료 초록 · 그 밖 노랑 · omf-all-around#286). */
      render: (row) => (
        <Chip size="sm" status={row.statusCode === 'DECIDED' ? 'success' : 'warning'}>
          {row.dispositionProgressCode === 'PARTIAL'
            ? t.values.statusWithProgress(
                codeValueLabel(status, row.statusCode),
                dispositionProgressLabel(row.dispositionProgressCode),
              )
            : codeValueLabel(status, row.statusCode)}
        </Chip>
      ),
    },
  ];

  /*
   * 열 순서 · 폭은 검사 조회·판정 목록과 같이 사용자가 바꾸고 브라우저에 남는다(사용자 지시 · #223). 모든 칸 가운데 정렬.
   */
  const ordered = useColumnOrder('omf-mes:dispositions:columns:pending:order', columns);
  const resizable = useColumnWidths('omf-mes:dispositions:columns:pending', ordered);
  /*
   * 좌우 배치에서 목록이 좁으면(1440 · 표 494px) 칸을 줄이지 않고 표 안에서 가로로 구른다 — 줄이면 여덟 칸이 46px 씩이 되어
   * 모두 「…」로 잘렸다(G2 M-b). 칸마다 폭을 두고(정한 폭의 합 `--col-fixed` 가 표 최소 폭이 된다 — app.css), 넓으면 비율대로 늘린다.
   */
  const fit = useFitColumns(resizable.columns, { scrollX: true });

  if (error !== null && error !== undefined) return error;

  if (isLoading) {
    return (
      <div role="status" aria-label={t.loading}>
        <SkeletonText lines={3} />
      </div>
    );
  }

  const empty = page.isBeyondLast ? (
    <EmptyState
      size="sm"
      live
      title={t.empty.beyondTitle}
      description={t.empty.beyondDescription}
      action={
        <Button variant="outlined" onClick={() => onChangePage(1)}>
          {t.actions.goFirstPage}
        </Button>
      }
    />
  ) : (
    <EmptyState
      size="sm"
      live
      icon={<PaneEmptyIcon name="assignment" />}
      title={t.empty.title}
      description={t.empty.description}
    />
  );

  return (
    <div className="disposition-list">
      {/*
       * ⭐ 여기 있던 「원천으로 거를 수 없다」 안내(A-11)를 걷었다 — **물러났던 것이 아니라
       * 되살아났다.** 축이 `sourceCode`로 정의돼 필터 바에 섰으므로(W-03-10 §5-4 · #648)
       * 그 자리에 남겨 두면 화면이 «있는 기능»을 없다고 말하게 된다.
       */}
      {/*
       * 줄을 누르면 고른다(#223) — DS 표에 줄 클릭이 없어 눌린 줄의 번호 칸에서 부적합을 읽는다.
       * 고른 줄을 다시 누르면 풀린다(`onSelect` 가 같은 번호면 선택을 지운다).
       */}
      <div
        ref={fit.ref}
        className="disposition-table disposition-pending-table inspection-queue-table"
        style={resizable.style}
        onClick={(event) => {
          const id = (event.target as Element)
            .closest('tbody tr')
            ?.querySelector<HTMLElement>('[data-nc-id]')?.dataset.ncId;
          if (id !== undefined) onSelect(Number(id));
        }}
      >
        <Table
          density="compact"
          caption={<span className="disposition-table-caption">{t.panes.list}</span>}
          columns={fit.columns}
          rows={rows}
          getRowId={(row) => String(row.nonconformanceId)}
          empty={empty}
        />
      </div>
      <ListPageNav
        meta={meta}
        sizes={PAGE_SIZE_OPTIONS}
        controlSize="sm"
        buttonSize="md"
        onChangePage={onChangePage}
        onChangeSize={onChangeSize}
      />
    </div>
  );
};
