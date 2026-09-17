import { AlertBanner, Button, Card, Select, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

import { useBackStep } from '../../patterns/back-step';
import { DockedNumberPad } from '../../patterns/docked-number-pad';
import { useCodeValues } from '../../patterns/code-values';
import { useLotNos } from '../../patterns/handling-units';
import { playErrorTone } from '../../patterns/error-tone';
import { useEquipments } from '../../patterns/equipments';
import { useLocation } from '../../patterns/locations';
import { useItemCodes } from '../../patterns/masters';
import { referenceLabel } from '../../patterns/reference';
import { useOnlineStatus } from '../../patterns/online-status';
import { useOutbox } from '../../patterns/outbox';
import { ScanReplaceDialog } from '../../patterns/scan-replace-dialog';
import { useScanField } from '../../patterns/use-scan-field';
import { useScreenTitle } from '../../patterns/screen-title';
import { useWorkerSession } from '../../patterns/worker-session';
import { FailureBanner } from '../../patterns/failure-banner';
import { useLoadFailure, useQueryErrorOf } from '../../patterns/load-failure';
import {
  hopperStockKey,
  useAlreadyReceived,
  useHopperStock,
  useScannedGoodsIssue,
} from './queries';
import {
  INVENTORY_ADJUSTMENT_REASON,
  canRecordHopper,
  hasHopper,
  hopperKeyOf,
  isReasonMissing,
  hopperLocationOf,
  adjustmentQtyOf,
  isMeasured,
  measureProblemOf,
  toHopperDraft,
} from './hopper';
import {
  RECEIPT_LABEL,
  canConfirm,
  isShort,
  needsReason,
  qtyProblemOf,
  queuedReceiptsFor,
  toReceiptDraft,
  varianceOf,
  type DraftLine,
} from './receipt';
import './screen.css';

const t = messages.shopfloorReceipt;
/* 필수 표시는 화면마다 짓지 않는다. 같은 뜻이 여러 모양으로 갈린다. */
const required = messages.common.required;

type Outcome = 'held' | 'sent' | 'rejected';

/** 차이 사유의 값 목록. 식별자는 환경마다 달라 코드 그룹 이름으로 받는다. */
const VARIANCE_REASON = 'VARIANCE_REASON';

/* 숫자판이 옮겨 갈 칸을 찾는 이름. 담는 쪽과 찾는 쪽이 이 함수들을 함께 쓴다. */
const receivedFieldId = (goodsIssueLineId: number): string =>
  `shopfloor-received-${goodsIssueLineId}`;

const measuredFieldId = (key: string): string => `shopfloor-measured-${key}`;

export const ShopfloorReceiptScreen = () => {
  useScreenTitle(t.title);
  const failureText = useLoadFailure();
  /* 확인하지 못한 까닭. 판정 훅은 까닭을 싣지 않아 캐시에서 읽는다. */
  const receivedError = useQueryErrorOf('shopfloor-receipt-existing');

  const { enqueue, flush, isRejected, loaded, pendingOf } = useOutbox();
  const { worker } = useWorkerSession();
  const queryClient = useQueryClient();

  const [scanned, setScanned] = useState<string | null>(null);
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  /*
   * 보내는 중인가. 상태로 두면 같은 틱에 두 번 누른 것을 막지 못한다 - 다시 그리기 전에
   * 두 번째가 들어와 같은 출고 전표의 수령이 두 건 담긴다.
   */
  const inFlight = useRef(false);

  const found = useScannedGoodsIssue(scanned);
  const issue = found.data ?? null;
  const received = useAlreadyReceived(issue?.issue.goodsIssueId ?? null);

  const lotNo = useLotNos((issue?.lines ?? []).map((line) => line.lotId));
  const reasons = useCodeValues(VARIANCE_REASON);
  /*
   * 사유는 고객이 늘리는 값이라 현장에서 비어 올 수 있다. 고를 것이 없는데 사유를 요구하면
   * 부족 수령을 영영 확정하지 못한다 - 물건은 이미 와 있다.
   *
   * 다만 아직 묻는 중인 것을 없는 것으로 세지 않는다. 목록이 오기 전에 요구를 걷으면 그 짧은
   * 창에 사유 없이 확정되고, 왜 모자랐는지가 그대로 사라진다.
   */
  const hasReasonOptions = reasons.isPending || (reasons.data ?? []).length > 0;

  /*
   * 큐에 담긴 것은 서버 응답에 없다. 읽기 전에는 담긴 것이 없는 것과 구별되지 않아 그 사이에
   * 다시 받게 되므로, 읽기 전에는 받은 것으로 세어 막아 둔다.
   */
  const queuedReceipts =
    issue === null
      ? 0
      : loaded
        ? queuedReceiptsFor(pendingOf(RECEIPT_LABEL), issue.issue.goodsIssueId)
        : 1;

  const ready =
    canConfirm(
      issue?.issue ?? null,
      lines,
      worker !== null,
      received === 'received' || received === 'checking',
      queuedReceipts,
      hasReasonOptions,
    ) &&
    issue !== null &&
    /* 작업지시와 도착 위치를 못 찾은 전표는 수령 전표를 만들 수 없다. 단추를 열지 않는다. */
    issue.workOrderId !== null &&
    issue.destinationLocationId !== null;

  /* 전표를 열면 그 라인으로 적을 자리를 만든다. 조회가 끝난 뒤라 렌더 중에 하지 않는다. */
  useEffect(() => {
    if (issue === null) {
      return;
    }

    setLines(
      issue.lines.map((line) => ({
        goodsIssueLineId: line.goodsIssueLineId,
        itemId: line.itemId,
        lotId: line.lotId,
        issuedQty: line.issueQty,
        uomId: line.uomId,
        receivedQty: '',
        reasonCode: '',
      })),
    );
  }, [issue]);

  /*
   * 호퍼 잔량은 수령과 독립된 쓰기다. 한 단추로 묶으면 하나가 거부될 때 다른 하나까지 함께
   * 되돌려야 하는데, 둘은 서로를 필요로 하지 않는다.
   */
  const [equipmentId, setEquipmentId] = useState<number | null>(null);
  const [measured, setMeasured] = useState<Record<string, string>>({});
  const [hopperOutcome, setHopperOutcome] = useState<Outcome | null>(null);
  const [hopperSaveFailed, setHopperSaveFailed] = useState(false);
  const hopperInFlight = useRef(false);

  const equipments = useEquipments();
  /*
   * 호퍼가 지정되지 않은 설비는 고를 것에서 뺀다. 목록에 세워 두면 골라 본 뒤에야 잴 자리가
   * 없다는 것을 알게 되고, 작업자는 자기가 잘못 골랐는지 설비가 잘못 등록됐는지 가리지 못한다.
   */
  const hopperEquipments = (equipments.data ?? []).filter(hasHopper);
  const equipment = hopperEquipments.find((each) => each.equipmentId === equipmentId) ?? null;
  const hopperLocationId = hopperLocationOf(equipment);
  const hopper = useLocation(hopperLocationId);
  const hopperStock = useHopperStock(hopperLocationId);

  /* 호퍼 잔량의 품목도 함께 묻는다 - 전표에 없는 품목이 섞여 있어 그 줄만 대리키로 남는다. */
  const itemCode = useItemCodes([
    ...(issue?.lines ?? []).map((line) => line.itemId),
    ...(hopperStock.data ?? []).map((stock) => stock.itemId),
  ]);
  const stocks = hopperStock.data ?? [];
  /*
   * 사유는 고객이 늘리는 값이라 화면이 박지 않는다. 서버가 모른다고 답하면 막는다 - 지어낸
   * 값을 실으면 누른 뒤에야 실패를 안다.
   */
  const adjustmentReasons = useCodeValues(INVENTORY_ADJUSTMENT_REASON);
  const reasonMissing = isReasonMissing(adjustmentReasons.isSuccess, adjustmentReasons.data ?? []);

  const recordHopper = async () => {
    if (hopperLocationId === null || worker === null || hopperInFlight.current) {
      return;
    }

    hopperInFlight.current = true;
    setHopperSaveFailed(false);

    const entry = toHopperDraft(hopperLocationId, stocks, measured, new Date(), worker.workerNo);

    try {
      /* 담기지 못하면 잰 값이 어디에도 없다. 말하지 않으면 사람은 기록된 줄 안다. */
      try {
        await enqueue(entry);
      } catch {
        setHopperSaveFailed(true);
        return;
      }

      const result = await flush().catch(() => null);
      const mine = (each: { idempotencyKey: string }) =>
        each.idempotencyKey === entry.idempotencyKey;

      const hopperResult: Outcome =
        (result !== null && result.rejected.some((each) => mine(each.entry))) ||
        isRejected(entry.idempotencyKey)
          ? 'rejected'
          : result === null || result.remaining.some(mine)
            ? 'held'
            : 'sent';

      setHopperOutcome(hopperResult);
      /* 다시 받기를 기다리는 사이에 칸이 차 있으면 단추가 열린 채로 눌러도 아무 일이 없다. */
      setMeasured({});

      /*
       * 서버에 닿았으면 장부가 그만큼 움직였다. 앞 값을 들고 있으면 곧바로 다시 잰 사람이
       * 이미 반영된 차이를 또 보낸다 - 100 을 99 로 고친 뒤 다시 99 를 적으면 98 이 된다.
       *
       * 대기로 남은 것은 아직 서버에 가지 않아 장부가 그대로다.
       */
      if (hopperResult === 'sent') {
        await queryClient.invalidateQueries({ queryKey: hopperStockKey(hopperLocationId) });
      }
    } finally {
      hopperInFlight.current = false;
    }
  };

  const online = useOnlineStatus();
  const destination = useLocation(issue?.destinationLocationId ?? null);

  const [scanSeq, setScanSeq] = useState(0);
  /* 라인이 여럿이라 어느 칸에 들어가는지 보이지 않으면 엉뚱한 줄에 수량이 적힌다(공유계약 D-4). */
  const [keypadFor, setKeypadFor] = useState<number | null>(null);
  /*
   * 호퍼는 품목과 LOT 으로 세고 수령은 라인 번호로 센다. 한 자리에 담으면 두 값이 겹칠 때
   * 엉뚱한 구획의 칸에 숫자판이 열린다.
   */
  const [hopperKeypadFor, setHopperKeypadFor] = useState<string | null>(null);

  const scanField = useScanField({
    applied: scanned,
    onScan: (value) => {
      setScanned(value.trim());
      /* 같은 라벨을 다시 스캔한 것도 한 회차다. 값만 보면 두 번째 스캔이 조용히 지나간다. */
      setScanSeq((seq) => seq + 1);

      /*
       * 전표가 바뀌면 호퍼 쪽도 비운다. 수령 수량은 전표가 바뀌면 다시 만들어지는데 여기만
       * 남아, 앞 전표를 보며 고른 설비와 잰 값이 다른 전표의 작업으로 이어진다.
       */
      setEquipmentId(null);
      setMeasured({});
      setHopperOutcome(null);
      setHopperSaveFailed(false);
      setSaveFailed(false);
    },
  });

  /*
   * 스캔한 전표를 찾지 못했다는 것을 소리로도 알린다(공유계약 D-2). 기기를 허리에 매단 채
   * 읽으므로 화면에만 적으면 사람은 통과한 줄 알고 다음 동작으로 넘어간다.
   */
  const scanMissed = scanned !== null && found.isSuccess && found.data === null;

  useEffect(() => {
    if (scanMissed) {
      playErrorTone();
    }
  }, [scanMissed, scanSeq]);

  /*
   * 뒤로가기는 고른 전표를 먼저 놓는다. 두지 않으면 수량을 적던 사람이 한 번에 작업 목록까지
   * 나가 전표를 다시 스캔해야 한다.
   */
  useBackStep(issue !== null, () => {
    setScanned(null);
    setLines([]);
    setKeypadFor(null);
    setHopperKeypadFor(null);
  });

  /* 라벨에는 품목 코드와 LOT 번호가 찍혀 있다. 대리키를 보이면 실물과 대조할 수 없다. */
  const itemCodeOf = (line: DraftLine): string => referenceLabel(itemCode(line.itemId));
  const lotNoOf = (line: DraftLine): string => referenceLabel(lotNo(line.lotId));

  /** 읽어 주는 이름. 줄이 여럿이라 이름만으로 어느 줄인지 갈려야 한다. */
  const nameOf = (line: DraftLine): string => t.lines.name(itemCodeOf(line), lotNoOf(line));

  /*
   * 숫자판이 지금 적는 자리. 투입 라인과 호퍼는 다른 일이라 서로 넘어가지 않는다 - 한쪽을
   * 열면 다른 쪽은 닫힌다.
   */
  const lineAt = lines.findIndex((line) => line.goodsIssueLineId === keypadFor);
  const linePad = lineAt === -1 ? null : { at: lineAt, line: lines[lineAt] as DraftLine };
  const hopperAt = stocks.findIndex((stock) => hopperKeyOf(stock) === hopperKeypadFor);
  const hopperStockAt = stocks[hopperAt];
  const hopperPad =
    hopperAt === -1 || hopperStockAt === undefined ? null : { at: hopperAt, stock: hopperStockAt };

  const restart = () => {
    setScanned(null);
    setLines([]);
    /* 라인 번호로 기억하므로, 두고 가면 다른 전표의 같은 번호 줄에 붙은 채로 열린다. */
    setKeypadFor(null);
    setOutcome(null);
    setSaveFailed(false);
    scanField.focus();
  };

  const submit = async () => {
    if (issue === null || worker === null || inFlight.current) {
      return;
    }

    /* 두 값이 없으면 수령 전표를 만들 수 없다. 지어내면 다른 작업지시에 재고가 붙는다. */
    if (issue.workOrderId === null || issue.destinationLocationId === null) {
      return;
    }

    inFlight.current = true;
    setSaveFailed(false);

    try {
      const draft = toReceiptDraft(
        issue.issue,
        issue.workOrderId,
        issue.destinationLocationId,
        lines,
        new Date(),
        worker.workerNo,
      );

      /* 담기지 못하면 적은 것이 어디에도 없다. 말하지 않으면 사람은 입고된 줄 안다. */
      try {
        await enqueue(draft);
      } catch {
        setSaveFailed(true);
        return;
      }

      const result = await flush().catch(() => null);

      /*
       * 자기가 부른 보내기의 결과만 보면 셸이 도는 다른 회차에서 되돌려진 건을 놓친다 - 화면은
       * 빈 결과를 받아 담아 두었다고 잘못 말한다.
       */
      const mine = (each: { idempotencyKey: string }) =>
        each.idempotencyKey === draft.idempotencyKey;

      if (
        (result !== null && result.rejected.some((each) => mine(each.entry))) ||
        isRejected(draft.idempotencyKey)
      ) {
        setOutcome('rejected');
        return;
      }

      setOutcome(result === null || result.remaining.some(mine) ? 'held' : 'sent');
    } finally {
      inFlight.current = false;
    }
  };

  if (outcome !== null) {
    return (
      <div className="shopfloor-receipt">
        {outcome === 'sent' ? <AlertBanner variant="success" title={t.sent.title} /> : null}
        {outcome === 'held' ? (
          <AlertBanner variant="warning" title={t.held.title}>
            {t.held.description}
          </AlertBanner>
        ) : null}
        {outcome === 'rejected' ? (
          <AlertBanner variant="error" title={t.rejected.title}>
            {t.rejected.description}
            <Link to="/rejections">{t.rejected.action}</Link>
          </AlertBanner>
        ) : null}
        <Button variant="filled" size="2xl" className="shopfloor-receipt__wide" onClick={restart}>
          {t.another}
        </Button>
      </div>
    );
  }

  return (
    <div
      className={
        linePad === null && hopperPad === null
          ? 'shopfloor-receipt'
          : 'shopfloor-receipt docked-pad-open'
      }
    >
      {/* 통신이 끊기면 출고분도 이 기기에서 처리한다. 말하지 않으면 다른 기기를 기다린다. */}
      {online ? null : (
        <AlertBanner variant="warning" title={t.degraded.title}>
          {t.degraded.description}
        </AlertBanner>
      )}

      <section className="shopfloor-receipt__section">
        <h2>{t.issue.legend}</h2>
        <TextField
          ref={scanField.ref}
          label={required(t.issue.scanLabel)}
          placeholder={t.issue.scanPlaceholder}
          size="xl"
          fullWidth
        />
        {/* 스캐너가 못 읽는 라벨이 있다. 스캔 칸 자체를 열어 손으로 넣는다(공유계약 D-3). */}
        <Button
          className="shopfloor-receipt__wide"
          variant={scanField.manual ? 'outlined' : 'text'}
          size="xl"
          onClick={scanField.manual ? scanField.submitManual : scanField.openManual}
        >
          {scanField.manual ? t.issue.manualSubmit : t.issue.manualLabel}
        </Button>

        {scanned !== null && found.isPending ? <p role="status">{t.issue.loading}</p> : null}
        {found.isError ? (
          <FailureBanner variant="error" title={failureText(found.error, t.issue.loadFailed)} />
        ) : null}
        {scanned !== null && found.data === null ? (
          <AlertBanner variant="error" title={t.issue.notFound(scanned)} />
        ) : null}
        {/* 무엇이 없어서 받을 수 없는지 그 자리에서 말한다. 단말 설정과는 무관한 일이다. */}
        {issue !== null && issue.workOrderId === null ? (
          <AlertBanner variant="error" title={t.issue.notForShopfloor}>
            {t.issue.notForShopfloorWhy}
          </AlertBanner>
        ) : null}

        {issue === null ? null : (
          <Card bordered>
            <Card.Header>
              {t.issue.summary(issue.issue.goodsIssueNo, issue.lines.length)}
            </Card.Header>
            <Card.Body className="card-body">
              {/* 어디로 들어온 것인가. 없으면 받은 자리가 전표에만 남는다. */}
              {destination.data === undefined ? null : (
                <p>{t.issue.destination(destination.data.locationCode)}</p>
              )}
              {destination.isError ? (
                <p className="shopfloor-receipt__note">
                  {failureText(destination.error, t.issue.destinationOffline, {
                    other: t.issue.destinationUnknown,
                  })}
                </p>
              ) : null}
              {issue.lines.length === 0 ? <p>{t.issue.empty}</p> : null}
            </Card.Body>
          </Card>
        )}

        {/* 진입 자리에서 말한다. 아래에서만 말하면 수량을 다 적고 마지막에 막힌 것을 안다. */}
        {received === 'received' ? (
          <AlertBanner variant="error" title={t.already.title}>
            {t.already.description}
          </AlertBanner>
        ) : null}
        {received !== 'received' && issue !== null && queuedReceipts > 0 && loaded ? (
          <AlertBanner variant="warning" title={t.queued.title}>
            {t.queued.description}
          </AlertBanner>
        ) : null}
        {/*
          막지 않는다 - 오프라인 입고 자체가 이 화면이 하는 일이다. 다만 확인하지 못했다는 것을
          말하지 않으면 작업자는 확인된 줄 알고 이미 받은 전표를 또 받는다.
        */}
        {received === 'unknown' && issue !== null ? (
          <AlertBanner variant="warning" title={t.unverified.title}>
            {failureText(receivedError, t.unverified.description, {
              caution: t.unverified.caution,
            })}
          </AlertBanner>
        ) : null}
      </section>

      {issue === null || received === 'received' ? null : (
        <>
          <section className="shopfloor-receipt__section">
            <h2>{t.lines.legend}</h2>
            {lines.map((line, index) => {
              const problem = qtyProblemOf(line);
              const short = varianceOf(line);
              const unit = String(line.issuedQty);

              return (
                <div key={line.goodsIssueLineId} className="shopfloor-receipt__line">
                  {/* 무엇을 받는 줄인지 먼저 세운다. 호퍼 잔량 줄과 같은 차례로 읽힌다. */}
                  <div className="shopfloor-receipt__stock-head">
                    <p className="shopfloor-receipt__stock-item">
                      <span className="shopfloor-receipt__stock-name">{t.itemLabel}</span>{' '}
                      <strong>{itemCodeOf(line)}</strong>
                    </p>
                    <p className="shopfloor-receipt__stock-lot">
                      <span className="shopfloor-receipt__stock-name">{t.lotLabel}</span>{' '}
                      {lotNoOf(line)}
                    </p>
                  </div>
                  {/* 견줄 값을 적는 칸보다 먼저 세운다. 모자란 것은 그 옆에 붙어 함께 읽힌다. */}
                  <div className="shopfloor-receipt__stock-figures">
                    <span className="shopfloor-receipt__issued">{t.lines.issued(unit)}</span>
                    {/* 모자란 사실은 고를 사유가 있든 없든 보인다. 숨기면 그냥 덜 받은 것이 된다. */}
                    {isShort(line) ? (
                      <span className="shopfloor-receipt__short">
                        {t.lines.short(String(short))}
                      </span>
                    ) : null}
                  </div>
                  <TextField
                    id={receivedFieldId(line.goodsIssueLineId)}
                    label={t.lines.received}
                    aria-label={t.lines.receivedLabel(nameOf(line))}
                    size="xl"
                    fullWidth
                    /*
                     * 장갑을 끼고 한 손으로 조작한다. 단말 키보드는 키가 촘촘하고, 올라오면
                     * 라인 목록과 확정 단추를 덮는다(설계 §7 · 공유계약 G-6).
                     */
                    inputMode="none"
                    value={line.receivedQty}
                    onChange={(event) => {
                      const next = event.target.value;
                      setLines((current) =>
                        current.map((each, at) =>
                          at === index ? { ...each, receivedQty: next } : each,
                        ),
                      );
                    }}
                    onFocus={() => {
                      setKeypadFor(line.goodsIssueLineId);
                      setHopperKeypadFor(null);
                    }}
                    error={
                      problem === null
                        ? undefined
                        : problem === 'overIssued'
                          ? t.lines.problem.overIssued(unit)
                          : t.lines.problem[problem]
                    }
                  />

                  {isShort(line) && hasReasonOptions ? (
                    <>
                      <label htmlFor={`reason-${String(line.goodsIssueLineId)}`}>
                        {t.lines.reason}
                      </label>
                      <Select
                        id={`reason-${String(line.goodsIssueLineId)}`}
                        aria-label={t.lines.reasonLabel(nameOf(line))}
                        placeholder={t.lines.reasonPlaceholder}
                        size="xl"
                        value={line.reasonCode === '' ? null : line.reasonCode}
                        onChange={(value) => {
                          const next = String(value);
                          setLines((current) =>
                            current.map((each, at) =>
                              at === index ? { ...each, reasonCode: next } : each,
                            ),
                          );
                        }}
                        options={(reasons.data ?? []).map((each) => ({
                          value: each.code,
                          label: each.name,
                        }))}
                      />
                    </>
                  ) : null}
                </div>
              );
            })}
          </section>

          <section className="shopfloor-receipt__section">
            {saveFailed ? (
              <AlertBanner variant="error" title={t.saveFailed.title}>
                {t.saveFailed.description}
              </AlertBanner>
            ) : null}
            {worker === null ? <p className="shopfloor-receipt__note">{t.noWorker}</p> : null}
            {lines.some((line) => needsReason(line, hasReasonOptions)) ? (
              <p className="shopfloor-receipt__note">{t.lines.reasonRequired}</p>
            ) : null}
            {/*
              막힌 사실만 말하면 물건을 손에 든 사람이 어디로 가야 하는지 모른 채 선다. 이
              화면에는 초과분을 담을 자리가 없어 출고 쪽을 고쳐야 풀린다(설계 §8 미결 1).
            */}
            {lines.some((line) => qtyProblemOf(line) === 'overIssued') ? (
              <AlertBanner variant="warning" title={t.lines.overIssuedTitle}>
                {t.lines.overIssuedGuide}
              </AlertBanner>
            ) : null}
          </section>

          {/*
           * 자재가 라인에 들어오는 이 시점에 사람이 눈으로 잰다. 여기서 적지 않으면 호퍼에
           * 무엇이 얼마나 남았는지가 어디에도 남지 않는다.
           */}
          <section className="shopfloor-receipt__section">
            <h2>{t.hopper.legend}</h2>
            {equipments.isPending ? <p role="status">{t.hopper.loading}</p> : null}
            {equipments.isError ? (
              <FailureBanner
                variant="error"
                title={failureText(equipments.error, t.hopper.loadFailed)}
              />
            ) : null}
            {equipments.data === undefined ? null : (
              <div className="shopfloor-receipt__field">
                <label htmlFor="hopper-equipment">{t.hopper.equipmentLabel}</label>
                <Select
                  id="hopper-equipment"
                  placeholder={t.hopper.equipmentPlaceholder}
                  size="xl"
                  value={equipmentId === null ? null : String(equipmentId)}
                  onChange={(value) => {
                    setEquipmentId(Number(value));
                    setMeasured({});
                  }}
                  options={hopperEquipments.map((each) => ({
                    value: String(each.equipmentId),
                    label: `${each.equipmentCode} ${each.equipmentName}`,
                  }))}
                />
              </div>
            )}

            {/* 고를 것이 하나도 없으면 빈 목록만 남아, 고르는 법을 모르는 것과 구별되지 않는다. */}
            {equipments.isSuccess && hopperEquipments.length === 0 ? (
              <AlertBanner variant="warning" title={t.hopper.noHopperEquipment} />
            ) : null}
            {hopper.data === undefined ? null : <p>{t.hopper.at(hopper.data.locationCode)}</p>}

            {hopperStock.isPending && hopperLocationId !== null ? (
              <p role="status">{t.hopper.stockLoading}</p>
            ) : null}
            {hopperStock.isError ? (
              <FailureBanner
                variant="error"
                title={failureText(hopperStock.error, t.hopper.stockFailed)}
              />
            ) : null}
            {hopperStock.isSuccess && stocks.length === 0 ? (
              <p className="shopfloor-receipt__note">{t.hopper.empty}</p>
            ) : null}

            {stocks.map((stock) => {
              const key = hopperKeyOf(stock);
              const value = measured[key] ?? '';
              const problem = measureProblemOf(value);
              const code = referenceLabel(itemCode(stock.itemId));
              /* 같은 품목이 여러 LOT 으로 남으면 품목 코드만으로는 어느 줄인지 알 수 없다. */
              const name = t.hopper.name(code, stock.lotNo ?? '');

              return (
                <div key={key} className="shopfloor-receipt__line">
                  {/*
                    무엇을 재는 줄인지 먼저 세운다. 칸 이름 하나에 품목과 34자리 LOT 을 함께
                    담으면 두 줄로 접히면서 「실측 잔량」이 갈라져, 줄을 훑는 눈이 품목도 칸
                    이름도 잡지 못한다. 읽어 주는 이름은 그대로 전부를 싣는다.
                  */}
                  <div className="shopfloor-receipt__stock-head">
                    <p className="shopfloor-receipt__stock-item">
                      <span className="shopfloor-receipt__stock-name">{t.itemLabel}</span>{' '}
                      <strong>{code}</strong>
                    </p>
                    {stock.lotNo === null ||
                    stock.lotNo === undefined ||
                    stock.lotNo === '' ? null : (
                      <p className="shopfloor-receipt__stock-lot">
                        <span className="shopfloor-receipt__stock-name">{t.lotLabel}</span>{' '}
                        {stock.lotNo}
                      </p>
                    )}
                  </div>
                  {/*
                    견줄 값을 적는 칸보다 먼저 세운다. 아래에 두면 얼마가 적혀 있는지 모른 채
                    적고 나서야 눈에 들어온다. 차이는 그 옆에 붙어 무엇에서 얼마가 벌어졌는지
                    한 눈에 읽힌다.
                  */}
                  <div className="shopfloor-receipt__stock-figures">
                    <span className="shopfloor-receipt__issued">
                      {t.hopper.onHand(String(stock.onHandQty))}
                    </span>
                    {/* 부호를 사람이 적게 하면 뒤집어 적는 순간 재고가 반대로 움직인다. */}
                    {isMeasured(stock, value) ? (
                      <span className="shopfloor-receipt__short">
                        {t.hopper.difference(String(adjustmentQtyOf(stock, value)))}
                      </span>
                    ) : null}
                  </div>
                  <TextField
                    id={measuredFieldId(key)}
                    label={t.hopper.measured}
                    aria-label={t.hopper.measuredLabel(name)}
                    size="xl"
                    fullWidth
                    inputMode="none"
                    value={value}
                    onChange={(event) => {
                      const next = event.target.value;
                      setMeasured((current) => ({ ...current, [key]: next }));
                    }}
                    onFocus={() => {
                      setHopperKeypadFor(key);
                      setKeypadFor(null);
                    }}
                    error={problem === null ? undefined : t.hopper.problem[problem]}
                  />
                </div>
              );
            })}

            {hopperSaveFailed ? <AlertBanner variant="error" title={t.hopper.saveFailed} /> : null}
            {hopperOutcome === 'sent' ? (
              <AlertBanner variant="success" title={t.hopper.sent} />
            ) : null}
            {hopperOutcome === 'held' ? (
              <AlertBanner variant="warning" title={t.hopper.queued} />
            ) : null}
            {hopperOutcome === 'rejected' ? (
              <AlertBanner variant="error" title={t.hopper.rejected}>
                <Link to="/rejections">{t.rejected.action}</Link>
              </AlertBanner>
            ) : null}
            <Button
              className="shopfloor-receipt__wide"
              variant="outlined"
              size="xl"
              disabled={
                !loaded ||
                !canRecordHopper(hopperLocationId, stocks, measured, worker !== null, reasonMissing)
              }
              onClick={() => void recordHopper()}
            >
              {t.hopper.submit}
            </Button>
          </section>

          {/* 라인이 쌓이면 확정 단추가 접힌 자리로 밀린다(설계 §3 액션 72). */}
          <div className="action-bar">
            <Button
              className="shopfloor-receipt__wide"
              variant="filled"
              size="2xl"
              disabled={!ready}
              onClick={() => void submit()}
            >
              {t.submit}
            </Button>
          </div>
        </>
      )}

      <ScanReplaceDialog field={scanField} />

      {linePad === null ? null : (
        <DockedNumberPad
          head={t.lines.receivedLabel(nameOf(linePad.line))}
          fieldId={receivedFieldId(linePad.line.goodsIssueLineId)}
          value={linePad.line.receivedQty}
          onChange={(value) => {
            setLines((current) =>
              current.map((each, at) =>
                at === linePad.at ? { ...each, receivedQty: value } : each,
              ),
            );
          }}
          onClose={() => {
            setKeypadFor(null);
          }}
          move={{
            canPrevious: linePad.at > 0,
            canNext: linePad.at < lines.length - 1,
            onPrevious: () => {
              setKeypadFor(lines[linePad.at - 1]?.goodsIssueLineId ?? null);
            },
            onNext: () => {
              setKeypadFor(lines[linePad.at + 1]?.goodsIssueLineId ?? null);
            },
            previousLabel: t.lines.previousLine,
            nextLabel: t.lines.nextLine,
          }}
          allowDecimal
        />
      )}

      {hopperPad === null ? null : (
        <DockedNumberPad
          head={t.hopper.measuredLabel(
            t.hopper.name(
              referenceLabel(itemCode(hopperPad.stock.itemId)),
              hopperPad.stock.lotNo ?? '',
            ),
          )}
          fieldId={measuredFieldId(hopperKeyOf(hopperPad.stock))}
          value={measured[hopperKeyOf(hopperPad.stock)] ?? ''}
          onChange={(next) => {
            setMeasured((current) => ({ ...current, [hopperKeyOf(hopperPad.stock)]: next }));
          }}
          onClose={() => {
            setHopperKeypadFor(null);
          }}
          move={{
            canPrevious: hopperPad.at > 0,
            canNext: hopperPad.at < stocks.length - 1,
            onPrevious: () => {
              const previous = stocks[hopperPad.at - 1];
              setHopperKeypadFor(previous === undefined ? null : hopperKeyOf(previous));
            },
            onNext: () => {
              const next = stocks[hopperPad.at + 1];
              setHopperKeypadFor(next === undefined ? null : hopperKeyOf(next));
            },
            previousLabel: t.hopper.previousHopper,
            nextLabel: t.hopper.nextHopper,
          }}
          allowDecimal
        />
      )}
    </div>
  );
};
