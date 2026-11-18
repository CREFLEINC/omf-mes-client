import { Chip, Icon, IconButton } from '@crefle/web-ui';
import type { InboundLotDetail, InboundLotMaterialLot } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import type { UseQueryResult } from '@tanstack/react-query';
import { Fragment, useId } from 'react';

import { Button } from '../../patterns/button';
import { Card } from '../../patterns/card';
import { shortLotNos } from '../../patterns/lot-short-no';
import { plantClock } from '../../patterns/plant-time';
import { isReceiving, type CardLock, type CardState } from './receipt';

import '../../patterns/lot-table.css';

const t = messages.inboundReceipt.card;

/** 패키징 단위 — 이름이 있으면 이름(「봉지」), 없으면 코드(G1 잔여). */
const packageUnitOf = (pkg: { uomCode: string; uomName?: string | null }): string => {
  const name = pkg.uomName?.trim() ?? '';

  return name === '' ? pkg.uomCode : name;
};

/**
 * 공급사 · 품목 값 — 낱말마다 꺾이지 않는 조각으로 그린다. 한글은 음절 사이에서도 꺾여 「검사불 / 필요」가 되는데,
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
  /** 자재 관리 LOT 표 · [입하 마감]을 펼쳤는가 — 머리를 누르면 바뀐다. */
  open: boolean;
  /** 마지막으로 스캔이 들어간 카드(맨 위) — 테두리를 짙게. */
  current: boolean;
  onToggle: () => void;
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
  open,
  current,
  onToggle,
  onUnregister,
  onEditSupplierLot,
  onClose,
}: InboundLotCardProps) => {
  const data = detail?.data;
  const lockNoteId = useId();
  const bodyId = useId();

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
  /* 품질(검사 대기 · 보류) 칩은 두지 않는다(사용자 지시 2026-11-18). */
  const shortNos = shortLotNos(lots.map((lot) => lot.lotNo));

  return (
    <Card
      className="receive-card"
      role="group"
      data-closed={!receiving}
      data-current={current}
      aria-label={data.inboundLotNo}
    >
      {/*
       * 머리 띠 — 누르면 자재 관리 LOT 표 · [입하 마감]을 접고 편다(사용자 지시 2026-11-18 「입하 LOT 단위 접기 펴기」).
       * 이름표 붙은 칸(공급사 · 품목 · LOT 수 · 전체 수량)은 접어도 남아 카드끼리 가를 수 있다.
       */}
      <button
        type="button"
        className="receive-card__head"
        aria-expanded={open}
        aria-controls={bodyId}
        aria-label={open ? t.collapse(data.inboundLotNo) : t.expand(data.inboundLotNo)}
        onClick={onToggle}
      >
        <span className="receive-card__no">{data.inboundLotNo}</span>
        <Chip size="sm" status={receiving ? (card.created ? 'warning' : 'info') : 'success'}>
          {status}
        </Chip>
        <Icon name={open ? 'expand_less' : 'expand_more'} size={24} />
      </button>
      {/* 이름표 붙은 칸 — 공급사 · 품목은 한 줄씩, LOT 수 · 전체 수량은 나란히(사용자 지시 2026-11-18 「명시적인 타이틀」). */}
      <dl className="receive-card__facts">
        <dt>{t.facts.supplier}</dt>
        <dd className="receive-card__wide">
          <Words text={data.supplierName} />
        </dd>
        <dt>{t.facts.item}</dt>
        <dd className="receive-card__wide">
          <Words text={`${data.itemCode} ${data.itemName}`} />
        </dd>
        <dt>{t.facts.lotCount}</dt>
        <dd className="receive-card__strong">{t.lotCount(data.lotCount)}</dd>
        <dt>{t.facts.totalQty}</dt>
        <dd className="receive-card__strong">{qtyText(data.receivedQty, data.uomCode)}</dd>
      </dl>

      <div id={bodyId} className="receive-card__more" hidden={!open}>
        {/*
         * 자재 관리 LOT 은 카드(입하 LOT) 아래 한 단 낮은 표 — 행은 한 줄, 줄마다 테두리 상자를 두지 않는다(사용자 지시
         * 2026-11-18 「목록과 계층으로 깔끔하게」). 번호 칸은 번호 전체 대신 카드 안에서 가를 수 있는 끝 조각(보통 일련번호),
         * 번호 전체는 공급사 LOT 시트와 단추 이름에 있다. 공급사 LOT 칸을 누르면 시트, ✕ 는 확인 없이 바로 해제.
         */}
        <table className="lot-table receive-lots" aria-label={t.lotsLabel}>
          <thead>
            <tr>
              <th scope="col">{t.columns.no}</th>
              <th scope="col">{t.columns.qty}</th>
              <th scope="col">{t.columns.registered}</th>
              <th scope="col">{t.columns.supplierLot}</th>
              {receiving ? <th scope="col" aria-label={t.unregister} /> : null}
            </tr>
          </thead>
          <tbody>
            {lots.map((lot) => {
              const latest = card.registered.get(lot.lotId) === 'latest';

              return (
                <tr key={lot.lotId} data-latest={latest}>
                  <td className="lot-table__no">{shortNos.get(lot.lotNo) ?? lot.lotNo}</td>
                  <td>
                    {qtyText(lot.lotQty, data.uomCode)}
                    {lot.package === null
                      ? ''
                      : t.package(packageUnitOf(lot.package), lot.package.count)}
                    {lot.fromSupplierLabel ? (
                      <>
                        {' '}
                        <Chip size="sm" status="idle">
                          {t.supplierLabel}
                        </Chip>
                      </>
                    ) : null}
                  </td>
                  <td className={latest ? 'lot-table__latest' : 'lot-table__muted'}>
                    {latest ? t.justNow : plantClock(lot.registeredAt)}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="receive-lots__supplier"
                      aria-label={t.editSupplierLot(lot.lotNo)}
                      disabled={!editable || busy}
                      onClick={() => {
                        onEditSupplierLot(lot);
                      }}
                    >
                      <span className="receive-lots__supplier-text">
                        {lot.supplierLotNo ?? t.noSupplierLot}
                      </span>
                      {editable ? <Icon name="edit" size={14} /> : null}
                    </button>
                  </td>
                  {receiving ? (
                    <td className="lot-table__x">
                      <IconButton
                        icon="close"
                        size="md"
                        aria-label={t.unregister}
                        disabled={lock !== null || busy}
                        onClick={() => {
                          onUnregister(lot);
                        }}
                      />
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>

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
      </div>
    </Card>
  );
};
