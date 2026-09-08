import {
  AlertBanner,
  Button,
  Card,
  Checkbox,
  Chip,
  Dialog,
  Select,
  TextField,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { NumericKeypad } from '@omf-mes/ui';
import { useEffect, useId, useRef, useState } from 'react';

import { OutboxStallBanner } from '../../patterns/outbox-stall-banner';
import { usePopIdentity } from '../../patterns/pop-identity';
import { PopWorkerTag } from '../../patterns/pop-worker-tag';
import { useResultEntry } from './entry-context';
import { useFlowGates } from './flow-gating';
import { useDocumentIssue, useLotComplete, useSerialIssue } from './flow-mutations';
import { useLabelPrintRunner, type PrintTarget } from './flow-print';
import {
  defaultPrinter,
  latestIssue,
  useCompletedLots,
  useCurrentLot,
  useItem,
  useLotIssues,
  usePrinters,
  useReissueReasons,
  useSerials,
  useTagIssueSummary,
} from './flow-queries';
import {
  buildLotComplete,
  buildLotIssue,
  buildTagIssue,
  canMatchIdentificationCount,
  judgeLotScan,
  missingIdentificationCount,
  requiresIdentificationTag,
  type DocumentIssueCreate,
} from './flow-state';
import { useOutbox, type OutboxEntry } from './outbox';
import { GOOD_QTY_MAX_LENGTH, formatQty, parseGoodQty } from './quantity-draft';
import { usePendingPqc, useWorkOrder } from './queries';
import { buildSaveBody } from './save-request';
import { useUomLookup } from './uom-lookup';

const t = messages.productionResult;

type OutputPhase =
  | 'idle'
  | 'queued'
  | 'issuing'
  | 'printing'
  | 'scanReady'
  | 'issueFailed'
  | 'printFailed'
  | 'completing'
  | 'completed';

const quantityInput = (value: string): string => {
  const cleaned = value.replace(/[^\d.]/gu, '');
  const [whole = '', ...fractions] = cleaned.split('.');
  const normalized = fractions.length === 0 ? whole : `${whole}.${fractions.join('')}`;

  return normalized.slice(0, GOOD_QTY_MAX_LENGTH);
};

const targetsOf = (
  issues: readonly { documentIssueLogId: number; target: { displayName: string } }[],
): PrintTarget[] =>
  issues.map((issue) => ({
    documentIssueLogId: issue.documentIssueLogId,
    label: issue.target.displayName,
  }));

/** P-02-04 생산 실적·인식표·생산 LOT 라벨·스캔 마감을 한 주소와 한 상태 흐름으로 묶는다. */
export const ProductionFlowScreen = () => {
  const titleId = useId();
  const actualQtyId = useId();
  const scanId = useId();

  const entry = useResultEntry();
  const identity = usePopIdentity();
  const workOrder = useWorkOrder(entry.workOrderId);
  const currentLot = useCurrentLot(entry.workOrderId);
  const pendingPqc = usePendingPqc(entry.workOrderId);
  const item = useItem(currentLot.data?.itemId ?? workOrder.data?.itemId ?? null);
  const printers = usePrinters();
  const gates = useFlowGates(identity.terminalId, identity.processId);
  const uom = useUomLookup();

  const [actualQty, setActualQty] = useState('');
  const [outputPhase, setOutputPhase] = useState<OutputPhase>('idle');
  const [scanValue, setScanValue] = useState('');
  const [scanMismatch, setScanMismatch] = useState(false);
  const [isCompletedOpen, setIsCompletedOpen] = useState(false);
  const [appliedLotId, setAppliedLotId] = useState<number | null>(null);
  const [lotPrintTargets, setLotPrintTargets] = useState<PrintTarget[]>([]);
  const [tagPrintTargets, setTagPrintTargets] = useState<PrintTarget[]>([]);
  const [pendingTagIssue, setPendingTagIssue] = useState<DocumentIssueCreate | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [isTagReissueOpen, setIsTagReissueOpen] = useState(false);
  const [tagReissueReason, setTagReissueReason] = useState<string | null>(null);
  const currentLotIdRef = useRef<number | null>(null);

  const completedLots = useCompletedLots(entry.workOrderId, isCompletedOpen);
  const isTagTarget = item.data === undefined ? null : requiresIdentificationTag(item.data);
  const serials = useSerials(currentLot.data?.lotId ?? null, isTagTarget === true);
  const tagIssueSummary = useTagIssueSummary(serials.data?.items ?? [], isTagTarget === true);
  const reissueReasons = useReissueReasons(isTagReissueOpen);
  const lotIssues = useLotIssues(currentLot.data?.lotId ?? null);
  const currentIssue = latestIssue(lotIssues.data);
  const printer = defaultPrinter(printers.data);
  const serialCount = serials.data?.page.total ?? null;
  const parsedQty = parseGoodQty(actualQty);
  const tagMissing =
    parsedQty === null || serialCount === null
      ? null
      : missingIdentificationCount(parsedQty, serialCount);

  const lotPrint = useLabelPrintRunner(entry.workerNo);
  const tagPrint = useLabelPrintRunner(entry.workerNo);

  const lotIssue = useDocumentIssue({
    workerNo: entry.workerNo ?? '',
    onSuccess: (result) => {
      const targets = targetsOf(result.items);
      setLotPrintTargets(targets);
      setOutputPhase('printing');
      void lotPrint.run(targets);
    },
  });

  const tagDocumentIssue = useDocumentIssue({
    workerNo: entry.workerNo ?? '',
    onSuccess: (result) => {
      const targets = targetsOf(result.items);
      setPendingTagIssue(null);
      setSelectedTagIds([]);
      setIsTagReissueOpen(false);
      setTagReissueReason(null);
      setTagPrintTargets(targets);
      void tagPrint.run(targets);
    },
  });

  const serialIssue = useSerialIssue({
    workerNo: entry.workerNo ?? '',
    onSuccess: (result) => {
      const body = buildTagIssue(result.items);
      setPendingTagIssue(body);
      tagDocumentIssue.write(body);
    },
  });

  const complete = useLotComplete({
    lotId: currentLot.data?.lotId ?? null,
    workerNo: entry.workerNo ?? '',
    onSuccess: () => {
      setOutputPhase('completed');
      setScanValue('');
      setScanMismatch(false);
      void currentLot.refetch();
    },
  });

  const onResultApplied = (outboxEntry: OutboxEntry): void => {
    const lotId = outboxEntry.body.lotAllocations?.[0]?.lotId;
    if (lotId === undefined) return;

    setAppliedLotId(lotId);
    setOutputPhase('issuing');
  };

  const outbox = useOutbox({ onApplied: onResultApplied });

  useEffect(() => {
    const lot = currentLot.data;
    if (lot === null || lot === undefined || appliedLotId !== lot.lotId) return;

    setAppliedLotId(null);
    lotIssue.write(buildLotIssue(lot.lotId, printer?.printerName ?? null));
    // `write`는 렌더마다 달라지는 이벤트 함수다. 적용 LOT 변화만 한 번 처리한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedLotId, currentLot.data?.lotId, printer?.printerName]);

  useEffect(() => {
    if (lotPrint.state.phase === 'succeeded') setOutputPhase('scanReady');
    if (lotPrint.state.phase === 'failed' || lotPrint.state.phase === 'shellUnavailable') {
      setOutputPhase('printFailed');
    }
  }, [lotPrint.state.phase]);

  useEffect(() => {
    if (lotIssue.error !== null && outputPhase === 'issuing') setOutputPhase('issueFailed');
  }, [lotIssue.error, outputPhase]);

  useEffect(() => {
    if (complete.error !== null && outputPhase === 'completing') setOutputPhase('scanReady');
  }, [complete.error, outputPhase]);

  useEffect(() => {
    if (outbox.rejection !== null && outputPhase === 'queued') setOutputPhase('idle');
  }, [outbox.rejection, outputPhase]);

  useEffect(() => {
    if (outputPhase === 'idle' && currentIssue?.printOutcome === 'SUCCEEDED') {
      setOutputPhase('scanReady');
    }
  }, [currentIssue?.printOutcome, outputPhase]);

  useEffect(() => {
    const lot = currentLot.data;
    const nextLotId = lot?.lotId ?? null;
    if (currentLotIdRef.current === nextLotId) return;

    currentLotIdRef.current = nextLotId;
    setActualQty(lot === null || lot === undefined ? '' : String(lot.initialQty));
    setOutputPhase(currentIssue?.printOutcome === 'SUCCEEDED' ? 'scanReady' : 'idle');
    setScanValue('');
    setScanMismatch(false);
    setLotPrintTargets([]);
    setTagPrintTargets([]);
    setPendingTagIssue(null);
    setSelectedTagIds([]);
    setIsTagReissueOpen(false);
    setTagReissueReason(null);
  }, [currentIssue?.printOutcome, currentLot.data]);

  const lot = currentLot.data ?? null;
  const hasPendingPqc =
    pendingPqc.isPending || pendingPqc.isError || (pendingPqc.data?.length ?? 0) > 0;
  const hasTagCountMatch =
    isTagTarget !== true ||
    (parsedQty !== null &&
      serialCount !== null &&
      canMatchIdentificationCount(parsedQty, serialCount));
  const summaryBySerialId = new Map(
    (tagIssueSummary.data ?? []).map((summary) => [summary.targetId, summary]),
  );
  const serialItems = serials.data?.items ?? [];
  const issuedSerials = serialItems.filter(
    (serial) => (summaryBySerialId.get(serial.serialNumberId)?.issueCount ?? 0) > 0,
  );
  const unissuedSerials = serialItems.filter(
    (serial) => summaryBySerialId.get(serial.serialNumberId)?.issueCount === 0,
  );
  const hasCompleteTagSummary =
    isTagTarget !== true ||
    (tagIssueSummary.data !== undefined && tagIssueSummary.data.length === serialItems.length);
  const hasTagDocuments =
    isTagTarget !== true || (hasCompleteTagSummary && unissuedSerials.length === 0);
  const canOutput =
    lot !== null &&
    parsedQty !== null &&
    parsedQty > 0 &&
    entry.workerNo !== null &&
    gates.input === 'allowed' &&
    gates.print === 'allowed' &&
    !hasPendingPqc &&
    isTagTarget !== null &&
    hasTagCountMatch &&
    hasTagDocuments &&
    printer !== null &&
    lotPrint.isShellAvailable &&
    outputPhase === 'idle' &&
    !outbox.isPendingForLot(lot.lotId) &&
    currentIssue === null;

  const queueOutput = (): void => {
    if (!canOutput || lot === null || parsedQty === null || entry.workOrderId === null) return;
    if (entry.workerNo === null) return;

    setOutputPhase('queued');
    outbox.enqueue(
      entry.workerNo,
      buildSaveBody({
        workOrderId: entry.workOrderId,
        lotId: lot.lotId,
        uomId: lot.uomId,
        goodQty: parsedQty,
        draft: { goodQty: actualQty, remarks: '' },
        occurredAt: new Date().toISOString(),
      }),
    );
  };

  const issueTags = (): void => {
    if (
      lot === null ||
      entry.workerNo === null ||
      tagMissing === null ||
      !Number.isInteger(tagMissing) ||
      tagMissing <= 0 ||
      gates.print !== 'allowed'
    ) {
      return;
    }

    tagPrint.reset();
    tagDocumentIssue.reset();
    serialIssue.write({ lotId: lot.lotId, quantity: tagMissing });
  };

  const retryLotIssue = (): void => {
    if (lot === null || entry.workerNo === null) return;

    lotIssue.write(buildLotIssue(lot.lotId, printer?.printerName ?? null));
    setOutputPhase('issuing');
  };

  const retryTagDocumentIssue = (): void => {
    if (pendingTagIssue === null || entry.workerNo === null) return;

    tagDocumentIssue.write(pendingTagIssue);
  };

  const restoreTagDocuments = (): void => {
    if (unissuedSerials.length === 0 || entry.workerNo === null) return;

    const body = buildTagIssue(unissuedSerials);
    setPendingTagIssue(body);
    tagDocumentIssue.write(body);
  };

  const reissueTags = (): void => {
    if (tagReissueReason === null || entry.workerNo === null || selectedTagIds.length === 0) return;

    const selected = issuedSerials.filter((serial) =>
      selectedTagIds.includes(serial.serialNumberId),
    );
    if (selected.length === 0) return;

    const body = buildTagIssue(selected, {
      reissueReasonCode: tagReissueReason,
      printerName: printer?.printerName ?? null,
    });
    setPendingTagIssue(body);
    tagDocumentIssue.write(body);
  };

  const retryLotPrint = (): void => {
    const targets =
      lotPrintTargets.length > 0
        ? lotPrintTargets
        : currentIssue === null
          ? []
          : [
              {
                documentIssueLogId: currentIssue.documentIssueLogId,
                label: currentIssue.target.displayName,
              },
            ];

    if (targets.length === 0) return;
    setOutputPhase('printing');
    void lotPrint.run(targets);
  };

  const changeScan = (value: string): void => {
    setScanValue(value);
    setScanMismatch(false);
    if (lot === null || outputPhase !== 'scanReady' || complete.isSaving) return;

    const verdict = judgeLotScan(value, lot.lotNo);
    if (verdict === 'mismatch') {
      setScanMismatch(true);
      return;
    }
    if (verdict !== 'match' || gates.complete !== 'allowed' || entry.workerNo === null) return;

    setOutputPhase('completing');
    complete.write(buildLotComplete(new Date()));
  };

  const outputStatus = (() => {
    switch (outputPhase) {
      case 'queued':
        return outbox.isOnline ? t.flow.output.saving : t.flow.output.queued;
      case 'issuing':
        return t.flow.output.issuing;
      case 'printing':
        return t.flow.output.printing;
      case 'scanReady':
        return t.flow.output.printed;
      case 'issueFailed':
        return t.flow.output.issueFailed;
      case 'printFailed':
        return lotPrint.state.phase === 'shellUnavailable'
          ? t.flow.output.shellUnavailable
          : t.flow.output.printFailed;
      case 'completing':
        return t.flow.scan.completing;
      case 'completed':
        return t.flow.scan.completed;
      case 'idle':
        return null;
    }
  })();

  const uomLabel = uom.labelOf(lot?.uomId ?? workOrder.data?.uomId) ?? '';

  return (
    <main className="pop-shell pop-ui production-flow" aria-labelledby={titleId}>
      <header className="pop-header">
        <h1 id={titleId} className="pop-title">
          {t.title}
        </h1>
        {workOrder.data === undefined ? null : (
          <p className="pop-context">
            {`${t.flow.header.erpWorkOrder} ${workOrder.data.productionOrderNo ?? '—'} · ${t.flow.header.workOrder} ${workOrder.data.workOrderNo} · ${t.flow.header.item} ${item.data?.itemCode ?? workOrder.data.itemCode ?? '—'}`}
          </p>
        )}
        <div className="pop-context-right">
          <PopWorkerTag workerNo={entry.workerNo} />
          <Chip status={outbox.isOnline ? 'success' : 'warning'}>
            {outbox.isOnline
              ? messages.common.connection.online
              : messages.common.connection.offline}
          </Chip>
          {outbox.pendingCount > 0 && (
            <Chip status="warning">{t.sync.pending(outbox.pendingCount)}</Chip>
          )}
        </div>
      </header>

      {outbox.isStalled && <OutboxStallBanner onRetry={outbox.retryNow} />}

      {currentLot.isError && (
        <div className="banner-slot">
          <AlertBanner variant="error" title={t.flow.currentLot.loadFailed} />
        </div>
      )}
      {currentLot.data === null && (
        <div className="banner-slot">
          <AlertBanner variant="info" title={t.flow.currentLot.none} />
        </div>
      )}
      {pendingPqc.isError && (
        <div className="banner-slot">
          <AlertBanner variant="error" title={t.pqc.loadFailed} />
        </div>
      )}
      {(pendingPqc.data?.length ?? 0) > 0 && (
        <div className="banner-slot">
          <AlertBanner variant="warning" title={t.pqc.blockedTitle}>
            {t.pqc.blockedBody}
          </AlertBanner>
        </div>
      )}
      {item.isError && (
        <div className="banner-slot">
          <AlertBanner variant="error" title={t.flow.tag.targetUnknown} />
        </div>
      )}
      {outbox.rejection !== null && (
        <div className="banner-slot">
          <AlertBanner variant="error" title={t.save.failTitle} />
        </div>
      )}
      {outputStatus !== null && (
        <div className="banner-slot">
          <AlertBanner
            variant={
              outputPhase === 'issueFailed' || outputPhase === 'printFailed' ? 'error' : 'info'
            }
            title={outputStatus}
          />
        </div>
      )}

      <div
        className={`production-flow-grid pop-fixed${
          isTagTarget === false ? ' production-flow-grid-no-tags' : ''
        }`}
      >
        <Card bordered className="pop-section production-flow-progress">
          <Card.Body>
            <div className="production-flow-section-head">
              <h2 className="pane-title">{t.flow.currentLot.title}</h2>
              <Button variant="outlined" onClick={() => setIsCompletedOpen(true)}>
                {t.flow.currentLot.completed}
              </Button>
            </div>
            <dl className="pop-figures">
              <div>
                <dt>{t.flow.currentLot.current}</dt>
                <dd>{lot?.lotNo ?? '—'}</dd>
              </div>
              <div>
                <dt>{t.flow.currentLot.title}</dt>
                <dd>
                  {t.flow.currentLot.sequence(
                    lot?.workOrderSequenceNo ?? null,
                    lot?.workOrderLotCount ?? null,
                  )}
                </dd>
              </div>
            </dl>
          </Card.Body>
        </Card>

        <Card bordered className="pop-section production-flow-quantity">
          <Card.Body>
            <h2 className="pane-title">{t.flow.quantity.title}</h2>
            <dl className="pop-figures production-flow-target-qty">
              <div>
                <dt>{t.flow.quantity.target}</dt>
                <dd>{lot === null ? '—' : `${formatQty(lot.initialQty)} ${uomLabel}`}</dd>
              </div>
            </dl>
            <TextField
              id={actualQtyId}
              label={t.flow.quantity.actual}
              value={actualQty}
              inputMode="decimal"
              trailingIcon={uomLabel}
              error={parsedQty === null || parsedQty <= 0 ? t.flow.quantity.invalid : undefined}
              onChange={(event) => setActualQty(quantityInput(event.target.value))}
            />
            <NumericKeypad
              value={actualQty}
              label={t.quantity.keypadLabel}
              backspaceLabel={t.quantity.backspace}
              backspaceGlyph="⌫"
              clearLabel={t.quantity.clearGlyph}
              maxLength={GOOD_QTY_MAX_LENGTH}
              allowDecimal
              decimalLabel="소수점"
              onChange={setActualQty}
            />
          </Card.Body>
        </Card>

        {isTagTarget === true && (
          <Card bordered className="pop-section production-flow-tags">
            <Card.Body>
              <h2 className="pane-title">{t.flow.tag.title}</h2>
              {serials.isError ? (
                <p className="field-error">{t.flow.tag.loadFailed}</p>
              ) : (
                <>
                  <p className="production-flow-count">
                    {t.flow.tag.issued}: {t.flow.tag.count(serialCount ?? 0)}
                  </p>
                  <div className="production-flow-serials" aria-label={t.flow.tag.issued}>
                    {issuedSerials.map((serial) => (
                      <Checkbox
                        key={serial.serialNumberId}
                        checked={selectedTagIds.includes(serial.serialNumberId)}
                        onChange={(event) =>
                          setSelectedTagIds((current) =>
                            event.target.checked
                              ? [...new Set([...current, serial.serialNumberId])]
                              : current.filter((id) => id !== serial.serialNumberId),
                          )
                        }
                      >
                        {serial.serialNo}
                      </Checkbox>
                    ))}
                  </div>
                  {tagIssueSummary.isError && (
                    <p className="field-error">{t.flow.tag.summaryFailed}</p>
                  )}
                  {unissuedSerials.length > 0 && (
                    <Button
                      variant="outlined"
                      disabled={tagDocumentIssue.isSaving}
                      onClick={restoreTagDocuments}
                    >
                      {t.flow.tag.restoreDocuments(unissuedSerials.length)}
                    </Button>
                  )}
                  {parsedQty !== null && serialCount !== null && serialCount > parsedQty && (
                    <p className="field-error">{t.flow.tag.tooMany}</p>
                  )}
                  {tagMissing === 0 && <p className="field-note">{t.flow.tag.matched}</p>}
                  <Button
                    disabled={
                      tagMissing === null ||
                      tagMissing <= 0 ||
                      !Number.isInteger(tagMissing) ||
                      gates.print !== 'allowed' ||
                      entry.workerNo === null ||
                      serialIssue.isSaving ||
                      tagDocumentIssue.isSaving ||
                      tagPrint.state.phase === 'sending'
                    }
                    onClick={issueTags}
                  >
                    {tagMissing === null ? t.flow.tag.title : t.flow.tag.issueMissing(tagMissing)}
                  </Button>
                  {tagPrint.state.phase === 'failed' && tagPrintTargets.length > 0 && (
                    <Button variant="outlined" onClick={() => void tagPrint.run(tagPrintTargets)}>
                      {t.flow.output.retryPrint}
                    </Button>
                  )}
                  {issuedSerials.length > 0 && (
                    <Button
                      variant="outlined"
                      disabled={selectedTagIds.length === 0}
                      onClick={() => setIsTagReissueOpen(true)}
                    >
                      {t.flow.tag.reissue}
                    </Button>
                  )}
                  {tagDocumentIssue.error !== null && pendingTagIssue !== null && (
                    <Button variant="outlined" onClick={retryTagDocumentIssue}>
                      {t.flow.retry}
                    </Button>
                  )}
                </>
              )}
            </Card.Body>
          </Card>
        )}

        <Card bordered className="pop-section production-flow-output">
          <Card.Body>
            <h2 className="pane-title">{t.flow.output.title}</h2>
            <dl className="pop-figures">
              <div>
                <dt>{t.flow.currentLot.current}</dt>
                <dd>{lot?.lotNo ?? '—'}</dd>
              </div>
              <div>
                <dt>{t.flow.header.item}</dt>
                <dd>{item.data?.itemCode ?? workOrder.data?.itemCode ?? '—'}</dd>
              </div>
              <div>
                <dt>{t.flow.quantity.actual}</dt>
                <dd>{parsedQty === null ? '—' : `${formatQty(parsedQty)} ${uomLabel}`}</dd>
              </div>
              <div>
                <dt>{t.flow.output.printer}</dt>
                <dd>{printer?.displayName ?? t.flow.output.printerUnknown}</dd>
              </div>
            </dl>

            {outputPhase === 'issueFailed' ? (
              <Button onClick={retryLotIssue}>{t.flow.output.retryIssue}</Button>
            ) : outputPhase === 'printFailed' ||
              (outputPhase === 'idle' && currentIssue !== null) ? (
              <Button onClick={retryLotPrint}>{t.flow.output.retryPrint}</Button>
            ) : (
              <Button disabled={!canOutput} onClick={queueOutput}>
                {t.flow.output.issue}
              </Button>
            )}

            {printer === null && !printers.isPending && (
              <p className="field-error">{t.flow.output.printerUnavailable}</p>
            )}
            {!lotPrint.isShellAvailable && (
              <p className="field-error">{t.flow.output.shellUnavailable}</p>
            )}
          </Card.Body>
        </Card>

        <Card bordered className="pop-section production-flow-scan">
          <Card.Body>
            <h2 className="pane-title">{t.flow.scan.title}</h2>
            <TextField
              id={scanId}
              label={t.flow.scan.label}
              value={scanValue}
              disabled={outputPhase !== 'scanReady' || gates.complete !== 'allowed'}
              error={scanMismatch && lot !== null ? t.flow.scan.mismatch(lot.lotNo) : undefined}
              onChange={(event) => changeScan(event.target.value)}
            />
            {outputPhase !== 'scanReady' && outputPhase !== 'completing' && (
              <p className="field-note">{t.flow.scan.waiting}</p>
            )}
            {complete.error !== null && <p className="field-error">{t.flow.scan.failed}</p>}
          </Card.Body>
        </Card>
      </div>

      <Dialog
        open={isCompletedOpen}
        onClose={() => setIsCompletedOpen(false)}
        title={t.flow.currentLot.completedTitle}
        footer={
          <Button variant="outlined" onClick={() => setIsCompletedOpen(false)}>
            {t.flow.close}
          </Button>
        }
      >
        {completedLots.data === undefined || completedLots.data.length === 0 ? (
          <p>{t.flow.currentLot.completedEmpty}</p>
        ) : (
          <ol className="production-flow-completed-lots">
            {completedLots.data.map((completedLot) => (
              <li key={completedLot.lotId}>{completedLot.lotNo}</li>
            ))}
          </ol>
        )}
      </Dialog>

      <Dialog
        open={isTagReissueOpen}
        onClose={() => setIsTagReissueOpen(false)}
        title={t.flow.tag.reissueReason}
        footer={
          <>
            <Button variant="outlined" onClick={() => setIsTagReissueOpen(false)}>
              {t.flow.close}
            </Button>
            <Button
              disabled={tagReissueReason === null || tagDocumentIssue.isSaving}
              onClick={reissueTags}
            >
              {t.flow.tag.reissue}
            </Button>
          </>
        }
      >
        {reissueReasons.isError ? (
          <AlertBanner variant="error">{t.flow.tag.reasonLoadFailed}</AlertBanner>
        ) : !reissueReasons.isPending && (reissueReasons.data?.length ?? 0) === 0 ? (
          <AlertBanner variant="warning">{t.flow.tag.reasonEmpty}</AlertBanner>
        ) : (
          <Select
            aria-label={t.flow.tag.reissueReason}
            value={tagReissueReason}
            placeholder={t.flow.tag.reissueReasonPlaceholder}
            options={(reissueReasons.data ?? []).map((reason) => ({
              value: reason.code,
              label: reason.codeName,
            }))}
            onChange={setTagReissueReason}
          />
        )}
      </Dialog>
    </main>
  );
};
