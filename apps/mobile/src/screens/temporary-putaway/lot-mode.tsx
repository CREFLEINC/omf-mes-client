import { AlertBanner, Icon, Radio, RadioGroup } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Link } from 'react-router';

import { BottomActionBar } from '../../patterns/bottom-action-bar';
import { useOutbox } from '../../patterns/outbox';
import { ResultHead } from '../../patterns/result-head';
import { TaskHeader } from '../../patterns/task-header';
import { useWorkerSession } from '../../patterns/worker-session';
import type { PendingLot, PendingLotLookup, PutawayDirectResult } from '../putaway/direct';
import { initialWarehouseOf, toTemporaryLotDraft, type TemporaryWarehouse } from './temporary';

const t = messages.temporaryPutaway;
const l = messages.temporaryPutaway.lot;
const d = messages.putaway.direct;

type Outcome = 'queued' | 'sent' | 'rejected';

export interface TemporaryLotModeProps {
  /** M-01-05 가 넘긴 적치 대기 LOT(`:lookup` 결과 — `temporaryWarehouses` 를 싣는다). */
  found: PendingLotLookup & { lot: PendingLot };
}

/**
 * M-01-07 LOT 모드(피처 009, 시안 M0107-After ①~④).
 *
 * 위치를 못 정한 적치 대기 LOT 을 창고만 골라 그 창고의 「창고 전체」 자리로 입고한다. 사유는 받지 않고, 확인
 * 창 없이 [임시 적치 등록] 한 번이 확인이다. 창고 목록은 서버가 준 차례(지정 위치가 있는 창고가 위, 불량 규칙에
 * 맞는 창고만)를 그대로 쓴다.
 */
export const TemporaryLotMode = ({ found }: TemporaryLotModeProps) => {
  const { enqueue, flush, isRejected } = useOutbox();
  const queryClient = useQueryClient();
  const { worker } = useWorkerSession();
  const lot = found.lot;
  const warehouses: TemporaryWarehouse[] = found.temporaryWarehouses ?? [];
  const [warehouseId, setWarehouseId] = useState<number | null>(() =>
    initialWarehouseOf(lot, warehouses),
  );
  const [outcome, setOutcome] = useState<{ kind: Outcome; receiptNo: string | null } | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  /* 같은 틱에 두 번 누르면 멱등키가 다른 두 건이 담긴다. */
  const inFlight = useRef(false);
  const qty = `${String(lot.qty)} ${lot.uomCode}`;
  const chosen = warehouses.find((each) => each.warehouseId === warehouseId) ?? null;

  const submit = async () => {
    if (chosen === null || worker === null || inFlight.current) {
      return;
    }

    inFlight.current = true;
    setSaveFailed(false);
    const entry = toTemporaryLotDraft(lot, chosen, new Date(), worker.workerNo);

    try {
      try {
        await enqueue(entry);
      } catch {
        setSaveFailed(true);
        return;
      }

      const result = await flush().catch(() => null);
      /* 이 LOT 은 적치 대기에서 빠진다 — M-01-05 로 돌아갔을 때 그대로 서 있으면 두 번 적치할 수 있다. */
      await queryClient.invalidateQueries({ queryKey: ['putaway-pending-lots'] });

      const mine = (each: { idempotencyKey: string }) =>
        each.idempotencyKey === entry.idempotencyKey;
      const response = result?.responses.get(entry.idempotencyKey) as
        PutawayDirectResult | undefined;
      const kind: Outcome =
        (result !== null && result.rejected.some((each) => mine(each.entry))) ||
        isRejected(entry.idempotencyKey)
          ? 'rejected'
          : result === null || result.remaining.some(mine)
            ? 'queued'
            : 'sent';

      setOutcome({ kind, receiptNo: response?.goodsReceiptNo ?? null });
    } finally {
      inFlight.current = false;
    }
  };

  if (outcome !== null && chosen !== null) {
    return (
      <div className="temporary">
        {outcome.kind === 'sent' ? (
          <ResultHead tone="success" title={t.sent.title} description={t.sent.description} />
        ) : null}
        {outcome.kind === 'queued' ? (
          <ResultHead tone="pending" title={t.queued.title} description={t.queued.description} />
        ) : null}
        {outcome.kind === 'rejected' ? (
          <AlertBanner variant="error" title={t.rejected.title}>
            {t.rejected.description}
            <Link to="/rejections">{t.rejected.action}</Link>
          </AlertBanner>
        ) : null}
        {outcome.kind === 'rejected' ? null : (
          <p className="temporary__chosen">
            <Icon name="check_circle" size={20} />
            <span>
              {l.row(lot.lotNo, chosen.warehouseName, qty)}
              {outcome.receiptNo === null ? null : (
                <span className="temporary__receipt">{l.receipt(outcome.receiptNo)}</span>
              )}
            </span>
          </p>
        )}
        <Link className="action-link" to="/putaway">
          {t.done}
        </Link>
      </div>
    );
  }

  return (
    <div className="temporary with-bottom-action-bar">
      <TaskHeader
        fields={[
          { label: t.task.itemLabel, value: lot.itemCode, strong: true },
          { label: messages.putaway.tasks.itemNameLabel, value: lot.itemName, caption: true },
          {
            label: d.statusLabel,
            value: lot.lotStatusCode === 'DEFECTIVE' ? d.defective : d.normal,
          },
          { label: d.qtyLabel, value: qty },
          ...(lot.inboundLotNo === undefined
            ? []
            : [{ label: d.inboundLotLabel, value: lot.inboundLotNo, code: true }]),
          { label: d.lotLabel, value: lot.lotNo, code: true },
        ]}
      />

      <p className="temporary__notice">
        <Icon name="info" size={20} />
        <span>
          <b>{t.banner.title}</b> <span>{l.notice}</span>
        </span>
      </p>

      <section className="temporary__section">
        <h2>{l.warehouseLegend}</h2>
        {warehouses.length === 0 ? <AlertBanner variant="warning" title={l.none} /> : null}
        {warehouses.length === 0 ? null : (
          <RadioGroup
            name="temporary-warehouse"
            aria-label={l.warehouseLegend}
            value={warehouseId === null ? '' : String(warehouseId)}
            onChange={(value) => {
              setWarehouseId(Number(value));
            }}
          >
            {warehouses.map((each) => (
              <Radio key={each.warehouseId} value={String(each.warehouseId)}>
                <span className="temporary__warehouse">
                  <span>{each.warehouseName}</span>
                  <span className="temporary__note">
                    {each.designatedCount > 0
                      ? l.designatedCount(String(each.designatedCount))
                      : l.noDesignated}
                  </span>
                </span>
              </Radio>
            ))}
          </RadioGroup>
        )}
        {lot.lotStatusCode === 'DEFECTIVE' ? (
          <p className="temporary__note">{l.defectOnly}</p>
        ) : null}
        {chosen === null ? null : (
          <p className="temporary__chosen">
            <Icon name="check_circle" size={20} />
            <span>{l.chosen(chosen.warehouseName, qty)}</span>
          </p>
        )}
        {saveFailed ? (
          <AlertBanner variant="error" title={t.saveFailed.title}>
            {t.saveFailed.description}
          </AlertBanner>
        ) : null}
      </section>

      <BottomActionBar
        primary={{
          label: t.submit,
          disabled: chosen === null || worker === null,
          lockReason: chosen === null ? l.locked : undefined,
          onClick: () => void submit(),
        }}
      />
    </div>
  );
};
