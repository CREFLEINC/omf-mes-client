import { AlertBanner, Select } from '@crefle/web-ui';
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
      {/*
        ⚠ **몇 회차인가는 구획 «표제 옆»에 선다**(사용자 지시 2026-09-07) — 이 구획이 무엇을
        하는 자리인지와 한눈에 함께 읽힌다. 여기 남는 것은 그것을 «못 받았을 때»뿐이다.
      */}
      {standingFailed && (
        <div className="banner-slot">
          <AlertBanner variant="warning" title={t.summaryFailed} />
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
          /*
           * ⛔ **`lg`(48) 로 두지 않는다.** POP 은 고르는 칸의 터치 하한을 56 으로 올리는데,
           *    부품이 «키»를 48 로 못박고 있어 하한만 늘어난다 — 겉 상자는 48 인 채 안의 단추가
           *    56 이라 **아래가 잘려 보였다**(실측 · 사용자 지적). 하한보다 큰 등급을 준다.
           */
          size="xl"
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
          /*
           * ⛔ **`lg`(48) 로 두지 않는다.** POP 은 고르는 칸의 터치 하한을 56 으로 올리는데,
           *    부품이 «키»를 48 로 못박고 있어 하한만 늘어난다 — 겉 상자는 48 인 채 안의 단추가
           *    56 이라 **아래가 잘려 보였다**(실측 · 사용자 지적). 하한보다 큰 등급을 준다.
           */
          size="xl"
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
