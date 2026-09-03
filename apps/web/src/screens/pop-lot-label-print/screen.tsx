import { AlertBanner, Button, Card } from '@crefle/web-ui';
import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useCallback, useId, useMemo, useState } from 'react';

import { usePopIdentity } from '../../patterns/pop-identity';
import { useLotLabelEntry } from './entry-context';
import { buildIssueRequest, guardIssue, judgeReissue } from './issue-request';
import { LotTable } from './lot-table';
import { useDocumentIssue } from './mutations';
import { renditionShell } from './print';
import { PrinterStatusIndicator } from './printer-status';
import {
  toIssueCounts,
  useCompletedLots,
  useIssueSummaries,
  useItem,
  useLotDetail,
  usePrinters,
  useReissueReasons,
} from './queries';
import { ReissueDialog } from './reissue-dialog';
import { TargetCard } from './target-card';
import { toGuardGate, useTerminalGate } from './terminal-gating';
import { toHeadPrinter, toLotRows } from './types';
import { usePrintRunner } from './use-print';

const t = messages.popLotLabelPrint;

const describeIssueError = (error: ApiError): string => {
  if (error.kind === 'network') return messages.httpError.offline;
  if (error.kind === 'validation' || error.kind === 'stateLocked') {
    const detail = error.errors
      .map((item) => item.message)
      .filter(Boolean)
      .join(' ');
    return detail === '' ? messages.httpError.description : detail;
  }
  if (error.kind === 'http' && error.message !== undefined) return error.message;
  return messages.httpError.description;
};

/**
 * P-02-07 · LOT 라벨 출력·부착 (POP 1024×768 + Label Printer).
 *
 * 좌 완료 LOT 목록 / 우 대상 상세 + 조작 하나(스펙 §3).
 *
 * **발행과 인쇄가 갈린다**(§6 · K-4) — 발행 기록이 남은 뒤 인쇄가 실패해도 기록은 남고,
 * 그 사실이 곧 재출력으로 복구할 수 있다는 뜻이다. 화면은 두 결과를 **다른 배너로** 말한다.
 */
export const PopLotLabelPrintScreen = () => {
  const titleId = useId();
  const entry = useLotLabelEntry();
  const identity = usePopIdentity();
  const [selectedLotId, setSelectedLotId] = useState<number | null>(null);
  const [reissueOpen, setReissueOpen] = useState(false);

  const lots = useCompletedLots(entry.workOrderId);
  const printers = usePrinters();

  /* 회차는 목록이 온 뒤에 묻는다 — 대상 식별자가 있어야 물을 수 있다. */
  const lotIds = useMemo(() => (lots.data ?? []).map((lot) => lot.lotId), [lots.data]);
  const summaries = useIssueSummaries(lotIds);
  const counts = useMemo(() => toIssueCounts(summaries.data), [summaries.data]);
  const rows = useMemo(() => toLotRows(lots.data ?? [], counts), [lots.data, counts]);

  const detail = useLotDetail(selectedLotId);
  const item = useItem(detail.data?.itemId ?? null);

  const gate = useTerminalGate(identity.terminalId, identity.processId);
  const printRunner = usePrintRunner(entry.workerNo);

  const issueCount = selectedLotId === null ? null : (counts?.get(selectedLotId) ?? null);
  const verdict = judgeReissue(issueCount);
  const reissueReasons = useReissueReasons(reissueOpen);

  const headPrinter = toHeadPrinter(printers.data ?? []);
  const shellAvailable = renditionShell() !== null;

  /**
   * 발행이 끝나면 **곧바로 인쇄로 넘긴다** — 사용자는 「출력」을 한 번 눌렀다.
   * ⛔ 인쇄가 실패해도 발행을 되돌리지 않는다.
   */
  const issue = useDocumentIssue({
    workerNo: entry.workerNo ?? '',
    onSuccess: (result) => {
      setReissueOpen(false);
      void printRunner.run(
        result.items.map((row) => ({
          documentIssueLogId: row.documentIssueLogId,
          label: row.target.displayName,
        })),
      );
    },
  });

  const block = guardIssue({
    lotId: selectedLotId,
    workerNo: entry.workerNo,
    gate: toGuardGate(gate.verdict),
    printer:
      printers.isError || printers.isPending ? 'unknown' : headPrinter === null ? 'none' : 'ready',
    shellAvailable,
    verdict,
    /* 재발행 버튼은 사유 창을 여는 동작이다. 실제 쓰기는 submit에서 다시 검사한다. */
    reissueReasonCode: verdict === 'reissue' ? 'pending-selection' : null,
  });

  const submit = useCallback(
    (reissueReasonCode: string | null) => {
      if (selectedLotId === null) return;

      const submitBlock = guardIssue({
        lotId: selectedLotId,
        workerNo: entry.workerNo,
        gate: toGuardGate(gate.verdict),
        printer:
          printers.isError || printers.isPending
            ? 'unknown'
            : headPrinter === null
              ? 'none'
              : 'ready',
        shellAvailable,
        verdict,
        reissueReasonCode,
      });
      if (submitBlock !== null) return;

      issue.write(
        buildIssueRequest({
          lotId: selectedLotId,
          reissueReasonCode,
          printerName: headPrinter?.printerName ?? null,
        }),
      );
    },
    [
      entry.workerNo,
      gate.verdict,
      headPrinter,
      issue,
      printers.isError,
      printers.isPending,
      selectedLotId,
      shellAvailable,
      verdict,
    ],
  );

  return (
    <main className="pop-lot-screen" aria-labelledby={titleId}>
      <header className="pop-lot-head">
        <h1 id={titleId} className="pop-title">
          {t.title}
        </h1>
        {entry.workOrderId === null ? null : (
          <p className="pop-context">
            <span>{t.entry.workOrderLabel}</span>
            <span>{entry.workOrderId}</span>
          </p>
        )}
        <PrinterStatusIndicator
          printer={headPrinter}
          isLoading={printers.isPending}
          isError={printers.isError}
          onRetry={() => {
            void printers.refetch();
          }}
        />
      </header>

      {entry.workOrderId === null ? (
        <div className="banner-slot">
          <AlertBanner variant="warning" title={t.entry.workOrderMissing}>
            {t.entry.workOrderMissingHint}
          </AlertBanner>
        </div>
      ) : null}

      {issue.error !== null ? (
        <div className="banner-slot">
          <AlertBanner variant="error" title={t.action.issueFailed}>
            {describeIssueError(issue.error)}
          </AlertBanner>
        </div>
      ) : null}

      {/* 발행은 됐고 인쇄만 못 한 상태 — 「실패」로 뭉뚱그리지 않는다. */}
      {printRunner.state.phase === 'shellUnavailable' ? (
        <div className="banner-slot">
          <AlertBanner variant="warning" title={t.print.shellUnavailableTitle}>
            {t.print.shellUnavailableBody}
          </AlertBanner>
        </div>
      ) : null}

      {printRunner.state.phase === 'failed' ? (
        <div className="banner-slot">
          <AlertBanner
            variant="error"
            title={t.print.failedTitle}
            action={
              <Button
                variant="outlined"
                size="sm"
                onClick={() => {
                  printRunner.reset();
                }}
              >
                {t.print.retry}
              </Button>
            }
          >
            {`${t.print.failedBody} ${printRunner.state.reason ?? ''}`.trim()}
          </AlertBanner>
        </div>
      ) : null}

      {printRunner.state.phase === 'succeeded' ? (
        <div className="banner-slot">
          <AlertBanner variant="success" title={t.print.issued}>
            {t.print.succeeded}
          </AlertBanner>
        </div>
      ) : null}

      <div className="pop-lot-panes">
        <Card bordered className="pop-lot-pane" aria-label={t.lotList.heading}>
          <h2 className="pop-lot-pane-title">{t.lotList.heading}</h2>

          {lots.isError ? (
            <div className="banner-slot">
              <AlertBanner
                variant="error"
                title={t.lotList.loadFailed}
                action={
                  <Button
                    variant="outlined"
                    size="sm"
                    onClick={() => {
                      void lots.refetch();
                    }}
                  >
                    {t.lotList.retry}
                  </Button>
                }
              >
                {t.lotList.emptyHint}
              </AlertBanner>
            </div>
          ) : (
            <LotTable
              rows={rows}
              selectedLotId={selectedLotId}
              onSelect={setSelectedLotId}
              isIssueCountUnavailable={summaries.isError && lotIds.length > 0}
            />
          )}
        </Card>

        <Card bordered className="pop-lot-pane" aria-label={t.title}>
          <TargetCard
            lot={detail.data ?? null}
            item={item.data ?? null}
            isLoading={detail.isPending && selectedLotId !== null}
            isError={detail.isError}
            onRetry={() => {
              void detail.refetch();
            }}
            issueCount={issueCount}
            verdict={verdict}
            block={block}
            isSubmitting={issue.isSaving || printRunner.state.phase === 'sending'}
            onPrint={() => {
              submit(null);
            }}
            onReprint={() => {
              setReissueOpen(true);
            }}
            onGateRetry={gate.retry}
          />
        </Card>
      </div>

      {reissueOpen ? (
        <ReissueDialog
          reasons={reissueReasons.data ?? []}
          isLoading={reissueReasons.isPending}
          isError={reissueReasons.isError}
          onConfirm={(reissueReasonCode) => {
            submit(reissueReasonCode);
          }}
          onCancel={() => {
            setReissueOpen(false);
          }}
        />
      ) : null}
    </main>
  );
};
