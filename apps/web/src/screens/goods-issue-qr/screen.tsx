import type { ApiError } from '@omf-mes/api-client';
import { AlertBanner, Button, Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { SaveErrorBanner } from '../../patterns/master';
import { canIssue, issueGuard } from './issue-target';
import { hasIssuedTarget, rowId, toLineRows } from './line-rows';
import { LineListPane } from './line-list-pane';
import { useItemNames, useLotNames, useReissueReasonOptions, useUomNames } from './lookups';
import { useDocumentIssueWrite, usePrintFlow } from './mutations';
import { hasPrintBridge } from './pop-print';
import { printResult, type PrintResult } from './print-result';
import { useDocumentIssueSummary, useGoodsIssue, useGoodsIssueLines, usePrinters } from './queries';
import { TargetPane } from './target-pane';
import { useGoodsIssueQrEntry } from './entry-context';
import {
  PLACEHOLDER_DOCUMENT_TYPE_CODE,
  PLACEHOLDER_LINE_TARGET_TYPE_CODE,
  type DocumentIssue,
  type Printer,
} from './types';

const t = messages.goodsIssueQr;

/**
 * P-01-02 — POP(1024×768 터치)에서 출고 단위 QR 을 발행·재발행한다.
 *
 * **이 화면의 본론은 「발행과 인쇄는 다른 걸음」이다**(스펙 §5-5 · K-4).
 *
 * - 서버가 하는 것: 발행 기록을 만들고 **회차를 매기고**, 출력물을 그린다
 * - 셸이 하는 것: 그린 것을 프린터로 보낸다
 * - 화면이 하는 것: 대상을 고르고, 두 걸음의 결과를 **각각** 말한다
 *
 * ⛔ **인쇄 실패로 발행을 되돌리지 않는다.** 되돌리면 같은 대상에 회차를 다시 매겨야 하고,
 * 그사이 다른 단말이 그 회차를 가져간다.
 *
 * ⛔ **셸(`AppShell`)을 쓰지 않는다.** POP 은 사이드바로 옮겨 다니는 화면이 아니라 전표 하나에
 * 매인 태스크 화면이고, 세로 예산이 액션바까지 정해져 있다(스펙 §3).
 *
 * ⚠ **단말 권한으로 선차단하지 않는다**(통지 #535). 창고 POP 은 단말 기능 구성의 적용 범위
 * 밖이고 게이트는 서버의 403 이다 — 막혔다는 사실은 눌러 본 뒤에 알려 준다.
 */
export const GoodsIssueQrScreen = () => {
  const titleId = useId();
  const { baseUrl } = useApiClient();

  const entry = useGoodsIssueQrEntry();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [reasonCode, setReasonCode] = useState('');
  const [issued, setIssued] = useState<DocumentIssue[] | null>(null);

  const goodsIssue = useGoodsIssue(entry.goodsIssueId);
  const lines = useGoodsIssueLines(entry.goodsIssueId);
  const lineItems = lines.data ?? [];

  const summary = useDocumentIssueSummary(lineItems.map((line) => line.goodsIssueLineId));
  const rows = toLineRows(lineItems, summary.data ?? []);

  const itemNames = useItemNames();
  const uomNames = useUomNames();
  const lotNames = useLotNames(lineItems.map((line) => line.lotId));
  const reasonOptions = useReissueReasonOptions();

  const printers = usePrinters();
  const printFlow = usePrintFlow(entry.workerNo);

  const needsReason = hasIssuedTarget(rows, selectedIds);

  const write = useDocumentIssueWrite({
    workerNo: entry.workerNo ?? '',
    onSuccess: (records) => {
      setIssued(records);
      /* 발행이 끝나면 곧바로 그린 것을 받아 셸로 보낸다 — 사용자가 한 번 더 누르지 않는다. */
      printFlow.mutate(records);
    },
  });

  const guard = issueGuard({
    workerNo: entry.workerNo,
    selectedIds,
    needsReason,
    reasonCode,
  });

  const issue = (): void => {
    if (!canIssue(guard)) return;

    setIssued(null);
    printFlow.reset();

    write.write({
      documentTypeCode: PLACEHOLDER_DOCUMENT_TYPE_CODE,
      targets: rows
        .filter((row) => selectedIds.includes(rowId(row.line)))
        .map((row) => ({
          targetTypeCode: PLACEHOLDER_LINE_TARGET_TYPE_CODE,
          targetId: row.line.goodsIssueLineId,
          lotId: row.line.lotId,
        })),
      /* 재발행이 아닐 때는 보내지 않는다 — 신규 기록에 사유가 붙으면 이력이 거짓이 된다. */
      ...(needsReason ? { reissueReasonCode: reasonCode } : {}),
    });
  };

  const firstIssued = issued?.[0] ?? null;
  const previewSrc =
    firstIssued === null
      ? null
      : `${baseUrl}/app/document-issues/${String(firstIssued.documentIssueLogId)}/rendition?format=png`;

  return (
    <main className="pop-shell" aria-labelledby={titleId}>
      <header className="pop-header">
        <h1 id={titleId} className="pop-title">
          {t.title}
        </h1>
        <div className="pop-context-right">
          {goodsIssue.data !== undefined && (
            <span>{`${t.entry.issueLabel} ${goodsIssue.data.goodsIssueNo}`}</span>
          )}
          {entry.workerNo !== null && <span>{`${t.entry.workerLabel} ${entry.workerNo}`}</span>}
          <PrinterChip
            isLoading={printers.isPending}
            isError={printers.isError}
            statusMessage={defaultPrinter(printers.data)?.statusMessage ?? null}
            hasPrinter={(printers.data?.length ?? 0) > 0}
          />
        </div>
      </header>

      {entry.goodsIssueId === null && (
        <div className="banner-slot">
          <AlertBanner variant="warning">{t.entry.missingIssue}</AlertBanner>
        </div>
      )}
      {entry.goodsIssueId !== null && entry.workerNo === null && (
        <div className="banner-slot">
          <AlertBanner variant="warning">{t.entry.missingWorker}</AlertBanner>
        </div>
      )}

      {/*
       * 403 만 화면의 말로 바꿔 낸다(스펙 §6 · F-7) — 공용 배너의 일반 문구는 「권한이 없습니다」
       * 까지이고, 여기서 필요한 것은 **어느 단말에서 다시 하면 되는가**다. 대상 선택은 그대로
       * 둔다 — 재시도는 다른 단말에서 하는 것이지 다시 고르는 것이 아니다.
       */}
      {isForbidden(write.error) ? (
        <div className="banner-slot">
          <AlertBanner variant="error">{t.errors.forbidden}</AlertBanner>
        </div>
      ) : (
        <SaveErrorBanner error={write.error} />
      )}

      {issued !== null && (
        <div className="banner-slot">
          <AlertBanner variant="success">{t.result.issued(issued.length)}</AlertBanner>
        </div>
      )}
      <PrintResultBanner
        isPending={printFlow.isPending}
        result={printResult(printFlow.data?.reports ?? [])}
      />

      <div className="pop-panes">
        <LineListPane
          rows={rows}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          itemNames={itemNames}
          lotNames={lotNames}
          uomNames={uomNames}
          isLoading={lines.isPending}
          isError={lines.isError}
        />
        <TargetPane
          selectedCount={selectedIds.length}
          issuedSeq={firstIssued?.issueSeq ?? null}
          needsReason={needsReason}
          reasonCode={reasonCode}
          onReasonChange={setReasonCode}
          reasonOptions={reasonOptions}
          previewSrc={previewSrc}
        />
      </div>

      <div className="pop-actions">
        {guard.kind !== 'ready' && <p className="field-note">{guardNote(guard.kind)}</p>}
        <Button
          variant="filled"
          size="2xl"
          type="button"
          disabled={!canIssue(guard)}
          loading={write.isSaving || printFlow.isPending}
          onClick={issue}
        >
          {t.action.issue}
        </Button>
      </div>

      {/* 「왜 전량인데도 찍나」에 답할 근거를 화면에 남긴다(스펙 §5-3 · G-5). */}
      <p className="field-note">{t.alwaysIssueNote}</p>
      {/*
       * 인쇄 통로가 없는 것과 프린터가 0건인 것은 **다른 사정**이다 — 전자는 이 셸에서 찍을 수
       * 없다는 뜻이고 후자는 이 단말에 등록된 프린터가 없다는 뜻이다. 한 문구로 뭉치면
       * 사용자가 무엇을 고쳐야 하는지 알 수 없다.
       */}
      {!hasPrintBridge() && <p className="field-note">{t.printer.noShell}</p>}
    </main>
  );
};

/**
 * 머리에 세울 프린터 한 대. **계약이 표시한 기본 프린터를 고른다** — 목록의 첫 줄을 집으면
 * 서버가 순서를 바꾸는 순간 다른 프린터의 상태를 보이게 된다. 기본 표시가 없으면 첫 줄이다.
 */
const defaultPrinter = (printers: Printer[] | undefined): Printer | null => {
  if (printers === undefined || printers.length === 0) return null;

  return printers.find((printer) => printer.isDefault) ?? printers[0] ?? null;
};

/** 서버가 이 단말의 발행을 막았는가. 게이트는 서버가 갖는다(통지 #535). */
const isForbidden = (error: ApiError | null): boolean =>
  error !== null && error.kind === 'http' && error.status === 403;

const guardNote = (kind: 'noWorker' | 'noSelection' | 'reasonRequired'): string => {
  switch (kind) {
    case 'noWorker':
      return t.action.disabledNoWorker;
    case 'noSelection':
      return t.action.disabledNoSelection;
    case 'reasonRequired':
      return t.action.disabledNoReason;
  }
};

interface PrinterChipProps {
  isLoading: boolean;
  isError: boolean;
  hasPrinter: boolean;
  statusMessage: string | null;
}

/**
 * 프린터 상태는 **머리에 상시 보인다**(스펙 §5-5 · K-4) — 인쇄가 안 될 때 사용자가 가장 먼저
 * 보는 자리다.
 *
 * ⚠ **상태값으로 문장을 조립하지 않는다.** 계약이 사람이 읽는 설명을 함께 내려 주므로 그것을
 * 그대로 쓴다 — 화면이 지어 붙이면 서버가 말하는 상태와 어긋난다.
 */
const PrinterChip = ({ isLoading, isError, hasPrinter, statusMessage }: PrinterChipProps) => {
  if (isLoading) return <Chip status="idle">{t.printer.loading}</Chip>;
  if (isError) return <Chip status="error">{t.printer.failed}</Chip>;
  if (!hasPrinter) return <Chip status="warning">{t.printer.empty}</Chip>;

  return <Chip status="success">{`${t.printer.label} ${statusMessage ?? ''}`.trim()}</Chip>;
};

interface PrintResultBannerProps {
  isPending: boolean;
  result: PrintResult;
}

/**
 * 인쇄 걸음의 결과. **다섯 갈래를 다섯 문장으로 말한다** — 접으면 사용자가 다음에 무엇을
 * 해야 하는지가 달라지는데 화면은 같은 말을 하게 된다.
 */
const PrintResultBanner = ({ isPending, result }: PrintResultBannerProps) => {
  if (isPending) {
    return (
      <div className="banner-slot">
        <AlertBanner variant="info">{t.result.printing}</AlertBanner>
      </div>
    );
  }

  switch (result.kind) {
    case 'none':
      return null;
    case 'printed':
      return (
        <div className="banner-slot">
          <AlertBanner variant="success">{t.result.printed}</AlertBanner>
        </div>
      );
    case 'printedUnreported':
      return (
        <div className="banner-slot">
          <AlertBanner variant="warning">{t.result.printedUnreported}</AlertBanner>
        </div>
      );
    case 'failed':
      return (
        <div className="banner-slot">
          <AlertBanner variant="warning">{t.result.printFailed}</AlertBanner>
        </div>
      );
    case 'failedUnreported':
      return (
        <div className="banner-slot">
          <AlertBanner variant="warning">{t.result.reportFailed}</AlertBanner>
        </div>
      );
  }
};
