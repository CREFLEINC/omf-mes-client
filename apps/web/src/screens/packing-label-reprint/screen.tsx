import { AlertBanner, Button, Card, Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, useMemo, useState } from 'react';

import { usePopIdentity } from '../../patterns/pop-identity';
import { useReprintEntry } from './entry-context';
import { ErrorBanner } from './error-banner';
import { HandlingUnitPane } from './handling-unit-pane';
import { useDocumentReissue } from './mutations';
import {
  useContentRows,
  useHandlingUnit,
  useIssueSummary,
  usePrinters,
  useReissueReasons,
} from './queries';
import { ReprintPane } from './reprint-pane';
import { applySummary, buildTargets, needsReason } from './targets';
import { useTerminalGate } from './terminal-gating';
import { usePrintRunner } from './use-print';
import {
  TARGET_TYPE_CODES,
  type DocumentIssueCreate,
  type Printer,
  type ReprintTarget,
} from './types';

const t = messages.packingLabelReprint;

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
 * 프린터 칩에 적을 말. **이름표를 사유 앞에 붙이지 않는다** — 사유 문구가 이미 「프린터를 …」로
 * 시작해, 앞에 이름표를 덧대면 말이 겹친다(전례 `P-02-05` 실측).
 */
const printerChipText = (printer: Printer | null, failed: boolean): string => {
  if (printer !== null) return `${t.device.printerLabel} ${printer.displayName}`;

  return failed ? t.device.printerUnknown : t.device.printerNone;
};

/**
 * 발행 요청 본문. **고른 줄마다 한 대상**이다 — 줄 하나가 라벨 한 장이다(스펙 §3·§5-2).
 *
 * ⚠ **사유는 필요할 때만 싣는다.** 이력이 없는 대상만 골랐으면 최초 발행이고(스펙 §6), 신규
 * 기록에 재발행 사유가 붙으면 이력이 거짓이 된다(계약).
 */
const issueBody = (
  selected: readonly ReprintTarget[],
  reasonCode: string,
): DocumentIssueCreate | null => {
  const first = selected[0];

  /* 고른 줄이 없으면 본문도 없다 — 문서 유형은 계약 `enum`이라 빈 값으로 채울 수 없다. */
  if (first === undefined) return null;

  return {
    documentTypeCode: first.documentTypeCode,
    targets: selected.map((target) => ({
      targetTypeCode: target.targetTypeCode,
      targetId: target.targetId,
      lotId: target.lotId,
    })),
    ...(needsReason(selected) && reasonCode !== '' ? { reissueReasonCode: reasonCode } : {}),
  };
};

/**
 * P-02-09 포장 라벨·인식표 재출력·부착.
 *
 * ⭐ **재발행이 정상 경로인 유일한 화면이다**(스펙 §5-1). 사유가 예외가 아니라 기본 입력이라
 * 우단에 상시 세운다.
 *
 * ⛔ **인쇄를 발행에 묶지 않는다**(K-4). 인쇄가 실패해도 발행 기록은 남아야 재인쇄로 복구된다.
 */
export const PackingLabelReprintScreen = () => {
  const titleId = useId();
  const entry = useReprintEntry();
  const identity = usePopIdentity();
  const gate = useTerminalGate(identity.terminalId, identity.processId);

  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [reasonCode, setReasonCode] = useState('');

  const handlingUnit = useHandlingUnit(entry.handlingUnitId);
  const contents = useContentRows(handlingUnit.data?.contents ?? []);
  const printers = usePrinters();
  const reasons = useReissueReasons();
  const printRunner = usePrintRunner(entry.workerNo);

  const targets = useMemo(() => buildTargets(contents.rows), [contents.rows]);

  /* 회차는 고를 수 있는 축(LOT)으로만 묻는다 — 개체는 대상 id 자체가 없다 */
  const summaryIds = useMemo(
    () =>
      targets
        .filter((target) => target.targetTypeCode === TARGET_TYPE_CODES.lot)
        .map((target) => target.targetId),
    [targets],
  );
  const summary = useIssueSummary(summaryIds);

  const withCounts = useMemo(() => applySummary(targets, summary.data), [targets, summary.data]);

  const selected = withCounts.filter((target) => selectedRowIds.includes(target.rowId));
  const workerNo = entry.workerNo;

  const reissue = useDocumentReissue({
    workerNo: workerNo ?? '',
    onSuccess: (result) => {
      void printRunner.run(
        result.items.map((issue) => ({
          documentIssueLogId: issue.documentIssueLogId,
          label: issue.target.displayName,
        })),
      );
    },
  });

  const blockedReason = ((): string | null => {
    if (entry.handlingUnitId === null) return t.entry.missingHandlingUnit;
    if (workerNo === null) return t.entry.missingWorker;
    if (gate.verdict !== 'allowed') return t.gate[gate.verdict];

    return null;
  })();

  const submit = (): void => {
    if (workerNo === null || selected.length === 0) return;
    if (needsReason(selected) && reasonCode === '') return;

    const body = issueBody(selected, reasonCode);
    if (body === null) return;

    printRunner.reset();
    reissue.write(body);
  };

  const toggle = (rowId: string): void => {
    setSelectedRowIds((current) =>
      current.includes(rowId) ? current.filter((id) => id !== rowId) : [...current, rowId],
    );
  };

  const printer = headlinePrinter(printers.data);

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

      {handlingUnit.isError && (
        <div className="banner-slot">
          <AlertBanner variant="error" title={t.handlingUnit.loadFailed}>
            {messages.httpError.description}
          </AlertBanner>
        </div>
      )}

      {reissue.error !== null && (
        <ErrorBanner error={reissue.error} title={t.error.issueTitle} onRetry={submit} />
      )}

      {printRunner.state.phase === 'shellUnavailable' && (
        <div className="banner-slot">
          <AlertBanner variant="info" title={t.print.issued}>
            {t.print.shellUnavailable}
          </AlertBanner>
        </div>
      )}

      {/*
        ⛔ **인쇄 실패를 발행 실패로 말하지 않는다**(K-4). 기록은 남았고 프린터만 실패한 것이라,
        복구 경로는 「다시 인쇄」이지 「다시 발행」이 아니다 — 다시 발행하면 회차가 또 오른다.
      */}
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
                  void printRunner.run(printRunner.state.targets);
                }}
              >
                {t.print.retry}
              </Button>
            }
          >
            {t.print.failedBody}
          </AlertBanner>
        </div>
      )}

      {printRunner.state.phase === 'succeeded' && (
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

        <Card bordered className="pop-section" aria-label={t.targets.sectionLabel}>
          <h2 className="pane-title">{t.targets.sectionLabel}</h2>
          <ReprintPane
            targets={withCounts}
            selectedRowIds={selectedRowIds}
            onToggle={toggle}
            summaryFailed={summary.isError}
            reasons={reasons.data ?? []}
            reasonsFailed={reasons.isError}
            reasonCode={reasonCode}
            onReasonChange={setReasonCode}
            reasonRequired={needsReason(selected)}
            reasonServerError={reissue.fieldErrors.reissueReasonCode ?? null}
            blockedReason={blockedReason}
            isSubmitting={reissue.isSaving || printRunner.state.phase === 'sending'}
            onSubmit={submit}
          />
        </Card>
      </div>
    </main>
  );
};
