import { Chip, Icon } from '@crefle/web-ui';
import type { InboundLotDetail, InboundLotMaterialLot } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import type { UseQueryResult } from '@tanstack/react-query';

import { Button } from '../../patterns/button';
import { Card } from '../../patterns/card';
import { isReceiving, type CardLock, type CardState } from './receipt';

const t = messages.inboundReceipt.card;

/** 수량 글 — 천 단위 쉼표, 소수는 여섯 자리까지. */
export const qtyText = (qty: number, uomCode: string): string =>
  `${qty.toLocaleString('ko-KR', { maximumFractionDigits: 6 })} ${uomCode}`;

/** 「앞서 등록 08:05」의 시각(단말 시각). */
const clockOf = (value: string): string => {
  const at = new Date(value);

  return Number.isNaN(at.getTime())
    ? ''
    : `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
};

export interface InboundLotCardProps {
  card: CardState;
  detail: UseQueryResult<InboundLotDetail> | undefined;
  lock: CardLock;
  pendingCount: number;
  busy: boolean;
  /** 이 화면이 마감했는가 — 아니면 「다른 단말 또는 날짜 자동 마감」 문구를 앞에 붙인다. */
  closedHere: boolean;
  onUnregister: (lot: InboundLotMaterialLot) => void;
  onEditSupplierLot: (lot: InboundLotMaterialLot) => void;
  onClose: () => void;
}

/**
 * 입하 LOT 카드(screens/M-01-01.md 「입하 LOT 카드」) — 공급사·품목마다 한 장.
 *
 * ⭐ 줄을 누르면 공급사 LOT 번호 시트 — 입하 중 · 온라인 · 전송 대기 없음일 때만(계약 §3, plan 확인할 것 14).
 * ⭐ [해제]는 확인 없이 바로, [입하 마감]은 확인 창 뒤.
 */
export const InboundLotCard = ({
  card,
  detail,
  lock,
  pendingCount,
  busy,
  closedHere,
  onUnregister,
  onEditSupplierLot,
  onClose,
}: InboundLotCardProps) => {
  const data = detail?.data;

  if (data === undefined) {
    return (
      <Card className="receive-card" role="group" aria-label={card.inboundLotNo}>
        <p className="receive-card__no">{card.inboundLotNo}</p>
        {detail?.isError === true ? (
          <p className="receive-card__note" role="alert">
            {t.loadFailed}{' '}
            <Button variant="outlined" size="sm" onClick={() => void detail.refetch()}>
              {t.retry}
            </Button>
          </p>
        ) : (
          <p className="receive-card__note">{t.loading}</p>
        )}
      </Card>
    );
  }

  const receiving = isReceiving(data);
  const editable = receiving && lock === null;
  const iqcNo = data.iqc?.requestNo ?? null;
  const status =
    data.statusCode === 'VOIDED'
      ? t.statusVoided
      : receiving
        ? card.created
          ? t.statusNew
          : t.statusReceiving
        : data.inspectionRequired
          ? t.statusClosed
          : t.statusClosedNoIqc;
  const lots = data.lots.filter((lot) => lot.lifecycleStatusCode !== 'WAITING');

  return (
    <Card
      className="receive-card"
      role="group"
      data-closed={!receiving}
      aria-label={data.inboundLotNo}
    >
      <div className="receive-card__head">
        <span className="receive-card__no">{data.inboundLotNo}</span>
        <Chip size="sm" status={receiving ? (card.created ? 'warning' : 'info') : 'success'}>
          {status}
        </Chip>
      </div>
      <p className="receive-card__pair">
        {t.pair(data.supplierName, data.itemCode, data.itemName)}
      </p>
      <p className="receive-card__sum">
        {t.summary(data.lotCount, qtyText(data.receivedQty, data.uomCode))}
      </p>

      <ol className="receive-card__lots">
        {lots.map((lot, index) => {
          const mark = card.registered.get(lot.lotId);
          const when =
            mark === 'latest'
              ? t.justNow
              : mark === 'session'
                ? t.thisVisit
                : t.earlier(clockOf(lot.registeredAt));

          return (
            <li key={lot.lotId} className="receive-lot" data-latest={mark === 'latest'}>
              <span className="receive-lot__seq">{index + 1}</span>
              <div className="receive-lot__body">
                <span className="receive-lot__no">{lot.lotNo}</span>
                <span className="receive-lot__qty">
                  {qtyText(lot.lotQty, data.uomCode)}
                  {lot.package === null
                    ? ''
                    : ` · ${lot.package.uomCode} ${String(lot.package.count)}`}
                </span>
                <span className="receive-lot__chips">
                  <Chip size="sm" status={mark === 'latest' ? 'info' : 'idle'}>
                    {when}
                  </Chip>
                  {lot.fromSupplierLabel ? (
                    <Chip size="sm" status="idle">
                      {t.supplierLabel}
                    </Chip>
                  ) : null}
                  <Chip size="sm" status={lot.statusCode === 'NORMAL' ? 'success' : 'warning'}>
                    {lot.statusCode === 'NORMAL' ? t.qualityNormal : t.qualityPending}
                  </Chip>
                </span>
                <button
                  type="button"
                  className="receive-lot__supplier"
                  aria-label={t.editSupplierLot(lot.lotNo)}
                  disabled={!editable || busy}
                  onClick={() => {
                    onEditSupplierLot(lot);
                  }}
                >
                  <Icon name="sell" size={16} />
                  {lot.supplierLotNo === null ? t.noSupplierLot : t.supplierLot(lot.supplierLotNo)}
                  <Icon name={editable ? 'edit' : 'lock'} size={16} />
                </button>
              </div>
              {receiving ? (
                <Button
                  variant="outlined"
                  size="sm"
                  disabled={lock !== null || busy}
                  onClick={() => {
                    onUnregister(lot);
                  }}
                >
                  {t.unregister}
                </Button>
              ) : null}
            </li>
          );
        })}
      </ol>

      {receiving ? (
        <>
          <Button
            className="receive-card__close"
            disabled={lock !== null || busy}
            onClick={onClose}
          >
            {t.close}
          </Button>
          {lock === null ? null : (
            <p className="receive-card__note">
              {lock === 'offline' ? t.blockedOffline : t.blockedPending(pendingCount)}
            </p>
          )}
        </>
      ) : data.statusCode === 'VOIDED' ? null : (
        <>
          <p className="receive-card__note">
            {closedHere ? '' : t.closedElsewhere}
            {data.inspectionRequired
              ? t.closedNote(iqcNo)
              : `${t.noInspection}. ${t.closedNote(null)}`}
          </p>
          <p className="receive-card__note">{t.readOnlySupplierLot}</p>
        </>
      )}
    </Card>
  );
};
