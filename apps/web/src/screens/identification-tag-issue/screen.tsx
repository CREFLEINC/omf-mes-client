import { AlertBanner, Button, Card, Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useCallback, useId, useState } from 'react';

import { usePopIdentity } from '../../patterns/pop-identity';
import { ErrorBanner, describeError } from './error-banner';
import { useTagIssueEntry } from './entry-context';
import { IssuePane } from './issue-pane';
import { judgeQuantity, unissuedGoodQty } from './issue-quantity';
import { LotListPane } from './lot-list-pane';
import { useDocumentBatchIssue, useSerialBatchIssue } from './mutations';
import { useIssuedSerialCount, useLotProgress, usePrinters, useTargetLots } from './queries';
import { ReissueDialog } from './reissue-dialog';
import { useTerminalGate } from './terminal-gating';
import { usePrintRunner } from './use-print';
import {
  ISSUE_CODES,
  emptyIssueProgress,
  type DocumentIssueCreate,
  type Printer,
  type SerialNumber,
} from './types';

const t = messages.identificationTagIssue;

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

/** 화면 머리에 세울 프린터 한 대. 기본 프린터가 있으면 그것, 없으면 첫 번째다. */
const headlinePrinter = (printers: readonly Printer[] | undefined): Printer | null => {
  if (printers === undefined || printers.length === 0) return null;

  return printers.find((printer) => printer.isDefault) ?? printers[0] ?? null;
};

/**
 * 프린터 칩에 적을 말.
 *
 * ⛔ **이름표를 사유 앞에 붙이지 않는다.** 사유 문구가 이미 「프린터를 …」로 시작해, 앞에
 * 「프린터」를 덧대면 **「프린터 프린터를 확인할 수 없습니다」**가 된다(실측). 이름표는 값이
 * 있을 때만 값을 가리키는 말이다.
 */
const printerChipText = (printer: Printer | null, failed: boolean): string => {
  if (printer !== null) return `${t.device.printerLabel} ${printer.displayName}`;

  return failed ? t.device.printerUnknown : t.device.printerNone;
};

/**
 * 발행 기록 요청 본문. **개체마다 한 대상**이다 — `uq_document_issue_log` 가 대상 단위라
 * 480 장을 발행하면 개체 480 행 + 기록 480 행이 된다(스펙 §5-3).
 *
 * ⚠ **재발행 사유를 싣지 않는다.** 이 경로는 최초 발행이고, 신규 기록에 재발행 사유가 붙으면
 * 이력이 거짓이 된다(계약).
 */
const issueBody = (serials: readonly SerialNumber[]): DocumentIssueCreate => ({
  documentTypeCode: ISSUE_CODES.documentType,
  targets: serials.map((serial) => ({
    targetTypeCode: ISSUE_CODES.serialTargetType,
    targetId: serial.serialNumberId,
    lotId: serial.lotId,
  })),
});

/**
 * P-02-05 인식표 발행·부착.
 *
 * ⭐ **버튼은 하나인데 서버 호출은 둘이다**(스펙 §5-3). ① 개체를 만들고 ② 그 개체로 발행
 * 기록을 만든다. 순서가 강제되고 **①만 성공한 상태가 정상**이라, 화면이 그 상태를 그리고
 * 재시도는 ②만 다시 부른다 — 개체를 다시 만들면 번호에 구멍이 난다.
 *
 * ⛔ **인쇄를 발행에 묶지 않는다**(K-4). 인쇄가 실패해도 발행 기록은 남아야 재인쇄로 복구된다.
 */
export const IdentificationTagIssueScreen = () => {
  const titleId = useId();
  const entry = useTagIssueEntry();
  const identity = usePopIdentity();
  const gate = useTerminalGate(identity.terminalId, identity.processId);

  const [selectedLotId, setSelectedLotId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState('');
  const [progress, setProgress] = useState(emptyIssueProgress);
  const [reissueOpen, setReissueOpen] = useState(false);

  const lots = useTargetLots(entry.workOrderId);
  const lotProgress = useLotProgress(selectedLotId);
  const serialCount = useIssuedSerialCount(selectedLotId);
  const printers = usePrinters();
  const printRunner = usePrintRunner(entry.workerNo);

  const goodQty = lotProgress.data?.goodQty ?? null;
  const issuedCount = serialCount.data ?? null;
  const unissued = unissuedGoodQty({ goodQty, issuedCount });
  const verdict = judgeQuantity(quantity, unissued);

  const workerNo = entry.workerNo;

  const documentIssue = useDocumentBatchIssue({
    workerNo: workerNo ?? '',
    onSuccess: (result) => {
      setProgress((current) => ({ ...current, phase: 'documentsIssued', issues: result.items }));
      void printRunner.run(
        result.items.map((issue) => ({
          documentIssueLogId: issue.documentIssueLogId,
          label: issue.target.displayName,
        })),
      );
    },
  });

  /* ②만 다시 부르는 자리. ①이 만든 개체를 그대로 쓴다 — 다시 만들지 않는다. */
  const issueDocuments = (serials: readonly SerialNumber[]): void => {
    if (workerNo === null || serials.length === 0) return;

    documentIssue.write(issueBody(serials));
  };

  const serialIssue = useSerialBatchIssue({
    workerNo: workerNo ?? '',
    onSuccess: (result) => {
      setProgress({ phase: 'serialsIssued', serials: result.items, issues: [] });
      issueDocuments(result.items);
    },
  });

  const blockedReason = ((): string | null => {
    if (entry.workOrderId === null) return t.entry.missingWorkOrder;
    if (workerNo === null) return t.entry.missingWorker;
    if (gate.verdict !== 'allowed') return t.gate[gate.verdict];

    return null;
  })();

  const submit = (): void => {
    if (!verdict.ok || selectedLotId === null || workerNo === null) return;

    printRunner.reset();
    setProgress(emptyIssueProgress);
    serialIssue.write({ lotId: selectedLotId, quantity: verdict.quantity });
  };

  const selectLot = useCallback((lotId: number): void => {
    setSelectedLotId(lotId);
    setQuantity('');
    setProgress(emptyIssueProgress);
  }, []);

  const isSubmitting = serialIssue.isSaving || documentIssue.isSaving;
  const printer = headlinePrinter(printers.data);
  const writeError = serialIssue.error ?? documentIssue.error;

  return (
    <main className="pop-shell" aria-labelledby={titleId}>
      <header className="pop-header">
        <h1 id={titleId} className="pop-title">
          {t.title}
        </h1>
        <div className="pop-context-right">
          <Chip status={printer === null ? 'warning' : printerTone(printer.status)}>
            {printerChipText(printer, printers.isError)}
          </Chip>
          <Chip status={identity.terminalId === null ? 'warning' : 'info'}>
            {`${t.device.terminalLabel} ${identity.terminalId === null ? t.device.terminalUnknown : String(identity.terminalId)}`}
          </Chip>
        </div>
      </header>

      {lots.isError && (
        <div className="banner-slot">
          <AlertBanner variant="error" title={t.lotList.loadFailed}>
            {messages.httpError.description}
          </AlertBanner>
        </div>
      )}

      {/*
        ⛔ **①만 성공한 상태에서는 일반 실패 배너를 세우지 않는다.** 그 상태의 복구 경로는
        「발행만 다시」 하나뿐인데, 배너 둘이 각자 「다시 시도」를 들면 사용자는 어느 것이
        개체를 다시 만드는지 알 수 없다. 서버가 준 사유는 아래 배너 안으로 접어 넣는다.
      */}
      {writeError !== null && progress.phase !== 'serialsIssued' && (
        <ErrorBanner error={writeError} title={t.error.issueTitle} onRetry={submit} />
      )}

      {progress.phase === 'serialsIssued' && (
        <div className="banner-slot">
          <AlertBanner
            variant="warning"
            title={t.result.serialsOnlyTitle}
            action={
              <Button
                variant="outlined"
                size="sm"
                onClick={() => {
                  issueDocuments(progress.serials);
                }}
              >
                {t.result.retryDocuments}
              </Button>
            }
          >
            {[
              t.result.serialsOnlyBody,
              ...(documentIssue.error === null ? [] : describeError(documentIssue.error)),
            ].join(' ')}
          </AlertBanner>
        </div>
      )}

      {printRunner.state.phase === 'shellUnavailable' && (
        <div className="banner-slot">
          <AlertBanner variant="info" title={t.result.issued}>
            {t.print.shellUnavailable}
          </AlertBanner>
        </div>
      )}

      {printRunner.state.phase === 'failed' && (
        <div className="banner-slot">
          <AlertBanner
            variant="error"
            title={t.print.failedTitle}
            action={
              <Button
                variant="outlined"
                size="sm"
                onClick={() => {
                  void printRunner.run(
                    progress.issues.map((issue) => ({
                      documentIssueLogId: issue.documentIssueLogId,
                      label: issue.target.displayName,
                    })),
                  );
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

      {printRunner.state.phase === 'succeeded' && (
        <div className="banner-slot">
          <AlertBanner variant="success" title={t.result.issued}>
            {t.print.succeeded}
          </AlertBanner>
        </div>
      )}

      <div className="pop-panes">
        <Card bordered className="pop-section" aria-label={t.lotList.sectionLabel}>
          <h2 className="pane-title">{t.lotList.sectionLabel}</h2>
          <LotListPane lots={lots.data ?? []} selectedLotId={selectedLotId} onSelect={selectLot} />
        </Card>

        <Card bordered className="pop-section" aria-label={t.issue.sectionLabel}>
          <h2 className="pane-title">{t.issue.sectionLabel}</h2>
          {lotProgress.isError || serialCount.isError ? (
            <p className="field-error">{t.issue.loadFailed}</p>
          ) : (
            <IssuePane
              lotNo={lotProgress.data?.lot.lotNo ?? null}
              goodQty={goodQty}
              issuedCount={issuedCount}
              unissued={unissued}
              quantity={quantity}
              onQuantityChange={setQuantity}
              rejection={verdict.ok ? null : verdict.reason}
              serverQuantityError={serialIssue.fieldErrors.quantity ?? null}
              blockedReason={blockedReason}
              issuedSerials={progress.serials}
              isSubmitting={isSubmitting || printRunner.state.phase === 'sending'}
              onSubmit={submit}
              onReissue={() => {
                setReissueOpen(true);
              }}
            />
          )}
        </Card>
      </div>

      <ReissueDialog
        open={reissueOpen}
        onClose={() => {
          setReissueOpen(false);
        }}
      />
    </main>
  );
};
