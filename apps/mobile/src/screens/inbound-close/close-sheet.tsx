import { Dialog, IconButton } from '@crefle/web-ui';
import type { InboundLotDetail, InboundLotMaterialLot } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { Button } from '../../patterns/button';
import { shortLotNos } from '../../patterns/lot-short-no';
import { plantClock } from '../../patterns/plant-time';
import { Words } from '../../patterns/words';
import { formatQty, packageNameOf } from './close';
import '../../patterns/item-sheet.css';
import '../../patterns/lot-table.css';

const t = messages.inboundClose;

interface CloseSheetProps {
  target: InboundLotDetail;
  /** 마감 · 해제가 막힌 까닭 — 없으면 null. */
  lockReason: string | null;
  saving: boolean;
  onUnregister: (lot: InboundLotMaterialLot) => void;
  onClose: () => void;
  onDismiss: () => void;
}

/**
 * 「입하 품목」 시트 — 목록 줄을 누르면 아래에서 올라온다(사용자 지시 2026-11-20, 입하 등록 시트와 같은 모양). 화면을
 * 통째로 바꾸던 상세 대신이다. 이름표 칸(품목코드 · 품목명 · 공급사 · 수량), 자재 관리 LOT(번호 끝 · 수량 · 등록 · ✕),
 * 이 화면의 주 행동 [마감].
 */
export const CloseSheet = ({
  target,
  lockReason,
  saving,
  onUnregister,
  onClose,
  onDismiss,
}: CloseSheetProps) => {
  const shortNos = shortLotNos(target.lots.map((lot) => lot.lotNo));

  return (
    <Dialog open onClose={onDismiss} title={t.sheet.title} size="sm" className="item-sheet">
      <section className="close-sheet" aria-label={t.detail.lots(target.lots.length)}>
        <dl className="sheet-facts">
          <dt>{t.sheet.fields.itemCode}</dt>
          <dd className="sheet-facts__code">{target.itemCode}</dd>
          <dt>{t.sheet.fields.itemName}</dt>
          <dd>
            <Words text={target.itemName} />
          </dd>
          <dt>{t.sheet.fields.supplier}</dt>
          <dd>{target.supplierName}</dd>
          <dt>{t.sheet.fields.qty}</dt>
          <dd>
            {t.sheet.summary(target.lots.length, formatQty(target.receivedQty, target.uomCode))}
          </dd>
        </dl>
        {/*
         * 번호 칸은 번호 전체 대신 이 입하 LOT 안에서 가를 수 있는 끝 조각(보통 일련번호) — 번호 전체는 ✕ 를 누르면 뜨는
         * 확인 창에 있다(사용자 지시 2026-11-18).
         */}
        <table className="lot-table" aria-label={t.detail.lots(target.lots.length)}>
          <thead>
            <tr>
              <th scope="col">{t.detail.columns.no}</th>
              <th scope="col">{t.detail.columns.qty}</th>
              <th scope="col">{t.detail.columns.registered}</th>
              <th scope="col" aria-label={t.detail.unregister} />
            </tr>
          </thead>
          <tbody>
            {target.lots.map((lot) => (
              <tr key={lot.lotId}>
                <td className="lot-table__no">{shortNos.get(lot.lotNo) ?? lot.lotNo}</td>
                <td>
                  {formatQty(lot.lotQty, target.uomCode)}
                  {lot.package === null
                    ? ''
                    : t.detail.package(packageNameOf(lot.package), lot.package.count)}
                </td>
                <td className="lot-table__muted">{plantClock(lot.registeredAt)}</td>
                <td className="lot-table__x">
                  <IconButton
                    icon="close"
                    size="md"
                    aria-label={t.detail.unregister}
                    disabled={lockReason !== null}
                    onClick={() => {
                      onUnregister(lot);
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Button
          variant="filled"
          size="2xl"
          className="close-sheet__close"
          loading={saving}
          disabled={lockReason !== null || saving}
          onClick={onClose}
        >
          {t.detail.close}
        </Button>
        {lockReason === null ? null : <p className="close-sheet__lock">{lockReason}</p>}
      </section>
    </Dialog>
  );
};
