import { AlertBanner, Button, Card, Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, useState } from 'react';

import { usePopIdentity } from '../../patterns/pop-identity';
import { useIsOnline } from './connection';
import { useRepackLabelEntry } from './entry-context';
import { ErrorBanner } from './error-banner';
import { HandlingUnitPane } from './handling-unit-pane';
import { HistoryPane } from './history-pane';
import { IssuePane } from './issue-pane';
import { issueBody } from './issue-body';
import { useDocumentIssue } from './mutations';
import { PreviewDialog } from './preview-dialog';
import {
  useContentRows,
  useHandlingUnit,
  useIssueHistory,
  useIssueStanding,
  usePrinters,
  useReissueReasons,
} from './queries';
import { useTerminalGate } from './terminal-gating';
import { useIssuePrintRunner } from './use-issue-print';
import { needsReason, type IssueStanding, type Printer } from './types';

const t = messages.repackLabelIssue;

/** 요약을 못 받았을 때의 자리. **「모른다」를 「0 번 발행」으로 말하지 않는다.** */
const UNKNOWN_STANDING: IssueStanding = {
  issueCount: null,
  lastIssuedAt: null,
  lastPrintOutcome: null,
};

/** 프린터 상태별 칩 색. 문구는 서버가 준 것을 쓴다 — 화면이 `status` 로 말을 조립하지 않는다. */
const printerTone = (status: Printer['status']) => {
  switch (status) {
    case 'READY':
      return 'success' as const;
    case 'BUSY':
      return 'info' as const;
    case 'OFFLINE':
    case 'ERROR':
      return 'error' as const;
  }
};

/** 기본 프린터가 있으면 그것, 없으면 첫 번째. 없으면 `null`. */
const defaultPrinter = (printers: readonly Printer[]): Printer | null =>
  printers.find((printer) => printer.isDefault) ?? printers[0] ?? null;

/**
 * P-04-04 재구성 신규 라벨 발행.
 *
 * ## ⚠ 지금 서 있는 것은 발행·인쇄뿐이다
 *
 * 스펙의 ① 발행 대기 목록과 ② 신규 발번은 **계약이 표현하지 못해 만들지 않았다**
 * (`omf-mes#418` · 자세한 근거는 `types.ts` 머리). 대상 포장은 주소로 받고(`entry-context.ts`),
 * 앞단이 정해지면 그 파일 하나가 바뀐다.
 *
 * ⛔ **인쇄를 발행에 묶지 않는다**(K-4). 인쇄가 실패해도 발행 기록은 남아야 재인쇄로 복구된다.
 *
 * ⭐ **순서가 「발행 → 미리보기 → 인쇄」다**(착수 이슈 §6). 그리기 경로가 발행 기록 번호를 받아
 * **발행 전 미리보기가 계약에 없다.**
 */
export const RepackLabelIssueScreen = () => {
  const titleId = useId();
  const entry = useRepackLabelEntry();
  const identity = usePopIdentity();
  const gate = useTerminalGate(identity.terminalId, identity.processId);
  const isOnline = useIsOnline();

  const [reasonCode, setReasonCode] = useState('');
  const [pickedPrinter, setPickedPrinter] = useState('');

  const handlingUnit = useHandlingUnit(entry.handlingUnitId);
  const contents = useContentRows(handlingUnit.data?.contents ?? []);
  const standingQuery = useIssueStanding(entry.handlingUnitId);
  const history = useIssueHistory(entry.handlingUnitId);
  const printers = usePrinters();
  const reasons = useReissueReasons();
  const printRunner = useIssuePrintRunner(entry.workerNo);

  const standing = standingQuery.data ?? UNKNOWN_STANDING;
  const reasonRequired = needsReason(standing);

  const printerList = printers.data ?? [];
  /*
   * 기본 프린터를 **파생으로 정한다** — 응답이 온 뒤 `useEffect` 로 상태에 밀어 넣으면 그
   * 한 프레임 동안 고른 것이 없는 화면이 서고, 사용자가 그사이 고른 값을 덮는다.
   */
  const printerName =
    pickedPrinter !== '' ? pickedPrinter : (defaultPrinter(printerList)?.printerName ?? '');
  const headline = printerList.find((printer) => printer.printerName === printerName) ?? null;

  const issue = useDocumentIssue({
    workerNo: entry.workerNo ?? '',
    onSuccess: (result) => {
      const issued = result.items[0];

      if (issued === undefined) return;

      void printRunner.begin({
        documentIssueLogId: issued.documentIssueLogId,
        label: handlingUnit.data?.handlingUnit.handlingUnitNo ?? issued.target.displayName,
      });
    },
  });

  const blockedReason = ((): string | null => {
    if (entry.handlingUnitId === null) return t.entry.missingHandlingUnit;
    if (entry.workerNo === null) return t.entry.missingWorker;
    if (gate.verdict !== 'allowed') return t.gate[gate.verdict];
    /*
     * ⛔ **끊긴 채로는 발행하지 않는다**(스펙 §6 · K-5). 라벨을 서버가 그리므로 기록만 남고
     * 인쇄할 것이 오지 않는다 — 회차만 오르고 종이는 없는 상태가 된다.
     */
    if (!isOnline) return t.gate.offline;

    return null;
  })();

  const submit = (): void => {
    const handlingUnitId = entry.handlingUnitId;

    if (handlingUnitId === null || entry.workerNo === null) return;
    /* 사유가 필요한데 비었으면 보내지 않는다 — 서버도 422 로 막지만 먼저 막는 자리가 화면이다. */
    if (reasonRequired && reasonCode === '') return;

    printRunner.reset();
    issue.write(issueBody({ handlingUnitId, printerName, reasonCode, reasonRequired }));
  };

  /** 이미 발행한 적이 있어야 볼 것이 있다. 가장 최근 회차를 연다. */
  const latestIssue = history.data?.[0] ?? null;

  const openPreview = (): void => {
    if (latestIssue === null) return;

    void printRunner.begin({
      documentIssueLogId: latestIssue.documentIssueLogId,
      label: handlingUnit.data?.handlingUnit.handlingUnitNo ?? latestIssue.target.displayName,
    });
  };

  const phase = printRunner.state.phase;

  return (
    <main className="pop-shell" aria-labelledby={titleId}>
      <header className="pop-header">
        <h1 id={titleId} className="pop-title">
          {t.title}
        </h1>
        <div className="pop-context-right">
          <Chip status={headline === null ? 'warning' : printerTone(headline.status)}>
            {headline === null
              ? printers.isError
                ? t.device.printerUnknown
                : t.device.printerNone
              : `${t.device.printerLabel} ${headline.displayName}`}
          </Chip>
          <Chip status={identity.terminalId === null ? 'warning' : 'info'}>
            {`${t.device.terminalLabel} ${identity.terminalId === null ? t.device.terminalUnknown : String(identity.terminalId)}`}
          </Chip>
          {/* 스펙 §3 헤더의 연결 표시. 발행을 막는 조건이기도 해서 상시 보인다. */}
          <Chip status={isOnline ? 'success' : 'error'}>
            {isOnline ? t.device.online : t.device.offline}
          </Chip>
        </div>
      </header>

      {handlingUnit.isError && (
        <div className="banner-slot">
          <AlertBanner variant="error" title={t.handlingUnit.loadFailed}>
            {messages.httpError.description}
          </AlertBanner>
        </div>
      )}

      {issue.error !== null && (
        <ErrorBanner error={issue.error} title={t.error.issueTitle} onRetry={submit} />
      )}

      {/*
        ⛔ **그림을 못 받은 것을 발행 실패로 말하지 않는다.** 기록은 남았다 — 다시 «발행»하면
        회차가 또 오르므로, 복구 경로는 미리보기를 다시 여는 것이다.
      */}
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
            {`${t.print.failedBody} ${printRunner.state.reason ?? ''}`.trim()}
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
              <Button
                variant="outlined"
                size="sm"
                onClick={() => {
                  void printRunner.print();
                }}
              >
                {t.print.retry}
              </Button>
            }
          >
            {`${t.print.failedBody} ${printRunner.state.reason ?? ''}`.trim()}
          </AlertBanner>
        </div>
      )}

      {phase === 'succeeded' && (
        <div className="banner-slot">
          <AlertBanner variant="success" title={t.print.issued}>
            {t.print.succeeded}
          </AlertBanner>
        </div>
      )}

      <div className="pop-panes">
        <Card bordered className="pop-section" aria-label={t.handlingUnit.sectionLabel}>
          <h2 className="pane-title">{t.handlingUnit.sectionLabel}</h2>
          {handlingUnit.data === undefined ? null : (
            <HandlingUnitPane
              handlingUnit={handlingUnit.data.handlingUnit}
              rows={contents.rows}
              namesFailed={contents.isNameError}
            />
          )}
        </Card>

        <Card bordered className="pop-section" aria-label={t.issue.sectionLabel}>
          <h2 className="pane-title">{t.issue.sectionLabel}</h2>
          <IssuePane
            standing={standing}
            standingFailed={standingQuery.isError}
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
            blockedReason={blockedReason}
            isSubmitting={issue.isSaving || phase === 'fetching' || phase === 'printing'}
            onSubmit={submit}
            canPreview={latestIssue !== null}
            onPreview={openPreview}
          />

          <h2 className="pane-title">{t.history.sectionLabel}</h2>
          <HistoryPane issues={history.data ?? []} isFailed={history.isError} />
        </Card>
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
