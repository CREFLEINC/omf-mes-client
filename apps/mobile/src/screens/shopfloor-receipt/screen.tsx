import { AlertBanner, Button, Card, Select, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

import { useCodeValues } from '../../patterns/code-values';
import { useItemLabels } from '../../patterns/masters';
import { useOutbox } from '../../patterns/outbox';
import { useScanField } from '../../patterns/use-scan-field';
import { useScreenTitle } from '../../patterns/screen-title';
import { useWorkerSession } from '../../patterns/worker-session';
import { useAlreadyReceived, useLineLotLabels, useScannedGoodsIssue } from './queries';
import {
  RECEIPT_LABEL,
  canConfirm,
  needsReason,
  qtyProblemOf,
  queuedReceiptsFor,
  toReceiptDraft,
  varianceOf,
  type DraftLine,
} from './receipt';
import './screen.css';

const t = messages.shopfloorReceipt;

type Outcome = 'held' | 'sent' | 'rejected';

/** 차이 사유의 값 목록. 식별자는 환경마다 달라 코드 그룹 이름으로 받는다. */
const VARIANCE_REASON = 'VARIANCE_REASON';

export const ShopfloorReceiptScreen = () => {
  useScreenTitle(t.title);

  const { enqueue, flush, isRejected, loaded, pendingOf } = useOutbox();
  const { worker } = useWorkerSession();

  const [scanned, setScanned] = useState<string | null>(null);
  const [manual, setManual] = useState('');
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

  const scanField = useScanField({
    onScan: (value) => {
      setScanned(value.trim());
    },
  });

  const nameOf = (line: DraftLine): string => {
    const item = itemLabels.data?.get(line.itemId);
    const lotNo = lotLabels.get(line.lotId) ?? String(line.lotId);

    return t.lines.name(item === undefined ? '' : item.itemCode, lotNo);
  };

  const restart = () => {
    setScanned(null);
    setManual('');
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
      <section className="shopfloor-receipt__section">
        <h2>{t.issue.legend}</h2>
        <TextField
          ref={scanField.ref}
          label={t.issue.scanLabel}
          placeholder={t.issue.scanPlaceholder}
          size="xl"
          fullWidth
        />
        {/* 스캔 칸은 스캐너 전용이다. 스캔이 실패했을 때 손으로 넣을 길을 함께 둔다. */}
        <div className="shopfloor-receipt__row">
          <TextField
            label={t.issue.manualLabel}
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
            {t.issue.manualSubmit}
          </Button>
        </div>

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
                    inputMode="numeric"
                    value={line.receivedQty}
                    onChange={(event) => {
                      const next = event.target.value;
                      setLines((current) =>
                        current.map((each, at) =>
                          at === index ? { ...each, receivedQty: next } : each,
                        ),
                      );
                    }}
                    error={
                      problem === null
                        ? undefined
                        : problem === 'overIssued'
                          ? t.lines.problem.overIssued(unit)
                          : t.lines.problem[problem]
                    }
                  />
                  <p className="shopfloor-receipt__issued">{t.lines.issued(unit)}</p>
                  {line.receivedQty.trim() !== '' && short !== 0 ? (
                    <>
                      <p className="shopfloor-receipt__short">{t.lines.short(String(short))}</p>
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
            {lines.some((line) => needsReason(line)) ? (
              <p className="shopfloor-receipt__note">{t.lines.reasonRequired}</p>
            ) : null}
            <Button
              className="shopfloor-receipt__wide"
              variant="filled"
              size="2xl"
              disabled={!ready}
              onClick={() => void submit()}
            >
              {t.submit}
            </Button>
          </section>
        </>
      )}
    </div>
  );
};
