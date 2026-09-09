import { AlertBanner, Button, Card, NumberPad, Select, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

import { useBackStep } from '../../patterns/back-step';
import { useCodeValues } from '../../patterns/code-values';
import { playErrorTone } from '../../patterns/error-tone';
import { useLocation } from '../../patterns/locations';
import { useItemLabels } from '../../patterns/masters';
import { useOnlineStatus } from '../../patterns/online-status';
import { useOutbox } from '../../patterns/outbox';
import { useScanField } from '../../patterns/use-scan-field';
import { useScreenTitle } from '../../patterns/screen-title';
import { useWorkerSession } from '../../patterns/worker-session';
import { useAlreadyReceived, useLineLotLabels, useScannedGoodsIssue } from './queries';
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

export const ShopfloorReceiptScreen = () => {
  useScreenTitle(t.title);

  const { enqueue, flush, isRejected, loaded, pendingOf } = useOutbox();
  const { worker } = useWorkerSession();

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

  const itemLabels = useItemLabels(issue !== null);
  const lotLabels = useLineLotLabels(issue?.lines ?? []);
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
    ) && issue !== null;

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

  const online = useOnlineStatus();
  const destination = useLocation(issue?.destinationLocationId ?? null);

  const [scanSeq, setScanSeq] = useState(0);
  /* 라인이 여럿이라 어느 칸에 들어가는지 보이지 않으면 엉뚱한 줄에 수량이 적힌다(공유계약 D-4). */
  const [keypadFor, setKeypadFor] = useState<number | null>(null);

  const scanField = useScanField({
    onScan: (value) => {
      setScanned(value.trim());
      /* 같은 라벨을 다시 스캔한 것도 한 회차다. 값만 보면 두 번째 스캔이 조용히 지나간다. */
      setScanSeq((seq) => seq + 1);
    },
  });

  /*
   * 스캔한 전표를 찾지 못했다는 것을 소리로도 알린다(공유계약 D-2). 단말을 허리에 매단 채
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
  });

  const nameOf = (line: DraftLine): string => {
    const item = itemLabels.data?.get(line.itemId);
    const lotNo = lotLabels.get(line.lotId) ?? String(line.lotId);

    return t.lines.name(item === undefined ? '' : item.itemCode, lotNo);
  };

  const restart = () => {
    setScanned(null);
    setLines([]);
    setOutcome(null);
    setSaveFailed(false);
    scanField.focus();
  };

  const submit = async () => {
    if (issue === null || worker === null || inFlight.current) {
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
    <div className="shopfloor-receipt">
      {/* 통신이 끊기면 출고분도 이 단말에서 처리한다. 말하지 않으면 다른 단말을 기다린다. */}
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
        {found.isError ? <AlertBanner variant="error" title={t.issue.loadFailed} /> : null}
        {scanned !== null && found.data === null ? (
          <AlertBanner variant="error" title={t.issue.notFound(scanned)} />
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
                <p className="shopfloor-receipt__note">{t.issue.destinationUnknown}</p>
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
            {t.unverified.description}
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
                  <TextField
                    label={t.lines.receivedLabel(nameOf(line))}
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
                    }}
                    error={
                      problem === null
                        ? undefined
                        : problem === 'overIssued'
                          ? t.lines.problem.overIssued(unit)
                          : t.lines.problem[problem]
                    }
                  />

                  {keypadFor !== line.goodsIssueLineId ? null : (
                    <NumberPad
                      value={line.receivedQty}
                      onChange={(value) => {
                        setLines((current) =>
                          current.map((each, at) =>
                            at === index ? { ...each, receivedQty: value } : each,
                          ),
                        );
                      }}
                      max={line.issuedQty}
                      allowDecimal
                    />
                  )}
                  <p className="shopfloor-receipt__issued">{t.lines.issued(unit)}</p>
                  {/* 모자란 사실은 고를 사유가 있든 없든 보인다. 숨기면 그냥 덜 받은 것이 된다. */}
                  {isShort(line) ? (
                    <p className="shopfloor-receipt__short">{t.lines.short(String(short))}</p>
                  ) : null}
                  {isShort(line) && hasReasonOptions ? (
                    <>
                      <label htmlFor={`reason-${String(line.goodsIssueLineId)}`}>
                        {t.lines.reasonLabel(nameOf(line))}
                      </label>
                      <Select
                        id={`reason-${String(line.goodsIssueLineId)}`}
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
    </div>
  );
};
