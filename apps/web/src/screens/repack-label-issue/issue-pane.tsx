import { AlertBanner, Button, Checkbox, Chip, Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import { PopPrinterStatus } from '../../patterns/pop-printer-status';
import { PopSelect as Select } from '../../patterns/pop-select';
import type { IssueStanding, Printer, RemainderCandidate } from './types';

const t = messages.repackLabelIssue.issue;

export interface IssuePaneProps {
  selectedHandlingUnitNo: string | null;
  includeNewLabel: boolean;
  onIncludeNewLabelChange: (checked: boolean) => void;
  remainderCandidates: readonly RemainderCandidate[];
  selectedRemainderIds: readonly number[];
  onRemainderChange: (handlingUnitId: number, checked: boolean) => void;
  remainderFailed: boolean;
  /** 인쇄할 라벨을 하나도 고르지 않았는가 — 그 사유를 인쇄 대상 안에서 말한다. */
  targetRequired: boolean;

  standing: IssueStanding;
  standingFailed: boolean;
  onStandingRetry: () => void;

  /** 서버가 사유 칸을 지목해 되돌린 말(422). 배너가 아니라 이 칸 아래에 선다 */

  printers: readonly Printer[];
  printersFailed: boolean;
  printerName: string;
  onPrinterChange: (value: string) => void;
}

/**
 * 《라벨 발행》 — ③ 인쇄 대상 · ④ 프린터.
 *
 * ⛔ **액션바는 여기 없다.** 설계 §3 은 [ 미리보기 ]·[ 발번·인쇄 ]를 구획 «안»이 아니라
 * **화면 바닥의 띠(88)** 로 그렸다 — 다른 POP 화면도 모두 그 자리다. 구획 안에 두면 구획이
 * 길어질 때 단추가 함께 밀려 내려가 화면 밖으로 나간다.
 *
 * ⛔ **회차를 화면이 세지 않는다**(계약 「서버가 매긴다」). 화면이 발행 현황으로 정하는 것은
 * **사유 칸을 요구할 것인가** 하나이고, 이번이 몇 회차가 될지는 말하지 않는다.
 *
 */
export const IssuePane = ({
  selectedHandlingUnitNo,
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
  printers,
  printersFailed,
  printerName,
  onPrinterChange,
}: IssuePaneProps) => {
  const printerId = useId();

  const selectedPrinter = printers.find((printer) => printer.printerName === printerName) ?? null;
  const printerOptions = printers.map((printer) => ({
    value: printer.printerName,
    label: printer.displayName,
  }));

  return (
    <>
      {/*
       * ⭐ **인쇄 대상과 프린터를 한 줄에 나란히 둔다**(사용자 지시 2026-09-17). 무엇을 어디로 찍는지를
       *    한 줄에서 함께 고른다. 좁으면 격자가 위아래로 접는다(`pop.css`).
       */}
      <div className="pop-repack-target-row">
        <fieldset className="pop-repack-targets">
          <legend className="pop-repack-targets-legend">
            {t.targetsLabel}
            {/*
             * ⭐ **고를 자리에서 말한다**(사용자 지시 2026-09-17) — 「인쇄 대상」 제목 옆에 선다.
             *    아래 액션 줄에 두면 고칠 칸과 말하는 자리가 갈린다.
             */}
            {targetRequired && (
              <Chip
                className="pop-repack-target-required"
                status="warning"
                size="md"
                leadingIcon={<Icon name="info" size={18} />}
              >
                {t.targetRequired}
              </Chip>
            )}
          </legend>
          <Checkbox
            checked={selectedHandlingUnitNo !== null && includeNewLabel}
            disabled={selectedHandlingUnitNo === null}
            onChange={(event) => onIncludeNewLabelChange(event.target.checked)}
          >
            {selectedHandlingUnitNo === null
              ? t.newLabelWaiting
              : t.newLabel(selectedHandlingUnitNo)}
          </Checkbox>

          {remainderCandidates.map(({ handlingUnit, standing: remainderStanding }) => (
            <div className="pop-repack-remainder" key={handlingUnit.handlingUnitId}>
              <Checkbox
                checked={selectedRemainderIds.includes(handlingUnit.handlingUnitId)}
                onChange={(event) =>
                  onRemainderChange(handlingUnit.handlingUnitId, event.target.checked)
                }
              >
                {t.remainderLabel(handlingUnit.handlingUnitNo, remainderStanding.issueCount ?? 0)}
              </Checkbox>
              {/* 잔량 라벨의 성질은 그 항목 «옆» 라벨로 짧게 말한다(사용자 지시 2026-09-17). */}
              <Chip
                className="pop-repack-remainder-note"
                status="info"
                size="md"
                leadingIcon={<Icon name="info" size={18} />}
              >
                {t.remainderNumberNote}
              </Chip>
            </div>
          ))}
          {remainderFailed && <p className="pop-repack-note">{t.remainderFailed}</p>}
        </fieldset>
        <div className="pop-repack-field">
          <label htmlFor={printerId}>{t.printerLabel}</label>
          <Select
            id={printerId}
            options={printerOptions}
            value={printerName === '' ? null : printerName}
            onChange={onPrinterChange}
            placeholder={t.printerPlaceholder}
            className="pop-repack-select"
            disabled={printers.length === 0}
          />
          {selectedPrinter !== null && (
            <PopPrinterStatus
              status={selectedPrinter.status}
              text={selectedPrinter.statusMessage ?? selectedPrinter.status}
            />
          )}
          {printersFailed && <p className="pop-repack-note">{t.printersFailed}</p>}
          {!printersFailed && printers.length === 0 && (
            <p className="pop-repack-note">{t.printersEmpty}</p>
          )}
        </div>
      </div>

      {/*
        ⚠ **몇 회차인가는 구획 «표제 옆»에 선다**(사용자 지시 2026-09-07) — 이 구획이 무엇을
        하는 자리인지와 한눈에 함께 읽힌다. 여기 남는 것은 그것을 «못 받았을 때»뿐이다.
      */}
      {standingFailed && (
        <div className="banner-slot">
          <AlertBanner
            variant="warning"
            title={t.summaryFailed}
            action={
              <Button variant="outlined" size="sm" onClick={onStandingRetry}>
                {messages.common.retry}
              </Button>
            }
          />
        </div>
      )}

      {/* 앞선 인쇄가 실패로 남아 있다 — 라벨이 안 나왔을 수 있다는 사실을 먼저 말한다. */}
      {standing.lastPrintOutcome === 'FAILED' && (
        <div className="banner-slot">
          <AlertBanner variant="warning" title={t.lastPrintFailed} />
        </div>
      )}
    </>
  );
};
