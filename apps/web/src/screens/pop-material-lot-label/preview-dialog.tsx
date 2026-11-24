import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { materialLotLabelFieldsOf } from '../../patterns/material-lot-label-print';
import { PuButton, PuDialog } from '../../patterns/pop-uniform';
import { LabelPreview } from './label-preview';
import type { LabelLot } from './types';

const t = messages.popMaterialLotLabel.preview;

export interface PreviewDialogProps {
  lots: readonly LabelLot[];
  /** 재인쇄면 고른 사유 이름 — 첫 발행이면 null. */
  reasonName: string | null;
  onCancel: () => void;
  onPrint: () => void;
}

/**
 * 라벨 미리 보기(screens/P-01-01.md 「라벨 미리 보기」 · FR-007·008 · 규칙 16 — 머리 X 없이 [취소] + [N장 인쇄]).
 *
 * ⭐ 실제 라벨과 같은 자리 · 같은 값으로 그린다(`label-preview` — 인쇄의 `layoutMaterialLotLabel` 을 그대로 쓴다).
 *    QR 에는 자재 관리 LOT 번호만 실린다(지금 규칙). 재인쇄면 「재인쇄 N회」(다음 회차)를 함께 보인다.
 */
export const PreviewDialog = ({ lots, reasonName, onCancel, onPrint }: PreviewDialogProps) => {
  const [index, setIndex] = useState(0);
  const lot = lots[Math.min(index, lots.length - 1)];
  const isReprint = reasonName !== null;

  if (lot === undefined) return null;

  return (
    <PuDialog
      title={isReprint ? t.reprintTitle : t.title}
      onClose={onCancel}
      footer={
        <>
          {/* 장 수는 [N장 인쇄]가 이미 말한다 — 따로 두지 않는다(사용자 지시 2026-11-19). */}
          <PuButton onClick={onCancel}>{t.close}</PuButton>
          <PuButton variant="primary" icon="print" onClick={onPrint}>
            {isReprint ? t.reprint(lots.length) : t.print(lots.length)}
          </PuButton>
        </>
      }
    >
      {/* 종이와 같은 자리 · 같은 값으로 그린다 — 회차는 라벨 오른쪽 위 `#n`(다음 회차). */}
      <figure className="mll-preview">
        <LabelPreview fields={materialLotLabelFieldsOf(lot, (lot.lastIssue?.issueSeq ?? 0) + 1)} />
        {isReprint ? (
          <figcaption className="mll-preview-reissue">
            {t.reissue((lot.lastIssue?.issueSeq ?? 0) + 1)}
          </figcaption>
        ) : null}
      </figure>
      {lots.length > 1 ? (
        <nav className="mll-preview-pager" aria-label={t.page(index + 1, lots.length)}>
          <PuButton
            disabled={index <= 0}
            onClick={() => {
              setIndex(index - 1);
            }}
          >
            {t.prev}
          </PuButton>
          <span>{t.page(index + 1, lots.length)}</span>
          <PuButton
            disabled={index >= lots.length - 1}
            onClick={() => {
              setIndex(index + 1);
            }}
          >
            {t.next}
          </PuButton>
        </nav>
      ) : null}
    </PuDialog>
  );
};
