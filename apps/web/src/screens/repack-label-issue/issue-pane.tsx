import { AlertBanner, Button, Checkbox } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import { PopSelect as Select } from '../../patterns/pop-select';
import type { CodeValue, IssueStanding, Printer, RemainderCandidate } from './types';

const t = messages.repackLabelIssue.issue;

export interface IssuePaneProps {
  selectedHandlingUnitNo: string | null;
  includeNewLabel: boolean;
  onIncludeNewLabelChange: (checked: boolean) => void;
  remainderCandidates: readonly RemainderCandidate[];
  selectedRemainderIds: readonly number[];
  onRemainderChange: (handlingUnitId: number, checked: boolean) => void;
  remainderFailed: boolean;

  standing: IssueStanding;
  standingFailed: boolean;
  onStandingRetry: () => void;

  reasons: readonly CodeValue[];
  reasonsFailed: boolean;
  reasonCode: string;
  onReasonChange: (value: string) => void;
  reasonRequired: boolean;
  /** 서버가 사유 칸을 지목해 되돌린 말(422). 배너가 아니라 이 칸 아래에 선다 */
  reasonServerError: string | null;

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
  standing,
  standingFailed,
  onStandingRetry,
  reasons,
  reasonsFailed,
  reasonCode,
  onReasonChange,
  reasonRequired,
  reasonServerError,
  printers,
  printersFailed,
  printerName,
  onPrinterChange,
}: IssuePaneProps) => {
  const reasonId = useId();
  const printerId = useId();
  const reasonErrorId = useId();

  const reasonOptions = reasons.map((reason) => ({
    value: reason.code,
    label: reason.codeName,
  }));

  const printerOptions = printers.map((printer) => ({
    value: printer.printerName,
    label: `${printer.displayName} · ${printer.statusMessage ?? printer.status}`,
  }));

  /* 사유가 필요한데 아직 고르지 않았다 — 화면이 먼저 막는다(스펙 §6). */
  const reasonMissing = reasonRequired && reasonCode === '';

  return (
    <>
      <fieldset className="pop-repack-targets">
        <legend>{t.targetsLabel}</legend>
        <Checkbox
          checked={selectedHandlingUnitNo !== null && includeNewLabel}
          disabled={selectedHandlingUnitNo === null}
          onChange={(event) => onIncludeNewLabelChange(event.target.checked)}
        >
          {selectedHandlingUnitNo === null ? t.newLabelWaiting : t.newLabel(selectedHandlingUnitNo)}
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
            <p className="pop-repack-note">{t.remainderNumberNote}</p>
            <p className="pop-repack-note">{t.remainderWarning}</p>
          </div>
        ))}
        {remainderFailed && <p className="pop-repack-note">{t.remainderFailed}</p>}
      </fieldset>

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

      {/*
        ⛔ **사유 칸을 감추지 않는다**(G-2). 최초 발행이면 비활성으로 두되 자리는 남긴다 —
        감추면 재발행일 때 갑자기 나타나 사용자가 무엇이 바뀐 줄 모른다.
      */}
      <div className="pop-repack-field">
        <label htmlFor={reasonId}>
          {t.reasonLabel}
          {reasonRequired && <span aria-hidden="true"> *</span>}
        </label>
        <Select
          id={reasonId}
          options={reasonOptions}
          value={reasonCode === '' ? null : reasonCode}
          onChange={onReasonChange}
          placeholder={t.reasonPlaceholder}
          className="pop-repack-select"
          disabled={!reasonRequired || reasons.length === 0}
          invalid={reasonMissing || reasonServerError !== null}
          aria-describedby={reasonServerError === null ? undefined : reasonErrorId}
        />
        {reasonsFailed && <p className="pop-repack-note">{t.reasonsFailed}</p>}
        {!reasonsFailed && reasons.length === 0 && (
          <p className="pop-repack-note">{t.reasonsEmpty}</p>
        )}
        {/* ⚠ 오류는 도움말과 **다른 색**이어야 한다 — 같으면 사용자가 안내로 읽고 지나친다. */}
        {reasonMissing && <p className="pop-repack-error">{t.reasonRequired}</p>}
        {reasonServerError !== null && (
          <p className="pop-repack-error" id={reasonErrorId} role="alert">
            {reasonServerError}
          </p>
        )}
      </div>

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
        {printersFailed && <p className="pop-repack-note">{t.printersFailed}</p>}
        {!printersFailed && printers.length === 0 && (
          <p className="pop-repack-note">{t.printersEmpty}</p>
        )}
      </div>
    </>
  );
};
