import { AlertBanner, Button, Card, Chip, Tooltip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useRef, useState } from 'react';

import { soleProcessIdOf, usePopIdentity } from '../../patterns/pop-identity';
import { PopWorkerTag } from '../../patterns/pop-worker-tag';
import { useIsOnline } from './connection';
import { useRepackLabelEntry } from './entry-context';
import { ErrorBanner } from './error-banner';
import { HandlingUnitPane } from './handling-unit-pane';
import { HistoryPane } from './history-pane';
import { IssuePane } from './issue-pane';
import { issueBody } from './issue-body';
import { useDocumentIssue } from './mutations';
import { PendingPane } from './pending-pane';
import { PreviewDialog } from './preview-dialog';
import {
  useContentRows,
  useHandlingUnit,
  useIssueHistory,
  useIssueStanding,
  isPendingListUnsupported,
  usePendingRepackRows,
  usePrinters,
  useHandlingUnitTypes,
  useReissueReasons,
  useRemainderCandidates,
} from './queries';
import { useTerminalGate } from './terminal-gating';
import {
  needsReason,
  PRINT_FAILURE_REASON_CODE,
  type DocumentIssue,
  type DocumentIssueCreate,
  type IssueStanding,
  type Printer,
} from './types';
import { useIssuePrintRunner, type IssuePrintTarget } from './use-issue-print';

const t = messages.repackLabelIssue;

const UNKNOWN_STANDING: IssueStanding = {
  issueCount: null,
  lastIssuedAt: null,
  lastPrintOutcome: null,
};

const defaultPrinter = (printers: readonly Printer[]): Printer | null =>
  printers.find((printer) => printer.isDefault) ?? printers[0] ?? null;

/**
 * P-04-04 재구성 신규 라벨 발행.
 *
 * 발행 대기는 계약의 `labelIssued=false` 결과이고, 신규 번호는 그 HandlingUnit의 서버 발번값을
 * 그대로 보인다. 화면은 번호를 조립하거나 별도 생성 API를 추측하지 않는다. 분할 잔량은 같은
 * SPLIT 사건의 기존 RESULT 중 발행 이력이 있는 포장만 선택 재출력 대상으로 둔다.
 */
export const RepackLabelIssueScreen = () => {
  const titleId = useId();
  const entry = useRepackLabelEntry();
  const identity = usePopIdentity();
  const gate = useTerminalGate(identity.terminalId, soleProcessIdOf(identity.processes));
  const isOnline = useIsOnline();

  const [selectedHandlingUnitId, setSelectedHandlingUnitId] = useState<number | null>(null);
  const [includeNewLabel, setIncludeNewLabel] = useState(true);
  const [selectedRemainderIds, setSelectedRemainderIds] = useState<number[]>([]);
  const [reasonCode, setReasonCode] = useState('');
  const [pickedPrinter, setPickedPrinter] = useState('');
  const [printQueue, setPrintQueue] = useState<IssuePrintTarget[]>([]);
  const [lastIssueBody, setLastIssueBody] = useState<DocumentIssueCreate | null>(null);
  /** 한 배치의 앞 라벨이 실패해 재발행해도 뒤 라벨 순서를 잃지 않는다. */
  const queueAfterRetry = useRef<IssuePrintTarget[]>([]);

  const pending = usePendingRepackRows();
  const handlingUnit = useHandlingUnit(selectedHandlingUnitId);
  const contents = useContentRows(handlingUnit.data?.contents ?? []);
  const standingQuery = useIssueStanding(selectedHandlingUnitId);
  const history = useIssueHistory(selectedHandlingUnitId);
  const remainder = useRemainderCandidates(selectedHandlingUnitId);
  const printers = usePrinters();
  const reasons = useReissueReasons();
  /* 《대상 포장》의 유형 칸이 코드가 아니라 표시명으로 서게 한다(#1045). */
  const handlingUnitTypes = useHandlingUnitTypes();
  const printRunner = useIssuePrintRunner(entry.workerNo);

  const standing = standingQuery.data ?? UNKNOWN_STANDING;
  const printerList = printers.data ?? [];
  const printerName =
    pickedPrinter !== '' ? pickedPrinter : (defaultPrinter(printerList)?.printerName ?? '');

  const issue = useDocumentIssue({
    workerNo: entry.workerNo ?? '',
    onSuccess: (result) => {
      const targets = result.items.map<IssuePrintTarget>((issued) => ({
        documentIssueLogId: issued.documentIssueLogId,
        targetId: issued.target.targetId,
        label: issued.target.displayName,
      }));
      const [first, ...rest] = targets;

      setPrintQueue([...rest, ...queueAfterRetry.current]);
      queueAfterRetry.current = [];
      if (first !== undefined) void printRunner.begin(first);
    },
  });

  /* 여러 대상을 한 트랜잭션으로 발행한 뒤에는 각 렌디션을 한 장씩 확인·인쇄한다. */
  useEffect(() => {
    if (printRunner.state.phase !== 'succeeded') return;

    const [next, ...rest] = printQueue;
    if (next === undefined) return;

    setPrintQueue(rest);
    void printRunner.begin(next);
  }, [printQueue, printRunner]);

  const selectedIds = [
    ...(selectedHandlingUnitId !== null && includeNewLabel ? [selectedHandlingUnitId] : []),
    ...selectedRemainderIds,
  ];
  const reasonRequired =
    selectedRemainderIds.length > 0 ||
    needsReason(standing) ||
    issue.fieldErrors.reissueReasonCode !== undefined;

  const phase = printRunner.state.phase;
  const isSubmitting = issue.isSaving || phase === 'fetching' || phase === 'printing';

  const blockedReason = ((): string | null => {
    if (selectedHandlingUnitId === null) return t.entry.missingHandlingUnit;
    if (standingQuery.isPending) return t.issue.summaryLoading;
    if (standingQuery.isError) return t.issue.summaryFailed;
    if (selectedIds.length === 0) return t.issue.targetRequired;
    if (entry.workerNo === null) return t.entry.missingWorker;
    if (gate.verdict !== 'allowed') return t.gate[gate.verdict];
    if (!isOnline) return t.gate.offline;

    return null;
  })();

  const submit = (): void => {
    if (entry.workerNo === null || selectedIds.length === 0) return;
    if (reasonRequired && reasonCode === '') return;

    printRunner.reset();
    setPrintQueue([]);
    queueAfterRetry.current = [];
    const body = issueBody({
      handlingUnitIds: selectedIds,
      printerName,
      reasonCode,
      reasonRequired,
    });
    setLastIssueBody(body);
    issue.write(body);
  };

  const retryFailedPrint = (): void => {
    const target = printRunner.state.target;

    if (target === null || entry.workerNo === null) return;

    queueAfterRetry.current = printQueue;
    printRunner.reset();
    setPrintQueue([]);
    const body = issueBody({
      handlingUnitIds: [target.targetId],
      printerName,
      reasonCode: PRINT_FAILURE_REASON_CODE,
      reasonRequired: true,
    });
    setLastIssueBody(body);
    issue.write(body);
  };

  const selectHandlingUnit = (handlingUnitId: number): void => {
    setSelectedHandlingUnitId(handlingUnitId);
    setIncludeNewLabel(true);
    setSelectedRemainderIds([]);
    setReasonCode('');
    setPrintQueue([]);
    setLastIssueBody(null);
    queueAfterRetry.current = [];
    printRunner.reset();
    issue.reset();
    issue.discardIdempotencyKey();
  };

  const toggleRemainder = (handlingUnitId: number, checked: boolean): void => {
    setSelectedRemainderIds((current) =>
      checked
        ? [...new Set([...current, handlingUnitId])]
        : current.filter((id) => id !== handlingUnitId),
    );
  };

  const latestIssue = (history.data ?? []).reduce<DocumentIssue | null>(
    (latest, item) => (latest === null || item.issueSeq > latest.issueSeq ? item : latest),
    null,
  );

  const openPreview = (): void => {
    const target =
      printRunner.state.target ??
      (latestIssue === null
        ? null
        : {
            documentIssueLogId: latestIssue.documentIssueLogId,
            targetId: latestIssue.target.targetId,
            label: latestIssue.target.displayName,
          });

    if (target !== null) void printRunner.begin(target);
  };

  const canPreview = isOnline && (latestIssue !== null || printRunner.state.target !== null);
  const isBlocked = blockedReason !== null || isSubmitting || (reasonRequired && reasonCode === '');

  return (
    <main className="pop-shell pop-ui" aria-labelledby={titleId}>
      <header className="pop-header">
        <h1 id={titleId} className="pop-title">
          {t.title}
        </h1>
        <div className="pop-context-right">
          <PopWorkerTag workerNo={entry.workerNo} />
          <Chip status={isOnline ? 'success' : 'error'}>
            {isOnline ? t.device.online : t.device.offline}
          </Chip>
        </div>
      </header>

      {issue.error !== null && lastIssueBody !== null && (
        <ErrorBanner
          error={issue.error}
          title={t.error.issueTitle}
          onRetry={() => issue.write(lastIssueBody)}
        />
      )}

      {phase === 'renditionFailed' && (
        <div className="banner-slot">
          <AlertBanner
            variant="error"
            title={t.preview.failed}
            action={
              <Button variant="outlined" size="sm" onClick={openPreview}>
                {messages.common.retry}
              </Button>
            }
          >
            {t.print.failedBody}
          </AlertBanner>
        </div>
      )}

      {phase === 'shellUnavailable' && (
        <div className="banner-slot">
          <AlertBanner variant="info" title={t.print.issued}>
            {t.print.shellUnavailable}
          </AlertBanner>
        </div>
      )}

      {phase === 'failed' && (
        <div className="banner-slot">
          <AlertBanner
            variant="error"
            title={t.print.failedTitle}
            action={
              /*
               * ⛔ **눌러도 안 되면 비활성으로 보인다**(#1093 · 사용자 지시). 처리기가 대상 ·
               *    사번 없이는 조용히 되돌아온다.
               */
              <Button
                variant="outlined"
                size="sm"
                disabled={printRunner.state.target === null || entry.workerNo === null}
                onClick={retryFailedPrint}
              >
                {t.print.retry}
              </Button>
            }
          >
            {t.print.failedBody}
          </AlertBanner>
        </div>
      )}

      {phase === 'reportFailed' && (
        <div className="banner-slot">
          <AlertBanner
            variant="warning"
            title={t.print.reportFailedTitle}
            action={
              <Button
                variant="outlined"
                size="sm"
                onClick={() => {
                  void printRunner.retryReport();
                }}
              >
                {t.print.reportRetry}
              </Button>
            }
          >
            {t.print.reportFailedBody}
          </AlertBanner>
        </div>
      )}

      {phase === 'succeeded' && printQueue.length === 0 && (
        <div className="banner-slot">
          <AlertBanner variant="success" title={t.print.issued}>
            {t.print.succeeded}
          </AlertBanner>
        </div>
      )}

      {/* 이 화면이 세 카드의 세로 예산을 직접 나눈다. 공통 자식 min-height:0 대상에서 뺀다. */}
      <div className="pop-repack-panes pop-fixed">
        <Card
          bordered
          className="pop-section pop-repack-pending"
          aria-label={t.pending.sectionLabel}
        >
          <h2 className="pane-title">{t.pending.sectionLabel}</h2>
          <PendingPane
            rows={pending.data ?? []}
            selectedId={selectedHandlingUnitId}
            isLoading={pending.isPending}
            isError={pending.isError}
            isUnsupported={isPendingListUnsupported()}
            disabled={isSubmitting}
            onSelect={selectHandlingUnit}
            onRetry={() => {
              void pending.refetch();
            }}
          />
        </Card>

        <Card
          bordered
          className="pop-section pop-repack-numbering"
          aria-label={t.handlingUnit.sectionLabel}
        >
          <h2 className="pane-title">{t.handlingUnit.sectionLabel}</h2>
          {selectedHandlingUnitId === null ? (
            <p className="pop-empty-note">{t.entry.missingHandlingUnit}</p>
          ) : handlingUnit.data === undefined ? (
            <p className="pop-empty-note">
              {handlingUnit.isError ? t.handlingUnit.loadFailed : t.handlingUnit.loading}
            </p>
          ) : (
            <HandlingUnitPane
              handlingUnit={handlingUnit.data.handlingUnit}
              rows={contents.rows}
              namesFailed={contents.isNameError}
              types={{
                entries: (handlingUnitTypes.data ?? []).map((value) => ({
                  value: value.code,
                  label: value.codeName,
                  isActive: value.isActive,
                })),
                isError: handlingUnitTypes.isError,
                isLoading: handlingUnitTypes.isPending,
              }}
            />
          )}
        </Card>

        <Card bordered className="pop-section pop-repack-issue" aria-label={t.issue.sectionLabel}>
          <div className="pane-title pop-repack-head">
            <h2 className="pop-repack-head-name">{t.issue.sectionLabel}</h2>
            {/*
             * ⛔ **처음 발행이라는 말을 적지 않는다**(사용자 지시 2026-09-11). 라벨이 없는
             *    포장을 골라 들어온 자리라 「처음」이 기본값이고, 기본값을 적어 두면 정작
             *    달라진 것(재발행 n회)이 그 자리에 묻힌다.
             */}
            {standingQuery.data !== undefined && (standing.issueCount ?? 0) > 0 && (
              <span className="pop-repack-standing">
                {t.issue.reissue(standing.issueCount ?? 0)}
              </span>
            )}
          </div>
          <IssuePane
            selectedHandlingUnitNo={handlingUnit.data?.handlingUnit.handlingUnitNo ?? null}
            includeNewLabel={includeNewLabel}
            onIncludeNewLabelChange={setIncludeNewLabel}
            remainderCandidates={remainder.data ?? []}
            selectedRemainderIds={selectedRemainderIds}
            onRemainderChange={toggleRemainder}
            remainderFailed={remainder.isError}
            standing={standing}
            standingFailed={standingQuery.isError}
            onStandingRetry={() => {
              void standingQuery.refetch();
            }}
            reasons={reasons.data ?? []}
            reasonsFailed={reasons.isError}
            reasonCode={reasonCode}
            onReasonChange={setReasonCode}
            reasonRequired={reasonRequired}
            reasonServerError={issue.fieldErrors.reissueReasonCode ?? null}
            printers={printerList}
            printersFailed={printers.isError}
            printerName={printerName}
            onPrinterChange={setPickedPrinter}
          />

          <h2 className="pane-title">{t.history.sectionLabel}</h2>
          <HistoryPane issues={history.data ?? []} isFailed={history.isError} />
        </Card>
      </div>

      <div className="pop-action-bar pop-repack-actions">
        {/*
         * ⛔ **《대상 포장》 구획이 이미 말하고 있는 사유는 여기서 되풀이하지 않는다**
         *    (사용자 지적 2026-09-12). 「발행 대기 목록에서 대상 포장을 선택하세요」가 구획
         *    한가운데와 이 줄에 동시에 서 있었다 — 들어오자마자 같은 문장이 둘이라, 정작
         *    다른 사유(회차 조회 실패·단말 권한·오프라인)가 떴을 때 그 자리가 늘 차 있던
         *    자리로 읽힌다.
         *
         * ⚠ 잠그는 것과 말하는 것은 다른 축이다 — [발번·인쇄]는 그대로 잠긴다.
         */}
        {blockedReason !== null && blockedReason !== t.entry.missingHandlingUnit && (
          <p className="pop-repack-blocked" role="status">
            {blockedReason}
            {gate.verdict === 'unavailable' && (
              <Button variant="outlined" size="sm" onClick={gate.retry}>
                {t.issue.gateRetry}
              </Button>
            )}
          </p>
        )}

        {canPreview ? (
          <Button variant="outlined" onClick={openPreview}>
            {t.issue.preview}
          </Button>
        ) : (
          <Tooltip content={t.issue.previewBeforeIssue}>
            <Button variant="outlined" disabled>
              {t.issue.preview}
            </Button>
          </Tooltip>
        )}

        <Button variant="filled" onClick={submit} loading={isSubmitting} disabled={isBlocked}>
          {t.issue.submit}
        </Button>
      </div>

      <PreviewDialog
        open={phase === 'preview' || phase === 'printing'}
        imageUrl={printRunner.state.imageUrl}
        isPrinting={phase === 'printing'}
        onPrint={() => {
          void printRunner.print();
        }}
        onClose={printRunner.dismiss}
      />
    </main>
  );
};
