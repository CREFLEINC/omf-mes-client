import { AlertBanner } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { QrCode } from '@omf-mes/ui';

import { Button } from '../../patterns/button';
import type { ShipmentCompletionBlocker, ShipmentRequest } from './picking';

const t = messages.productPicking;

/** 막는 이유 한 줄 — 서버가 준 라인·LOT 을 그대로 붙인다. */
export const blockerText = (blocker: ShipmentCompletionBlocker): string => {
  switch (blocker.code) {
    case 'PICKING_SHORT':
      return t.blocker.PICKING_SHORT(blocker.lineNo ?? 0);
    case 'SALES_ORDER_LINE_CANCELLED':
      return t.blocker.SALES_ORDER_LINE_CANCELLED(blocker.lineNo ?? 0);
    case 'ALREADY_COMPLETED':
      return t.blocker.ALREADY_COMPLETED;
    default:
      return t.blocker[blocker.code](blocker.lotNo ?? '');
  }
};

/**
 * 「지시서 코드 보기」 — POP 「출하 완료」 화면의 스캐너에 비출 QR 을 흰 바탕 전체 화면으로.
 *
 * 값은 인쇄본과 같은 `SHPREQ:{번호}` 다. 막는 이유(`completionBlockers`)를 함께 보여 POP 에
 * 가기 전에 알 수 있게 한다(시안 ⑦ 제안).
 */
export const CodeSheet = ({
  request,
  customerName,
  onClose,
}: {
  request: ShipmentRequest;
  customerName: string | null;
  onClose: () => void;
}) => (
  <div className="picking picking--qr">
    <h2 className="picking__qr-title">{t.qr.title}</h2>
    <QrCode
      className="picking__qr"
      value={request.code}
      size="15.5rem"
      label={t.qr.label(request.shipmentRequestNo)}
    />
    <strong className="picking__qr-no">{request.shipmentRequestNo}</strong>
    <p className="picking__note">{request.code}</p>
    {customerName === null ? null : <p>{customerName}</p>}
    <AlertBanner variant="info" title={t.qr.guide}>
      {t.qr.guideDetail}
    </AlertBanner>
    {request.completionBlockers.length === 0 ? null : (
      <AlertBanner variant="warning" title={t.qr.blockedTitle}>
        <ul className="picking__blockers">
          {request.completionBlockers.map((blocker) => (
            <li key={`${blocker.code}-${String(blocker.lineNo)}-${String(blocker.lotNo)}`}>
              {blockerText(blocker)}
            </li>
          ))}
        </ul>
      </AlertBanner>
    )}
    <Button className="picking__pick" variant="filled" size="2xl" onClick={onClose}>
      {t.qr.close}
    </Button>
  </div>
);
