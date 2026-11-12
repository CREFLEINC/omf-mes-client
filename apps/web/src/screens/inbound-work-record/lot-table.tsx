import { Chip, Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { Fragment, type ReactNode } from 'react';

import type { WorkRecordLot } from './forward-contract';
import { formatAt, formatQty, matchParts, reasonOf, shortDate, type View } from './types';

const t = messages.inboundWorkRecord;
const tl = t.list;

/** 행의 P/O 매칭 칸 — 초과 · P/O 없음은 강조(screens/W-01-16.md). 입하 중이면 「마감 때 자동 매칭」. */
export const MatchSummary = ({
  lot,
}: {
  lot: Pick<WorkRecordLot, 'statusCode' | 'poAllocations' | 'unallocatedQty'>;
}) => {
  const parts = matchParts(lot);
  if (parts === null) return <span className="field-note">{tl.autoMatchLater}</span>;
  if (parts.length === 0) return <span className="field-note">—</span>;
  return (
    <span className="iwr-match">
      {parts.map((part, index) => (
        <Fragment key={`${part.kind}-${String(index)}`}>
          {index > 0 && tl.separator}
          {part.kind === 'unallocated' ? (
            <mark className="iwr-mark is-unallocated">{part.text}</mark>
          ) : part.excess ? (
            <mark className="iwr-mark is-excess">{part.text}</mark>
          ) : (
            <span>{part.text}</span>
          )}
        </Fragment>
      ))}
    </span>
  );
};

/** 마지막 칸(보기마다 이름이 바뀐다). ⛔ 최종 마감 보기에 ERP 송신 칩은 두지 않는다(#265). */
const lastCell = (view: View, lot: WorkRecordLot): ReactNode => {
  if (view === 'final')
    return (
      <Chip size="sm" status="idle" leadingIcon={<Icon name="lock" size={14} aria-hidden />}>
        {formatAt(lot.finalizedAt) ?? '—'}
      </Chip>
    );
  if (view === 'prog')
    return (
      <Chip size="sm" status="warning">
        {reasonOf(lot)}
      </Chip>
    );
  return (
    <span className="iwr-chips">
      <Chip size="sm" status="success">
        {tl.readyChip}
      </Chip>
      {lot.closedAutomatically && (
        <Chip size="sm" status="idle">
          {tl.autoClosed}
        </Chip>
      )}
    </span>
  );
};

const lastHead = (view: View): string =>
  view === 'final' ? tl.columns.finalized : view === 'prog' ? tl.columns.reason : tl.columns.status;

/**
 * 입하 LOT 목록(시안 W0116-After). 넓은 표라 1280 폭에서는 표 상자 안에서 가로로 민다(`.wide-table`).
 * 행 어디를 눌러도 상세가 열린다 — 키보드는 입하 LOT 칸의 단추가 맡는다.
 */
export const LotTable = ({
  view,
  rows,
  openId,
  onOpen,
}: {
  view: View;
  rows: readonly WorkRecordLot[];
  openId: number | null;
  onOpen: (inboundLotId: number) => void;
}) => (
  <div className="wide-table iwr-table-scroll">
    <table className="iwr-table" aria-label={tl.label}>
      <thead>
        <tr>
          <th scope="col">{tl.columns.inboundLot}</th>
          <th scope="col">{tl.columns.supplier}</th>
          <th scope="col">{tl.columns.item}</th>
          <th scope="col">{tl.columns.receivingDate}</th>
          <th scope="col" className="is-number">
            {tl.columns.lotCount}
          </th>
          <th scope="col" className="is-number">
            {tl.columns.receivedQty}
          </th>
          <th scope="col" className="is-number">
            {tl.columns.goodsReceivedQty}
          </th>
          <th scope="col">{tl.columns.match}</th>
          <th scope="col">{lastHead(view)}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((lot) => {
          const open = (): void => onOpen(lot.inboundLotId);
          return (
            <tr
              key={lot.inboundLotId}
              className="is-clickable"
              aria-selected={openId === lot.inboundLotId ? true : undefined}
              onClick={open}
            >
              <td>
                <button
                  type="button"
                  className="link-cell iwr-code"
                  aria-label={tl.open(lot.inboundLotNo)}
                  onClick={(event) => {
                    event.stopPropagation();
                    open();
                  }}
                >
                  {lot.inboundLotNo}
                </button>
              </td>
              <td>{lot.supplierName}</td>
              <td className="is-wrap">
                <span className="iwr-code">{lot.itemCode}</span> {lot.itemName}
              </td>
              <td>{shortDate(lot.receivingDate)}</td>
              <td className="is-number">{String(lot.lotCount)}</td>
              <td className="is-number">
                {formatQty(lot.receivedQty)} <span className="field-note">{lot.uomCode}</span>
              </td>
              <td className="is-number">
                {formatQty(lot.goodsReceivedQty)} <span className="field-note">{lot.uomCode}</span>
              </td>
              <td className="is-wrap">
                <MatchSummary lot={lot} />
              </td>
              <td>{lastCell(view, lot)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);
