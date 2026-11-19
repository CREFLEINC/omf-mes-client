import { messages } from '@omf-mes/i18n';
import { useEffect, useRef, useState } from 'react';

import { soleProcessIdOf, usePopIdentity } from '../../patterns/pop-identity';
import {
  PuActionBar,
  PuButton,
  PuChip,
  PuCols,
  PuCount,
  PuEmpty,
  PuNote,
  PuScanField,
  PuScreen,
  PuSection,
  PuSeg,
  puToast,
} from '../../patterns/pop-uniform';
import { useIsOnline } from './connection';
import { useRepackLabelEntry } from './entry-context';
import { ErrorBanner } from './error-banner';
import { HandlingUnitPane, typeText } from './handling-unit-pane';
import { HistoryPane } from './history-pane';
import { IssuePane, IssuePrinter } from './issue-pane';
import { issueBody } from './issue-body';
import { IssuePreviewDialog } from './issue-preview-dialog';
import { useDocumentIssue } from './mutations';
import { usePackingLabelDraw } from './packing-label';
import { PendingPane } from './pending-pane';
import { PreviewDialog } from './preview-dialog';
import { ReasonField } from './reason-field';
import {
  useContentRows,
  useHandlingUnit,
  useIssueHistory,
  useIssueStanding,
  useRepackRows,
  type PendingRepackRow,
  usePrinters,
  useHandlingUnitTypes,
  useReissueReasons,
  useRemainderCandidates,
} from './queries';
import { useTerminalGate } from './terminal-gating';
import {
  needsReason,
  PRINT_FAILURE_REASON_CODE,
  lotCount,
  type DocumentIssue,
  type DocumentIssueCreate,
  type IssueStanding,
  type Printer,
} from './types';
import { useIssuePrintRunner, type IssuePrintTarget } from './use-issue-print';
import './uniform.css';

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
  const entry = useRepackLabelEntry();
  const identity = usePopIdentity();
  const gate = useTerminalGate(identity.terminalId, soleProcessIdOf(identity.processes));
  const isOnline = useIsOnline();

  /** 왼쪽 탭(#295 시안) — 발행 대기 = 발행 기록 없는 포장, 재발행 = 한 번 이상 발행한 포장. */
  const [tab, setTab] = useState<'WAIT' | 'REISSUE'>('WAIT');
  const [scanValue, setScanValue] = useState('');
  const [scanError, setScanError] = useState<string | null>(null);
  /** 발행 대기의 발행 전 미리보기 창 — 기록을 만들지 않는다. */
  const [issuePreviewOpen, setIssuePreviewOpen] = useState(false);
  /** 고른 발행 대기 줄 — 발행 뒤 목록에서 빠져도 정보 띠는 고를 때의 값을 그대로 보인다. */
  const [selectedRow, setSelectedRow] = useState<PendingRepackRow | null>(null);
  const selectedHandlingUnitId = selectedRow?.handlingUnitId ?? null;
  const [isListFolded, setListFolded] = useState(false);
  const [includeNewLabel, setIncludeNewLabel] = useState(true);
  const [selectedRemainderIds, setSelectedRemainderIds] = useState<number[]>([]);
  const [reasonCode, setReasonCode] = useState('');
  const [pickedPrinter, setPickedPrinter] = useState('');
  const [printQueue, setPrintQueue] = useState<IssuePrintTarget[]>([]);
  const [lastIssueBody, setLastIssueBody] = useState<DocumentIssueCreate | null>(null);
  /** 한 배치의 앞 라벨이 실패해 재발행해도 뒤 라벨 순서를 잃지 않는다. */
  const queueAfterRetry = useRef<IssuePrintTarget[]>([]);
  /**
   * 이번 그림 받기가 [발번·인쇄]에서 시작됐는가 — 그렇다면 미리보기 창 없이 바로 찍는다
   * (사용자 지시 2026-09-17). 창은 [미리보기]를 눌렀을 때만 연다.
   */
  const printDirectly = useRef(false);
  /**
   * 열린 인쇄 창. `preview` 는 [미리보기]로 연 발행된 라벨 창, `reason` 은 [발번·인쇄]에서 사유가
   * 필요할 때 여는 사유 창이다. 둘 다 창 안에서 재발행 사유를 고르고 [인쇄]로 발행·인쇄한다
   * (사용자 지시 2026-09-17). `ids` 는 [인쇄]가 발행할 포장이다.
   */
  const [dialog, setDialog] = useState<{ mode: 'preview' | 'reason'; ids: number[] } | null>(null);
  /** 마지막으로 사유와 함께 보낸 포장 — 서버가 사유를 지목해 돌려주면 그 창을 다시 연다. */
  const lastReasonIds = useRef<number[]>([]);

  const pending = useRepackRows(false);
  const reissued = useRepackRows(true);
  const listQuery = tab === 'WAIT' ? pending : reissued;
  const handlingUnit = useHandlingUnit(selectedHandlingUnitId);
  const contents = useContentRows(handlingUnit.data?.contents ?? []);
  const standingQuery = useIssueStanding(selectedHandlingUnitId);
  const history = useIssueHistory(selectedHandlingUnitId);
  const remainder = useRemainderCandidates(selectedHandlingUnitId);
  const printers = usePrinters();
  const reasons = useReissueReasons();
  /* 《대상 포장》의 유형 칸이 코드가 아니라 표시명으로 서게 한다(#1045). */
  const handlingUnitTypes = useHandlingUnitTypes();
  const drawLabel = usePackingLabelDraw();
  const printRunner = useIssuePrintRunner(entry.workerNo, drawLabel);

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
        issueSeq: issued.issueSeq,
        label: issued.target.displayName,
      }));
      const [first, ...rest] = targets;

      setPrintQueue([...rest, ...queueAfterRetry.current]);
      queueAfterRetry.current = [];
      setDialog(null);
      if (first !== undefined) {
        printDirectly.current = true;
        void printRunner.begin(first);
      }
    },
  });

  /* [발번·인쇄]로 받은 그림은 창을 띄우지 않고 곧장 인쇄로 넘긴다. */
  useEffect(() => {
    if (printRunner.state.phase !== 'preview' || !printDirectly.current) return;

    void printRunner.print();
  }, [printRunner]);

  /* 여러 대상을 한 트랜잭션으로 발행한 뒤에는 각 렌디션을 한 장씩 확인·인쇄한다. */
  useEffect(() => {
    if (printRunner.state.phase !== 'succeeded') return;

    const [next, ...rest] = printQueue;
    if (next === undefined) return;

    setPrintQueue(rest);
    printDirectly.current = true;
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
    if (selectedHandlingUnitId === null) {
      return tab === 'WAIT' ? t.entry.missingHandlingUnit : t.entry.missingReissue;
    }
    if (standingQuery.isPending) return t.issue.summaryLoading;
    if (standingQuery.isError) return t.issue.summaryFailed;
    if (selectedIds.length === 0) return t.issue.targetRequired;
    if (entry.workerNo === null) return t.entry.missingWorker;
    if (gate.verdict !== 'allowed') return t.gate[gate.verdict];
    if (!isOnline) return t.gate.offline;

    return null;
  })();

  const sendIssue = (handlingUnitIds: readonly number[], withReason: boolean): void => {
    if (entry.workerNo === null || handlingUnitIds.length === 0) return;
    if (withReason && reasonCode === '') return;

    printRunner.reset();
    setPrintQueue([]);
    queueAfterRetry.current = [];
    /* 사유 없이 보냈어도 서버가 「사유 필요」로 거절할 수 있다(발행 현황이 낡았을 때) — 대상을 기억한다. */
    lastReasonIds.current = [...handlingUnitIds];
    setDialog(null);
    const body = issueBody({
      handlingUnitIds,
      printerName,
      reasonCode,
      reasonRequired: withReason,
    });
    setLastIssueBody(body);
    issue.write(body);
  };

  /* [발번·인쇄] — 사유가 필요하면 사유 창을 먼저 연다. 아니면 곧장 발행·인쇄한다. */
  const submit = (): void => {
    if (reasonRequired) {
      setDialog({ mode: 'reason', ids: selectedIds });
      return;
    }

    sendIssue(selectedIds, false);
  };

  /* 서버가 사유를 지목해 돌려줬다 — 사유 칸이 있는 창을 다시 열어 그 자리에서 고치게 한다. */
  const reasonServerError = issue.fieldErrors.reissueReasonCode ?? null;
  useEffect(() => {
    if (reasonServerError === null || lastReasonIds.current.length === 0) return;

    setDialog((current) => current ?? { mode: 'reason', ids: lastReasonIds.current });
  }, [reasonServerError]);

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

  const selectHandlingUnit = (row: PendingRepackRow): void => {
    setSelectedRow(row);
    setIncludeNewLabel(true);
    setSelectedRemainderIds([]);
    setReasonCode('');
    setDialog(null);
    setPrintQueue([]);
    setLastIssueBody(null);
    queueAfterRetry.current = [];
    printRunner.reset();
    issue.reset();
    issue.discardIdempotencyKey();
  };

  const clearSelection = (): void => {
    setSelectedRow(null);
    setDialog(null);
    setPrintQueue([]);
    setLastIssueBody(null);
    queueAfterRetry.current = [];
    printRunner.reset();
    issue.reset();
  };

  const chooseTab = (next: 'WAIT' | 'REISSUE'): void => {
    if (next === tab) return;
    setTab(next);
    setScanValue('');
    setScanError(null);
    clearSelection();
  };

  /* 재발행 탭 스캔 — 새 포장 · 원 포장 · 잔량 번호 중 하나로 찾는다(#295 시안). */
  const submitScan = (code: string): void => {
    const has = (row: PendingRepackRow): boolean =>
      row.handlingUnitNo === code || row.sourceNos.includes(code) || row.remainderNo === code;
    const found = (reissued.data ?? []).find(has);
    setScanValue('');
    if (found !== undefined) {
      setScanError(null);
      selectHandlingUnit(found);
      return;
    }
    setScanError(
      (pending.data ?? []).some(has) ? t.pending.scanNotIssued(code) : t.pending.scanMissing(code),
    );
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
            issueSeq: latestIssue.issueSeq,
            label: latestIssue.target.displayName,
          });

    if (target === null) return;

    printDirectly.current = false;
    /* 미리보기가 뜬다는 것은 이미 발행한 라벨이라는 뜻이다 — [인쇄]는 사유를 받아 재발행한다. */
    setDialog({ mode: 'preview', ids: [target.targetId] });
    void printRunner.begin(target);
  };

  const isBlocked = blockedReason !== null || isSubmitting;
  /* 처음 발행이 아니면 [재발행] — 사유를 받아 회차가 하나 오른다(시안 「재발행 (N장)」). */
  const isReissue =
    tab === 'REISSUE' || (standingQuery.data !== undefined && needsReason(standing));
  /*
   * 발행 대기는 발행 «전» 미리보기(라벨 모양만, 기록 없음), 재발행은 발행된 라벨 미리보기·재인쇄.
   */
  const canPreview = isReissue
    ? isOnline && (latestIssue !== null || printRunner.state.target !== null)
    : isOnline && handlingUnit.data !== undefined && selectedIds.length > 0 && !isSubmitting;

  /* 인쇄까지 끝났으면 결과 알림 한 줄(규칙 13 · 사용자 지시 2026-09-17 「그 한 줄만」). */
  const allPrinted = phase === 'succeeded' && printQueue.length === 0;
  useEffect(() => {
    if (allPrinted) puToast(t.print.succeeded, 'ok');
  }, [allPrinted]);

  const typeSource = {
    entries: (handlingUnitTypes.data ?? []).map((value) => ({
      value: value.code,
      label: value.codeName,
      isActive: value.isActive,
    })),
    isError: handlingUnitTypes.isError,
    isLoading: handlingUnitTypes.isPending,
  };
  const newLabelBody = ((): string => {
    if (handlingUnit.data === undefined) return t.handlingUnit.unknownValue;
    const rows = contents.rows;
    const uoms = new Set(rows.map((row) => row.uomCode));
    const [uom] = [...uoms];
    /* 단위가 섞이면 수량을 더하지 않는다 — 다른 단위의 합은 뜻이 없다. */
    const qtyText =
      rows.length > 0 && uoms.size === 1
        ? `${String(rows.reduce((sum, row) => sum + row.qty, 0))} ${uom ?? t.handlingUnit.unknownValue}`
        : null;

    return t.issue.newBody(
      typeText(typeSource, handlingUnit.data.handlingUnit.handlingUnitTypeCode),
      t.handlingUnit.mixedLot(lotCount(rows)),
      qtyText,
    );
  })();
  const labelCount = selectedIds.length;
  const remainderList = remainder.data ?? [];
  const allSelectable = 1 + remainderList.length;

  /*
   * ⛔ **작업 줄에는 안내 글을 두지 않는다**(규칙 3). 대상 미선택 · 사번 미확인 · 인쇄 대상 미선택은
   *    다른 자리가 이미 말하므로 빼고, 남은 막힘(회차 조회 · 단말 권한 · 오프라인)만 구획 안 한 줄로.
   */
  const blockedNote =
    blockedReason !== null &&
    blockedReason !== t.entry.missingHandlingUnit &&
    blockedReason !== t.entry.missingReissue &&
    blockedReason !== t.entry.missingWorker &&
    blockedReason !== t.issue.targetRequired
      ? blockedReason
      : null;

  return (
    /* ⚠ POP 라우트는 관리웹 셸을 지나지 않는다 — 이 화면이 최상위 랜드마크다. */
    <main className="pop-ui" aria-label={t.title}>
      <PuScreen
        actionBar={
          <PuActionBar>
            <PuButton
              disabled={!canPreview}
              onClick={
                isReissue
                  ? openPreview
                  : () => {
                      setIssuePreviewOpen(true);
                    }
              }
            >
              {isReissue ? t.issue.previewReissue : t.issue.preview}
            </PuButton>
            <PuButton variant="primary" onClick={submit} disabled={isBlocked}>
              {isReissue
                ? labelCount > 0
                  ? t.issue.reissueCount(labelCount)
                  : t.issue.reissue
                : labelCount > 0
                  ? t.issue.submitCount(labelCount)
                  : t.issue.submit}
            </PuButton>
          </PuActionBar>
        }
      >
        <PuCols variant="list" className="rpk-cols">
          <PuSection
            head={
              <PuSeg
                label={t.pending.tabsLabel}
                value={tab}
                options={[
                  {
                    value: 'WAIT' as const,
                    disabled: isSubmitting,
                    label: (
                      <>
                        {t.pending.sectionLabel}
                        {pending.data === undefined ? null : (
                          <PuCount>{pending.data.length}</PuCount>
                        )}
                      </>
                    ),
                  },
                  {
                    value: 'REISSUE' as const,
                    disabled: isSubmitting,
                    label: t.pending.reissueTab,
                  },
                ]}
                onChange={chooseTab}
              />
            }
            fold={{
              label: tab === 'WAIT' ? t.pending.sectionLabel : t.pending.reissueTab,
              folded: isListFolded,
              onChange: setListFolded,
            }}
            bodyClassName="rpk-left"
          >
            <PendingPane
              key={tab}
              rows={listQuery.data ?? []}
              selectedId={selectedHandlingUnitId}
              isLoading={listQuery.isPending}
              isError={listQuery.isError}
              scan={
                tab === 'REISSUE' ? (
                  <PuScanField
                    label={t.pending.scanLabel}
                    value={scanValue}
                    placeholder={t.pending.scanPlaceholder}
                    disabled={isSubmitting}
                    error={scanError ?? undefined}
                    manual={{ title: t.pending.manualTitle, label: t.pending.scanLabel }}
                    onChange={(value) => {
                      setScanValue(value);
                      setScanError(null);
                    }}
                    onSubmit={submitScan}
                  />
                ) : undefined
              }
              disabled={isSubmitting}
              onSelect={(row) => {
                setScanError(null);
                selectHandlingUnit(row);
              }}
              onRetry={() => {
                void listQuery.refetch();
              }}
            />
          </PuSection>

          <PuSection
            title={t.handlingUnit.sectionLabel}
            meta={
              selectedRow === null ? undefined : (
                <>
                  {standingQuery.data !== undefined && (standing.issueCount ?? 0) > 0 && (
                    <PuChip tone="warn">{t.issue.standing(standing.issueCount ?? 0)}</PuChip>
                  )}
                  <PuButton
                    size="sm"
                    disabled={labelCount === allSelectable}
                    onClick={() => {
                      setIncludeNewLabel(true);
                      setSelectedRemainderIds(
                        remainderList.map((candidate) => candidate.handlingUnit.handlingUnitId),
                      );
                    }}
                  >
                    {t.issue.selectAll(allSelectable)}
                  </PuButton>
                  <PuButton
                    size="sm"
                    disabled={labelCount === 0}
                    onClick={() => {
                      setIncludeNewLabel(false);
                      setSelectedRemainderIds([]);
                    }}
                  >
                    {t.issue.clearSelection}
                  </PuButton>
                </>
              )
            }
            bodyClassName="rpk-right"
          >
            {(entry.workerNo === null || entry.workerNo.trim() === '') && (
              <PuNote tone="warn">{messages.popChrome.workerMissing}</PuNote>
            )}

            {issue.error !== null && lastIssueBody !== null && (
              <ErrorBanner
                error={issue.error}
                title={t.error.issueTitle}
                onRetry={() => issue.write(lastIssueBody)}
              />
            )}

            {phase === 'renditionFailed' && (
              <PuNote
                tone="bad"
                action={
                  /*
                   * ⚠ 같은 발행 기록의 그림을 «다시 받는다». [미리보기]로 부르면 창이 떠 [재인쇄]가
                   *   재발행을 하나 더 만든다 — 바로 인쇄 중이던 흐름이면 바로 인쇄로 이어 간다.
                   */
                  <PuButton
                    size="sm"
                    onClick={() => {
                      const target = printRunner.state.target;
                      if (target !== null) void printRunner.begin(target);
                    }}
                  >
                    {messages.common.retry}
                  </PuButton>
                }
              >
                <b>{t.preview.failed}</b> {t.print.failedBody}
              </PuNote>
            )}

            {phase === 'shellUnavailable' && (
              <PuNote>
                <b>{t.print.issued}</b> {t.print.shellUnavailable}
              </PuNote>
            )}

            {phase === 'failed' && (
              <PuNote
                tone="bad"
                action={
                  /* ⛔ 눌러도 안 되면 비활성으로 보인다(#1093) — 대상 · 사번 없이는 되돌아온다. */
                  <PuButton
                    size="sm"
                    disabled={printRunner.state.target === null || entry.workerNo === null}
                    onClick={retryFailedPrint}
                  >
                    {t.print.retry}
                  </PuButton>
                }
              >
                <b>{t.print.failedTitle}</b> {t.print.failedBody}
              </PuNote>
            )}

            {phase === 'reportFailed' && (
              <PuNote
                tone="warn"
                action={
                  <PuButton
                    size="sm"
                    onClick={() => {
                      void printRunner.retryReport();
                    }}
                  >
                    {t.print.reportRetry}
                  </PuButton>
                }
              >
                <b>{t.print.reportFailedTitle}</b> {t.print.reportFailedBody}
              </PuNote>
            )}

            {blockedNote !== null && (
              <PuNote
                tone="warn"
                live
                action={
                  gate.verdict === 'unavailable' ? (
                    <PuButton size="sm" onClick={gate.retry}>
                      {t.issue.gateRetry}
                    </PuButton>
                  ) : undefined
                }
              >
                {blockedNote}
              </PuNote>
            )}

            {selectedRow === null ? (
              <PuEmpty
                icon="list"
                title={tab === 'WAIT' ? t.entry.missingHandlingUnit : t.entry.missingReissue}
              />
            ) : handlingUnit.data === undefined ? (
              <PuEmpty
                icon={handlingUnit.isError ? 'bad' : 'box'}
                title={handlingUnit.isError ? t.handlingUnit.loadFailed : t.handlingUnit.loading}
              />
            ) : (
              <>
                <HandlingUnitPane
                  handlingUnit={handlingUnit.data.handlingUnit}
                  row={selectedRow}
                  rows={contents.rows}
                  namesFailed={contents.isNameError}
                  types={typeSource}
                />
                <IssuePane
                  selectedHandlingUnitNo={handlingUnit.data.handlingUnit.handlingUnitNo}
                  newLabelBody={newLabelBody}
                  includeNewLabel={includeNewLabel}
                  onIncludeNewLabelChange={setIncludeNewLabel}
                  remainderCandidates={remainderList}
                  selectedRemainderIds={selectedRemainderIds}
                  onRemainderChange={toggleRemainder}
                  remainderFailed={remainder.isError}
                  targetRequired={blockedReason === t.issue.targetRequired}
                  standing={standingQuery.data ?? null}
                  standingFailed={standingQuery.isError}
                  onStandingRetry={() => {
                    void standingQuery.refetch();
                  }}
                />
                {/* 발행 이력은 「재발행」 탭에서만 선다 — 발행 대기에서는 늘 비어 있다(시안). */}
                {tab === 'REISSUE' && (history.isError || (history.data ?? []).length > 0) && (
                  <HistoryPane issues={history.data ?? []} isFailed={history.isError} />
                )}
              </>
            )}
          </PuSection>
        </PuCols>

        <IssuePrinter
          printers={printerList}
          printersFailed={printers.isError}
          printerName={printerName}
          onPrinterChange={setPickedPrinter}
        />

        {issuePreviewOpen && selectedHandlingUnitId !== null && (
          <IssuePreviewDialog
            draw={drawLabel}
            targets={selectedIds.map((handlingUnitId) => ({
              handlingUnitId,
              /* 미리보기에 찍는 회차는 «다음» 회차 — 실제 회차는 서버가 매긴다. */
              issueSeq:
                (handlingUnitId === selectedHandlingUnitId
                  ? (standing.issueCount ?? 0)
                  : (remainderList.find((c) => c.handlingUnit.handlingUnitId === handlingUnitId)
                      ?.standing.issueCount ?? 0)) + 1,
            }))}
            canIssue={!isBlocked}
            onIssue={() => {
              setIssuePreviewOpen(false);
              submit();
            }}
            onClose={() => {
              setIssuePreviewOpen(false);
            }}
          />
        )}

        <PreviewDialog
          open={dialog !== null && (dialog.mode === 'reason' || phase !== 'renditionFailed')}
          mode={dialog?.mode ?? 'preview'}
          reasonField={
            <ReasonField
              reasons={reasons.data ?? []}
              reasonsFailed={reasons.isError}
              reasonCode={reasonCode}
              onReasonChange={setReasonCode}
              serverError={reasonServerError}
            />
          }
          count={dialog?.ids.length ?? 0}
          canPrint={reasonCode !== '' && !isSubmitting}
          imageUrl={printRunner.state.imageUrl}
          isPrinting={isSubmitting}
          onPrint={() => {
            if (dialog !== null) sendIssue(dialog.ids, true);
          }}
          onClose={() => {
            if (dialog?.mode === 'preview') printRunner.dismiss();
            setDialog(null);
          }}
        />
      </PuScreen>
    </main>
  );
};
