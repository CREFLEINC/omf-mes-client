import { AlertBanner, Button, Select, Tooltip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import type { CodeValue, IssueStanding, Printer } from './types';

const t = messages.repackLabelIssue.issue;

export interface IssuePaneProps {
  standing: IssueStanding;
  standingFailed: boolean;

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

  /** 발행을 막는 사유. `null` 이면 막지 않는다 */
  blockedReason: string | null;
  isSubmitting: boolean;
  onSubmit: () => void;

  /** 발행 이력이 있어야 볼 것이 있다(착수 이슈 §6) */
  canPreview: boolean;
  onPreview: () => void;
}

/**
 * 《라벨 발행》 — ③ 인쇄 대상 · ④ 프린터 · 액션바.
 *
 * ⛔ **회차를 화면이 세지 않는다**(계약 「서버가 매긴다」). 화면이 발행 현황으로 정하는 것은
 * **사유 칸을 요구할 것인가** 하나이고, 이번이 몇 회차가 될지는 말하지 않는다.
 *
 * ⛔ **스펙 ③ 의 「인쇄 대상 체크박스」가 여기 없다.** 그 구획은 「새 포장 라벨」과 「잔량 라벨
 * 재출력」을 가르는데, 새 포장이 아직 서지 않아(`types.ts` 머리 · `omf-mes#418`) 고를 갈래가
 * 하나뿐이다 — **체크박스 하나짜리 선택은 선택이 아니다.** 앞단이 열리면 이 구획에 붙는다.
 */
export const IssuePane = ({
  standing,
  standingFailed,
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
  blockedReason,
  isSubmitting,
  onSubmit,
  canPreview,
  onPreview,
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

  const disabled = blockedReason !== null || isSubmitting || reasonMissing;

  return (
    <>
      {standingFailed ? (
        <div className="banner-slot">
          <AlertBanner variant="warning" title={t.summaryFailed} />
        </div>
      ) : (
        <p className="pop-repack-standing">
          {standing.issueCount === null || standing.issueCount === 0
            ? t.firstIssue
            : t.reissue(standing.issueCount)}
        </p>
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
          size="lg"
          disabled={!reasonRequired || reasons.length === 0}
          invalid={reasonMissing || reasonServerError !== null}
          aria-describedby={reasonServerError === null ? undefined : reasonErrorId}
        />
        {reasonsFailed && <p className="pop-repack-note">{t.reasonsFailed}</p>}
        {!reasonsFailed && reasons.length === 0 && (
          <p className="pop-repack-note">{t.reasonsEmpty}</p>
        )}
        {reasonMissing && <p className="pop-repack-note">{t.reasonRequired}</p>}
        {reasonServerError !== null && (
          <p className="pop-repack-note" id={reasonErrorId}>
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
          size="lg"
          disabled={printers.length === 0}
        />
        {printersFailed && <p className="pop-repack-note">{t.printersFailed}</p>}
        {!printersFailed && printers.length === 0 && (
          <p className="pop-repack-note">{t.printersEmpty}</p>
        )}
      </div>

      <div className="pop-action-bar">
        {/*
          ⚠ **발행 전에는 볼 것이 없다.** 그리기 경로가 발행 기록 번호를 받는다(착수 이슈 §6) —
          비활성으로 두되 **사유를 말한다.**
        */}
        {canPreview ? (
          <Button variant="outlined" size="2xl" onClick={onPreview}>
            {t.preview}
          </Button>
        ) : (
          <Tooltip content={t.previewBeforeIssue}>
            <Button variant="outlined" size="2xl" disabled>
              {t.preview}
            </Button>
          </Tooltip>
        )}

        {/*
          ⭐ **`size="2xl"` 이 72px 이다** — 스펙 §7 이 지목한 치수이고 고정 커밋의 설치본에
          실제로 있다. `patterns/pop-touch` 의 부족분 보충은 `xl`(60px)까지이던 시절의 것이라
          여기서는 쓰지 않는다.
        */}
        {blockedReason === null ? (
          <Button
            variant="filled"
            size="2xl"
            onClick={onSubmit}
            loading={isSubmitting}
            disabled={disabled}
          >
            {t.submit}
          </Button>
        ) : (
          <Tooltip content={blockedReason}>
            <Button variant="filled" size="2xl" disabled>
              {t.submit}
            </Button>
          </Tooltip>
        )}
      </div>
    </>
  );
};
