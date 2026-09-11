import { AlertBanner, Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useMemo, useState } from 'react';

import { popTouchClass } from '../../patterns/pop-touch';
import {
  DELIVERY_LABEL,
  DELIVERY_LABEL_ISSUE_LOCKED,
  PACKING_LABEL,
  type LabelKind,
} from './codes';
import { useShippingLabelEntry } from './entry-context';
import { HistoryDialog } from './history-dialog';
import { IssueOutcome } from './issue-outcome';
import { LabelKindRadio } from './label-kind-radio';
import { PreviewDialog } from './preview-dialog';
import { PrinterSelect } from './printer-select';
import {
  useAllocations,
  useHandlingUnits,
  useIssueHistory,
  useIssueSummaries,
  usePrinters,
  useReissueReasons,
  useShipment,
} from './queries';
import { ReissuePane } from './reissue-pane';
import { TargetTable } from './target-table';
import { useLabelIssue } from './mutations';
import {
  isDelivery,
  needsReissueReason,
  toDeliveryRow,
  toPackingRow,
  toDefaultPrinterName,
  type TargetRow,
} from './types';

const t = messages.shippingPackingLabel;

export interface ShipmentLabelPanelProps {
  shipmentId?: number | null;
  workerNo?: string | null;
  embedded?: boolean;
}

/**
 * `P-04-01` 안의 납품·포장 라벨 상태·재출력 구획.
 *
 * 스펙 §3 배치를 따른다 — **세로 네 구획**: ① 라벨 종류 · ② 대상 · ③ 재출력 · ④ 프린터.
 * 좌우로 펴지 않는다. 1024×768 에서 세로 예산의 슬랙이 0 이라 ③은 **재발행일 때만 펼친다**
 * (스펙 §3-1) — 늘 띄우면 그 자리만큼 목록이 줄어든다.
 *
 * ⭐ **발행 시점이 갈리는 두 라벨이 한 화면에 있다**(스펙 §5-1). 포장 라벨은 포장 즉시,
 * 납품 라벨은 OQC 합격 후다. 종류를 먼저 고르고 대상 목록이 그에 따라 갈린다.
 *
 * ⭐ **화면 순서가 「발행 → 미리보기 → 인쇄」다.** 그리기 경로가 발행 기록 번호를 받으므로
 * 발행 전 미리보기는 이번 계약에 없다(착수 이슈 §6).
 */
export const ShippingPackingLabelScreen = ({
  shipmentId: shipmentIdOverride,
  workerNo: workerNoOverride,
  embedded = false,
}: ShipmentLabelPanelProps = {}) => {
  /*
   * 귀속 사번은 **셸이 아는 값**이다(진입점 화면 소관). 쓰기가 헤더로 요구하므로 없으면
   * 부를 수 없고, 그 사실을 감추지 않고 사유로 보인다(공유계약 F-1 · F-6).
   *
   * ⚠ 셸이 채우는 자리(`pop-identity`)는 저장소에 공급자가 아직 없어 **항상 비어 있다** —
   * 진입 주소에서 받는다(전례 `P-02-05`). 셸이 서면 `entry-context` 하나가 바뀐다.
   */
  const entry = useShippingLabelEntry();
  const shipmentId = shipmentIdOverride === undefined ? entry.shipmentId : shipmentIdOverride;
  const workerNo = workerNoOverride === undefined ? entry.workerNo : workerNoOverride;
  const shipment = useShipment(shipmentId);

  /*
   * ⛔ **종류를 미리 골라 두지 않는다.** 스펙 §5-7 이 「대상 선택 | 종류 선택됨」으로 적어
   * 종류 이전의 상태를 인정한다. 하나를 기본으로 세워 두면 사용자가 고르지 않은 종류의
   * 대상이 목록에 서고, 그것을 그대로 발행하면 **엉뚱한 라벨이 나온다.**
   */
  const [kind, setKind] = useState<LabelKind | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [reissueReasonCode, setReissueReasonCode] = useState<string | null>(null);
  const [printerName, setPrinterName] = useState<string | null>(null);
  const [historyTargetId, setHistoryTargetId] = useState<number | null>(null);
  const [isPreviewOpen, setPreviewOpen] = useState(false);
  const [isRecoveryPrintQueued, setRecoveryPrintQueued] = useState(false);

  const allocations = useAllocations(shipmentId);
  const allocationItems = useMemo(() => allocations.data ?? [], [allocations.data]);
  const units = useHandlingUnits(allocationItems, embedded || (kind !== null && !isDelivery(kind)));

  const packingRows = useMemo(() => units.units.map(toPackingRow), [units.units]);
  const deliveryRows = useMemo(
    () =>
      allocationItems.map((allocation) =>
        toDeliveryRow(
          allocation,
          t.targets.status.passed,
          t.targets.status.waiting,
          t.targets.unnamed,
        ),
      ),
    [allocationItems],
  );

  /*
   * 목록 줄은 종류마다 다른 것에서 나오지만(배분 ↔ 취급 단위) **같은 모양으로 편다** —
   * 갈라 두면 표 컴포넌트가 둘이 되고 회차 열을 두 번 고치게 된다.
   */
  const rows: TargetRow[] = useMemo(() => {
    if (kind === null) return [];

    return isDelivery(kind) ? deliveryRows : packingRows;
  }, [deliveryRows, kind, packingRows]);

  /*
   * ⛔ **서버에 묻는 것은 줄 식별자가 아니라 대상 식별자다**(`issueTargetId`). 납품 라벨은
   * 한 LOT 이 여러 배분으로 갈릴 수 있어 유일하게 만든다 — 같은 값을 두 번 물으면 서버가
   * 같은 회차를 두 줄로 돌려주고 화면이 그중 하나만 보게 된다.
   */
  const packingTargetIds = useMemo(
    () => [...new Set(packingRows.map((row) => row.issueTargetId))],
    [packingRows],
  );
  const deliveryTargetIds = useMemo(
    () => [...new Set(deliveryRows.map((row) => row.issueTargetId))],
    [deliveryRows],
  );
  const packingSummaries = useIssueSummaries(
    embedded || kind === PACKING_LABEL ? PACKING_LABEL : null,
    packingTargetIds,
  );
  const deliverySummaries = useIssueSummaries(
    embedded || kind === DELIVERY_LABEL ? DELIVERY_LABEL : null,
    deliveryTargetIds,
  );
  const summaries = kind === DELIVERY_LABEL ? deliverySummaries : packingSummaries;
  const summaryItems = useMemo(() => summaries.data ?? [], [summaries.data]);
  const packingPrinters = usePrinters(embedded || kind === PACKING_LABEL ? PACKING_LABEL : null);
  const deliveryPrinters = usePrinters(embedded || kind === DELIVERY_LABEL ? DELIVERY_LABEL : null);
  const printers = kind === DELIVERY_LABEL ? deliveryPrinters : packingPrinters;

  /*
   * ⛔ **재발행 여부를 화면이 세지 않는다.** 서버가 준 발행 횟수로만 가른다 — 화면이 세면
   * 다른 단말이 찍은 회차를 놓친다(스펙 §5-4).
   */
  const selectedRows = useMemo(
    () => rows.filter((row) => selectedIds.includes(row.targetId)),
    [rows, selectedIds],
  );
  const selectedIssueTargetIds = useMemo(
    () => [...new Set(selectedRows.map((row) => row.issueTargetId))],
    [selectedRows],
  );
  const isReissue = needsReissueReason(selectedIssueTargetIds, summaryItems);
  const alreadyIssuedCount = selectedIssueTargetIds.filter((id) =>
    summaryItems.some((summary) => summary.targetId === id && summary.issueCount > 0),
  ).length;
  const firstIssueCount = selectedIssueTargetIds.length - alreadyIssuedCount;
  const hasMixedIssueModes = alreadyIssuedCount > 0 && firstIssueCount > 0;

  const reissueReasons = useReissueReasons(isReissue);
  const history = useIssueHistory(kind, historyTargetId);
  const issue = useLabelIssue({ workerNo });

  const missingPackingRows = useMemo(
    () =>
      packingRows.filter((row) =>
        packingSummaries.data?.some(
          (summary) => summary.targetId === row.issueTargetId && summary.issueCount === 0,
        ),
      ),
    [packingRows, packingSummaries.data],
  );
  const missingDeliveryRows = useMemo(
    () =>
      deliveryRows.filter(
        (row) =>
          row.isIssuable &&
          deliverySummaries.data?.some(
            (summary) => summary.targetId === row.issueTargetId && summary.issueCount === 0,
          ),
      ),
    [deliveryRows, deliverySummaries.data],
  );
  const oqcWaitingCount = deliveryRows.filter((row) => !row.isIssuable).length;
  const recoveryReissueCount = [
    ...(packingSummaries.data ?? []),
    ...(deliverySummaries.data ?? []),
  ].filter((summary) => summary.issueCount > 0 && summary.lastPrintOutcome !== 'SUCCEEDED').length;

  const printerItems = printers.data ?? [];
  /* 고르지 않았으면 기본 프린터를 쓴다 — 계약이 `printer_name` 을 선택으로 둔다(스펙 §6). */
  const effectivePrinterName = printerName ?? toDefaultPrinterName(printerItems);

  const isBusy = issue.phase === 'issuing' || issue.phase === 'printing';
  const isListError = allocations.isError || units.isError || (kind !== null && summaries.isError);
  const isListPending =
    allocations.isPending || units.isPending || (kind !== null && summaries.isPending);
  const isRecoveryError =
    allocations.isError ||
    units.isError ||
    (packingTargetIds.length > 0 && packingSummaries.isError) ||
    (deliveryTargetIds.length > 0 && deliverySummaries.isError);
  const isRecoveryPending =
    allocations.isPending ||
    units.isPending ||
    (packingTargetIds.length > 0 && packingSummaries.isPending) ||
    (deliveryTargetIds.length > 0 && deliverySummaries.isPending);

  /* 복구 액션은 이름 그대로 물리 인쇄까지 이어 간다. 발행만 남기면 다음 재진입 때 재출력이 된다. */
  useEffect(() => {
    if (!isRecoveryPrintQueued) return;
    if (issue.result.failedAt === 'issue') {
      setRecoveryPrintQueued(false);

      return;
    }
    if (issue.phase !== 'issued' || issue.labels.length === 0) return;

    setRecoveryPrintQueued(false);
    issue.print();
  }, [isRecoveryPrintQueued, issue]);
  /**
   * 발행할 수 있는가 — **막는 사유가 넷이다.**
   *
   * ⛔ 감추지 않고 **왜 못 하는지** 보인다(공유계약 F-1). 비활성만 두면 사용자는 화면이
   * 고장 난 줄 안다.
   */
  const blockedReason = ((): string | null => {
    if (issue.phase !== 'idle') return t.actions.finishCurrentIssue;
    if (workerNo === null) return t.actions.needsWorker;
    if (selectedRows.length === 0) return t.actions.needsTarget;
    if (summaries.isPending) return t.actions.checkingHistory;
    if (summaries.isError) return t.actions.historyUnavailable;
    if (hasMixedIssueModes) return t.actions.mixedIssueModes;
    if (isReissue && reissueReasonCode === null) return t.actions.needsReason;

    return null;
  })();

  const startIssue = (): void => {
    if (kind === null || blockedReason !== null) return;
    if (DELIVERY_LABEL_ISSUE_LOCKED && kind === DELIVERY_LABEL) return;

    issue.issue({
      kind,
      rows: selectedRows,
      printerName: effectivePrinterName,
      /* ⛔ 신규 발행에 사유가 붙으면 이력이 거짓이 된다 — 재발행일 때만 싣는다(계약 명시). */
      reissueReasonCode: isReissue ? reissueReasonCode : null,
    });
  };

  /* 빈 목록의 «이유»가 셋이다 — 종류를 안 골랐다 / 포장이 없다 / 배분이 없다. */
  const emptyMessage =
    kind === null
      ? t.targets.beforeKind
      : isDelivery(kind)
        ? t.targets.empty
        : t.targets.emptyPacking;

  return (
    /*
     * ⚠ **이 화면이 최상위 랜드마크다.** POP 라우트는 관리웹 셸을 지나지 않으므로(`routes/pop`)
     * `main` 을 세워 주는 바깥이 없다 — 먼저 선 POP 화면들과 같은 형태다.
     */
    <section
      className={`pop-slabel-screen pop-ui${embedded ? ' pop-slabel-screen--embedded' : ''}`}
      aria-label={t.title}
    >
      {/*
       * 머리줄은 **다른 POP 화면과 같은 어휘로 쓴다**(`pop-header` · `pop-title` ·
       * `pop-context-right`). 이 화면만 자기 이름(`pop-slabel-head`)과 DS `PageHeader` 로
       * 세웠더니 규격(`app/pop.css` 「머리줄」)이 이 화면에만 걸리지 않아, 머리줄이 358px 로
       * 늘고 배경도 구분선도 없이 떴다(실측 — 다른 화면은 72px).
       */}
      {!embedded ? (
        <header className="pop-header">
          <h1 className="pop-title">{t.title}</h1>
          {shipmentId === null ? null : (
            /* 맥락은 화면명 옆이다 — 오른쪽 끝은 상태 자리다(스펙 §3 머리줄). */
            <p className="pop-context">
              {shipment.isPending
                ? t.shipment.loading
                : shipment.isError || shipment.data === undefined
                  ? t.shipment.loadFailed
                  : t.shipment.context(shipment.data.shipmentNo)}
            </p>
          )}
        </header>
      ) : null}

      {shipmentId === null ? (
        // ⛔ 출하가 없으면 아무 목록도 그리지 않는다 — 남의 출하 라벨을 뽑게 된다.
        <AlertBanner variant="warning">{t.shipment.missing}</AlertBanner>
      ) : (
        <>
          {embedded ? (
            <section className="pane pop-fixed pop-slabel-recovery" aria-label={t.recovery.title}>
              <h2 className="pane-title">{t.recovery.title}</h2>
              {isRecoveryError ? (
                <AlertBanner
                  variant="error"
                  action={
                    <Button
                      className={popTouchClass('normal')}
                      variant="outlined"
                      size="xl"
                      onClick={() => {
                        void allocations.refetch();
                        units.refetch();
                        void packingSummaries.refetch();
                        void deliverySummaries.refetch();
                      }}
                    >
                      {t.targets.retry}
                    </Button>
                  }
                >
                  {t.recovery.loadFailed}
                </AlertBanner>
              ) : (
                <div className="pop-slabel-recovery-actions">
                  <span>{t.recovery.packingMissing(missingPackingRows.length)}</span>
                  <Button
                    className={popTouchClass('normal')}
                    variant="outlined"
                    size="xl"
                    disabled={
                      isRecoveryPending ||
                      missingPackingRows.length === 0 ||
                      workerNo === null ||
                      issue.phase !== 'idle'
                    }
                    onClick={() => {
                      setRecoveryPrintQueued(true);
                      issue.issue({
                        kind: PACKING_LABEL,
                        rows: missingPackingRows,
                        printerName: toDefaultPrinterName(packingPrinters.data ?? []),
                        reissueReasonCode: null,
                      });
                    }}
                  >
                    {t.recovery.packingAction}
                  </Button>
                  <span>{t.recovery.deliveryMissing(missingDeliveryRows.length)}</span>
                  <Button
                    className={popTouchClass('critical')}
                    size="xl"
                    disabled={
                      DELIVERY_LABEL_ISSUE_LOCKED ||
                      isRecoveryPending ||
                      missingDeliveryRows.length === 0 ||
                      workerNo === null ||
                      issue.phase !== 'idle'
                    }
                    onClick={() => {
                      if (DELIVERY_LABEL_ISSUE_LOCKED) return;
                      setRecoveryPrintQueued(true);
                      issue.issue({
                        kind: DELIVERY_LABEL,
                        rows: missingDeliveryRows,
                        printerName: toDefaultPrinterName(deliveryPrinters.data ?? []),
                        reissueReasonCode: null,
                      });
                    }}
                  >
                    {t.recovery.deliveryAction}
                  </Button>
                  {oqcWaitingCount > 0 ? (
                    <span className="field-note">{t.recovery.oqcWaiting(oqcWaitingCount)}</span>
                  ) : null}
                  {recoveryReissueCount > 0 ? (
                    <span className="field-note">
                      {t.recovery.reissueRequired(recoveryReissueCount)}
                    </span>
                  ) : null}
                  {!isRecoveryPending &&
                  missingPackingRows.length === 0 &&
                  missingDeliveryRows.length === 0 &&
                  recoveryReissueCount === 0 ? (
                    <span className="field-note">{t.recovery.complete}</span>
                  ) : null}
                </div>
              )}
            </section>
          ) : null}

          {/*
           * ⭐ **네 구획을 각각 상자로 세운다**(설계 §3 도면의 ①②③④). 테두리 없이 늘어놓으면
           * 어디서 한 묶음이 끝나는지가 크기로만 갈려, 세로가 빌 때 화면이 통째로 흩어져 보인다.
           */}
          <section className="pane pop-fixed pop-slabel-kind" aria-label={t.kind.legend}>
            <h2 className="pane-title">{t.kind.legend}</h2>
            <LabelKindRadio
              value={kind}
              onChange={(next) => {
                setKind(next);
                // 종류가 바뀌면 대상이 통째로 달라진다 — 고른 것을 들고 가면 남의 대상이 된다.
                setSelectedIds([]);
                setReissueReasonCode(null);
                setPrinterName(null);
                issue.reset();
              }}
              disabled={isBusy}
            />
          </section>

          <section className="pane pop-slabel-targets" aria-label={t.targets.paneLabel}>
            {/* 구획 이름은 왼쪽이다 — 표 가운데 caption 으로 두면 다른 POP 화면과 자리가 다르다. */}
            <h2 className="pane-title">{t.targets.paneLabel}</h2>
            {isListError ? (
              <AlertBanner
                variant="error"
                title={t.targets.loadFailed}
                action={
                  <Button
                    className={popTouchClass('normal')}
                    variant="outlined"
                    size="xl"
                    onClick={() => {
                      void allocations.refetch();
                      units.refetch();
                      void summaries.refetch();
                    }}
                  >
                    {t.targets.retry}
                  </Button>
                }
              />
            ) : (
              <>
                {/* 표만 스크롤한다 — 구획째 스크롤하면 바닥의 프린터 줄이 같이 밀려 사라진다. */}
                <div className="pop-slabel-table">
                  <TargetTable
                    rows={rows}
                    summaries={summaryItems}
                    selectedIds={selectedIds}
                    onSelectionChange={setSelectedIds}
                    onOpenHistory={setHistoryTargetId}
                    empty={isListPending ? '' : emptyMessage}
                  />
                </div>
                {/* 고를 수 없는 줄이 목록에 남아 있는 이유를 말한다(G-3 — 어떻게 풀 것인가). */}
                {kind !== null && isDelivery(kind) && rows.some((row) => !row.isIssuable) ? (
                  <p className="field-note pop-slabel-wide-note">{t.targets.status.blockedNote}</p>
                ) : null}
              </>
            )}

            {/*
             * ④ 프린터 — **대상 구획 «안» 바닥에 둔다**(사용자 지시 2026-09-07).
             *
             * ⚠ 설계 §3 도면은 이 자리를 상자 하나(④ · 88)로 따로 그렸다. 「무엇을 뽑을지」
             *    고른 바로 그 자리에서 「어디로 보낼지」까지 마치는 편이 손이 덜 움직이고,
             *    상자 넷이 서던 세로도 셋으로 준다. **도면과 어긋나므로 요청서로 알린다.**
             *
             * 자리는 늘 세우고, 종류를 고르기 전이면 잠가 둔다 — 감췄다 세우면 그 순간
             * 아래가 밀려 화면이 출렁이고, 무엇을 더 해야 열리는지도 보이지 않는다.
             */}
            <div className="pop-slabel-printer-row">
              <PrinterSelect
                printers={printerItems}
                value={effectivePrinterName}
                onChange={setPrinterName}
                /*
                 * ⛔ 종류를 고르기 전에는 「찍을 수 있는 프린터가 없다」고 «단정하지» 않는다 —
                 * 그때는 조회 자체를 하지 않아 모르는 상태다. 모르는 것을 없음으로 그리면
                 * 사용자가 설치 문제로 오해한다(공유계약 G-9 · 실측 2026-09-03).
                 */
                awaitingKind={kind === null}
                isLoading={printers.isPending}
                isError={printers.isError}
                onRetry={() => {
                  void printers.refetch();
                }}
                disabled={isBusy}
              />
            </div>
          </section>

          {/* ③ 재출력 — 고른 대상 중 이미 발행된 것이 있을 때만 펼친다(스펙 §3-1). */}
          {isReissue ? (
            <ReissuePane
              alreadyIssuedCount={alreadyIssuedCount}
              reasons={reissueReasons.data ?? []}
              isLoading={reissueReasons.isPending}
              isError={reissueReasons.isError}
              value={reissueReasonCode}
              onChange={setReissueReasonCode}
            />
          ) : null}

          <IssueOutcome
            phase={issue.phase}
            result={issue.result}
            issuedCount={issue.labels.length}
            onClose={issue.reset}
            onRetryRendition={issue.retryRendition}
          />

          <div className="pop-slabel-actions">
            {/* 막힌 이유를 단추 옆에 둔다 — 비활성만 두면 화면이 고장 난 줄 안다. */}
            {blockedReason === null ? null : <p className="field-note">{blockedReason}</p>}
            <Button
              className={popTouchClass('normal')}
              variant="outlined"
              size="2xl"
              disabled={issue.labels.length === 0 || isBusy}
              title={issue.labels.length === 0 ? t.actions.previewPending : undefined}
              onClick={() => {
                setPreviewOpen(true);
              }}
            >
              {t.actions.preview}
            </Button>
            <Button
              className={popTouchClass('critical')}
              size="2xl"
              disabled={blockedReason !== null || isBusy}
              loading={issue.phase === 'issuing'}
              onClick={startIssue}
            >
              {t.actions.issue}
            </Button>
          </div>

          {/* 지금 무엇을 하는 중인지 — 걸음마다 다음에 할 일이 다르므로 뭉뚱그리지 않는다. */}
          {issue.step === null ? null : (
            <p className="field-note" role="status">
              {t.actions.running[issue.step]}
            </p>
          )}
        </>
      )}

      {isPreviewOpen && issue.labels.length > 0 ? (
        <PreviewDialog
          labels={issue.labels}
          isPrinting={issue.phase === 'printing'}
          canPrint={issue.phase === 'issued'}
          onPrint={() => {
            issue.print();
          }}
          onClose={() => {
            setPreviewOpen(false);
          }}
        />
      ) : null}

      {historyTargetId === null ? null : (
        <HistoryDialog
          issues={history.data ?? []}
          isLoading={history.isPending}
          isError={history.isError}
          onClose={() => {
            setHistoryTargetId(null);
          }}
        />
      )}
    </section>
  );
};
