import { Chip, Tooltip, type Column } from '@crefle/web-ui';
import { messages, named } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { toPlantDateTimeParts } from '../../patterns/plant-time';
import { SelectableTable } from '../../patterns/selectable-table';
import { formatQty } from './rows';
import type { TraceDirection } from './trace-filters';
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
 * 칩에 마우스를 올리거나 초점을 두면 드로어의 추정 칩과 같은 근거 한 문장이 보인다.
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

const lotCell = (lotNo: string) => <span className="nowrap-cell mono-cell">{lotNo}</span>;

const nameCell = (item: { code: string; name: string }) => (
  <span className="ellipsis-cell lot-trace-fill" title={named(item.name, item.code)}>
    {item.name}
  </span>
);

const qtyCell = (qty: number, uomCode: string) => (
  <span className="nowrap-cell">{`${formatQty(qty)} ${uomCode}`}</span>
);

/**
 * 정방향 목록: LOT 번호 | 자재명 | 입고일 | 입고 수량 | 투입량 | 진행(C-1, C-10, C-16).
 * 1280×800에서 자재 LOT 번호(말줄임 없음)가 길어 자재 코드, 공급사, 출하 열은 드로어에 둔다.
 */
export const ForwardTable = ({
  rows,
  activeId,
  onOpen,
  empty,
}: TraceTableProps<ForwardListRow>) => {
  const columns: Column<ForwardListRow>[] = [
    { key: 'lotNo', header: t.trace.columns.lotNo, render: (row) => lotCell(row.lotNo) },
    { key: 'name', header: t.trace.columns.materialName, render: (row) => nameCell(row.item) },
    {
      key: 'receivedAt',
      header: t.trace.columns.receivedAt,
      render: (row) => <span className="nowrap-cell">{plantDate(row.firstReceivedAt)}</span>,
    },
    {
      key: 'receivedQty',
      header: t.trace.columns.receivedQty,
      align: 'end',
      render: (row) => qtyCell(row.receivedQty, row.uomCode),
    },
    {
      key: 'consumedQty',
      header: t.trace.columns.consumedQty,
      align: 'end',
      render: (row) => qtyCell(row.consumedQty, row.uomCode),
    },
    {
      key: 'stage',
      header: t.trace.columns.stage,
      render: (row) => <StageCell stage={row.currentStageCode} basis={row.basis} />,
    },
  ];
  return (
    <SelectableTable
      className="lot-trace-table"
      caption={<span className="visually-hidden">{t.trace.listCaption}</span>}
      columns={columns}
      rows={rows}
      getRowId={(row) => String(row.lotId)}
      activeId={activeId === null ? null : String(activeId)}
      rowLabel={(row) => t.trace.openRow(row.lotNo)}
      onActivate={onOpen}
      empty={empty}
    />
  );
};

/**
 * 역방향 목록: LOT 번호 | 제품명 | W/O 번호 | 생산일 | 양품 수량 | 진행.
 * 투입 자재 LOT 수와 출하(고객)는 드로어의 영향 요약과 나무가 보인다.
 */
export const BackwardTable = ({
  rows,
  activeId,
  onOpen,
  empty,
}: TraceTableProps<BackwardListRow>) => {
  const columns: Column<BackwardListRow>[] = [
    { key: 'lotNo', header: t.trace.columns.lotNo, render: (row) => lotCell(row.lotNo) },
    { key: 'name', header: t.trace.columns.productName, render: (row) => nameCell(row.item) },
    {
      key: 'workOrder',
      header: t.trace.columns.workOrder,
      render: (row) => <span className="nowrap-cell mono-cell">{row.workOrder.workOrderNo}</span>,
    },
    {
      key: 'producedAt',
      header: t.trace.columns.producedAt,
      render: (row) => <span className="nowrap-cell">{plantDate(row.lastProducedAt)}</span>,
    },
    {
      key: 'goodQty',
      header: t.trace.columns.goodQty,
      align: 'end',
      render: (row) => qtyCell(row.producedQty, row.uomCode),
    },
    {
      key: 'stage',
      header: t.trace.columns.stage,
      render: (row) => <StageCell stage={row.currentStageCode} basis={row.basis} />,
    },
  ];
  return (
    <SelectableTable
      className="lot-trace-table"
      caption={<span className="visually-hidden">{t.trace.listCaption}</span>}
      columns={columns}
      rows={rows}
      getRowId={(row) => String(row.lotId)}
      activeId={activeId === null ? null : String(activeId)}
      rowLabel={(row) => t.trace.openRow(row.lotNo)}
      onActivate={onOpen}
      empty={empty}
    />
  );
};
