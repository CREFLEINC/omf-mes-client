import { AlertBanner, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { BottomActionBar } from '../../patterns/bottom-action-bar';
import { useBackStep } from '../../patterns/back-step';
import { plantShortDateTime } from '../../patterns/plant-time';
import { toApiError } from '../../patterns/request';
import { lookupMessageOf, lotOf, qtyText, type ReturnLot } from './return';
import {
  useReturnLookup,
  useReturnWorkOrderLots,
  useReturnWorkOrders,
  type ReturnWorkOrder,
  type ReturnWorkOrderLot,
} from './queries';

const t = messages.materialReturn;

/**
 * 처음 고를 LOT — 라벨 미발행 LOT 이 «한 품목에만» 있고 그 품목에 하나뿐이면 그 LOT(US4-3 · FR-015), 목록에 LOT 이
 * 하나뿐이면 그 LOT. POP 창과 같은 규칙이다.
 */
export const initialLotId = (lots: readonly ReturnWorkOrderLot[]): number | null => {
  if (lots.length === 1) return lots[0]?.lotId ?? null;
  const unprinted = lots.filter((lot) => lot.labelUnprinted);
  const items = new Set(unprinted.map((lot) => lot.item.itemId));

  return unprinted.length === 1 && items.size === 1 ? (unprinted[0]?.lotId ?? null) : null;
};

/** 「B-220 외 2 · 공정 20 · 출고 11-27 09:40」 — 생산 품목이 아니라 그 W/O 로 나간 자재(시안 ⑤ W/O 로 찾기). */
const itemLine = (workOrder: ReturnWorkOrder): string =>
  t.findByWo.workOrderLine(
    t.findByWo.withOthers(
      workOrder.returnableMaterial.item.itemCode,
      workOrder.returnableMaterial.otherItemCount,
    ),
    workOrder.processName ?? '-',
    plantShortDateTime(workOrder.lastIssuedAt),
  );

/**
 * 「라벨이 없어요 · W/O 로 찾기」(US4 · 시안 ⑤ W/O 로 찾기) — W/O → 자재 LOT 을 고르면 수량 단계로 이어진다.
 *
 * ⭐ POP 와 같은 목록이지만 라벨을 찍지 않는다 — 그 LOT 은 POP 「분할 LOT 라벨」 발행 대기에 남는다(FR-017).
 * ⭐ 고른 LOT 은 한 번 더 조회해 받는 곳(출고 생산창고)과 지금 반납 가능 양을 스캔 LOT 과 같은 값으로 갖는다.
 */
export const FindByWorkOrder = ({
  onPick,
  onClose,
}: {
  onPick: (lot: ReturnLot) => void;
  onClose: () => void;
}) => {
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<ReturnWorkOrder | null>(null);
  const [lotId, setLotId] = useState<number | null>(null);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const workOrders = useReturnWorkOrders(query);
  const lots = useReturnWorkOrderLots(picked?.workOrderId ?? null);
  const lookup = useReturnLookup();

  const lotList = lots.data ?? [];
  const autoLotId = lots.data === undefined ? null : initialLotId(lots.data);
  const chosenId = touched ? lotId : autoLotId;
  const chosen = lotList.find((lot) => lot.lotId === chosenId) ?? null;

  const backToList = (): void => {
    setPicked(null);
    setLotId(null);
    setTouched(false);
    setError(null);
  };

  useBackStep(picked !== null, backToList);
  useBackStep(picked === null, onClose);

  const next = (): void => {
    if (chosen === null || picked === null) return;
    setError(null);
    lookup.mutate(chosen.lotNo, {
      onSuccess: (found) => {
        onPick(lotOf(found, picked.workOrderId));
      },
      onError: (cause) => {
        setError(lookupMessageOf(toApiError(cause)) ?? t.findByWo.loadFailed);
      },
    });
  };

  return (
    <div className="mreturn__find">
      <h2 className="mreturn__find-title">{t.findByWo.title}</h2>
      {picked === null ? (
        <>
          <TextField
            label={t.findByWo.search}
            type="search"
            size="xl"
            fullWidth
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
          />
          {workOrders.isPending ? <p role="status">{t.findByWo.loading}</p> : null}
          {workOrders.isError ? (
            <AlertBanner variant="error" title={t.findByWo.loadFailed} />
          ) : null}
          {workOrders.data !== undefined && workOrders.data.items.length === 0 ? (
            <p className="mreturn__note">
              {query.trim() === ''
                ? t.findByWo.emptyWorkOrders
                : t.findByWo.emptySearch(query.trim())}
            </p>
          ) : null}
          <ul className="mreturn__wo-list" aria-label={t.findByWo.recent}>
            {(workOrders.data?.items ?? []).map((workOrder) => (
              <li key={workOrder.workOrderId}>
                <button
                  type="button"
                  className="mreturn__wo"
                  onClick={() => {
                    setPicked(workOrder);
                  }}
                >
                  <span className="mreturn__wo-head">
                    <b className="mreturn__code">{workOrder.workOrderNo}</b>
                    {workOrder.unprintedLotCount > 0 ? (
                      <span className="mreturn__chip mreturn__chip--info">
                        {t.findByWo.unprintedShort(workOrder.unprintedLotCount)}
                      </span>
                    ) : null}
                    {workOrder.finalized ? (
                      <span className="mreturn__chip mreturn__chip--warn">
                        {t.findByWo.finalized}
                      </span>
                    ) : null}
                  </span>
                  <span className="mreturn__sub">{itemLine(workOrder)}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <p className="mreturn__wo-picked">
            <b className="mreturn__code">{picked.workOrderNo}</b>
            {picked.finalized ? (
              <span className="mreturn__chip mreturn__chip--warn">{t.findByWo.finalized}</span>
            ) : null}
          </p>
          {picked.finalized ? (
            <AlertBanner variant="info" title={t.findByWo.finalizedNote} />
          ) : null}
          {lots.isPending ? <p role="status">{t.findByWo.loading}</p> : null}
          {lots.isError ? <AlertBanner variant="error" title={t.findByWo.loadFailed} /> : null}
          {lots.data !== undefined && lotList.length === 0 ? (
            <p className="mreturn__note">{t.findByWo.emptyLots}</p>
          ) : null}
          <ul className="mreturn__wo-list" aria-label={t.findByWo.lotTable.label}>
            {lotList.map((lot) => (
              <li key={lot.lotId}>
                <button
                  type="button"
                  className={lot.lotId === chosenId ? 'mreturn__wo is-picked' : 'mreturn__wo'}
                  aria-pressed={lot.lotId === chosenId}
                  onClick={() => {
                    setTouched(true);
                    setLotId(lot.lotId);
                  }}
                >
                  <span className="mreturn__wo-head">
                    <b className="mreturn__code">{lot.item.itemCode}</b>
                    {lot.labelUnprinted ? (
                      <span className="mreturn__chip mreturn__chip--info">
                        {t.findByWo.labelUnprinted}
                      </span>
                    ) : null}
                    {lot.lotId === autoLotId ? (
                      <span className="mreturn__chip mreturn__chip--ok">
                        {t.findByWo.autoPicked}
                      </span>
                    ) : null}
                  </span>
                  <span className="mreturn__lotno">{lot.lotNo}</span>
                  <span className="mreturn__sub">
                    {`${t.findByWo.lotTable.issued} ${plantShortDateTime(lot.issuedAt)} · ${qtyText(lot.issueQty, lot.uom.uomCode)}`}
                  </span>
                  <span className="mreturn__sub">
                    {t.pda.returnableOf(qtyText(lot.returnableQty, lot.uom.uomCode))}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {error === null ? null : <AlertBanner variant="error" title={error} />}
        </>
      )}
      <BottomActionBar
        {...(picked === null
          ? {}
          : {
              primary: {
                label: t.findByWo.next,
                onClick: next,
                disabled: chosen === null,
                busy: lookup.isPending,
              },
            })}
        secondary={
          picked === null
            ? { label: t.findByWo.close, onClick: onClose }
            : { label: t.findByWo.back, onClick: backToList }
        }
      />
    </div>
  );
};
