import { AlertBanner, Button, PageHeader } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useMemo, useState } from 'react';

import { popTouchClass } from '../../patterns/pop-touch';
import { DELIVERY_LABEL, type LabelKind } from './codes';
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

/**
 * `P-04-02` 납품·포장 라벨 출력 (POP).
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
export const ShippingPackingLabelScreen = () => {
  /*
   * 귀속 사번은 **셸이 아는 값**이다(진입점 화면 소관). 쓰기가 헤더로 요구하므로 없으면
   * 부를 수 없고, 그 사실을 감추지 않고 사유로 보인다(공유계약 F-1 · F-6).
   *
   * ⚠ 셸이 채우는 자리(`pop-identity`)는 저장소에 공급자가 아직 없어 **항상 비어 있다** —
   * 진입 주소에서 받는다(전례 `P-02-05`). 셸이 서면 `entry-context` 하나가 바뀐다.
   */
  const { shipmentId, workerNo } = useShippingLabelEntry();
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

  const allocations = useAllocations(shipmentId);
  const allocationItems = useMemo(() => allocations.data ?? [], [allocations.data]);
  const units = useHandlingUnits(allocationItems, kind !== null && !isDelivery(kind));

  /*
   * 목록 줄은 종류마다 다른 것에서 나오지만(배분 ↔ 취급 단위) **같은 모양으로 편다** —
   * 갈라 두면 표 컴포넌트가 둘이 되고 회차 열을 두 번 고치게 된다.
   */
  const rows: TargetRow[] = useMemo(() => {
    if (kind === null) return [];

    return isDelivery(kind)
      ? allocationItems.map((allocation) =>
          toDeliveryRow(
            allocation,
            t.targets.status.passed,
            t.targets.status.waiting,
            t.targets.unnamed,
          ),
        )
      : units.units.map(toPackingRow);
  }, [allocationItems, kind, units.units]);

  /*
   * ⛔ **서버에 묻는 것은 줄 식별자가 아니라 대상 식별자다**(`issueTargetId`). 납품 라벨은
   * 한 LOT 이 여러 배분으로 갈릴 수 있어 유일하게 만든다 — 같은 값을 두 번 물으면 서버가
   * 같은 회차를 두 줄로 돌려주고 화면이 그중 하나만 보게 된다.
   */
  const targetIds = useMemo(() => [...new Set(rows.map((row) => row.issueTargetId))], [rows]);
  const summaries = useIssueSummaries(kind, targetIds);
  const summaryItems = useMemo(() => summaries.data ?? [], [summaries.data]);
  const printers = usePrinters(kind);

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

  const reissueReasons = useReissueReasons(isReissue);
  const history = useIssueHistory(kind, historyTargetId);
  const issue = useLabelIssue({ workerNo });

  const printerItems = printers.data ?? [];
  /* 고르지 않았으면 기본 프린터를 쓴다 — 계약이 `printer_name` 을 선택으로 둔다(스펙 §6). */
  const effectivePrinterName = printerName ?? toDefaultPrinterName(printerItems);

  const isBusy = issue.phase === 'issuing' || issue.phase === 'printing';
  const isListError = allocations.isError || units.isError;
  const isListPending = allocations.isPending || units.isPending;
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
    if (isReissue && reissueReasonCode === null) return t.actions.needsReason;

    return null;
  })();

  const startIssue = (): void => {
    if (kind === null || blockedReason !== null) return;

    issue.issue({
      kind,
      rows: selectedRows,
      printerName: effectivePrinterName,
      /* ⛔ 신규 발행에 사유가 붙으면 이력이 거짓이 된다 — 재발행일 때만 싣는다(계약 명시). */
      reissueReasonCode: isReissue ? reissueReasonCode : null,
    });
  };

  const emptyMessage =
    kind !== null && !isDelivery(kind) ? t.targets.emptyPacking : t.targets.empty;

  return (
    /*
     * ⚠ **이 화면이 최상위 랜드마크다.** POP 라우트는 관리웹 셸을 지나지 않으므로(`routes/pop`)
     * `main` 을 세워 주는 바깥이 없다 — 먼저 선 POP 화면들과 같은 형태다.
     */
    <main className="pop-slabel-screen" aria-label={t.title}>
      <header className="pop-slabel-head">
        <PageHeader title={t.title} size="compact" />
        {shipmentId === null ? null : (
          <p className="field-note">
            {shipment.isPending
              ? t.shipment.loading
              : shipment.isError || shipment.data === undefined
                ? t.shipment.loadFailed
                : t.shipment.context(shipment.data.shipmentNo)}
          </p>
        )}
      </header>

      {shipmentId === null ? (
        // ⛔ 출하가 없으면 아무 목록도 그리지 않는다 — 남의 출하 라벨을 뽑게 된다.
        <AlertBanner variant="warning">{t.shipment.missing}</AlertBanner>
      ) : (
        <>
          <section className="pop-slabel-kind" aria-label={t.kind.legend}>
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

          <section className="pop-slabel-targets" aria-label={t.targets.paneLabel}>
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
                    }}
                  >
                    {t.targets.retry}
                  </Button>
                }
              />
            ) : (
              <>
                {/*
                 * ⚠ **회차 열의 한계를 밝힌다.** 발행 현황 조회가 대상 유형 코드를 조건으로
                 * 받는데 그 값이 아직 확정되지 않았다 — 서버가 가진 문자열과 다르면 이미
                 * 뽑은 것도 「없음」으로 보인다. 감추면 사용자가 그 값을 믿고 재발행을 놓친다.
                 */}
                <AlertBanner variant="info">{t.targets.seqNotice}</AlertBanner>
                <TargetTable
                  rows={rows}
                  summaries={summaryItems}
                  selectedIds={selectedIds}
                  onSelectionChange={setSelectedIds}
                  onOpenHistory={setHistoryTargetId}
                  empty={isListPending ? '' : emptyMessage}
                />
                {/* 고를 수 없는 줄이 목록에 남아 있는 이유를 말한다(G-3 — 어떻게 풀 것인가). */}
                {kind !== null && isDelivery(kind) && rows.some((row) => !row.isIssuable) ? (
                  <p className="field-note pop-slabel-wide-note">{t.targets.status.blockedNote}</p>
                ) : null}
              </>
            )}
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

          <section className="pop-slabel-printer-pane" aria-label={t.printer.label}>
            <PrinterSelect
              printers={printerItems}
              value={effectivePrinterName}
              onChange={setPrinterName}
              /*
               * ⛔ 종류를 고르기 전에는 「찍을 수 있는 프린터가 없다」고 «단정하지» 않는다 —
               * 그때는 조회 자체를 하지 않아 모르는 상태다. 모르는 것을 없음으로 그리면
               * 사용자가 설치 문제로 오해한다(공유계약 G-9 · 실측 2026-09-03).
               */
              isLoading={kind === null || printers.isPending}
              isError={printers.isError}
              onRetry={() => {
                void printers.refetch();
              }}
              disabled={isBusy}
            />
          </section>

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
    </main>
  );
};
