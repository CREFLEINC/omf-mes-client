import { Chip, Icon } from '@crefle/web-ui';
import type { InboundLot } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { Button } from '../../patterns/button';
import { FitName } from '../../patterns/fit-name';
import { formatQty } from './close';

const t = messages.inboundClose;

/** 공급사별 묶음 — 처음 나온 차례 그대로. 공급사가 하나면 머리 줄은 노이즈라 그리지 않는다. */
const groupsOf = (lots: readonly InboundLot[]): { supplierName: string; lots: InboundLot[] }[] => {
  const groups = new Map<number, { supplierName: string; lots: InboundLot[] }>();

  for (const lot of lots) {
    const group = groups.get(lot.supplierId) ?? { supplierName: lot.supplierName, lots: [] };
    group.lots.push(lot);
    groups.set(lot.supplierId, group);
  }

  return [...groups.values()];
};

interface RowsProps {
  lots: readonly InboundLot[];
  /** 한 줄 — 번호 칸 뒤의 칸들. */
  cells: (lot: InboundLot) => ReactNode;
  /** 표 칸 수(공급사 머리 줄 colSpan). */
  columns: number;
  currentId?: number | null;
}

const Rows = ({ lots, cells, columns, currentId = null }: RowsProps) => {
  const groups = groupsOf(lots);
  let no = 0;

  return (
    <>
      {groups.map((group) => (
        <tbody key={group.supplierName}>
          {groups.length > 1 ? (
            <tr className="close-table__group">
              <th scope="colgroup" colSpan={columns}>
                {group.supplierName}
              </th>
            </tr>
          ) : null}
          {group.lots.map((lot) => {
            no += 1;

            return (
              <tr key={lot.inboundLotId} data-current={lot.inboundLotId === currentId}>
                <td className="close-table__no">{no}</td>
                {cells(lot)}
              </tr>
            );
          })}
        </tbody>
      ))}
    </>
  );
};

/**
 * 입하 중 표 — No · 품목코드 / 품목명(한 줄, 넘치면 8px 까지 줄임) · LOT 수 · 수량(사용자 지시 2026-11-20). 품목 칸을 누르면
 * 「입하 품목」 시트(자재 관리 LOT · 해제 · [마감]).
 */
export const OpenTable = ({
  lots,
  onOpen,
}: {
  lots: readonly InboundLot[];
  onOpen: (inboundLotId: number) => void;
}) => (
  <div className="close-table__box">
    <table className="close-table">
      <colgroup>
        <col className="close-table__col-no" />
        <col />
        <col className="close-table__col-count" />
        <col className="close-table__col-qty" />
      </colgroup>
      <Rows
        lots={lots}
        columns={4}
        cells={(lot) => (
          <>
            <td className="close-table__item">
              <button
                type="button"
                className="close-table__open"
                aria-label={t.list.open(lot.itemCode, lot.itemName)}
                onClick={() => {
                  onOpen(lot.inboundLotId);
                }}
              >
                <span className="close-table__code">
                  {lot.itemCode}
                  {lot.reopened ? <Chip status="error">{t.open.reopened}</Chip> : null}
                </span>
                <FitName className="close-table__name" text={lot.itemName} min={8} lines={1} />
              </button>
            </td>
            <td className="close-table__num close-table__count">{lot.lotCount}</td>
            <td className="close-table__num">{formatQty(lot.receivedQty, lot.uomCode)}</td>
          </>
        )}
      />
    </table>
  </div>
);

/**
 * 마감 취소 가능 표 — No · 품목(까닭 칩 · 자동 마감 · 마감 시각 · 막힘) · 작은 외곽선 [마감 취소]. 방금 마감한 줄은
 * 초록(결과 화면 대신, 사용자 결정 2026-11-20).
 */
export const DoneTable = ({
  lots,
  currentId,
  reasonOf,
  closedTextOf,
  blockerOf,
  locked,
  onReopen,
}: {
  lots: readonly InboundLot[];
  currentId: number | null;
  reasonOf: (lot: InboundLot) => string;
  closedTextOf: (lot: InboundLot) => string;
  blockerOf: (lot: InboundLot) => string | null;
  locked: boolean;
  onReopen: (lot: InboundLot) => void;
}) => (
  <div className="close-table__box">
    <table className="close-table">
      <colgroup>
        <col className="close-table__col-no" />
        <col />
        <col className="close-table__col-action" />
      </colgroup>
      <Rows
        lots={lots}
        columns={3}
        currentId={currentId}
        cells={(lot) => {
          const blocker = blockerOf(lot);

          return (
            <>
              <td className="close-table__item close-table__item--static">
                <span className="close-table__code">
                  {lot.itemCode}
                  {lot.closedAutomatically ? <Chip>{t.done.autoChip}</Chip> : null}
                  <Chip status="info">{reasonOf(lot)}</Chip>
                </span>
                <FitName className="close-table__name" text={lot.itemName} min={8} lines={1} />
                <span className="close-table__sub">{closedTextOf(lot)}</span>
                {blocker === null ? null : (
                  <span className="close-table__blocked">
                    <Icon name="lock" size={16} />
                    {blocker}
                  </span>
                )}
              </td>
              <td className="close-table__action">
                <Button
                  variant="outlined"
                  size="sm"
                  disabled={locked}
                  onClick={() => {
                    onReopen(lot);
                  }}
                >
                  {t.done.reopen}
                </Button>
              </td>
            </>
          );
        }}
      />
    </table>
  </div>
);
