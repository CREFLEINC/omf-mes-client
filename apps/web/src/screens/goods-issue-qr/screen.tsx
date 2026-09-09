import type { ApiError } from '@omf-mes/api-client';
import { AlertBanner, Button, Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { PopWorkerTag } from '../../patterns/pop-worker-tag';
import { usePopIdentity } from '../../patterns/pop-identity';
import { SaveErrorBanner } from '../../patterns/master';
import { canIssue, issueGuard, type IssueGuard } from './issue-target';
import { hasIssuedTarget, hasUnknownTarget, rowId, toLineRows } from './line-rows';
import { LineListPane } from './line-list-pane';
import { useItemNames, useLotNames, useReissueReasonOptions, useUomNames } from './lookups';
import { useDocumentIssueWrite, usePrintFlow } from './mutations';
import { hasPrintBridge } from './pop-print';
import { printResult, type PrintResult } from './print-result';
import {
  useDocumentIssueSummary,
  useGoodsIssue,
  useGoodsIssueLines,
  useHandlingUnitContents,
  useLineHandlingUnits,
  usePrinters,
} from './queries';
import { TargetPane } from './target-pane';
import { useGoodsIssueQrEntry } from './entry-context';
import {
  DOCUMENT_TYPE_CODE,
  ISSUE_UNIT,
  LINE_TARGET_TYPE_CODE,
  PALLET_TARGET_TYPE_CODE,
  type DocumentIssue,
  type IssueUnit,
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
  const identity = usePopIdentity();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  /**
   * 라인 단위인가 파렛트 단위인가(스펙 §5-2). **화면 안에서만 쓰는 구분이다** — 서버로 나가는
   * 것은 이 값이 아니라 대상 유형 코드다.
   */
  const [unit, setUnit] = useState<IssueUnit>(ISSUE_UNIT.line);
  const [palletId, setPalletId] = useState<number | null>(null);
  const [reasonCode, setReasonCode] = useState('');
  const [issued, setIssued] = useState<DocumentIssue[] | null>(null);
  /**
   * 서버가 이 발행을 재발행으로 보고 사유를 물었다.
   *
   * ⛔ **거부 문구가 사라진다고 칸까지 접지 않는다.** 값을 고치면 옛 거부는 지워지는데, 칸이
   * 그 오류에만 매여 있으면 **사용자가 방금 고른 사유와 함께 칸이 사라지고** 다시 사유 없는
   * 요청이 나간다 — 같은 거부를 무한히 반복한다. 발행이 실제로 성공할 때까지 열어 둔다.
   */
  const [reasonAsked, setReasonAsked] = useState(false);

  const goodsIssue = useGoodsIssue(entry.goodsIssueId);
  const lines = useGoodsIssueLines(entry.goodsIssueId);
  const lineItems = lines.data ?? [];

  const summary = useDocumentIssueSummary(
    LINE_TARGET_TYPE_CODE,
    lineItems.map((line) => line.goodsIssueLineId),
  );
  const rows = toLineRows(lineItems, summary.data ?? []);

  /*
   * 파렛트 대상은 **고른 라인의 LOT** 으로 좁힌다(스펙 §5-2). 라인이 하나로 정해지지 않으면
   * 어느 LOT 으로 좁힐지 화면이 대신 정하게 되므로 조회 자체를 내보내지 않는다.
   */
  const palletSelectable = unit === ISSUE_UNIT.pallet && selectedIds.length === 1;
  const selectedLine = rows.find((row) => rowId(row.line) === selectedIds[0])?.line ?? null;
  const pallets = useLineHandlingUnits(palletSelectable ? (selectedLine?.lotId ?? null) : null);
  const palletItems = pallets.data ?? [];
  const palletContents = useHandlingUnitContents(unit === ISSUE_UNIT.pallet ? palletId : null);

  /*
   * 파렛트도 회차가 오른다 — 같은 취급 단위를 두 번 찍으면 재발행이고 사유가 필요하다.
   * **대상 유형이 달라 라인 요약으로는 알 수 없다**(같은 표를 유형으로 가른다 · 스펙 §5-1).
   */
  const palletSummary = useDocumentIssueSummary(
    PALLET_TARGET_TYPE_CODE,
    palletId === null ? [] : [palletId],
  );

  const itemNames = useItemNames();
  const uomNames = useUomNames();
  const lotNames = useLotNames(lineItems.map((line) => line.lotId));
  const reasonOptions = useReissueReasonOptions();

  const printers = usePrinters();
  const printFlow = usePrintFlow(entry.workerNo);

  const palletIssueCount = palletSummary.data?.[0]?.issueCount ?? null;
  const needsReason =
    unit === ISSUE_UNIT.pallet
      ? palletIssueCount !== null && palletIssueCount > 0
      : hasIssuedTarget(rows, selectedIds);

  const write = useDocumentIssueWrite({
    workerNo: entry.workerNo ?? '',
    onSuccess: (records) => {
      setIssued(records);
      setReasonAsked(false);
      /* 발행이 끝나면 곧바로 그린 것을 받아 셸로 보낸다 — 사용자가 한 번 더 누르지 않는다. */
      printFlow.mutate(records);
    },
  });

  /*
   * 사유 칸을 세우는 세 경우. **필수인 것은 첫째뿐이다.**
   *
   * ⛔ 서버가 이 칸을 짚어 거부했는데 칸이 서 있지 않으면, 사용자는 **고칠 자리를 찾지 못한 채**
   * 같은 거부만 반복해서 본다 — 발행은 되돌릴 수 없는 쓰기이고 정정 경로가 없다.
   */
  const reasonServerError = write.fieldErrors.reissueReasonCode ?? null;
  const hasUnknownStatus =
    unit === ISSUE_UNIT.pallet
      ? palletId !== null && palletIssueCount === null
      : hasUnknownTarget(rows, selectedIds);
  const showReason = needsReason || hasUnknownStatus || reasonAsked;

  useEffect(() => {
    if (reasonServerError !== null) setReasonAsked(true);
  }, [reasonServerError]);

  const guard = issueGuard({
    workerNo: entry.workerNo,
    unit,
    selectedIds,
    palletId,
    palletContentCount: palletContents.data?.length ?? null,
    needsReason,
    reasonCode,
  });

  const issue = (): void => {
    if (!canIssue(guard)) return;

    setIssued(null);
    printFlow.reset();

    write.write({
      documentTypeCode: DOCUMENT_TYPE_CODE,
      /*
       * ⛔ **파렛트 발행은 `lotId` 를 싣지 않는다**(스펙 §5-2). 취급 단위 하나가 여러 LOT 을
       * 담아 한 칸에 못 담는다 — 아무 LOT 이나 골라 채우면 이력이 그 LOT 의 것으로 굳는다.
       */
      targets:
        unit === ISSUE_UNIT.pallet
          ? [{ targetTypeCode: PALLET_TARGET_TYPE_CODE, targetId: palletId as number }]
          : rows
              .filter((row) => selectedIds.includes(rowId(row.line)))
              .map((row) => ({
                targetTypeCode: LINE_TARGET_TYPE_CODE,
                targetId: row.line.goodsIssueLineId,
                lotId: row.line.lotId,
              })),
      /*
       * 재발행이 아닐 때는 보내지 않는다 — 신규 기록에 사유가 붙으면 이력이 거짓이 된다.
       * ⚠ 현황을 모르는 라인이 섞였을 때는 **고른 경우에만** 싣는다: 사용자가 고르지 않았으면
       * 화면이 대신 정하지 않고, 재발행인지의 판정을 서버에 맡긴다.
       */
      ...(showReason && reasonCode !== '' ? { reissueReasonCode: reasonCode } : {}),
    });
  };

  const firstIssued = issued?.[0] ?? null;
  const previewSrc =
    firstIssued === null
      ? null
      : `${baseUrl}/app/document-issues/${String(firstIssued.documentIssueLogId)}/rendition?format=png`;

  return (
    <main className="pop-shell pop-ui" aria-labelledby={titleId}>
      <header className="pop-header">
        <h1 id={titleId} className="pop-title">
          {t.title}
        </h1>
        {/* 맥락은 화면명 옆이다 — 오른쪽 끝은 사번·단말·프린터 같은 상태 자리다(스펙 §3 머리줄). */}
        {goodsIssue.data === undefined ? null : (
          <p className="pop-context">{`${t.entry.issueLabel} ${goodsIssue.data.goodsIssueNo}`}</p>
        )}
        <div className="pop-context-right">
          <PopWorkerTag workerNo={entry.workerNo} />
          <PrinterChip
            isLoading={printers.isPending}
            isError={printers.isError}
            statusMessage={defaultPrinter(printers.data)?.statusMessage ?? null}
            hasPrinter={(printers.data?.length ?? 0) > 0}
          />
          {/*
           * 단말도 상시 보인다(스펙 §3 머리줄 `POP-W1 ●`). 인쇄가 안 될 때 「이 단말이 무엇인가」가
           * 프린터 상태와 함께 있어야 현장이 어느 자리를 봐야 하는지 안다.
           */}
          <Chip status={identity.terminalId === null ? 'warning' : 'info'}>
            {`${t.device.terminalLabel} ${
              identity.terminalId === null ? t.device.terminalUnknown : String(identity.terminalId)
            }`}
          </Chip>
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

      {/*
       * ⚠ **인쇄 통로가 없는 것은 배너로 먼저 말한다.** 액션바 «아래»에 작은 글로 달아 두었는데,
       *    설계 §3 의 세로 예산은 액션바에서 끝나(768 슬랙 0) 그 줄이 화면 밖으로 밀렸다 —
       *    단말에서는 없는 문구가 된다.
       *
       * ⛔ 프린터가 0건인 것과 뭉치지 않는다 — 전자는 이 셸에서 찍을 수 없다는 뜻이고 후자는
       *    이 단말에 등록된 프린터가 없다는 뜻이라, 사용자가 손댈 곳이 다르다.
       */}
      {!hasPrintBridge() && (
        <div className="banner-slot">
          <AlertBanner variant="warning">{t.printer.noShell}</AlertBanner>
        </div>
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
          onSelectionChange={(ids) => {
            setSelectedIds(ids);
            /* 좁히는 LOT 이 바뀌면 앞서 고른 파렛트는 이 라인의 것이 아니다. */
            setPalletId(null);
            /* 대상이 바뀌면 앞 거부는 이 발행의 것이 아니다 — 물음도 함께 내린다. */
            setReasonAsked(false);
            write.clearFieldError('reissueReasonCode');
          }}
          itemNames={itemNames}
          lotNames={lotNames}
          uomNames={uomNames}
          isLoading={lines.isPending}
          isError={lines.isError}
        />
        <TargetPane
          selectedCount={selectedIds.length}
          unit={unit}
          onUnitChange={(next) => {
            setUnit(next);
            /* 유형이 바뀌면 앞 유형의 대상은 이 발행의 것이 아니다. */
            setPalletId(null);
            setReasonAsked(false);
            write.clearFieldError('reissueReasonCode');
          }}
          pallets={palletItems}
          palletsPending={pallets.isPending && palletSelectable}
          palletsFailed={pallets.isError}
          palletSelectable={palletSelectable}
          palletId={palletId}
          onPalletChange={(handlingUnitId) => {
            setPalletId(handlingUnitId);
            setReasonAsked(false);
            write.clearFieldError('reissueReasonCode');
          }}
          palletContents={
            palletContents.data === undefined
              ? null
              : {
                  lineCount: palletContents.data.length,
                  totalQty: palletContents.data.reduce((sum, content) => sum + content.qty, 0),
                }
          }
          issuedSeq={firstIssued?.issueSeq ?? null}
          showReason={showReason}
          needsReason={needsReason}
          hasUnknownStatus={hasUnknownStatus}
          reasonServerError={reasonServerError}
          reasonCode={reasonCode}
          onReasonChange={(code) => {
            setReasonCode(code);
            /* 고친 값 옆에 옛 거부를 남기지 않는다 — 저장소의 다른 화면들과 같은 처리다. */
            write.clearFieldError('reissueReasonCode');
          }}
          reasonOptions={reasonOptions}
          previewSrc={previewSrc}
        />
      </div>

      {/*
       * 액션바 — **화면 바닥의 띠**(설계 §3 · 88). 다른 POP 화면과 같은 이름(`pop-action-bar`)
       * 을 쓴다: `.pop-actions` 는 단추만 오른쪽으로 미는 줄이라 띠의 높이·경계선을 갖지 않아,
       * 이 화면만 바닥이 없는 것처럼 떠 있었다.
       */}
      <div className="pop-action-bar pop-giqr-actions">
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

const guardNote = (kind: Exclude<IssueGuard['kind'], 'ready'>): string => {
  switch (kind) {
    case 'noWorker':
      return t.action.disabledNoWorker;
    case 'noSelection':
      return t.action.disabledNoSelection;
    case 'palletNeedsOneLine':
      return t.action.disabledPalletNeedsOneLine;
    case 'noPallet':
      return t.action.disabledNoPallet;
    case 'emptyPallet':
      return t.action.disabledEmptyPallet;
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
    /*
     * ⛔ **인쇄 성공은 따로 말하지 않는다**(사용자 지시 2026-09-09). 바로 위에 「N건을
     *    발행했습니다」가 이미 서 있어 초록 띠가 둘로 겹쳤다 — 잘된 것을 두 번 말하면
     *    정작 봐야 할 «실패» 띠가 묻힌다. 아래 실패·미보고 갈래는 그대로 남긴다.
     */
    case 'printed':
      return null;
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
