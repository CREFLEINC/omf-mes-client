import { Chip, Icon } from '@crefle/web-ui';
import type { InboundLotDetail, InboundLotMaterialLot } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import type { UseQueryResult } from '@tanstack/react-query';
import { Fragment, useId } from 'react';

import { Button } from '../../patterns/button';
import { Card } from '../../patterns/card';
import { LotNoLine } from '../../patterns/lot-no-line';
import { plantClock } from '../../patterns/plant-time';
import { isReceiving, type CardLock, type CardState } from './receipt';

const t = messages.inboundReceipt.card;

/** 패키징 단위 — 이름이 있으면 이름(「봉지」), 없으면 코드(G1 잔여). */
const packageUnitOf = (pkg: { uomCode: string; uomName?: string | null }): string => {
  const name = pkg.uomName?.trim() ?? '';

  return name === '' ? pkg.uomCode : name;
};

/**
 * 공급사 · 품목 줄 — 낱말마다 꺾이지 않는 조각으로 그린다. 한글은 음절 사이에서도 꺾여 「검사불 / 필요」가 되는데,
 * 모바일 규칙(`code-wrapping`)이 `word-break: keep-all` 을 막아 조각(inline-block)으로 낱말 단위 꺾기를 만든다(G1 잔여).
 */
const Words = ({ text }: { text: string }) => (
  <>
    {text
      .split(' ')
      .filter((word) => word !== '')
      .map((word, index) => (
        <Fragment key={`${String(index)}-${word}`}>
          {index === 0 ? null : ' '}
          <span className="receive-card__word">{word}</span>
        </Fragment>
      ))}
  </>
);

/** 수량 글 — 천 단위 쉼표, 소수는 여섯 자리까지. */
export const qtyText = (qty: number, uomCode: string): string =>
  `${qty.toLocaleString('ko-KR', { maximumFractionDigits: 6 })} ${uomCode}`;

export interface InboundLotCardProps {
  card: CardState;
  detail: UseQueryResult<InboundLotDetail> | undefined;
  lock: CardLock;
  pendingCount: number;
  busy: boolean;
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
  onUnregister,
  onEditSupplierLot,
  onClose,
}: InboundLotCardProps) => {
  const data = detail?.data;
  const lockNoteId = useId();

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
  /* 품질 상태가 모두 같으면 합계 줄에 칩 하나만 — 줄마다 같은 칩을 되풀이하지 않는다. 섞이면 줄마다 단다. */
  const sharedQuality = lots.every((lot) => lot.statusCode === lots[0]?.statusCode)
    ? (lots[0]?.statusCode ?? null)
    : null;
  const qualityChip = (statusCode: string) => (
    <Chip size="sm" status={statusCode === 'NORMAL' ? 'success' : 'warning'}>
      {statusCode === 'NORMAL' ? t.qualityNormal : t.qualityPending}
    </Chip>
  );

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
        <Words text={t.pair(data.supplierName, data.itemCode, data.itemName)} />
      </p>
      <p className="receive-card__sum">
        <span>{t.summary(data.lotCount, qtyText(data.receivedQty, data.uomCode))}</span>
        {sharedQuality === null ? null : qualityChip(sharedQuality)}
      </p>

      <ol className="receive-card__lots">
        {lots.map((lot, index) => {
          const mark = card.registered.get(lot.lotId);
          /* 이 화면에서 등록한 줄은 「방금 등록」(마지막 하나)만 칩을 단다 — 줄마다 「이번에 등록」을 달지 않는다. */
          const when =
            mark === 'latest'
              ? t.justNow
              : mark === 'session'
                ? null
                : t.earlier(plantClock(lot.registeredAt));

          return (
            /*
             * 줄은 두 줄 — 위: LOT 번호 · 칩, 아래: 수량 · 공급사 LOT · [해제](사용자 지시 2026-11-18 「가능하면 한 줄로」).
             * 번호가 넘치면 가운데를 줄여 일련번호를 남기고, 아래 줄이 모자라면 공급사 LOT 글이 줄어든다.
             */
            <li key={lot.lotId} className="receive-lot" data-latest={mark === 'latest'}>
              <span className="receive-lot__seq">{index + 1}</span>
              <span className="receive-lot__body">
                <span className="receive-lot__line">
                  <LotNoLine lotNo={lot.lotNo} className="receive-lot__no" />
                  {when === null ? null : (
                    <Chip size="sm" status={mark === 'latest' ? 'info' : 'idle'}>
                      {when}
                    </Chip>
                  )}
                  {lot.fromSupplierLabel ? (
                    <Chip size="sm" status="idle">
                      {t.supplierLabel}
                    </Chip>
                  ) : null}
                  {sharedQuality === null ? qualityChip(lot.statusCode) : null}
                </span>
                <span className="receive-lot__line">
                  <span className="receive-lot__qty">
                    {qtyText(lot.lotQty, data.uomCode)}
                    {lot.package === null
                      ? ''
                      : t.package(packageUnitOf(lot.package), lot.package.count)}
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
                    <span className="receive-lot__supplier-text">
                      {lot.supplierLotNo === null
                        ? t.noSupplierLot
                        : t.supplierLot(lot.supplierLotNo)}
                    </span>
                    <Icon name={editable ? 'edit' : 'lock'} size={16} />
                  </button>
                  {receiving ? (
                    <Button
                      className="receive-lot__unregister"
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
                </span>
              </span>
            </li>
          );
        })}
      </ol>

      {receiving ? (
        <>
          <Button
            className="receive-card__close"
            disabled={lock !== null || busy}
            aria-describedby={lock === null ? undefined : lockNoteId}
            onClick={onClose}
          >
            {t.close}
          </Button>
          {lock === null ? null : (
            <p id={lockNoteId} className="receive-card__note">
              {lock === 'offline' ? t.blockedOffline : t.blockedPending(pendingCount)}
            </p>
          )}
        </>
      ) : data.statusCode === 'VOIDED' || !data.inspectionRequired || iqcNo === null ? null : (
        <p className="receive-card__note">{t.iqcRequest(iqcNo)}</p>
      )}
    </Card>
  );
};
