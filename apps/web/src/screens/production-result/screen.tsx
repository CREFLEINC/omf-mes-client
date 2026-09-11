import { AlertBanner, Button, Card, Checkbox, Chip, Dialog, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { NumericKeypad } from '@omf-mes/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState } from 'react';

import { OutboxStallBanner } from '../../patterns/outbox-stall-banner';
import { usePopIdentity } from '../../patterns/pop-identity';
import { PopSelect as Select } from '../../patterns/pop-select';
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
  useLotDetail,
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
  appliedGoodQty,
  canMatchIdentificationCount,
  chunkTargets,
  completedLotPageBoundary,
  hasSucceededIdentificationPrint,
  judgeLotScan,
  missingIdentificationCount,
  requiresIdentificationTag,
  nextBatchCount,
  type DocumentIssueCreate,
} from './flow-state';
import { useOutbox, type OutboxEntry } from './outbox';
import {
  GOOD_QTY_MAX_LENGTH,
  exceedsRemaining,
  formatQty,
  parseGoodQty,
  remainingQty,
} from './quantity-draft';
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
  | 'renditionFailed'
  | 'printFailed'
  | 'reportFailed'
  | 'legacyMismatch'
  | 'completing'
  | 'completed';

const quantityInput = (value: string): string => {
  const cleaned = value.replace(/[^\d.]/gu, '');
  const [whole = '', ...fractions] = cleaned.split('.');
  /*
   * ⛔ **앞자리 0 을 쌓지 않는다**(사용자 지시 2026-09-10 · 키패드도 같은 규칙이다). `011` 은
   *    `11` 과 같은 수인데 글자가 달라, 되돌릴 수 없는 기록에 실리면 나중에 같은 값인지 눈으로
   *    판단해야 한다. ⚠ `0.5` 의 앞자리 0 은 남긴다 — 그것은 뜻을 갖는 자리다.
   */
  const trimmed = whole.replace(/^0+(?=\d)/u, '');
  const normalized = fractions.length === 0 ? trimmed : `${trimmed}.${fractions.join('')}`;

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
  const queryClient = useQueryClient();
  const identity = usePopIdentity();
  const workOrder = useWorkOrder(entry.workOrderId);
  const currentLot = useCurrentLot(entry.workOrderId);
  const pendingPqc = usePendingPqc(entry.workOrderId);
  const item = useItem(currentLot.data?.itemId ?? workOrder.data?.itemId ?? null);
  const lotPrinters = usePrinters('PRODUCTION_LOT_LABEL');
  const tagPrinters = usePrinters('IDENTIFICATION_TAG');
  const gates = useFlowGates(identity.terminalId, identity.processId);
  const uom = useUomLookup();

  const [actualQty, setActualQty] = useState('');
  const [outputPhase, setOutputPhase] = useState<OutputPhase>('idle');
  const [scanValue, setScanValue] = useState('');
  const [scanMismatch, setScanMismatch] = useState(false);
  const [isCompletedOpen, setIsCompletedOpen] = useState(false);
  const [completedPage, setCompletedPage] = useState(1);
  const [appliedLotId, setAppliedLotId] = useState<number | null>(null);
  const [confirmedResultLotId, setConfirmedResultLotId] = useState<number | null>(null);
  const [lotPrintTargets, setLotPrintTargets] = useState<PrintTarget[]>([]);
  const [tagPrintTargets, setTagPrintTargets] = useState<PrintTarget[]>([]);
  const [pendingTagIssue, setPendingTagIssue] = useState<DocumentIssueCreate | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [isTagReissueOpen, setIsTagReissueOpen] = useState(false);
  /*
   * 초과 확인 팝업. ⛔ **확인했다는 사실을 남기지 않는다** — 수량을 고쳐 다시 넘기면 다시
   * 물어야 한다. 팝업이 열려 있는 동안만 서는 상태다(스펙 §6 「차단하지 말고 확인 후 진행」).
   */
  const [isOverrunOpen, setIsOverrunOpen] = useState(false);
  const [tagReissueReason, setTagReissueReason] = useState<string | null>(null);
  const [pendingSerialQuantity, setPendingSerialQuantity] = useState(0);
  const [pendingTagDocuments, setPendingTagDocuments] = useState<DocumentIssueCreate[]>([]);
  const currentLotIdRef = useRef<number | null>(null);

  const completedLots = useCompletedLots(entry.workOrderId, isCompletedOpen, completedPage);
  const isTagTarget = item.data === undefined ? null : requiresIdentificationTag(item.data);
  const serials = useSerials(currentLot.data?.lotId ?? null, isTagTarget === true);
  const tagIssueSummary = useTagIssueSummary(serials.data?.items ?? [], isTagTarget === true);
  const reissueReasons = useReissueReasons(isTagReissueOpen);
  const lotIssues = useLotIssues(currentLot.data?.lotId ?? null);
  /*
   * ⭐ **마감이 실을 낙관적 잠금 값을 받아 두는 조회다**(#1005 · 공유계약 B-1). 응답 «내용»은
   *    쓰지 않는다 — 목록이 이미 준다. 여기서 얻는 것은 `ETag` 헤더뿐이고, 그것이 보관소의
   *    `/trace/lots/{lotId}` 자리에 앉아야 `useLotComplete` 가 꺼내 쓸 수 있다.
   */
  const lotDetail = useLotDetail(currentLot.data?.lotId ?? null);
  const currentIssue = latestIssue(lotIssues.data);
  const lotPrinter = defaultPrinter(lotPrinters.data);
  const tagPrinter = defaultPrinter(tagPrinters.data);
  const serialCount = serials.data?.page.total ?? null;
  const parsedQty = parseGoodQty(actualQty);
  /*
   * 이 작업지시의 잔여수량 — **서버가 낸 값을 쓴다**(`quantity-draft`). 화면이 식을 새로
   * 세우지 않는다. 받지 못했으면 `null` 이고, 그것은 0 이 아니라 «모른다»다.
   */
  const remaining = remainingQty(workOrder.data);
  /** 지금 입력이 잔여를 넘는가. 잔여를 모르면 넘는지도 모른다 — 그때는 묻지 않는다. */
  const isOverrun = exceedsRemaining(actualQty, remaining);
  const tagMissing =
    parsedQty === null || serialCount === null
      ? null
      : missingIdentificationCount(parsedQty, serialCount);
  const lot = currentLot.data ?? null;
  const serverAppliedQty = appliedGoodQty(lot);
  const hasAppliedResult =
    lot !== null && (serverAppliedQty !== null || confirmedResultLotId === lot.lotId);

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
      const [first, ...rest] = chunkTargets(result.items).map((serialBatch) =>
        buildTagIssue(serialBatch, { printerName: tagPrinter?.printerName ?? null }),
      );
      if (first === undefined) return;

      setPendingTagDocuments(rest);
      setPendingTagIssue(first);
      tagDocumentIssue.write(first);
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
    setConfirmedResultLotId(lotId);
    setOutputPhase('issuing');
  };

  const outbox = useOutbox({ onApplied: onResultApplied });

  useEffect(() => {
    const lot = currentLot.data;
    if (
      lot === null ||
      lot === undefined ||
      appliedLotId !== lot.lotId ||
      lotIssues.data === undefined
    ) {
      return;
    }

    setAppliedLotId(null);
    if (currentIssue !== null) {
      const targets = targetsOf([currentIssue]);
      setLotPrintTargets(targets);
      setOutputPhase('printing');
      void lotPrint.run(targets);
      return;
    }

    lotIssue.write(buildLotIssue(lot.lotId, lotPrinter?.printerName ?? null));
    // 쓰기·인쇄 함수는 렌더마다 달라진다. 적용 LOT과 서버 이력 변화만 한 번 처리한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    appliedLotId,
    currentIssue?.documentIssueLogId,
    currentLot.data?.lotId,
    lotIssues.data,
    lotPrinter?.printerName,
  ]);

  useEffect(() => {
    if (lotPrint.state.phase === 'succeeded') {
      setOutputPhase(hasAppliedResult ? 'scanReady' : 'legacyMismatch');
    }
    if (lotPrint.state.phase === 'renditionFailed') {
      setOutputPhase('renditionFailed');
    }
    if (lotPrint.state.phase === 'printFailed' || lotPrint.state.phase === 'shellUnavailable') {
      setOutputPhase('printFailed');
    }
    if (lotPrint.state.phase === 'reportFailed') {
      setOutputPhase('reportFailed');
    }
  }, [hasAppliedResult, lotPrint.state.phase]);

  useEffect(() => {
    if (lotIssue.error !== null && outputPhase === 'issuing') setOutputPhase('issueFailed');
  }, [lotIssue.error, outputPhase]);

  useEffect(() => {
    if (complete.error !== null && outputPhase === 'completing') {
      setScanValue('');
      setOutputPhase('scanReady');
    }
  }, [complete.error, outputPhase]);

  useEffect(() => {
    if (outbox.rejection !== null && outputPhase === 'queued') setOutputPhase('idle');
  }, [outbox.rejection, outputPhase]);

  useEffect(() => {
    const lot = currentLot.data;
    const nextLotId = lot?.lotId ?? null;
    if (currentLotIdRef.current === nextLotId) return;

    currentLotIdRef.current = nextLotId;
    setActualQty(
      lot === null || lot === undefined ? '' : String(appliedGoodQty(lot) ?? lot.initialQty),
    );
    setOutputPhase('idle');
    setScanValue('');
    setScanMismatch(false);
    setLotPrintTargets([]);
    setTagPrintTargets([]);
    setPendingTagIssue(null);
    setSelectedTagIds([]);
    setIsTagReissueOpen(false);
    setTagReissueReason(null);
    setPendingSerialQuantity(0);
    setPendingTagDocuments([]);
    setConfirmedResultLotId((confirmedLotId) =>
      confirmedLotId === nextLotId ? confirmedLotId : null,
    );
  }, [currentLot.data]);

  useEffect(() => {
    if (lot === null || lotIssues.data === undefined || outputPhase !== 'idle') return;

    if (serverAppliedQty === null) {
      if (currentIssue !== null) setOutputPhase('legacyMismatch');
      return;
    }

    setActualQty(String(serverAppliedQty));
    if (currentIssue?.printOutcome === 'SUCCEEDED') {
      setOutputPhase('scanReady');
    } else if (currentIssue === null) {
      setOutputPhase('issueFailed');
    } else {
      setOutputPhase('printFailed');
    }
  }, [currentIssue, lot, lotIssues.data, outputPhase, serverAppliedQty]);

  useEffect(() => {
    if (
      tagPrint.state.phase !== 'succeeded' &&
      tagPrint.state.phase !== 'renditionFailed' &&
      tagPrint.state.phase !== 'printFailed' &&
      tagPrint.state.phase !== 'reportFailed'
    ) {
      return;
    }

    void queryClient.invalidateQueries({
      queryKey: ['production-flow', 'tag-issue-summary'],
    });

    if (tagPrint.state.phase !== 'succeeded') return;

    const [nextDocument, ...remainingDocuments] = pendingTagDocuments;
    if (nextDocument !== undefined) {
      setPendingTagDocuments(remainingDocuments);
      setPendingTagIssue(nextDocument);
      tagPrint.reset();
      tagDocumentIssue.write(nextDocument);
      return;
    }

    const nextSerialBatch = nextBatchCount(pendingSerialQuantity);
    if (nextSerialBatch !== null && lot !== null) {
      setPendingSerialQuantity(nextSerialBatch.remaining);
      tagPrint.reset();
      serialIssue.write({ lotId: lot.lotId, quantity: nextSerialBatch.quantity });
    }
    // 쓰기 함수는 렌더마다 달라진다. 인쇄 상태와 대기열 변화만 이어서 처리한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tagPrint.state.phase, pendingTagDocuments, pendingSerialQuantity, lot?.lotId]);

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
  const printedSerials = serialItems.filter((serial) =>
    hasSucceededIdentificationPrint(summaryBySerialId.get(serial.serialNumberId)),
  );
  const unissuedSerials = serialItems.filter(
    (serial) => summaryBySerialId.get(serial.serialNumberId)?.issueCount === 0,
  );
  const retryableSerials = issuedSerials.filter(
    (serial) => !hasSucceededIdentificationPrint(summaryBySerialId.get(serial.serialNumberId)),
  );
  const hasCompleteTagSummary =
    isTagTarget !== true ||
    (tagIssueSummary.data !== undefined &&
      serialCount === serialItems.length &&
      serialItems.every((serial) => summaryBySerialId.has(serial.serialNumberId)));
  const hasTagDocuments =
    isTagTarget !== true || (hasCompleteTagSummary && printedSerials.length === serialItems.length);
  const isQuantityLocked =
    outputPhase !== 'idle' ||
    hasAppliedResult ||
    (lot !== null && outbox.isPendingForLot(lot.lotId));
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
    lotPrinter !== null &&
    lotPrint.isShellAvailable &&
    outputPhase === 'idle' &&
    !outbox.isPendingForLot(lot.lotId) &&
    currentIssue === null &&
    !hasAppliedResult;

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
      gates.print !== 'allowed' ||
      tagPrinter === null
    ) {
      return;
    }

    const first = nextBatchCount(tagMissing);
    if (first === null) return;

    setPendingSerialQuantity(first.remaining);
    setPendingTagDocuments([]);
    tagPrint.reset();
    tagDocumentIssue.reset();
    serialIssue.write({ lotId: lot.lotId, quantity: first.quantity });
  };

  const retryLotIssue = (): void => {
    if (lot === null || entry.workerNo === null) return;

    lotIssue.write(buildLotIssue(lot.lotId, lotPrinter?.printerName ?? null));
    setOutputPhase('issuing');
  };

  const retryTagDocumentIssue = (): void => {
    if (pendingTagIssue === null || entry.workerNo === null) return;

    tagDocumentIssue.write(pendingTagIssue);
  };

  const restoreTagDocuments = (): void => {
    if (unissuedSerials.length === 0 || entry.workerNo === null || tagPrinter === null) return;

    const [first, ...rest] = chunkTargets(unissuedSerials).map((serialBatch) =>
      buildTagIssue(serialBatch, { printerName: tagPrinter.printerName }),
    );
    if (first === undefined) return;

    setPendingTagDocuments(rest);
    setPendingTagIssue(first);
    tagDocumentIssue.write(first);
  };

  const reissueTags = (): void => {
    if (tagReissueReason === null || entry.workerNo === null || selectedTagIds.length === 0) return;

    const selected = issuedSerials.filter((serial) =>
      selectedTagIds.includes(serial.serialNumberId),
    );
    if (selected.length === 0) return;

    if (tagPrinter === null) return;

    const [first, ...rest] = chunkTargets(selected).map((serialBatch) =>
      buildTagIssue(serialBatch, {
        reissueReasonCode: tagReissueReason,
        printerName: tagPrinter.printerName,
      }),
    );
    if (first === undefined) return;

    setPendingTagDocuments(rest);
    setPendingTagIssue(first);
    tagDocumentIssue.write(first);
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
      case 'renditionFailed':
        return t.flow.output.renditionFailed;
      case 'printFailed':
        return lotPrint.state.phase === 'shellUnavailable'
          ? t.flow.output.shellUnavailable
          : t.flow.output.printFailed;
      case 'reportFailed':
        return t.flow.output.reportFailed;
      case 'legacyMismatch':
        return t.flow.output.legacyMismatch;
      case 'completing':
        return t.flow.scan.completing;
      case 'completed':
        return t.flow.scan.completed;
      case 'idle':
        return null;
    }
  })();

  const uomLabel = uom.labelOf(lot?.uomId ?? workOrder.data?.uomId) ?? '';
  const completedBoundary = completedLotPageBoundary(completedLots.data?.page);

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
          {/*
           * 프린터 — **머리에 상시 보인다**(사용자 지시 2026-09-10). 라벨이 나오지 않을 때
           * 작업자가 가장 먼저 보는 곳이고, 없으면 「등록이 안 됐다」로 오해한다. 자매 화면
           * (`P-01-01`)이 같은 자리에 같은 모양으로 세운다.
           *
           * ⛔ **조회 중에는 아무것도 단정하지 않는다** — 「없음」이 잠깐 스치면 그 사이에
           *    오해가 생긴다. 없는 것과 못 받은 것을 같은 모양으로 그리지 않는다(G-9).
           */}
          {lotPrinters.isPending ? null : (
            <Chip status={lotPrinter === null ? 'warning' : 'success'}>
              {`${t.flow.output.printer} ${lotPrinter?.displayName ?? t.flow.output.printerUnknown}`}
            </Chip>
          )}
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

      <div
        className={`production-flow-grid pop-fixed${
          isTagTarget === false ? ' production-flow-grid-no-tags' : ''
        }`}
      >
        <Card bordered className="pop-section production-flow-progress">
          <Card.Body>
            <div className="production-flow-section-head">
              <h2 className="pane-title">{t.flow.currentLot.title}</h2>
              <Button
                variant="outlined"
                onClick={() => {
                  setCompletedPage(1);
                  setIsCompletedOpen(true);
                }}
              >
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
              {/*
               * ⭐ **잔여수량을 세운다**(스펙 §3-2 「잔여수량 380 / 500」). 초과를 확인으로
               *    되묻는 화면인데 잔여가 보이지 않으면, 묻는 순간에야 처음 그 수를 본다.
               * ⚠ 받지 못했으면 **「확인할 수 없습니다」로 적는다** — 0 으로 그리면 잔여가
               *    없다는 뜻이 되어, 모든 입력이 초과로 보인다.
               */}
              <div>
                <dt>{t.quantity.remaining}</dt>
                <dd>
                  {remaining === null
                    ? t.quantity.remainingUnknown
                    : `${formatQty(remaining)} ${t.quantity.orderedSuffix(
                        formatQty(workOrder.data?.orderQty ?? 0),
                        uomLabel === '' ? null : uomLabel,
                      )}`}
                </dd>
              </div>
            </dl>
            <TextField
              id={actualQtyId}
              label={t.flow.quantity.actual}
              value={actualQty}
              disabled={isQuantityLocked}
              inputMode="decimal"
              trailingIcon={uomLabel}
              error={parsedQty === null || parsedQty <= 0 ? t.flow.quantity.invalid : undefined}
              onChange={(event) => setActualQty(quantityInput(event.target.value))}
            />
            <NumericKeypad
              value={actualQty}
              /* 수를 받는 칸이다 — 앞자리 0 을 쌓지 않는다(사번 칸은 켜지 않는다). */
              dropLeadingZero
              disabled={isQuantityLocked}
              label={t.quantity.keypadLabel}
              backspaceLabel={t.quantity.backspace}
              clearLabel={t.quantity.clearGlyph}
              maxLength={GOOD_QTY_MAX_LENGTH}
              /*
               * ⛔ **정수 단위에는 소수점 키를 세우지 않는다**(사용자 지시 2026-09-10). 「개(EA)」에
               *    소수를 주면 넣을 수 없는 값을 넣게 되고, 실적은 되돌릴 수 없다. 무게 단위처럼
               *    계약이 소수를 허용하는 단위에서는 그대로 연다 — 자매 화면(`P-04-03`)이 같은
               *    규칙을 쓴다.
               */
              allowDecimal={uom.decimalScaleOf(lot?.uomId ?? workOrder.data?.uomId) > 0}
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
                    {issuedSerials.map((serial) => {
                      const summary = summaryBySerialId.get(serial.serialNumberId);
                      const outcome = summary?.lastPrintOutcome ?? 'PENDING';

                      return (
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
                          {`${serial.serialNo} · ${t.flow.tag.printOutcome[outcome]}`}
                        </Checkbox>
                      );
                    })}
                  </div>
                  {tagIssueSummary.isError && (
                    <p className="field-error">{t.flow.tag.summaryFailed}</p>
                  )}
                  {unissuedSerials.length > 0 && (
                    <Button
                      variant="outlined"
                      disabled={tagDocumentIssue.isSaving || tagPrinter === null}
                      onClick={restoreTagDocuments}
                    >
                      {t.flow.tag.restoreDocuments(unissuedSerials.length)}
                    </Button>
                  )}
                  {parsedQty !== null && serialCount !== null && serialCount > parsedQty && (
                    <p className="field-error">{t.flow.tag.tooMany}</p>
                  )}
                  {tagMissing === 0 && <p className="field-note">{t.flow.tag.matched}</p>}
                  {retryableSerials.length > 0 && (
                    <p className="field-error">
                      {t.flow.tag.printIncomplete(retryableSerials.length)}
                    </p>
                  )}
                  <Button
                    disabled={
                      tagMissing === null ||
                      tagMissing <= 0 ||
                      !Number.isInteger(tagMissing) ||
                      gates.print !== 'allowed' ||
                      entry.workerNo === null ||
                      serialIssue.isSaving ||
                      tagDocumentIssue.isSaving ||
                      tagPrint.state.phase === 'sending' ||
                      tagPrinter === null
                    }
                    onClick={issueTags}
                  >
                    {tagMissing === null ? t.flow.tag.title : t.flow.tag.issueMissing(tagMissing)}
                  </Button>
                  {(tagPrint.state.phase === 'renditionFailed' ||
                    tagPrint.state.phase === 'printFailed') &&
                    tagPrintTargets.length > 0 && (
                      <Button variant="outlined" onClick={() => void tagPrint.run(tagPrintTargets)}>
                        {t.flow.output.retryPrint}
                      </Button>
                    )}
                  {tagPrint.state.phase === 'reportFailed' && (
                    <>
                      <p className="field-error">{t.flow.tag.reportFailed}</p>
                      <Button variant="outlined" onClick={() => void tagPrint.retryReport()}>
                        {t.flow.output.retryReport}
                      </Button>
                    </>
                  )}
                  {issuedSerials.length > 0 && (
                    <Button
                      variant="outlined"
                      disabled={selectedTagIds.length === 0 || tagPrinter === null}
                      onClick={() => setIsTagReissueOpen(true)}
                    >
                      {t.flow.tag.reissue}
                    </Button>
                  )}
                  {tagPrinter === null && !tagPrinters.isPending && (
                    <p className="field-error">{t.flow.tag.printerUnavailable}</p>
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
                <dd>{lotPrinter?.displayName ?? t.flow.output.printerUnknown}</dd>
              </div>
            </dl>

            {outputPhase === 'legacyMismatch' ? (
              <Button disabled>{t.flow.output.mismatchBlocked}</Button>
            ) : outputPhase === 'issueFailed' ? (
              <Button onClick={retryLotIssue}>{t.flow.output.retryIssue}</Button>
            ) : outputPhase === 'reportFailed' ? (
              <Button onClick={() => void lotPrint.retryReport()}>
                {t.flow.output.retryReport}
              </Button>
            ) : outputPhase === 'renditionFailed' ||
              outputPhase === 'printFailed' ||
              (outputPhase === 'idle' && currentIssue !== null) ? (
              <Button onClick={retryLotPrint}>{t.flow.output.retryPrint}</Button>
            ) : (
              <Button
                disabled={!canOutput}
                /*
                 * ⛔ **초과라고 단추를 끄지 않는다** — 초과 생산은 허용이고(✓확정 QA #27),
                 *    화면이 하는 일은 한 번 확인받는 것이다(스펙 §6). 끄면 현장이 초과분을
                 *    등록할 길이 없어진다.
                 */
                onClick={() => {
                  if (isOverrun) {
                    setIsOverrunOpen(true);
                    return;
                  }

                  queueOutput();
                }}
              >
                {t.flow.output.issue}
              </Button>
            )}

            {/*
             * 저장·발행·인쇄가 어떻게 됐는지는 **[생산 라벨 출력] 바로 아래에서 말한다**
             * (사용자 지시 2026-09-10). 누른 자리와 그 답이 한 자리에 모인다 — 화면 맨 위
             * 띠에 두었더니 눌러 놓고 눈이 위로 올라갔다.
             *
             * 두 소식이 같은 자리에 선다: 실적 저장이 먼저이고 발행·인쇄가 그다음이다.
             */}
            {outbox.rejection !== null && (
              <div className="banner-slot">
                <AlertBanner variant="error" title={t.save.failTitle} />
              </div>
            )}

            {outputStatus !== null && (
              <div className="banner-slot">
                <AlertBanner
                  variant={
                    outputPhase === 'issueFailed' ||
                    outputPhase === 'renditionFailed' ||
                    outputPhase === 'printFailed' ||
                    outputPhase === 'reportFailed' ||
                    outputPhase === 'legacyMismatch'
                      ? 'error'
                      : 'info'
                  }
                  title={outputStatus}
                />
              </div>
            )}

            {lotPrinter === null && !lotPrinters.isPending && (
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
              /*
               * ⭐ **칸이 구획 폭을 다 쓴다**(사용자 지시 2026-09-10). LOT 번호는 서른 자리를
               * 넘길 수 있어, 기본 폭에서는 읽은 값이 칸 밖으로 밀려 눈으로 대조할 수 없다.
               */
              fullWidth
              value={scanValue}
              disabled={outputPhase !== 'scanReady' || gates.complete !== 'allowed'}
              error={scanMismatch && lot !== null ? t.flow.scan.mismatch : undefined}
              onChange={(event) => changeScan(event.target.value)}
            />
            {/*
             * ⚠ **한 번에 한 줄만 낸다**(사용자 지시 2026-09-10). 스캔이 어긋난 것과 마감이
             * 실패한 것이 함께 서면, 다음에 무엇을 해야 하는지가 두 문장으로 갈린다. 어긋남은
             * 칸이 이미 말하고 있으므로 마감 실패는 그때만 선다.
             */}
            {complete.error !== null && !scanMismatch && (
              <p className="field-error">{t.flow.scan.failed}</p>
            )}
          </Card.Body>
        </Card>
      </div>

      <Dialog
        open={isCompletedOpen}
        onClose={() => setIsCompletedOpen(false)}
        title={t.flow.currentLot.completedTitle}
        /* ⛔ 바닥의 [닫기]와 같은 일을 하므로 X 를 두지 않는다 — 나가는 길은 하나다. */
        showCloseButton={false}
        /*
         * ⛔ **팝업 바깥을 눌러 닫히지 않는다**(사용자 지시 2026-09-10 · #1005). 터치 단말에서
         *    팝업은 화면 대부분을 덮어 손이 스치기 쉽고, 스크림 클릭이 닫기로 이어지면
         *    「누른 적 없는데 닫힌다」가 된다. 닫는 길은 아래 [닫기] 단추다.
         */
        closeOnBackdropClick={false}
        footer={
          <Button variant="outlined" onClick={() => setIsCompletedOpen(false)}>
            {t.flow.close}
          </Button>
        }
      >
        {completedLots.data === undefined || completedLots.data.items.length === 0 ? (
          <p>{t.flow.currentLot.completedEmpty}</p>
        ) : (
          <>
            <ol className="production-flow-completed-lots">
              {completedLots.data.items.map((completedLot) => (
                <li key={completedLot.lotId}>{completedLot.lotNo}</li>
              ))}
            </ol>
            <nav className="production-flow-completed-pages" aria-label={t.flow.currentLot.pageNav}>
              <Button
                variant="outlined"
                disabled={!completedBoundary.canPageUp}
                onClick={() => setCompletedPage(Math.max(1, completedBoundary.page - 1))}
              >
                {t.flow.currentLot.pageUp}
              </Button>
              <p className="field-note">
                {t.flow.currentLot.pagePosition(
                  completedBoundary.page,
                  completedBoundary.totalPages,
                )}
              </p>
              <Button
                variant="outlined"
                disabled={!completedBoundary.canPageDown}
                onClick={() => setCompletedPage(completedBoundary.page + 1)}
              >
                {t.flow.currentLot.pageDown}
              </Button>
            </nav>
          </>
        )}
      </Dialog>

      {/*
       * 초과 확인 — **막는 팝업이 아니라 되묻는 팝업이다**(스펙 §6 · ✓확정 QA #27 「초과 달성」).
       * [초과로 저장] 이 그대로 저장·발행으로 이어지고, [수량 고치기] 는 수량 칸으로 돌아간다.
       */}
      <Dialog
        open={isOverrunOpen}
        onClose={() => setIsOverrunOpen(false)}
        title={t.overrun.title}
        /* ⛔ 나가는 길은 아래 두 단추다 — 다른 팝업과 같은 규칙이다(#1005). */
        showCloseButton={false}
        closeOnBackdropClick={false}
        footer={
          <>
            <Button variant="outlined" onClick={() => setIsOverrunOpen(false)}>
              {t.overrun.cancel}
            </Button>
            <Button
              onClick={() => {
                setIsOverrunOpen(false);
                queueOutput();
              }}
            >
              {t.overrun.confirm}
            </Button>
          </>
        }
      >
        <p>
          {t.overrun.body(
            `${actualQty} ${uomLabel}`.trim(),
            remaining === null ? '—' : `${formatQty(remaining)} ${uomLabel}`.trim(),
          )}
        </p>
      </Dialog>

      <Dialog
        open={isTagReissueOpen}
        onClose={() => setIsTagReissueOpen(false)}
        title={t.flow.tag.reissueReason}
        /* ⛔ 바닥의 [닫기]와 같은 일을 하므로 X 를 두지 않는다 — 나가는 길은 하나다. */
        showCloseButton={false}
        /*
         * ⛔ **팝업 바깥을 눌러 닫히지 않는다**(사용자 지시 2026-09-10 · #1005). 터치 단말에서
         *    팝업은 화면 대부분을 덮어 손이 스치기 쉽고, 스크림 클릭이 닫기로 이어지면
         *    「누른 적 없는데 닫힌다」가 된다. 닫는 길은 아래 [닫기] 단추다.
         */
        closeOnBackdropClick={false}
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
