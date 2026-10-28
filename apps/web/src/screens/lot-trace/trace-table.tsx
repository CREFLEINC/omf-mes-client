import { Chip, Tooltip, type Column } from '@crefle/web-ui';
import { messages, named } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { useColumnOrder } from '../../patterns/column-grip-order';
import { useFitColumns } from '../../patterns/column-fit';
import { useColumnWidths } from '../../patterns/column-resize';
import { toPlantDateTimeParts } from '../../patterns/plant-time';
import { SelectableTable } from '../../patterns/selectable-table';
import { formatQty } from './rows';
import type { BackwardListRow, FlowBasis, ForwardListRow, ForwardStage } from './trace-types';

const t = messages.lotTrace;

/** 공장 날짜. 바꾸지 못한 값은 받은 글자 그대로 보인다(앞 10자는 UTC 날짜라 공장 날짜와 하루 어긋날 수 있다). */
export const plantDate = (value: string | null): string =>
  value === null ? '' : (toPlantDateTimeParts(value)?.date ?? value);

export const plantDateTime = (value: string | null): string => {
  if (value === null) return '';
  const parts = toPlantDateTimeParts(value);
  return parts === null ? value : `${parts.date} ${parts.time}`;
};

/** 진행 칩 — 조건 칩과 같은 이름이다(C-17). 단계는 상태가 아니라 위치라 한 색(중립)이다. */
export const StageChip = ({ stage }: { stage: ForwardStage }) => (
  <Chip variant="status" size="sm" status="idle">
    {t.stages[stage]}
  </Chip>
);

/**
 * 진행 칸: 진행 칩과, 추정 이음이 섞인 LOT이면 「추정 포함」 칩(서버 `basis`가 null이 아닐 때).
 * 칩에 마우스를 올리거나 초점을 두면 상세의 추정 칩과 같은 근거 한 문장이 보인다.
 */
const StageCell = ({ stage, basis }: { stage: ForwardStage; basis: FlowBasis | null }) => (
  <span className="lot-trace-stage-cell">
    <StageChip stage={stage} />
    {basis !== null && (
      <Tooltip content={t.chain.estimateTip[basis]}>
        <span
          className="lot-trace-chip-anchor"
          tabIndex={0}
          aria-label={`${t.trace.estimated}. ${t.chain.estimateTip[basis]}`}
        >
          <Chip variant="status" size="sm" status="info">
            {t.trace.estimated}
          </Chip>
        </span>
      </Tooltip>
    )}
  </span>
);

interface TraceTableProps<Row> {
  rows: Row[];
  activeId: number | null;
  onOpen: (row: Row) => void;
  empty: ReactNode;
}

/**
 * LOT 번호 — 한 줄. 칸이 모자라면 앞쪽만 줄이고 끝 마디(일련번호)는 남긴다. 같은 품목, 같은 날 LOT은 끝 마디만
 * 달라 끝이 잘리면 줄끼리 구분이 안 된다(검사 조회·판정 목록과 같다). 전체 번호는 마우스를 올리면 보인다.
 */
const lotCell = (lotNo: string) => {
  /* 구분자가 없는 번호(생산 LOT)는 끝 8자를 남긴다 — 같은 날 LOT은 앞이 같고 끝이 다르다. */
  const cut = lotNo.includes('|') ? lotNo.lastIndexOf('|') + 1 : Math.max(0, lotNo.length - 8);
  return (
    <span className="lot-trace-lot mono-cell" title={lotNo}>
      {cut > 0 && cut < lotNo.length ? (
        <>
          <span className="lot-trace-lot-head">{lotNo.slice(0, cut)}</span>
          <span className="lot-trace-lot-tail">{lotNo.slice(cut)}</span>
        </>
      ) : (
        lotNo
      )}
    </span>
  );
};

/** 품목 「이름 코드」 한 줄. 이름이 먼저 줄고 코드는 흐리게 뒤에 붙는다(검사 조회·판정 목록과 같다). */
const itemCell = (item: { code: string; name: string }) => (
  <span className="stacked-cell" title={named(item.name, item.code)}>
    <span className="lot-trace-item-name">{item.name}</span>
    <span className="lot-trace-item-code">{item.code}</span>
  </span>
);

const qtyCell = (qty: number, uomCode: string) => `${formatQty(qty)} ${uomCode}`;

/**
 * 목록 표. 검사 조회·판정 목록과 같은 짜임이다 — 열 폭은 정한 값(px)으로 고정하고 넘치면 말줄임, 행은 한 줄.
 * 열 폭과 순서는 머리칸에서 끌어 바꾸고 브라우저에 남는다. 목록 창이 좁으면 표 안에서 가로로 구른다.
 * 행 선택은 C-1 공용 부품(`SelectableTable`)이 맡는다.
 */
const TraceTable = <Row extends { lotId: number; lotNo: string }>({
  storageKey,
  columns,
  rows,
  activeId,
  onOpen,
  empty,
}: TraceTableProps<Row> & { storageKey: string; columns: Column<Row>[] }) => {
  const ordered = useColumnOrder(`${storageKey}:order`, columns);
  const resizable = useColumnWidths(storageKey, ordered, { fitContent: true });
  const fit = useFitColumns(resizable.columns, { scrollX: true });
  return (
    <div
      ref={fit.ref}
      className="lot-trace-list-rows inspection-queue-table"
      style={resizable.style}
    >
      <SelectableTable
        className="lot-trace-table"
        caption={<span className="visually-hidden">{t.trace.listCaption}</span>}
        columns={fit.columns}
        rows={rows}
        getRowId={(row) => String(row.lotId)}
        activeId={activeId === null ? null : String(activeId)}
        rowLabel={(row) => t.trace.openRow(row.lotNo)}
        onActivate={onOpen}
        empty={empty}
      />
    </div>
  );
};

/** 자재 LOT 목록: LOT 번호 | 자재 | 입고일 | 입고 수량 | 투입량 | 진행(C-1, C-10, C-16). 공급사, 출하는 상세에 있다. */
export const ForwardTable = (props: TraceTableProps<ForwardListRow>) => (
  <TraceTable
    {...props}
    storageKey="omf-mes:lot-trace:columns:material"
    columns={[
      {
        key: 'lotNo',
        header: t.trace.columns.lotNo,
        width: '260px',
        render: (row) => lotCell(row.lotNo),
      },
      {
        key: 'name',
        header: t.trace.columns.materialName,
        width: '200px',
        render: (row) => itemCell(row.item),
      },
      {
        key: 'receivedAt',
        header: t.trace.columns.receivedAt,
        width: '104px',
        align: 'center',
        render: (row) => plantDate(row.firstReceivedAt),
      },
      {
        key: 'receivedQty',
        header: t.trace.columns.receivedQty,
        width: '112px',
        align: 'end',
        render: (row) => qtyCell(row.receivedQty, row.uomCode),
      },
      {
        key: 'consumedQty',
        header: t.trace.columns.consumedQty,
        width: '112px',
        align: 'end',
        render: (row) => qtyCell(row.consumedQty, row.uomCode),
      },
      {
        key: 'stage',
        header: t.trace.columns.stage,
        width: '152px',
        align: 'center',
        render: (row) => <StageCell stage={row.currentStageCode} basis={row.basis} />,
      },
    ]}
  />
);

/** 제품 LOT 목록: LOT 번호 | 제품 | W/O 번호 | 생산일 | 양품 수량 | 진행. 투입 자재와 출하(고객)는 상세에 있다. */
export const BackwardTable = (props: TraceTableProps<BackwardListRow>) => (
  <TraceTable
    {...props}
    storageKey="omf-mes:lot-trace:columns:product"
    columns={[
      {
        key: 'lotNo',
        header: t.trace.columns.lotNo,
        width: '240px',
        render: (row) => lotCell(row.lotNo),
      },
      {
        key: 'name',
        header: t.trace.columns.productName,
        width: '180px',
        render: (row) => itemCell(row.item),
      },
      {
        key: 'workOrder',
        header: t.trace.columns.workOrder,
        width: '150px',
        render: (row) => <span className="mono-cell">{row.workOrder.workOrderNo}</span>,
      },
      {
        key: 'producedAt',
        header: t.trace.columns.producedAt,
        width: '104px',
        align: 'center',
        render: (row) => plantDate(row.lastProducedAt),
      },
      {
        key: 'goodQty',
        header: t.trace.columns.goodQty,
        width: '112px',
        align: 'end',
        render: (row) => qtyCell(row.producedQty, row.uomCode),
      },
      {
        key: 'stage',
        header: t.trace.columns.stage,
        width: '152px',
        align: 'center',
        render: (row) => <StageCell stage={row.currentStageCode} basis={row.basis} />,
      },
    ]}
  />
);
