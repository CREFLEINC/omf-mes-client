import {
  AlertBanner,
  Button,
  Card,
  Chip,
  NumberPad,
  Radio,
  RadioGroup,
  Select,
  TextField,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

import { useAdvanceTo } from '../../patterns/advance-to';
import { useBackStep } from '../../patterns/back-step';
import { displayNameOf, useCodeValues } from '../../patterns/code-values';
import { playErrorTone } from '../../patterns/error-tone';
import { useLocation } from '../../patterns/locations';
import { useOutbox } from '../../patterns/outbox';
import { useScanField } from '../../patterns/use-scan-field';
import { useScreenTitle } from '../../patterns/screen-title';
import { useWorkerId } from '../../patterns/workers';
import { useWorkerSession } from '../../patterns/worker-session';
import { PickingOrderList } from './order-list';
import {
  ISSUE_TYPE,
  PICKING_TYPE,
  canConfirmIssue,
  canPick,
  defaultIssueTypeOf,
  isOpenOrder,
  isOutOfSequence,
  isOfOrder,
  issuedLinesOf,
  issuableQtyOf,
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
  type GoodsIssueLineUpsert,
  type PickingLine,
} from './picking';
import {
  MATERIAL_ISSUE_REQUEST,
  pickingKeys,
  useAssignedPickingOrders,
  useIssueRequest,
  usePickingOrder,
} from './queries';
import './screen.css';

const t = messages.materialPicking;
/* 필수 표시는 화면마다 짓지 않는다. 같은 뜻이 여러 모양으로 갈린다. */
const required = messages.common.required;

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
 * 같은 묶음의 다른 라인 피킹까지 함께 되돌아가는 것은 이 선택의 대가다. 아직 출고를 담지
 * 않았어도 그렇다 - 묶음은 소속만 말하고 앞을 따르는지는 가리지 않는다. 그 라인의 물건은
 * 이미 집혔지만 되돌아온 건에 남으므로 기록이 사라지지는 않는다.
 */
const batchIdOf = (pickingOrderId: number): string => `picking-order-${String(pickingOrderId)}`;

export const MaterialPickingScreen = () => {
  useScreenTitle(t.title);

  const { enqueue, flush, isRejected, loaded, pendingOf, rejected } = useOutbox();
  const { worker } = useWorkerSession();
  const queryClient = useQueryClient();

  const [orderId, setOrderId] = useState<number | null>(null);
  const [lineId, setLineId] = useState<number | null>(null);
  const [scanned, setScanned] = useState<string | null>(null);
  const [qty, setQty] = useState('');
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  /* 피킹 한 건의 결과. 거부를 조용히 넘기면 왜 안 집혔는지 알 수 없다. */
  const [pickOutcome, setPickOutcome] = useState<Outcome | null>(null);
  const [issueTypeCode, setIssueTypeCode] = useState<string | null>(null);
  /*
   * 보내는 동안 단추를 잠근다. 장갑 낀 손이 한 번 더 누르면 멱등키가 다른 두 건이 담기고,
   * 서버가 흡수할 수 없어 재고가 두 번 움직인다.
   */
  const [busy, setBusy] = useState(false);
  /* 담기가 실패하면 적은 것이 어디에도 없다. 조용히 넘기지 않는다. */
  const [saveFailed, setSaveFailed] = useState(false);
  const [pickSaveFailed, setPickSaveFailed] = useState(false);
  /*
   * 보내는 중인가. 상태로 두면 같은 틱에 두 번 누른 것을 막지 못한다 - 다시 그리기 전에
   * 두 번째가 들어와 멱등키가 다른 두 건이 담기고, 서버가 흡수하지 못해 재고가 두 번 움직인다.
   * 아래 busy 는 단추를 잠가 보이기 위한 것이고, 실제로 막는 것은 이 자리다.
   */
  const inFlight = useRef(false);
  /*
   * 이 단말이 이번에 담은 출고. 담는 순간 적고, 되돌아온 것만 빼고 센다.
   *
   * 보냈는지로 가르면 셸이 배경으로 보낸 것을 아무도 세지 않아, 큐가 비는 순간 담긴 출고를
   * 세는 방어와 함께 꺼진다 - 같은 수량이 한 번 더 나간다. 담긴 것도 나갈 것이므로 함께 세고,
   * 되돌아온 것만 되돌린다. 화면이 다시 서면 사라지는 반쪽 방어이며 나머지는 설계에 물었다.
   */
  const issuedHere = useRef<{ idempotencyKey: string; lines: GoodsIssueLineUpsert[] }[]>([]);

  const scanSection = useRef<HTMLElement | null>(null);
  const qtySection = useRef<HTMLElement | null>(null);

  const workerId = useWorkerId(worker?.workerNo ?? null);
  const orders = useAssignedPickingOrders(workerId.data ?? null);
  const detail = usePickingOrder(orderId);
  const issueTypes = useCodeValues(ISSUE_TYPE);
  const pickingTypes = useCodeValues(PICKING_TYPE);

  const order = detail.data?.order ?? null;
  const lines = detail.data?.lines ?? [];
  /*
   * 집은 것을 어디로 가져가는지는 원천 요청에만 있다. 출하 요청에서 나온 지시는 이 화면 몫이
   * 아니라 묻지 않는다.
   */
  const request = useIssueRequest(
    order !== null && order.sourceDocumentTypeCode === MATERIAL_ISSUE_REQUEST
      ? order.sourceDocumentId
      : null,
  );
  const destination = useLocation(request.data?.destinationLocationId ?? null);
  const line = lines.find((each) => each.pickingLineId === lineId) ?? null;
  /*
   * 담긴 피킹을 셈에 넣는다. 서버가 아는 것만 세면 오프라인에서 집은 흔적이 화면에 남지 않아
   * 같은 라인을 다시 집게 되고, 출고 확정도 영영 열리지 않는다.
   */
  const queued = queuedPicksOf(pendingOf(t.record.picked), orderId ?? -1);
  const queuedIssues = queuedIssueCountOf(pendingOf(t.record.issued), orderId ?? -1);
  const done = lines.filter((each) => lineProblemOf(each, queued) === 'done').length;
  /* 잠긴 라인 수. 셈의 분모에는 들어가지만 분자가 될 수 없어 따로 말해 준다. */
  const held = lines.filter((each) => lineProblemOf(each, queued) === 'held').length;
  /* 배경 보내기가 거부당하면 큐에서 빠진다. 화면이 읽지 않으면 사유가 어디에도 보이지 않는다. */
  const returned = rejected.filter((record) => isOfOrder(record.entry, orderId ?? -1));

  const alreadyIssued = new Map<number, number>();

  for (const record of issuedHere.current) {
    /* 되돌아온 것은 나간 적이 없다. 빼 두면 다시 내보낼 길이 사라진다. */
    if (rejected.some((each) => each.entry.idempotencyKey === record.idempotencyKey)) {
      continue;
    }

    for (const each of record.lines) {
      const lineId = each.pickingLineId;

      if (lineId !== null && lineId !== undefined) {
        alreadyIssued.set(lineId, (alreadyIssued.get(lineId) ?? 0) + each.issueQty);
      }
    }
  }

  /*
   * 셸이 스스로 큐를 비운다. 그때 다시 조회하지 않으면 담긴 것이 셈에서 빠진 자리에 서버가
   * 아직 모르는 값이 남아, 화면이 안 집은 것으로 되돌아간다 - 작업자는 같은 라인을 다시 집는다.
   */
  const queuedCount = queued.length + queuedIssues;
  const lastQueued = useRef({ orderId, count: queuedCount });

  /*
   * 생산에 넣을 자재를 내보내는 자리다. 매번 고르게 하면 손이 한 번 더 들고 엉뚱한 유형이
   * 섞인다. 고객이 그 값을 지웠으면 사람이 고른다.
   */
  const defaultIssueType = defaultIssueTypeOf(issueTypes.data ?? []);

  useEffect(() => {
    if (issueTypeCode === null && defaultIssueType !== null) {
      setIssueTypeCode(defaultIssueType);
    }
  }, [defaultIssueType, issueTypeCode]);

  useEffect(() => {
    const previous = lastQueued.current;

    lastQueued.current = { orderId, count: queuedCount };

    /* 지시를 갈아타며 줄어든 것은 이 지시가 보낸 것이 아니다. 같은 지시일 때만 본다. */
    if (previous.orderId === orderId && queuedCount < previous.count && orderId !== null) {
      void queryClient.invalidateQueries({ queryKey: pickingKeys.order(orderId) });
    }
  }, [orderId, queryClient, queuedCount]);

  const [scanSeq, setScanSeq] = useState(0);

  const scanField = useScanField({
    onScan: (value) => {
      setScanned(value.trim());
      /* 같은 라벨을 다시 스캔한 것도 한 회차다. 값만 보면 두 번째 스캔이 조용히 지나간다. */
      setScanSeq((seq) => seq + 1);
    },
  });

  /*
   * 스캔한 것이 이 라인의 LOT 이 아니라는 것을 소리로도 알린다(공유계약 D-2). 단말을 허리에
   * 매단 채 읽으므로 화면에만 적으면 사람은 통과한 줄 알고 다음 동작으로 넘어간다.
   */
  const scanMissed = scanned !== null && line !== null && !isScannedLotOf(line, scanned);

  useEffect(() => {
    if (scanMissed) {
      playErrorTone();
    }
  }, [scanMissed, scanSeq]);

  /* 세로 화면이라 채운 구획이 자리를 차지한 채 남으면 다음에 할 일이 접힌 자리에 있다. */
  useAdvanceTo(lineId !== null, scanSection);
  useAdvanceTo(scanned !== null, qtySection);

  /*
   * 뒤로가기는 화면 안 단계를 먼저 되돌린다. 라우터 이력에는 이 화면 하나뿐이라, 두지 않으면
   * 지시와 라인을 고르고 집던 사람이 한 번에 작업 목록까지 나간다.
   */
  useBackStep(orderId !== null && lineId !== null, () => {
    setLineId(null);
    setScanned(null);
    setQty('');
  });
  useBackStep(orderId !== null && lineId === null, () => {
    setOrderId(null);
  });

  const chooseLine = (next: PickingLine) => {
    setPickOutcome(null);
    setLineId(next.pickingLineId);
    setScanned(null);
    setQty('');
  };

  const restart = () => {
    setOrderId(null);
    setLineId(null);
    setScanned(null);
    setQty('');
    setOutcome(null);
    setPickOutcome(null);
    setIssueTypeCode(null);
    scanField.focus();
  };

  const pick = async () => {
    const order = detail.data?.order;

    if (order === undefined || line === null || worker === null || busy || inFlight.current) {
      return;
    }

    inFlight.current = true;
    setBusy(true);
    setPickSaveFailed(false);

    try {
      /* 이 지시의 피킹과 출고를 한 묶음으로 둔다. 앞이 거부되면 뒤가 함께 되돌아간다. */
      const draft = toPickDraft(
        order,
        line,
        qty,
        batchIdOf(order.pickingOrderId),
        new Date(),
        worker.workerNo,
      );

      /* 담기지 못하면 집은 것이 어디에도 없다. 말하지 않으면 사람은 집힌 줄 안다. */
      try {
        await enqueue(draft);
      } catch {
        setPickSaveFailed(true);
        return;
      }

      const result = await flush().catch(() => null);
      const mine = (each: { idempotencyKey: string }) =>
        each.idempotencyKey === draft.idempotencyKey;

      /* 서버가 집은 양을 더해 내려준다. 화면이 그 셈을 따로 하지 않는다. */
      await queryClient.invalidateQueries({ queryKey: pickingKeys.order(orderId) });

      if (
        (result !== null && result.rejected.some((each) => mine(each.entry))) ||
        isRejected(draft.idempotencyKey)
      ) {
        setPickOutcome('rejected');
        return;
      }

      setPickOutcome(result === null || result.remaining.some(mine) ? 'queued' : 'sent');
      setLineId(null);
      setScanned(null);
      setQty('');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const confirm = async () => {
    const order = detail.data?.order;

    if (
      order === undefined ||
      worker === null ||
      issueTypeCode === null ||
      busy ||
      inFlight.current
    ) {
      return;
    }

    inFlight.current = true;
    setBusy(true);
    setSaveFailed(false);

    try {
      const draft = toIssueDraft(
        order,
        lines,
        queued,
        issueTypeCode,
        batchIdOf(order.pickingOrderId),
        new Date(),
        worker.workerNo,
        alreadyIssued,
      );

      try {
        await enqueue(draft);
      } catch {
        setSaveFailed(true);
        return;
      }

      /*
       * 담긴 뒤에 적는다. 담기지 못한 것을 적으면 나가지도 않은 양이 셈에 들어가 확정이
       * 잠긴다. 담긴 것도 서버로 향하므로 보냈는지로는 가르지 않는다.
       */
      issuedHere.current = [
        ...issuedHere.current,
        { idempotencyKey: draft.idempotencyKey, lines: issuedLinesOf(draft) },
      ];

      const result = await flush().catch(() => null);
      const mine = (each: { idempotencyKey: string }) =>
        each.idempotencyKey === draft.idempotencyKey;

      if (
        (result !== null && result.rejected.some((each) => mine(each.entry))) ||
        isRejected(draft.idempotencyKey)
      ) {
        setOutcome('rejected');
        return;
      }

      setOutcome(result === null || result.remaining.some(mine) ? 'queued' : 'sent');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
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
          pickingTypes={pickingTypes.data ?? []}
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
            <p>
              {t.orders.type(
                displayNameOf(pickingTypes.data ?? [], detail.data?.order.pickingTypeCode ?? ''),
              )}
            </p>
            {/* 집은 것을 어디로 가져가는가. 말하지 않으면 그 자리가 사람의 기억에만 남는다. */}
            {destination.isPending && request.data !== undefined ? (
              <p role="status">{t.orders.destinationLoading}</p>
            ) : null}
            {request.isError || destination.isError ? (
              <p className="picking-out__note">{t.orders.destinationUnknown}</p>
            ) : null}
            {destination.data === undefined ? null : (
              <p>
                {t.orders.destination(
                  `${destination.data.locationCode} ${destination.data.locationName}`,
                )}
              </p>
            )}
          </Card.Body>
        </Card>
        {/* 진입 자리에서 말한다. 아래에서만 말하면 다 집어 놓고 마지막에 막힌 것을 안다. */}
        {order !== null && !isOpenOrder(order) ? (
          <AlertBanner variant="error" title={t.orders.closed} />
        ) : null}
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
        {/*
         * 보류 라인은 집을 수 없어 셈의 분자가 될 수 없다. 분모에만 넣어 두면 남은 수가 영영
         * 줄지 않아, 다 집고도 아직 할 일이 남은 것처럼 읽힌다. 몇이 잠겨 있는지 함께 적는다.
         */}
        <h2>
          {`${t.lines.legend} ${t.lines.progress(done, lines.length)}`}
          {held === 0 ? '' : ` · ${t.lines.heldCount(String(held))}`}
        </h2>
        {detail.isPending ? <p role="status">{t.lines.loading}</p> : null}
        {detail.isError ? <AlertBanner variant="error" title={t.lines.loadFailed} /> : null}
        {detail.data !== undefined && lines.length === 0 ? (
          <AlertBanner variant="warning" title={t.lines.none} />
        ) : null}

        {/*
         * 셋 중 하나를 고르는 일이다. 줄마다 단추를 세우면 무엇이 고르는 자리이고 무엇이
         * 골라진 것인지 생김새로 갈리지 않는다.
         */}
        <RadioGroup
          className="picking-out__lines"
          name="picking-line"
          aria-label={t.lines.legend}
          value={lineId === null ? undefined : String(lineId)}
          onChange={(value) => {
            const picked = lines.find((each) => String(each.pickingLineId) === value);

            if (picked !== undefined) {
              chooseLine(picked);
            }
          }}
        >
          {lines.map((each) => {
            const trouble = lineProblemOf(each, queued);
            const place = [
              each.locationCode === undefined ? '' : t.lines.at(each.locationCode),
              /* 유효기한이 없는 품목의 선출 근거는 제조일이다. 비워 두면 왜 이 줄이 먼저인지 알 수 없다. */
              each.expiryDate !== null && each.expiryDate !== undefined
                ? t.lines.expiry(each.expiryDate)
                : each.manufacturedAt === null || each.manufacturedAt === undefined
                  ? ''
                  : t.lines.manufactured(each.manufacturedAt.slice(0, 10)),
            ].filter((part) => part !== '');

            return (
              <Radio
                key={each.pickingLineId}
                value={String(each.pickingLineId)}
                /* 보류 라인은 비활성으로 두고 사유를 함께 보인다. 서버가 표시해 내려준 값이다. */
                disabled={trouble !== null}
                /*
                 * 이미 고른 줄을 다시 누르면 고른 값이 바뀌지 않아 change 가 나지 않는다.
                 * 되돌아온 뒤 같은 줄을 다시 집는 길이 그 누름이라 눌림으로도 잇는다.
                 */
                onClick={() => {
                  chooseLine(each);
                }}
              >
                <span className="picking-out__line">
                  <span className="picking-out__line-head">
                    <strong>{`${each.itemCode ?? ''} ${each.itemName ?? ''}`}</strong>
                    {each.pickSequenceRank === null ||
                    each.pickSequenceRank === undefined ? null : (
                      <span className="picking-out__line-rank">
                        {t.lines.rank(each.pickSequenceRank)}
                      </span>
                    )}
                  </span>
                  <span className="picking-out__line-qty">
                    {t.lines.planned(String(each.plannedQty), String(pickedQtyOf(each, queued)))}
                  </span>
                  {queuedQtyOf(each, queued) === 0 ? null : (
                    <span className="picking-out__line-note">
                      {t.lines.queued(String(queuedQtyOf(each, queued)))}
                    </span>
                  )}
                  {each.lotNo === null || each.lotNo === undefined ? null : (
                    <span className="picking-out__line-lot">{each.lotNo}</span>
                  )}
                  {place.length === 0 ? null : (
                    <span className="picking-out__line-note">{place.join(' · ')}</span>
                  )}
                  {trouble === 'held' ? (
                    <span className="picking-out__line-state">
                      {`${t.lines.held}${
                        each.holdReasonCode === null || each.holdReasonCode === undefined
                          ? ''
                          : ` · ${t.lines.heldReason(each.holdReasonCode)}`
                      }`}
                    </span>
                  ) : null}
                  {trouble === 'done' ? (
                    <span className="picking-out__line-state">{t.lines.done}</span>
                  ) : null}
                </span>
              </Radio>
            );
          })}
        </RadioGroup>
      </section>

      {line === null || problem !== null ? null : (
        <>
          <section className="picking-out__section" ref={scanSection}>
            <h2>{t.scan.legend}</h2>
            <TextField
              ref={scanField.ref}
              label={required(t.scan.label)}
              placeholder={t.scan.placeholder}
              size="xl"
              fullWidth
            />
            {/* 스캐너가 못 읽는 라벨이 있다. 스캔 칸 자체를 열어 손으로 넣는다(공유계약 D-3). */}
            <Button
              className="picking-out__wide"
              variant={scanField.manual ? 'outlined' : 'text'}
              size="xl"
              onClick={scanField.manual ? scanField.submitManual : scanField.openManual}
            >
              {scanField.manual ? t.scan.manualSubmit : t.scan.manualLabel}
            </Button>

            {scanned === null ? null : matched ? (
              <Chip status="success">{t.scan.matched}</Chip>
            ) : (
              <AlertBanner variant="error" title={t.scan.mismatch(line.lotNo ?? '')} />
            )}

            {isOutOfSequence(line, lines, queued) ? (
              <AlertBanner variant="warning" title={t.outOfSequence} />
            ) : null}
          </section>

          <section className="picking-out__section" ref={qtySection}>
            {/*
             * 장갑을 끼고 한 손으로 조작한다. 운영체제 키보드는 작은 키가 촘촘하고, 올라오면
             * 라인 목록과 확정 단추를 덮는다(설계 §7-1 · 공유계약 G-6).
             */}
            <TextField
              label={required(t.qty.label)}
              size="xl"
              fullWidth
              inputMode="none"
              value={qty}
              onChange={(event) => {
                setQty(event.target.value);
              }}
              error={qtyMessage()}
            />
            <NumberPad
              value={qty}
              onChange={setQty}
              max={remainingQtyOf(line, queued)}
              allowDecimal
            />
            {pickSaveFailed ? <AlertBanner variant="error" title={t.saveFailed} /> : null}
            <Button
              variant="filled"
              size="2xl"
              className="picking-out__wide"
              disabled={busy || !loaded || !canPick(line, scanned, qty, worker !== null, queued)}
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
        {/* 기본값이 잡히면 고를 일이 없다. 고객이 그 값을 지웠을 때만 고르게 연다. */}
        {issueTypes.data === undefined ||
        issueTypes.data.length === 0 ||
        defaultIssueType !== null ? null : (
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
        {defaultIssueType !== null ? null : <p className="picking-out__note">{t.issueTypeNote}</p>}
        {worker === null ? <p className="picking-out__note">{t.noWorker}</p> : null}
        {saveFailed ? <AlertBanner variant="error" title={t.saveFailed} /> : null}
        {queuedIssues === 0 ? null : <AlertBanner variant="warning" title={t.issueQueued} />}
        {alreadyIssued.size > 0 &&
        !lines.some((each) => issuableQtyOf(each, queued, alreadyIssued) > 0) ? (
          <AlertBanner variant="info" title={t.allIssued} />
        ) : null}
      </section>

      {/* 라인이 쌓이면 확정 단추가 접힌 자리로 밀린다(설계 §3 액션 72). */}
      <div className="action-bar">
        <Button
          variant="filled"
          size="2xl"
          className="picking-out__wide"
          disabled={
            busy ||
            !loaded ||
            !canConfirmIssue(order, lines, worker !== null, queued, queuedIssues, alreadyIssued) ||
            issueTypeCode === null
          }
          onClick={() => void confirm()}
        >
          {t.submit}
        </Button>
      </div>
    </div>
  );
};
