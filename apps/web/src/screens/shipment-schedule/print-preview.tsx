import { Button, Dialog, Radio, RadioGroup } from '@crefle/web-ui';
import { ko, messages, vi } from '@omf-mes/i18n';
import { QrCode } from '@omf-mes/ui';
import { useId, useState } from 'react';
import { createPortal } from 'react-dom';

import { formatPlantDateTime } from '../../patterns/plant-time';
import { linesOf, portionText, printableLots, type ShipmentRequestDetail } from './request-detail';

const t = messages.shipmentSchedule;

export type PrintLang = 'ko' | 'vi';

/** 출력 언어는 화면 언어와 따로 고른다 — 양식 글은 두 언어를 다 읽는다(검사표 인쇄 선례). */
const LABELS = { ko: ko.shipmentSchedule.print, vi: vi.shipmentSchedule.print } as const;

export interface PrintNames {
  customer: string;
  shipToPartner: string;
  fulfillmentPlant: string;
  item: (itemId: number) => string;
}

export interface ShipmentRequestSheetProps {
  detail: ShipmentRequestDetail;
  names: PrintNames;
  lang: PrintLang;
  printedAt: string;
}

/**
 * 출하 지시서 A4 세로 한 장(시안 Print-Preview).
 *
 * 큰 QR(`SHPREQ:{지시서 번호}` — POP P-04-07 이 읽는 값)과 사람이 읽는 번호, 머리 표, 품목 표,
 * 인쇄 시점의 피킹 LOT(교체 LOT 제외), 서명 칸 넷. ⛔ ERP 송신 표시는 없다(결정 2026-11-18).
 */
export const ShipmentRequestSheet = ({
  detail,
  names,
  lang,
  printedAt,
}: ShipmentRequestSheetProps) => {
  const l = LABELS[lang];
  const lots = printableLots(detail);

  return (
    <article className="ship-print" lang={lang}>
      <header className="ship-print__head">
        <div>
          <h1 className="ship-print__title">{l.title}</h1>
          <p className="ship-print__no">{detail.shipmentRequestNo}</p>
          <p className="ship-print__hint">{l.scanHint}</p>
        </div>
        <div className="ship-print__qr">
          <QrCode value={detail.code} size="42mm" label={l.qrLabel} />
          <span>{detail.code}</span>
        </div>
      </header>

      <table className="ship-print__table">
        <tbody>
          <tr>
            <th scope="row">{l.shipmentRequestNo}</th>
            <td>{detail.shipmentRequestNo}</td>
            <th scope="row">{l.shipDate}</th>
            <td>{detail.requestedShipDate}</td>
          </tr>
          <tr>
            <th scope="row">{l.customer}</th>
            <td>{names.customer}</td>
            <th scope="row">{l.shipToPartner}</th>
            <td>{names.shipToPartner}</td>
          </tr>
          <tr>
            <th scope="row">{l.fulfillmentPlant}</th>
            <td colSpan={3}>{names.fulfillmentPlant}</td>
          </tr>
        </tbody>
      </table>

      <h2 className="ship-print__section">{l.items}</h2>
      <table className="ship-print__table">
        <thead>
          <tr>
            <th scope="col">{l.lineNo}</th>
            <th scope="col">{l.item}</th>
            <th scope="col">{l.target}</th>
            <th scope="col">{l.picked}</th>
            <th scope="col">{l.inspection}</th>
          </tr>
        </thead>
        <tbody>
          {linesOf(detail).map((line) => (
            <tr key={line.shipmentRequestLineId}>
              <td>{line.lineNo}</td>
              <td>{names.item(line.itemId)}</td>
              <td className="ship-print__num">{line.allocatedQty}</td>
              <td className="ship-print__num">{line.pickedQty}</td>
              <td>
                {line.shippingInspectionRequired ? l.inspectionRequired : l.inspectionNotRequired}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="ship-print__section">{l.lots}</h2>
      {lots.length === 0 ? (
        <p>{l.noLots}</p>
      ) : (
        <table className="ship-print__table">
          <thead>
            <tr>
              <th scope="col">{l.lineNo}</th>
              <th scope="col">{l.lot}</th>
              <th scope="col">{l.qty}</th>
              <th scope="col">{l.places}</th>
              <th scope="col">{l.managementCode}</th>
            </tr>
          </thead>
          <tbody>
            {lots.map(({ line, lot }) => (
              <tr key={lot.shipmentRequestLotId}>
                <td>{line.lineNo}</td>
                <td>{lot.lotNo}</td>
                <td className="ship-print__num">{lot.pickedQty}</td>
                <td>{lot.portions.map((portion) => portionText(portion)).join(', ')}</td>
                <td>{lot.managementCode ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <table className="ship-print__table ship-print__signatures">
        <thead>
          <tr>
            {l.signatures.map((signature) => (
              <th key={signature} scope="col">
                {signature}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {l.signatures.map((signature) => (
              <td key={signature} />
            ))}
          </tr>
        </tbody>
      </table>
      <p className="ship-print__printed">{l.printedAt(printedAt)}</p>
    </article>
  );
};

export interface PrintPreviewDialogProps {
  detail: ShipmentRequestDetail;
  names: PrintNames;
  onClose: () => void;
  /** 인쇄 시각 — 시험이 고정할 수 있게 밖에서 받는다. */
  now?: Date;
}

/**
 * 지시서 인쇄 미리 보기. [인쇄]는 브라우저 인쇄(`window.print`)를 부르고, 인쇄 때는 이 장만
 * 보인다(`body` 바로 아래 `.sheet-print-root` — 검사표 인쇄와 같은 자리 규칙, 세로 A4 는 이름 붙은 쪽).
 */
export const PrintPreviewDialog = ({ detail, names, onClose, now }: PrintPreviewDialogProps) => {
  const [lang, setLang] = useState<PrintLang>('ko');
  const langLabelId = useId();
  const printedAt = formatPlantDateTime((now ?? new Date()).toISOString()) ?? '';
  const sheet = (
    <ShipmentRequestSheet detail={detail} names={names} lang={lang} printedAt={printedAt} />
  );

  return (
    <>
      <Dialog
        open
        size="lg"
        title={t.printPreview.title}
        onClose={onClose}
        footer={
          <>
            <Button variant="outlined" onClick={onClose}>
              {t.printPreview.close}
            </Button>
            <Button
              onClick={() => {
                window.print();
              }}
            >
              {t.printPreview.print}
            </Button>
          </>
        }
      >
        <div className="field-cell">
          <span className="field-label" id={langLabelId}>
            {t.printPreview.language}
          </span>
          <RadioGroup
            name="ship-print-lang"
            orientation="horizontal"
            value={lang}
            aria-labelledby={langLabelId}
            onChange={(value) => setLang(value === 'vi' ? 'vi' : 'ko')}
          >
            <Radio value="ko">한국어</Radio>
            <Radio value="vi">Tiếng Việt</Radio>
          </RadioGroup>
        </div>
        <div className="ship-print-preview">{sheet}</div>
      </Dialog>
      {createPortal(<div className="sheet-print-root">{sheet}</div>, document.body)}
    </>
  );
};
