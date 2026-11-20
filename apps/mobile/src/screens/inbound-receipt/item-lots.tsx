import { Dialog, Icon, IconButton } from '@crefle/web-ui';
import type { InboundLotDetail, InboundLotMaterialLot } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import { Button } from '../../patterns/button';
import { shortLotNos } from '../../patterns/lot-short-no';
import { packageUnitOf, qtyNumber, qtyText } from './lot-format';
import { isReceiving, receivedLotsOf } from './receipt';
import { Words } from '../../patterns/words';
import '../../patterns/item-sheet.css';

import '../../patterns/lot-table.css';

const t = messages.inboundReceipt;

export interface ItemLotsProps {
  detail: InboundLotDetail;
  /** 해제 · 공급사 LOT 을 고칠 수 있는가 — 입하 중 · 온라인 · 전송 대기 없음 · 일하는 중 아님. */
  editable: boolean;
  /** [이 품목만 마감]이 막힌 까닭 — 없으면 null. */
  closeLock: string | null;
  closing: boolean;
  onUnregister: (lot: InboundLotMaterialLot) => void;
  onEditSupplierLot: (lot: InboundLotMaterialLot) => void;
  onCloseItem: () => void;
  onDismiss: () => void;
}

/**
 * 이번 입하 표의 품목 줄을 누르면 아래에서 올라오는 시트 — 그 품목(입하 LOT 하나)으로 찍은 자재 관리 LOT.
 * 하나씩 빼기(✕) · 공급사 LOT 번호 · 이 품목만 마감처럼 드물지만 꼭 필요한 일은 여기에만 둔다(사용자 지시
 * 2026-11-20 「필요한 순간에 필요한 내용만」). 화면을 바꾸지 않아 닫으면 하던 자리 그대로다.
 * 공급사 LOT 은 스캔으로 알 수 없어 손으로 적는다.
 */
export const ItemLots = ({
  detail,
  editable,
  closeLock,
  closing,
  onUnregister,
  onEditSupplierLot,
  onCloseItem,
  onDismiss,
}: ItemLotsProps) => {
  const lots = receivedLotsOf(detail);
  const shortNos = shortLotNos(lots.map((lot) => lot.lotNo));
  const receiving = isReceiving(detail);
  const lockId = useId();

  return (
    <Dialog open onClose={onDismiss} title={t.lots.title} size="sm" className="item-sheet">
      <section className="item-lots" aria-label={t.lots.label}>
        {/* 품목코드 · 품목명 · 공급사를 이름표와 함께 같은 수준으로(사용자 지시 2026-11-20). */}
        <dl className="item-lots__head">
          <dt>{t.lots.fields.itemCode}</dt>
          <dd className="item-lots__code">{detail.itemCode}</dd>
          <dt>{t.lots.fields.itemName}</dt>
          <dd className="item-lots__name">
            <Words text={detail.itemName} />
          </dd>
          <dt>{t.lots.fields.supplier}</dt>
          <dd>{detail.supplierName}</dd>
          <dt>{t.lots.fields.received}</dt>
          <dd>{t.lots.summary(detail.lotCount, qtyText(detail.receivedQty, detail.uomCode))}</dd>
        </dl>
        <table className="lot-table item-lots__table" aria-label={t.lots.label}>
          <thead>
            <tr>
              <th scope="col" className="item-lots__no">
                {t.lots.columns.no}
              </th>
              <th scope="col">{t.lots.columns.lotNo}</th>
              <th scope="col">{t.lots.columns.qty}</th>
              <th scope="col" className="item-lots__supplier-cell">
                <span className="item-lots__clip">{t.lots.columns.supplierLot}</span>
              </th>
              {receiving ? <th scope="col" aria-label={t.lots.unregister} /> : null}
            </tr>
          </thead>
          <tbody>
            {lots.map((lot, index) => (
              <tr key={lot.lotId}>
                <td className="item-lots__no">{index + 1}</td>
                <td className="lot-table__no">{shortNos.get(lot.lotNo) ?? lot.lotNo}</td>
                <td>
                  {qtyNumber(lot.lotQty)}
                  <small className="item-lots__uom">{detail.uomCode}</small>
                  {lot.package === null
                    ? ''
                    : t.lots.package(packageUnitOf(lot.package), lot.package.count)}
                </td>
                <td className="item-lots__supplier-cell">
                  <button
                    type="button"
                    className="item-lots__supplier"
                    aria-label={t.lots.editSupplierLot(lot.lotNo)}
                    disabled={!editable}
                    onClick={() => {
                      onEditSupplierLot(lot);
                    }}
                  >
                    <span className="item-lots__supplier-text">
                      {lot.supplierLotNo ?? t.lots.noSupplierLot}
                    </span>
                    {editable ? <Icon name="edit" size={14} /> : null}
                  </button>
                </td>
                {receiving ? (
                  <td className="lot-table__x">
                    <IconButton
                      icon="close"
                      size="md"
                      aria-label={t.lots.unregister}
                      disabled={!editable}
                      onClick={() => {
                        onUnregister(lot);
                      }}
                    />
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
        {receiving ? (
          <>
            <Button
              variant="outlined"
              className="item-lots__close"
              disabled={closeLock !== null || closing}
              loading={closing}
              aria-describedby={closeLock === null ? undefined : lockId}
              onClick={onCloseItem}
            >
              {t.close.one(detail.lotCount)}
            </Button>
            {closeLock === null ? null : (
              <p id={lockId} className="item-lots__lock">
                {closeLock}
              </p>
            )}
          </>
        ) : (
          <p className="item-lots__lock">{t.tally.closed}</p>
        )}
      </section>
    </Dialog>
  );
};
