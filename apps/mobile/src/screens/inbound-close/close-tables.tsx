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
  /** 공급사가 하나여도 머리 줄을 그린다(사용자 지시 2026-11-20 「공급사도 표시」). */
  alwaysGroup?: boolean;
}

const Rows = ({ lots, cells, columns, currentId = null, alwaysGroup = false }: RowsProps) => {
  const groups = groupsOf(lots);
  let no = 0;

  return (
    <>
      {groups.map((group) => (
        <tbody key={group.supplierName}>
          {alwaysGroup || groups.length > 1 ? (
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
 * 입하 중 표 — 공급사 머리 줄 › No · 품목코드 / 품목명(줄여서라도 전체) · LOT 수 · 수량(사용자 지시 2026-11-20). 품목 칸을 누르면
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
        alwaysGroup
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
                <FitName
                  className="close-table__name"
                  text={lot.itemName}
                  min={7}
                  lines={1}
                  whole
                />
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
 * 마감 취소 가능 표 — 공급사 머리 줄 › No · 품목코드 / 품목명 / 「까닭 · 마감 시각 · IQC 번호」 · 작은 외곽선 [마감 취소].
 * 칩은 두지 않는다 — 줄이 꺾여 길어졌다(사용자 결정 2026-11-20 시안 B). 방금 마감한 줄은 초록(결과 화면 대신).
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
        alwaysGroup
        cells={(lot) => {
          const blocker = blockerOf(lot);

          return (
            <>
              <td className="close-table__item close-table__item--static">
                <span className="close-table__code">{lot.itemCode}</span>
                <FitName
                  className="close-table__name"
                  text={lot.itemName}
                  min={7}
                  lines={1}
                  whole
                />
                {/* 칩 대신 아래 회색 줄 맨 앞에 까닭(사용자 결정 2026-11-20 시안 B). */}
                <span className="close-table__sub">
                  <b className="close-table__reason">{reasonOf(lot)}</b>
                  {` · ${closedTextOf(lot)}`}
                </span>
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
