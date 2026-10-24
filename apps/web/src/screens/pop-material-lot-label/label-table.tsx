import { messages } from '@omf-mes/i18n';
import type { UseQueryResult } from '@tanstack/react-query';
import type { RefObject } from 'react';

import { lookupDisplayLabel, type LookupSource } from '../../patterns/lookup-display';
import { plantToday } from '../../patterns/plant-time';
import { rowStatusOf, type BatchSnapshot, type RowStatus } from './batch-view';
import { nameSource, type ItemNameSource } from './lookups';
import { formatQty, receiptWhen } from './pending';
import type { RegisteredLot } from './queries';
import type { TargetRow } from './types';

const t = messages.popMaterialLotLabel.table;
const tStatus = messages.popMaterialLotLabel.status;

/**
 * 표가 무엇을 보이는가.
 *
 * - `pending` 발행 대기 — 체크 · 품목코드 · 품목명 · 수량 · 입하 시각
 * - `result` 발행 결과 — 결과 표식 · 품목코드 · 품목명 · 수량 · 결과(체크 대신 결과가 제자리에 붙는다)
 * - `reprint` 다시 인쇄 — 체크 · LOT 번호 · 품목명 · 수량 · 마지막 발행
 */
export type LabelTableMode = 'pending' | 'result' | 'reprint';

export interface LabelTableProps {
  mode: LabelTableMode;
  /** 이 쪽에 세울 줄. */
  rows: readonly TargetRow[];
  checked: ReadonlySet<number>;
  onToggle: (lineId: number) => void;
  /** 발행 중에는 줄을 바꾸지 못한다. */
  isLocked: boolean;
  itemNames: ReadonlyMap<number, ItemNameSource>;
  uomLookup: LookupSource;
  /** `result` 에서 줄마다 결과를 읽는다. */
  batch: BatchSnapshot;
  /** 줄 목록 경로가 없을 때(입하 건 → 줄 모으기) 다시 인쇄 줄의 LOT 번호를 따로 물은 결과. */
  lots: ReadonlyMap<number, UseQueryResult<RegisteredLot>>;
  /** 줄 칸 — 화면이 높이를 재서 쪽 크기를 정한다(`row-fit`). */
  rowsRef: RefObject<HTMLDivElement | null>;
  /** 줄이 없을 때 그 자리에 보일 말. */
  empty: string;
}

const CheckMark = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

const CrossMark = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M7 7l10 10M17 7L7 17" />
  </svg>
);

/** 입하 시각 — 오늘이면 시각만, 아니면 날짜를 앞에 붙인다. */
const receivedText = (value: string): string => {
  const when = receiptWhen(value);

  if (when === null) return '';

  return when.date === plantToday() ? when.time : `${when.day} ${when.time}`;
};

const statusText = (status: RowStatus): string => {
  switch (status.kind) {
    case 'printed':
      return status.iqcMissing ? tStatus.iqcMissing : tStatus.printed;
    case 'failed':
      return tStatus.failed[status.failure];
    case 'running':
      return tStatus.running;
    case 'waiting':
      return tStatus.waiting;
    case 'stopped':
      return tStatus.stopped;
    case 'alreadyIssued':
      return tStatus.alreadyIssued;
    case 'notSelected':
      return tStatus.notSelected;
  }
};

/** 결과 표식의 모양 — CSS 가 `data-status` 로 색을 고른다(클래스 이름을 조립하지 않는다). */
const statusTone = (status: RowStatus): string => {
  if (status.kind === 'printed') return status.iqcMissing ? 'warning' : 'ok';
  if (status.kind === 'failed')
    return status.failure === 'reportFailedAfterPrint' ? 'warning' : 'error';

  return status.kind === 'running' ? 'running' : 'idle';
};

/**
 * 발행 대기 · 결과 · 다시 인쇄 표 — **열 머리를 한 번만 두고 줄은 한 줄**로 적는다.
 *
 * ⭐ 옛 목록은 값마다 이름표를 붙여 한 쪽에 이름표가 40개였다. 머리를 한 번 두면 줄은 값만 남는다.
 * ⭐ 줄 전체가 체크 칸이다(규범 C-1) — 어디를 눌러도 체크된다. 장갑 낀 손으로 작은 네모를 겨누지 않는다.
 */
export const LabelTable = ({
  mode,
  rows,
  checked,
  onToggle,
  isLocked,
  itemNames,
  uomLookup,
  batch,
  lots,
  rowsRef,
  empty,
}: LabelTableProps) => {
  const columns =
    mode === 'reprint'
      ? [t.columns.lotNo, t.columns.itemName, t.columns.qty, t.columns.issued]
      : [
          t.columns.itemCode,
          t.columns.itemName,
          t.columns.qty,
          mode === 'result' ? t.columns.result : t.columns.receivedAt,
        ];

  return (
    <div className="pop-mlot-table" data-mode={mode}>
      <div className="pop-mlot-table-head" aria-hidden="true">
        <span>{mode === 'result' ? '' : t.columns.check}</span>
        {columns.map((column) => (
          <span key={column}>{column}</span>
        ))}
      </div>
      <div className="pop-mlot-rows" ref={rowsRef}>
        {rows.length === 0 ? <p className="pop-mlot-empty">{empty}</p> : null}
        {rows.map((row) => {
          const source = nameSource(itemNames, row.itemId);
          const itemCode = source.item?.code ?? lookupDisplayLabel(source, row.itemId);
          const itemName = source.item?.name ?? lookupDisplayLabel(source, row.itemId);
          const uom = lookupDisplayLabel(uomLookup, row.uomId);
          const qty = (
            <span className="pop-mlot-cell-qty">
              {formatQty(row.receivedQty)}
              <span className="pop-mlot-uom">{uom}</span>
            </span>
          );
          const name = (
            <span className="pop-mlot-cell-name">
              <span className="pop-mlot-name-text">{itemName}</span>
              {row.inspectionRequired ? <span className="pop-mlot-iqc">{t.iqc}</span> : null}
            </span>
          );

          if (mode === 'result') {
            const status = rowStatusOf(row.inboundReceiptLineId, batch);
            const tone = statusTone(status);

            return (
              <div
                key={row.inboundReceiptLineId}
                className="pop-mlot-row"
                data-status={tone}
                data-selected={status.kind !== 'notSelected'}
              >
                <span className="pop-mlot-cell-mark">
                  <span className="pop-mlot-mark" data-status={tone}>
                    {tone === 'ok' ? <CheckMark /> : tone === 'error' ? <CrossMark /> : null}
                  </span>
                </span>
                <span className="pop-mlot-cell-code">{itemCode}</span>
                {name}
                {qty}
                <span className="pop-mlot-cell-result" data-status={tone}>
                  {statusText(status)}
                </span>
              </div>
            );
          }

          const isChecked = checked.has(row.inboundReceiptLineId);
          const lot = row.lotId === null ? undefined : lots.get(row.lotId);
          const lotNo = row.lotNo ?? lot?.data?.lotNo ?? null;
          const received = receivedText(row.receiptDatetime);

          return (
            <button
              key={row.inboundReceiptLineId}
              type="button"
              role="checkbox"
              aria-checked={isChecked}
              aria-label={t.rowName(
                itemCode,
                itemName,
                `${formatQty(row.receivedQty)} ${uom}`,
                received,
              )}
              className="pop-mlot-row"
              disabled={isLocked}
              onClick={() => {
                onToggle(row.inboundReceiptLineId);
              }}
            >
              <span className="pop-mlot-cell-mark">
                <span className="pop-mlot-checkbox" data-checked={isChecked}>
                  {isChecked ? <CheckMark /> : null}
                </span>
              </span>
              {mode === 'reprint' ? (
                <span className="pop-mlot-cell-lot">{lotNo ?? t.lotLoading}</span>
              ) : (
                <span className="pop-mlot-cell-code">{itemCode}</span>
              )}
              {name}
              {qty}
              {mode === 'reprint' ? (
                <span className="pop-mlot-cell-when">
                  {row.lastIssue === null
                    ? ''
                    : t.issuedAt(row.lastIssue.issueSeq, receivedText(row.lastIssue.issuedAt))}
                </span>
              ) : (
                <span className="pop-mlot-cell-when">{received}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
