import { AlertBanner, Button, Card, Chip, Select, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

import { useCodeValues } from '../../patterns/code-values';
import { useOutbox } from '../../patterns/outbox';
import { useScanField } from '../../patterns/use-scan-field';
import { useScreenTitle } from '../../patterns/screen-title';
import { useWorkerId } from '../../patterns/workers';
import { useWorkerSession } from '../../patterns/worker-session';
import { PickingOrderList } from './order-list';
import {
  ISSUE_TYPE,
  canConfirmIssue,
  canPick,
  isOutOfSequence,
  isOfOrder,
  isScannedLotOf,
  lineProblemOf,
  pickedQtyOf,
  qtyProblemOf,
  queuedIssueCountOf,
  queuedPicksOf,
  queuedQtyOf,
  remainingQtyOf,
  toIssueDraft,
  toPickDraft,
  type PickingLine,
} from './picking';
import { pickingKeys, useAssignedPickingOrders, usePickingOrder } from './queries';
import './screen.css';

const t = messages.materialPicking;

type Outcome = 'queued' | 'sent' | 'rejected';

/**
 * 한 지시의 피킹과 출고를 한 묶음에 둔다.
 *
 * 출고 본문은 이 지시에 담긴 피킹 전부의 수량을 합쳐 싣는다. 그중 하나라도 서버가 거부하면
 * 출고가 싣고 있는 수량이 틀린 것이 되므로, 그 출고는 나가면 안 된다. 묶음이 그것을 건다.
 *
 * 이름을 화면 상태로 지으면 지시를 다시 열거나 화면이 다시 서는 순간 갈린다 - 앞서 담긴
 * 피킹과 뒤에 담긴 출고가 다른 묶음이 되어, 피킹이 거부돼도 출고가 그 수량을 싣고 그대로
 * 나간다. 즉시 전기라 되돌릴 수 없다. 그래서 지시 번호에서 짓는다.
 *
 * 같은 묶음의 다른 라인 피킹까지 함께 되돌아가는 것은 이 선택의 대가다. 그 라인의 물건은
 * 이미 집혔지만, 출고가 그 수량도 싣고 있어 함께 판정받는 것이 맞다 - 되돌아온 건에 남으므로
 * 기록이 사라지지는 않는다.
 */
const batchIdOf = (pickingOrderId: number): string => `picking-order-${String(pickingOrderId)}`;

export const MaterialPickingScreen = () => {
  useScreenTitle(t.title);

  const { enqueue, flush, loaded, pendingOf, rejected } = useOutbox();
  const { worker } = useWorkerSession();
  const queryClient = useQueryClient();

  const [orderId, setOrderId] = useState<number | null>(null);
  const [lineId, setLineId] = useState<number | null>(null);
  const [scanned, setScanned] = useState<string | null>(null);
  const [qty, setQty] = useState('');
  const [manual, setManual] = useState('');
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  /* 피킹 한 건의 결과. 거부를 조용히 넘기면 왜 안 집혔는지 알 수 없다. */
  const [pickOutcome, setPickOutcome] = useState<Outcome | null>(null);
  const [issueTypeCode, setIssueTypeCode] = useState<string | null>(null);

  const workerId = useWorkerId(worker?.workerNo ?? null);
  const orders = useAssignedPickingOrders(workerId.data ?? null);
  const detail = usePickingOrder(orderId);
  const issueTypes = useCodeValues(ISSUE_TYPE);

  const lines = detail.data?.lines ?? [];
  const line = lines.find((each) => each.pickingLineId === lineId) ?? null;
  /*
   * 담긴 피킹을 셈에 넣는다. 서버가 아는 것만 세면 오프라인에서 집은 흔적이 화면에 남지 않아
   * 같은 라인을 다시 집게 되고, 출고 확정도 영영 열리지 않는다.
   */
  const queued = queuedPicksOf(pendingOf(t.record.picked), orderId ?? -1);
  const queuedIssues = queuedIssueCountOf(pendingOf(t.record.issued), orderId ?? -1);
  const done = lines.filter((each) => lineProblemOf(each, queued) === 'done').length;
  /* 배경 보내기가 거부당하면 큐에서 빠진다. 화면이 읽지 않으면 사유가 어디에도 보이지 않는다. */
  const returned = rejected.filter((record) => isOfOrder(record.entry, orderId ?? -1));

  /*
   * 셸이 스스로 큐를 비운다. 그때 다시 조회하지 않으면 담긴 것이 셈에서 빠진 자리에 서버가
   * 아직 모르는 값이 남아, 화면이 안 집은 것으로 되돌아간다 - 작업자는 같은 라인을 다시 집는다.
   */
  const queuedCount = queued.length + queuedIssues;
  const lastQueued = useRef({ orderId, count: queuedCount });

  useEffect(() => {
    const previous = lastQueued.current;

    lastQueued.current = { orderId, count: queuedCount };

    /* 지시를 갈아타며 줄어든 것은 이 지시가 보낸 것이 아니다. 같은 지시일 때만 본다. */
    if (previous.orderId === orderId && queuedCount < previous.count && orderId !== null) {
      void queryClient.invalidateQueries({ queryKey: pickingKeys.order(orderId) });
    }
  }, [orderId, queryClient, queuedCount]);

  const scanField = useScanField({
    onScan: (value) => {
      setScanned(value.trim());
    },
  });

  const chooseLine = (next: PickingLine) => {
    setPickOutcome(null);
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
    setPickOutcome(null);
    setIssueTypeCode(null);
    scanField.focus();
  };

  const pick = async () => {
    const order = detail.data?.order;

    if (order === undefined || line === null || worker === null) {
      return;
    }

    /* 이 지시의 피킹과 출고를 한 묶음으로 둔다. 앞이 거부되면 뒤가 함께 되돌아간다. */
    const draft = toPickDraft(
      order,
      line,
      qty,
      batchIdOf(order.pickingOrderId),
      new Date(),
      worker.workerNo,
    );

    await enqueue(draft);

    const result = await flush().catch(() => null);
    const mine = (each: { idempotencyKey: string }) => each.idempotencyKey === draft.idempotencyKey;

    /* 서버가 집은 양을 더해 내려준다. 화면이 그 셈을 따로 하지 않는다. */
    await queryClient.invalidateQueries({ queryKey: pickingKeys.order(orderId) });

    if (result !== null && result.rejected.some((each) => mine(each.entry))) {
      setPickOutcome('rejected');
      return;
    }

    setPickOutcome(result === null || result.remaining.some(mine) ? 'queued' : 'sent');
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
      queued,
      issueTypeCode,
      batchIdOf(order.pickingOrderId),
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
        <PickingOrderList
          workerNo={worker?.workerNo ?? null}
          workerId={workerId}
          orders={orders}
          onChoose={setOrderId}
        />
      </div>
    );
  }

  const problem = line === null ? null : lineProblemOf(line, queued);
  const matched = line !== null && scanned !== null && isScannedLotOf(line, scanned);

  const qtyMessage = (): string | undefined => {
    if (line === null || qty.trim() === '') {
      return undefined;
    }

    const trouble = qtyProblemOf(qty, line, queued);

    if (trouble === null) {
      return undefined;
    }

    return trouble === 'overPlanned'
      ? t.qty.problem.overPlanned(String(remainingQtyOf(line, queued)))
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

      {pickOutcome === null ? null : (
        <AlertBanner
          variant={
            pickOutcome === 'sent' ? 'success' : pickOutcome === 'queued' ? 'warning' : 'error'
          }
          title={t.pickOutcome[pickOutcome].title}
        >
          {t.pickOutcome[pickOutcome].description}
        </AlertBanner>
      )}

      {returned.length === 0 ? null : (
        <AlertBanner variant="error" title={t.returned.title(String(returned.length))}>
          {t.returned.description}
          <Link to="/rejections">{t.rejected.action}</Link>
        </AlertBanner>
      )}

      <section className="picking-out__section">
        <h2>{`${t.lines.legend} ${t.lines.progress(done, lines.length)}`}</h2>
        {detail.isPending ? <p role="status">{t.lines.loading}</p> : null}
        {detail.isError ? <AlertBanner variant="error" title={t.lines.loadFailed} /> : null}
        {detail.data !== undefined && lines.length === 0 ? (
          <AlertBanner variant="warning" title={t.lines.none} />
        ) : null}

        {lines.map((each) => {
          const trouble = lineProblemOf(each, queued);

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
                <span>
                  {t.lines.planned(String(each.plannedQty), String(pickedQtyOf(each, queued)))}
                </span>
                {queuedQtyOf(each, queued) === 0 ? null : (
                  <span>{t.lines.queued(String(queuedQtyOf(each, queued)))}</span>
                )}
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

            {isOutOfSequence(line, lines, queued) ? (
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
              disabled={!loaded || !canPick(line, scanned, qty, worker !== null, queued)}
              onClick={() => void pick()}
            >
              {t.pick}
            </Button>
          </section>
        </>
      )}

      <section className="picking-out__section">
        <p className="picking-out__note">{t.partialNote}</p>
        {issueTypes.isError ? <AlertBanner variant="error" title={t.issueTypeLoadFailed} /> : null}
        {issueTypes.data !== undefined && issueTypes.data.length === 0 ? (
          <AlertBanner variant="warning" title={t.noIssueType} />
        ) : null}
        {issueTypes.data === undefined || issueTypes.data.length === 0 ? null : (
          <div className="picking-out__field">
            <label htmlFor="picking-issue-type">{t.issueTypeLabel}</label>
            <Select
              id="picking-issue-type"
              placeholder={t.issueTypePlaceholder}
              size="xl"
              value={issueTypeCode}
              onChange={(value) => {
                setIssueTypeCode(String(value));
              }}
              options={issueTypes.data.map((each) => ({ value: each.code, label: each.name }))}
            />
          </div>
        )}
        {/* 어느 값이 이 화면의 출고인지 계약이 아직 말하지 않아 사람이 고른다. */}
        <p className="picking-out__note">{t.issueTypeNote}</p>
        {worker === null ? <p className="picking-out__note">{t.noWorker}</p> : null}
        {queuedIssues === 0 ? null : <AlertBanner variant="warning" title={t.issueQueued} />}
        <Button
          variant="filled"
          size="2xl"
          className="picking-out__wide"
          disabled={
            !loaded ||
            !canConfirmIssue(lines, worker !== null, queued, queuedIssues) ||
            issueTypeCode === null
          }
          onClick={() => void confirm()}
        >
          {t.submit}
        </Button>
      </section>
    </div>
  );
};
