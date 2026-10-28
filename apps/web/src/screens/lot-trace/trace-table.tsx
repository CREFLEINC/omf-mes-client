import { type Column } from '@crefle/web-ui';
import type { ReactNode } from 'react';

import { useColumnOrder } from '../../patterns/column-grip-order';
import { useFitColumns } from '../../patterns/column-fit';
import { useColumnWidths } from '../../patterns/column-resize';
import { toPlantDateTimeParts } from '../../patterns/plant-time';
import { SelectableTable } from '../../patterns/selectable-table';

/** 공장 날짜. 바꾸지 못한 값은 받은 글자 그대로 보인다(앞 10자는 UTC 날짜라 공장 날짜와 하루 어긋날 수 있다). */
export const plantDate = (value: string | null): string =>
  value === null ? '' : (toPlantDateTimeParts(value)?.date ?? value);

export const plantDateTime = (value: string | null): string => {
  if (value === null) return '';
  const parts = toPlantDateTimeParts(value);
  return parts === null ? value : `${parts.date} ${parts.time}`;
};

/**
 * LOT 번호 — 한 줄. 칸이 모자라면 앞쪽만 줄이고 끝 마디(일련번호)는 남긴다. 같은 품목, 같은 날 LOT은 끝 마디만
 * 달라 끝이 잘리면 줄끼리 구분이 안 된다(검사 조회·판정 목록과 같다). 전체 번호는 마우스를 올리면 보인다.
 */
export const LotNo = ({ lotNo }: { lotNo: string }) => {
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

/**
 * 이력 목록 표. 검사 조회·판정 목록과 같은 짜임이다 — 열 폭은 정한 값(px)으로 고정하고 넘치면 말줄임, 행은 한 줄.
 * 열 폭과 순서는 머리칸에서 끌어 바꾸고 브라우저에 남는다. 목록 창이 좁으면 열이 비율대로 줄어 말줄임이 된다.
 * 행 선택은 C-1 공용 부품(`SelectableTable`)이 맡는다.
 */
export const ListTable = <Row,>({
  storageKey,
  columns,
  rows,
  activeId,
  onOpen,
  empty,
  getRowId,
  rowLabel,
  caption,
}: {
  storageKey: string;
  columns: Column<Row>[];
  rows: Row[];
  activeId: string | null;
  onOpen: (row: Row) => void;
  empty: ReactNode;
  getRowId: (row: Row) => string;
  rowLabel: (row: Row) => string;
  caption: string;
}) => {
  const ordered = useColumnOrder(`${storageKey}:order`, columns);
  const resizable = useColumnWidths(storageKey, ordered, { fitContent: true });
  /* 목록 창 폭에 열을 맞춘다 — 좁으면 열이 비율대로 줄어 말줄임이 되고, 머리칸이 창 밖으로 밀려 잘리지 않는다. */
  const fit = useFitColumns(resizable.columns);
  return (
    <div
      ref={fit.ref}
      className="lot-trace-list-rows inspection-queue-table"
      style={resizable.style}
    >
      <SelectableTable
        className="lot-trace-table"
        caption={<span className="visually-hidden">{caption}</span>}
        columns={fit.columns}
        rows={rows}
        getRowId={getRowId}
        activeId={activeId}
        rowLabel={rowLabel}
        onActivate={onOpen}
        empty={empty}
      />
    </div>
  );
};
