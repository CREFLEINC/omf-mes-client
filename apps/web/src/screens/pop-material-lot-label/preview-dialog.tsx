import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { formatBaseQty, formatPackage } from '../../patterns/package-qty';
import { plantToday } from '../../patterns/plant-time';
import { PuButton, PuDialog } from '../../patterns/pop-uniform';
import type { LabelLot } from './types';

const t = messages.popMaterialLotLabel.preview;

export interface PreviewDialogProps {
  lots: readonly LabelLot[];
  /** 재인쇄면 고른 사유 이름 — 첫 발행이면 null. */
  reasonName: string | null;
  printerName: string | null;
  onCancel: () => void;
  onPrint: () => void;
}

/**
 * 라벨 미리 보기(screens/P-01-01.md 「라벨 미리 보기」 · FR-007·008 · 규칙 16 — 머리 X 없이 [취소] + [N장 인쇄]).
 *
 * ⭐ 실제 라벨은 POP 이 TSPL 로 짠다(`label-tspl`) — 여기는 **무엇이 실리는가**를 보이는 그림이다. QR 에는
 *    자재 관리 LOT 번호만 실린다(지금 규칙). 재인쇄면 「재인쇄 N회」(다음 회차)를 함께 보인다.
 */
export const PreviewDialog = ({
  lots,
  reasonName,
  printerName,
  onCancel,
  onPrint,
}: PreviewDialogProps) => {
  const [index, setIndex] = useState(0);
  const lot = lots[Math.min(index, lots.length - 1)];
  const isReprint = reasonName !== null;

  if (lot === undefined) return null;

  const packageText = formatPackage(lot.package);

  return (
    <PuDialog
      title={isReprint ? t.reprintTitle : t.title}
      onClose={onCancel}
      footer={
        <>
          <span className="mll-preview-printer">
            {printerName === null ? t.printerDefault : t.printer(printerName)}
          </span>
          <PuButton onClick={onCancel}>{t.cancel}</PuButton>
          <PuButton variant="primary" icon="print" onClick={onPrint}>
            {isReprint ? t.reprint(lots.length) : t.print(lots.length)}
          </PuButton>
        </>
      }
    >
      <p className="pu-help">
        {t.note}
        {reasonName === null ? '' : t.reprintNote(reasonName)}
      </p>
      <figure className="pu-label-preview mll-preview" aria-label={lot.lotNo}>
        <b>{`${t.kind} · ${plantToday()}`}</b>
        <div className="qr" aria-hidden="true" />
        <span>
          <b>{lot.itemCode}</b> {lot.itemName}
        </span>
        <span>
          {`${t.qty} `}
          <b className="mll-preview-qty">{formatBaseQty(lot.lotQty, lot.uomCode)}</b>
          {packageText === null ? null : ` · ${packageText}`}
        </span>
        <span>{`${t.supplier} ${lot.supplierName} (${lot.supplierCode})`}</span>
        <span className="pu-mono mll-preview-lot">{lot.lotNo}</span>
        {isReprint ? (
          <span className="mll-preview-reissue">
            {t.reissue((lot.lastIssue?.issueSeq ?? 0) + 1)}
          </span>
        ) : null}
      </figure>
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
    </PuDialog>
  );
};
