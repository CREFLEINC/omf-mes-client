import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { PopTopPrinter } from '../../patterns/pop-top-status';
import { PuButton, PuNote } from '../../patterns/pop-uniform';
import { PrinterChip } from '../pop-material-lot-label/printer-chip';
import { toPrinterView } from '../pop-material-lot-label/types';
import { localDateTimeText } from './formatting';
import type { IssueStanding, Printer, RemainderCandidate } from './types';

const t = messages.repackLabelIssue.issue;
const th = messages.repackLabelIssue.history;

export interface IssuePaneProps {
  selectedHandlingUnitNo: string;
  /** 새 포장 라벨 줄의 「내용」(유형 · LOT 수 · 수량). */
  newLabelBody: string;
  includeNewLabel: boolean;
  onIncludeNewLabelChange: (checked: boolean) => void;
  remainderCandidates: readonly RemainderCandidate[];
  selectedRemainderIds: readonly number[];
  onRemainderChange: (handlingUnitId: number, checked: boolean) => void;
  remainderFailed: boolean;
  /** 인쇄할 라벨을 하나도 고르지 않았는가 — 표 아래 빨간 한 줄. */
  targetRequired: boolean;

  /** 새 포장의 발행 현황. 아직 못 받았으면 `null`. */
  standing: IssueStanding | null;
  standingFailed: boolean;
  onStandingRetry: () => void;
}

const issuedCell = (count: number | null, sub: ReactNode): ReactNode =>
  count === null ? (
    th.unknownAt
  ) : count === 0 ? (
    <span className="rpk-sub">{t.notIssued}</span>
  ) : (
    <>
      {t.issuedTimes(count)}
      {sub}
    </>
  );

/**
 * 《대상 포장》 아래쪽 — 인쇄 대상 표(선택 · 라벨 · 번호 · 내용 · 발행)와 그 안내.
 *
 * 줄 어디를 눌러도 고르거나 푼다. 새 포장 라벨 한 줄 + (분할이면) 잔량 라벨 재인쇄 줄.
 * ⛔ **회차를 화면이 세지 않는다**(계약 「서버가 매긴다」) — 지금까지의 횟수만 서버 값으로 보인다.
 */
export const IssuePane = ({
  selectedHandlingUnitNo,
  newLabelBody,
  includeNewLabel,
  onIncludeNewLabelChange,
  remainderCandidates,
  selectedRemainderIds,
  onRemainderChange,
  remainderFailed,
  targetRequired,
  standing,
  standingFailed,
  onStandingRetry,
}: IssuePaneProps) => {
  const last = standing?.lastIssuedAt ?? null;
  const lastOutcome = standing?.lastPrintOutcome ?? null;

  const row = (
    key: string,
    checked: boolean,
    onToggle: (next: boolean) => void,
    ariaLabel: string,
    cells: ReactNode,
  ): ReactNode => (
    <tr
      key={key}
      className={checked ? 'is-pick is-selected' : 'is-pick'}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest('input') !== null) return;
        onToggle(!checked);
      }}
    >
      <td className="fit mid">
        <input
          type="checkbox"
          checked={checked}
          aria-label={ariaLabel}
          onChange={(event) => {
            onToggle(event.target.checked);
          }}
        />
      </td>
      {cells}
    </tr>
  );

  return (
    <>
      {standingFailed && (
        <PuNote
          tone="warn"
          action={
            <PuButton size="sm" onClick={onStandingRetry}>
              {messages.common.retry}
            </PuButton>
          }
        >
          {t.summaryFailed}
        </PuNote>
      )}

      <div className="pu-table-wrap rpk-table">
        <table className="pu-table" aria-label={t.targetsLabel}>
          <thead>
            <tr>
              <th className="fit mid">{t.colPick}</th>
              <th className="fit">{t.colLabel}</th>
              <th className="fit">{t.colNo}</th>
              <th>{t.colBody}</th>
              <th className="fit">{t.colIssued}</th>
            </tr>
          </thead>
          <tbody>
            {row(
              'new',
              includeNewLabel,
              onIncludeNewLabelChange,
              t.newLabel(selectedHandlingUnitNo),
              <>
                <td className="fit">
                  <b>{t.newLabelName}</b>
                </td>
                <td className="fit pu-mono rpk-no" title={selectedHandlingUnitNo}>
                  {selectedHandlingUnitNo}
                </td>
                <td title={newLabelBody}>{newLabelBody}</td>
                <td className="fit">
                  {issuedCell(
                    standing?.issueCount ?? null,
                    last === null ? null : (
                      <span className={lastOutcome === 'FAILED' ? 'rpk-sub bad' : 'rpk-sub'}>
                        {localDateTimeText(last, th.unknownAt)}
                        {lastOutcome === null ? '' : ` · ${th.outcome[lastOutcome]}`}
                      </span>
                    ),
                  )}
                </td>
              </>,
            )}
            {remainderCandidates.map(({ handlingUnit, standing: remainderStanding }) =>
              row(
                String(handlingUnit.handlingUnitId),
                selectedRemainderIds.includes(handlingUnit.handlingUnitId),
                (next) => {
                  onRemainderChange(handlingUnit.handlingUnitId, next);
                },
                t.remainderLabel(handlingUnit.handlingUnitNo, remainderStanding.issueCount ?? 0),
                <>
                  <td className="fit">
                    <b>{t.remainderName}</b>
                  </td>
                  <td className="fit pu-mono rpk-no" title={handlingUnit.handlingUnitNo}>
                    {handlingUnit.handlingUnitNo}
                  </td>
                  <td title={t.remainderNumberNote}>{t.remainderNumberNote}</td>
                  <td className="fit">
                    {issuedCell(
                      remainderStanding.issueCount,
                      <span className="rpk-sub">{t.existingLabel}</span>,
                    )}
                  </td>
                </>,
              ),
            )}
          </tbody>
        </table>
      </div>
      {remainderFailed && <PuNote tone="warn">{t.remainderFailed}</PuNote>}
      {targetRequired && <p className="rpk-err">{t.targetRequired}</p>}
    </>
  );
};

/**
 * 프린터 칩 — 공통 메뉴 맨 위 줄 프린터 자리에 서고, 누르면 고른다(사용자 지시 2026-11-17 · #291).
 * ⚠ 화면에 늘 붙어 있어야 한다 — 고른 포장이 바뀔 때마다 빠졌다 붙으면 맨 위 줄 자리가 흔들린다.
 */
export const IssuePrinter = ({
  printers,
  printersFailed,
  printerName,
  onPrinterChange,
}: {
  printers: readonly Printer[];
  printersFailed: boolean;
  printerName: string;
  onPrinterChange: (value: string) => void;
}) => {
  const selectedPrinter = printers.find((printer) => printer.printerName === printerName) ?? null;

  return (
    <PopTopPrinter>
      <PrinterChip
        printers={printers.map(toPrinterView)}
        selected={selectedPrinter === null ? null : toPrinterView(selectedPrinter)}
        isLoading={false}
        isError={printersFailed}
        isLocked={false}
        onRetry={() => undefined}
        onSelect={onPrinterChange}
        showNone
        noneLabel={messages.productionResult.flow.work.printerNone}
      />
    </PopTopPrinter>
  );
};
