import { Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { formatBaseQty, formatPackage } from '../../patterns/package-qty';
import { plantToday } from '../../patterns/plant-time';
import { popTouchClass } from '../../patterns/pop-touch';
import type { LabelLot } from './types';

const t = messages.popMaterialLotLabel.preview;

export interface PreviewDialogProps {
  lots: readonly LabelLot[];
  /** 다시 인쇄면 고른 사유 이름 — 첫 발행이면 null. */
  reasonName: string | null;
  printerName: string | null;
  onCancel: () => void;
  onPrint: () => void;
}

const QrMark = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM18 18h3v3h-3zM5 5h3v3H5zM16 5h3v3h-3zM5 16h3v3H5z" />
  </svg>
);

/**
 * 라벨 미리 보기(screens/P-01-01.md 「라벨 미리 보기」 · FR-007·008).
 *
 * ⭐ 실제 라벨은 POP 이 TSPL 로 짠다(`label-tspl`) — 여기는 **무엇이 실리는가**를 보이는 그림이다. QR 에는
 *    자재 관리 LOT 번호만 실린다(지금 규칙). 다시 인쇄면 「재발행 N회」(다음 회차)를 함께 보인다.
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
    <Dialog
      open
      /* POP 팝업은 바깥을 눌러 닫히지 않는다(#1005) — 장갑 낀 손이 창 밖을 스치면 사라졌다. */
      closeOnBackdropClick={false}
      onClose={onCancel}
      title={isReprint ? t.reprintTitle : t.title}
      size="lg"
      className="pop-mlot-preview-dialog"
      footer={
        <>
          <span className="pop-mlot-hint pop-mlot-preview-printer">
            {printerName === null ? t.printerDefault : t.printer(printerName)}
          </span>
          <Button
            className={popTouchClass('normal')}
            variant="outlined"
            size="xl"
            onClick={onCancel}
          >
            {t.cancel}
          </Button>
          <Button className={popTouchClass('primary')} size="xl" onClick={onPrint}>
            {isReprint ? t.reprint(lots.length) : t.print(lots.length)}
          </Button>
        </>
      }
    >
      <p className="pop-mlot-hint">
        {t.note}
        {reasonName === null ? '' : t.reprintNote(reasonName)}
      </p>
      <figure className="pop-mlot-label-preview" aria-label={lot.lotNo}>
        <div className="pop-mlot-label-qr">
          <QrMark />
          <span className="pop-mlot-cell-lot">{lot.lotNo}</span>
        </div>
        <dl className="pop-mlot-label-fields">
          <div className="pop-mlot-label-head">
            <span>{t.kind}</span>
            <span>{plantToday()}</span>
          </div>
          <dt>{t.item}</dt>
          <dd>
            <strong>{lot.itemCode}</strong>
            <br />
            {lot.itemName}
          </dd>
          <dt>{t.qty}</dt>
          <dd className="pop-mlot-label-big">{formatBaseQty(lot.lotQty, lot.uomCode)}</dd>
          {packageText === null ? null : (
            <>
              <dt>{t.package}</dt>
              <dd className="pop-mlot-label-pkg">{packageText}</dd>
            </>
          )}
          <dt>{t.supplier}</dt>
          <dd>{`${lot.supplierName} (${lot.supplierCode})`}</dd>
        </dl>
        {isReprint ? (
          <span className="pop-mlot-label-reissue">
            {t.reissue((lot.lastIssue?.issueSeq ?? 0) + 1)}
          </span>
        ) : null}
      </figure>
      <nav className="pop-mlot-preview-pager" aria-label={t.page(index + 1, lots.length)}>
        <Button
          className={popTouchClass('normal')}
          variant="outlined"
          size="xl"
          disabled={index <= 0}
          onClick={() => {
            setIndex(index - 1);
          }}
        >
          {t.prev}
        </Button>
        <span className="pop-mlot-preview-page">{t.page(index + 1, lots.length)}</span>
        <Button
          className={popTouchClass('normal')}
          variant="outlined"
          size="xl"
          disabled={index >= lots.length - 1}
          onClick={() => {
            setIndex(index + 1);
          }}
        >
          {t.next}
        </Button>
      </nav>
    </Dialog>
  );
};
