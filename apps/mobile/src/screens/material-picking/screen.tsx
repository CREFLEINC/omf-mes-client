import { AlertBanner, Button, Card, Chip, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';

import { useCodeValues } from '../../patterns/code-values';
import { createIdempotencyKey, useOutbox } from '../../patterns/outbox';
import { useScanField } from '../../patterns/use-scan-field';
import { useScreenTitle } from '../../patterns/screen-title';
import { useWorkerId } from '../../patterns/workers';
import { useWorkerSession } from '../../patterns/worker-session';
import {
  ISSUE_TYPE,
  canConfirmIssue,
  canPick,
  isOutOfSequence,
  isScannedLotOf,
  lineProblemOf,
  qtyProblemOf,
  remainingQtyOf,
  toIssueDraft,
  toPickDraft,
  type PickingLine,
} from './picking';
import { pickingKeys, useAssignedPickingOrders, usePickingOrder } from './queries';
import './screen.css';

const t = messages.materialPicking;

type Outcome = 'queued' | 'sent' | 'rejected';

export const MaterialPickingScreen = () => {
  useScreenTitle(t.title);

  const { enqueue, flush } = useOutbox();
  const { worker } = useWorkerSession();
  const queryClient = useQueryClient();

  const [orderId, setOrderId] = useState<number | null>(null);
  const [lineId, setLineId] = useState<number | null>(null);
  const [scanned, setScanned] = useState<string | null>(null);
  const [qty, setQty] = useState('');
  const [manual, setManual] = useState('');
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const workerId = useWorkerId(worker?.workerNo ?? null);
  const orders = useAssignedPickingOrders(workerId.data ?? null);
  const detail = usePickingOrder(orderId);
  const issueTypes = useCodeValues(ISSUE_TYPE);

  const lines = detail.data?.lines ?? [];
  const line = lines.find((each) => each.pickingLineId === lineId) ?? null;
  const done = lines.filter((each) => lineProblemOf(each) === 'done').length;
  const issueTypeCode = issueTypes.data?.[0]?.code ?? null;

  const scanField = useScanField({
    onScan: (value) => {
      setScanned(value.trim());
    },
  });

  const chooseLine = (next: PickingLine) => {
    setLineId(next.pickingLineId);
    setScanned(null);
    setQty('');
    setManual('');
  };

  const restart = () => {
    setOrderId(null);
    setLineId(null);
    setScanned(null);
    setQty('');
    setManual('');
    setOutcome(null);
    scanField.focus();
  };

  const pick = async () => {
    const order = detail.data?.order;

    if (order === undefined || line === null || worker === null) {
      return;
    }

    await enqueue(toPickDraft(order, line, qty, createIdempotencyKey(), new Date(), worker.workerNo));
    await flush().catch(() => null);

    /* 서버가 집은 양을 더해 내려준다. 화면이 그 셈을 따로 하지 않는다. */
    await queryClient.invalidateQueries({ queryKey: pickingKeys.order(orderId) });

    setLineId(null);
    setScanned(null);
    setQty('');
  };

  const confirm = async () => {
    const order = detail.data?.order;

    if (order === undefined || worker === null || issueTypeCode === null) {
      return;
    }

    const draft = toIssueDraft(
      order,
      lines,
      issueTypeCode,
      createIdempotencyKey(),
      new Date(),
      worker.workerNo,
    );

    await enqueue(draft);

    const result = await flush().catch(() => null);
    const mine = (each: { idempotencyKey: string }) => each.idempotencyKey === draft.idempotencyKey;

    if (result !== null && result.rejected.some((each) => mine(each.entry))) {
      setOutcome('rejected');
      return;
    }

    setOutcome(result === null || result.remaining.some(mine) ? 'queued' : 'sent');
  };

  if (outcome !== null) {
    return (
      <div className="picking-out">
        {outcome === 'sent' ? <AlertBanner variant="success" title={t.sent.title} /> : null}
        {outcome === 'queued' ? (
          <AlertBanner variant="warning" title={t.queued.title}>
            {t.queued.description}
          </AlertBanner>
        ) : null}
        {outcome === 'rejected' ? (
          <AlertBanner variant="error" title={t.rejected.title}>
            {t.rejected.description}
            <Link to="/rejections">{t.rejected.action}</Link>
          </AlertBanner>
        ) : null}
        <Button variant="filled" size="2xl" className="picking-out__wide" onClick={restart}>
          {t.another}
        </Button>
      </div>
    );
  }

  if (orderId === null) {
    return (
      <div className="picking-out">
        <section className="picking-out__section">
          <h2>{t.orders.legend}</h2>
          {workerId.isPending && worker !== null ? <p role="status">{t.worker.loading}</p> : null}
          {workerId.isError ? <AlertBanner variant="error" title={t.worker.loadFailed} /> : null}
          {worker !== null && workerId.data === null ? (
            <AlertBanner variant="warning" title={t.worker.notFound(worker.workerNo)} />
          ) : null}
          {orders.isPending && workerId.data !== null ? (
            <p role="status">{t.orders.loading}</p>
          ) : null}
          {orders.isError ? <AlertBanner variant="error" title={t.orders.loadFailed} /> : null}
          {orders.data !== undefined && orders.data.length === 0 ? (
            <AlertBanner variant="info" title={t.orders.none} />
          ) : null}
          {(orders.data ?? []).map((order) => (
            <Button
              key={order.pickingOrderId}
              variant="outlined"
              size="xl"
              className="picking-out__wide"
              onClick={() => {
                setOrderId(order.pickingOrderId);
              }}
            >
              {`${order.pickingOrderNo} · ${t.orders.type(order.pickingTypeCode)}`}
            </Button>
          ))}
        </section>
      </div>
    );
  }

  const problem = line === null ? null : lineProblemOf(line);
  const matched = line !== null && scanned !== null && isScannedLotOf(line, scanned);

  const qtyMessage = (): string | undefined => {
    if (line === null || qty.trim() === '') {
      return undefined;
    }

    const trouble = qtyProblemOf(qty, line);

    if (trouble === null) {
      return undefined;
    }

    return trouble === 'overPlanned'
      ? t.qty.problem.overPlanned(String(remainingQtyOf(line)))
      : t.qty.problem[trouble];
  };

  return (
    <div className="picking-out">
      <section className="picking-out__section">
        <h2>{t.orders.legend}</h2>
        <Card bordered>
          <Card.Header>{detail.data?.order.pickingOrderNo ?? ''}</Card.Header>
          <Card.Body className="card-body">
            <p>{t.orders.type(detail.data?.order.pickingTypeCode ?? '')}</p>
          </Card.Body>
        </Card>
        <Button
          variant="text"
          size="xl"
          onClick={() => {
            setOrderId(null);
            setLineId(null);
          }}
        >
          {t.orders.change}
        </Button>
      </section>

      <section className="picking-out__section">
        <h2>{`${t.lines.legend} ${t.lines.progress(done, lines.length)}`}</h2>
        {detail.isPending ? <p role="status">{t.lines.loading}</p> : null}
        {detail.isError ? <AlertBanner variant="error" title={t.lines.loadFailed} /> : null}
        {detail.data !== undefined && lines.length === 0 ? (
          <AlertBanner variant="warning" title={t.lines.none} />
        ) : null}

        {lines.map((each) => {
          const trouble = lineProblemOf(each);

          return (
            <Button
              key={each.pickingLineId}
              variant={each.pickingLineId === lineId ? 'filled' : 'outlined'}
              size="xl"
              className="picking-out__wide"
              /* 보류 라인은 비활성으로 두고 사유를 함께 보인다. 서버가 표시해 내려준 값이다. */
              disabled={trouble !== null}
              onClick={() => {
                chooseLine(each);
              }}
            >
              <span className="picking-out__line">
                <span>{`${each.itemCode ?? ''} ${each.itemName ?? ''}`}</span>
                <span>{t.lines.planned(String(each.plannedQty), String(each.pickedQty))}</span>
                <span>
                  {[
                    each.lotNo ?? '',
                    each.locationCode === undefined ? '' : t.lines.at(each.locationCode),
                    each.pickSequenceRank === null || each.pickSequenceRank === undefined
                      ? ''
                      : t.lines.rank(each.pickSequenceRank),
                  ]
                    .filter((part) => part !== '')
                    .join(' · ')}
                </span>
                {each.expiryDate === null || each.expiryDate === undefined ? null : (
                  <span>{t.lines.expiry(each.expiryDate)}</span>
                )}
                {trouble === 'held' ? (
                  <span>
                    {`${t.lines.held}${
                      each.holdReasonCode === null || each.holdReasonCode === undefined
                        ? ''
                        : ` · ${t.lines.heldReason(each.holdReasonCode)}`
                    }`}
                  </span>
                ) : null}
                {trouble === 'done' ? <span>{t.lines.done}</span> : null}
              </span>
            </Button>
          );
        })}
      </section>

      {line === null || problem !== null ? null : (
        <>
          <section className="picking-out__section">
            <h2>{t.scan.legend}</h2>
            <TextField
              ref={scanField.ref}
              label={t.scan.label}
              placeholder={t.scan.placeholder}
              size="xl"
              fullWidth
            />
            {/* 스캔 칸은 스캐너 전용이다. 스캔이 실패했을 때 손으로 넣을 길을 함께 둔다. */}
            <div className="picking-out__row">
              <TextField
                label={t.scan.manualLabel}
                size="xl"
                fullWidth
                value={manual}
                onChange={(event) => {
                  setManual(event.target.value);
                }}
              />
              <Button
                variant="outlined"
                size="xl"
                onClick={() => {
                  setScanned(manual.trim());
                  setManual('');
                }}
              >
                {t.scan.manualSubmit}
              </Button>
            </div>

            {scanned === null ? null : matched ? (
              <Chip status="success">{t.scan.matched}</Chip>
            ) : (
              <AlertBanner variant="error" title={t.scan.mismatch(line.lotNo ?? '')} />
            )}

            {isOutOfSequence(line, lines) ? (
              <AlertBanner variant="warning" title={t.outOfSequence} />
            ) : null}
          </section>

          <section className="picking-out__section">
            <TextField
              label={t.qty.label}
              size="xl"
              fullWidth
              inputMode="numeric"
              value={qty}
              onChange={(event) => {
                setQty(event.target.value);
              }}
              error={qtyMessage()}
            />
            <Button
              variant="filled"
              size="2xl"
              className="picking-out__wide"
              disabled={!canPick(line, scanned, qty, worker !== null)}
              onClick={() => void pick()}
            >
              {t.pick}
            </Button>
          </section>
        </>
      )}

      <section className="picking-out__section">
        <p className="picking-out__note">{t.partialNote}</p>
        {issueTypes.isError ? (
          <AlertBanner variant="error" title={t.issueTypeLoadFailed} />
        ) : null}
        {issueTypes.data !== undefined && issueTypeCode === null ? (
          <AlertBanner variant="warning" title={t.noIssueType} />
        ) : null}
        {issueTypeCode === null ? null : (
          <p className="picking-out__note">{t.placeholderNote(issueTypeCode)}</p>
        )}
        {worker === null ? <p className="picking-out__note">{t.noWorker}</p> : null}
        <Button
          variant="filled"
          size="2xl"
          className="picking-out__wide"
          disabled={!canConfirmIssue(lines, worker !== null) || issueTypeCode === null}
          onClick={() => void confirm()}
        >
          {t.submit}
        </Button>
      </section>
    </div>
  );
};
