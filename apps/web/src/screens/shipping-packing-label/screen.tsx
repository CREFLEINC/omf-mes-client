import { messages } from '@omf-mes/i18n';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { PopSelect } from '../../patterns/pop-select';
import { PopTopPrinter } from '../../patterns/pop-top-status';
import {
  PuActionBar,
  PuBand,
  PuButton,
  PuChip,
  PuCols,
  PuCount,
  PuDialog,
  PuEmpty,
  PuField,
  PuIcon,
  PuNote,
  PuPager,
  PuScreen,
  PuSection,
  PuSeg,
  PuTiles,
  puCx,
  puToast,
  useClientPage,
  useFitCount,
  type PuChipTone,
} from '../../patterns/pop-uniform';
import { PrinterChip } from '../pop-material-lot-label/printer-chip';
import { toPrinterView } from '../pop-material-lot-label/types';
import { DELIVERY_LABEL, LABEL_KINDS, PACKING_LABEL, type LabelKind } from './codes';
import { useDeliveryLabelDrawer } from './delivery-label-drawer';
import { useShippingLabelEntry } from './entry-context';
import { describeError } from './error-lines';
import { useLabelIssue, type IssuedLabel } from './mutations';
import { usePackingLabelCommand, usePackingLabelDrawer } from './packing-label-drawer';
import {
  useAllocations,
  useHandlingUnits,
  useIssueHistory,
  useIssueSummaries,
  usePrinters,
  useReissueReasons,
  useShipment,
  useShippingUnits,
  useUomCodes,
} from './queries';
import {
  formatIssuedAt,
  isDelivery,
  needsReissueReason,
  toDeliveryRow,
  toDefaultPrinterName,
  toPackingRow,
  type IssueSummaryView,
  type IssueView,
  type PrintOutcome,
  type TargetRow,
} from './types';
import './uniform.css';

const t = messages.shippingPackingLabel;

export interface ShipmentLabelPanelProps {
  shipmentId?: number | null;
  workerNo?: string | null;
  embedded?: boolean;
  /** 작업 줄 [이전] — 포장 등록으로 돌아간다. 없으면(단독 실행) 단추를 두지 않는다. */
  onBack?: () => void;
}

type LabelTab = 'WAIT' | 'REISSUE';

/** 고를 수 있는 사유가 이보다 많으면 고르기 창(`PopSelect`)으로 받는다(공통 규칙 7). */
const MAX_REASON_TILES = 6;

const OUTCOME_TONE: Record<PrintOutcome, PuChipTone> = {
  SUCCEEDED: 'ok',
  FAILED: 'bad',
  PENDING: 'idle',
};

const summaryOf = (
  summaries: readonly IssueSummaryView[],
  issueTargetId: number,
): IssueSummaryView | undefined => summaries.find((one) => one.targetId === issueTargetId);

/** 단위가 하나일 때만 수량을 더한다 — 다른 단위의 합은 뜻이 없다. */
const sumOf = (
  lines: readonly { qty: number; uom: string | null }[],
): { qty: number; uom: string | null } | null => {
  const uoms = new Set(lines.map((line) => line.uom));
  if (lines.length === 0 || uoms.size !== 1) return null;

  return { qty: lines.reduce((sum, line) => sum + line.qty, 0), uom: lines[0]?.uom ?? null };
};

const qtyText = (sum: { qty: number; uom: string | null }): string =>
  `${sum.qty.toLocaleString('ko-KR')}${sum.uom === null ? '' : ` ${sum.uom}`}`;

/**
 * 고른 대상의 라벨 모양 — 인쇄와 같은 그리기 경로로 «이번 회차»를 그려 보인다(서버 호출 없음).
 * ⚠ 발행 기록이 아니다. 발행한 라벨의 확인·인쇄는 [미리보기] 창이 한다(발행 → 미리보기 → 인쇄).
 */
const LabelShape = ({ bytes, alt }: { bytes: Uint8Array<ArrayBuffer> | null; alt: string }) => {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (bytes === null || typeof URL.createObjectURL !== 'function') {
      setUrl(null);

      return undefined;
    }
    const next = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }));
    setUrl(next);

    return () => {
      if (typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(next);
    };
  }, [bytes]);

  return (
    <div className="spl-preview">
      {url === null ? (
        <PuEmpty icon="print" title={t.preview.unavailable} />
      ) : (
        <img src={url} alt={alt} className="spl-preview-img" />
      )}
    </div>
  );
};

/** 발행 이력 창 — 연 대상의 회차를 최근이 위로 보인다. 조회는 창을 열 때 나간다. */
const HistoryDialog = ({
  issues,
  isLoading,
  isError,
  onClose,
}: {
  issues: readonly IssueView[];
  isLoading: boolean;
  isError: boolean;
  onClose: () => void;
}) => {
  const sorted = [...issues].sort((a, b) => b.issueSeq - a.issueSeq);

  return (
    <PuDialog title={t.history.title} onClose={onClose} closeLabel={t.history.close}>
      <div className="spl-dialog-body">
        {isError ? <PuNote tone="bad">{t.history.loadFailed}</PuNote> : null}
        {!isError && !isLoading && sorted.length === 0 ? (
          <span className="spl-history-empty">{t.history.empty}</span>
        ) : null}
        {sorted.map((issue) => (
          <div
            key={issue.documentIssueLogId}
            className={puCx('spl-history-row', issue.printOutcome === 'FAILED' && 'bad')}
          >
            <i>
              <PuIcon name={issue.printOutcome === 'FAILED' ? 'x' : 'check'} />
            </i>
            <div>
              <b>
                {t.history.step(issue.issueSeq)} · {t.history.outcome[issue.printOutcome]}
              </b>
              <small>
                {formatIssuedAt(issue.issuedAt)}
                {issue.reissueReasonName === null
                  ? ''
                  : ` · ${t.history.reason(issue.reissueReasonName)}`}
              </small>
            </div>
          </div>
        ))}
      </div>
    </PuDialog>
  );
};

/** 발행한 라벨 확인 창 — 발행 응답의 회차로 그린 그림. 인쇄는 발행만 된 상태에서 연다. */
const PreviewDialog = ({
  labels,
  isPrinting,
  canPrint,
  onPrint,
  onClose,
}: {
  labels: readonly IssuedLabel[];
  isPrinting: boolean;
  canPrint: boolean;
  onPrint: () => void;
  onClose: () => void;
}) => (
  <PuDialog
    title={t.preview.title}
    wide
    onClose={onClose}
    footer={
      <>
        <PuButton onClick={onClose}>{t.preview.close}</PuButton>
        <PuButton variant="primary" disabled={!canPrint || isPrinting} onClick={onPrint}>
          {t.preview.print}
        </PuButton>
      </>
    }
  >
    <div className="spl-dialog-body">
      <PuNote>{t.preview.notice}</PuNote>
      <div className="spl-previews">
        {labels.map((label) => (
          <figure key={label.issue.documentIssueLogId} className="spl-preview-fig">
            <img
              src={label.previewUrl}
              alt={t.preview.alt(label.issue.displayName, label.issue.issueSeq)}
              className="spl-preview-img"
            />
            <figcaption>
              {label.issue.displayName} · {label.issue.issueSeq}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  </PuDialog>
);

/** 재발행 사유 — 고른 대상 중 이미 발행된 것이 있을 때만 선다(종전 재출력 구획과 같다). */
const ReissuePane = ({
  alreadyIssuedCount,
  reasons,
  isLoading,
  isError,
  value,
  onChange,
}: {
  alreadyIssuedCount: number;
  reasons: readonly { code: string; name: string }[];
  isLoading: boolean;
  isError: boolean;
  value: string | null;
  onChange: (code: string) => void;
}) => {
  const options = reasons.map((each) => ({ value: each.code, label: each.name }));

  return (
    <div className="spl-reissue" aria-label={t.reissue.title} role="group">
      <PuNote tone="warn">
        <span>{t.reissue.notice(alreadyIssuedCount)}</span> <span>{t.reissue.guide}</span>
      </PuNote>
      {isError ? <PuNote tone="bad">{t.reissue.loadFailed}</PuNote> : null}
      {!isError && !isLoading && reasons.length === 0 ? (
        <PuNote tone="warn">{t.reissue.empty}</PuNote>
      ) : null}
      {reasons.length > 0 ? (
        <PuField label={t.reissue.label} required>
          {reasons.length > MAX_REASON_TILES ? (
            <PopSelect
              aria-label={t.reissue.label}
              size="xl"
              value={value}
              options={options}
              onChange={onChange}
            />
          ) : (
            <PuTiles
              label={t.reissue.label}
              cols={2}
              options={options}
              value={value}
              onChange={onChange}
            />
          )}
        </PuField>
      ) : null}
    </div>
  );
};

/**
 * `P-04-01` 안의 「라벨 상태·재인쇄」 — 고른 출하의 포장 라벨 · 납품 라벨(#295 시안 모양).
 *
 * 왼쪽 목록(발행 대기 / 재발행 탭 · 라벨 종류 · 대상 고르기) + 오른쪽 작업(정보 띠 · 라벨 모양).
 * 프린터는 맨 위 줄 프린터 자리에서 고른다. 동작(고름 · 발행 · 재발행 사유 · 미리보기 · 이력 · 누락
 * 라벨 이어서 출력)은 종전 화면과 같다 — 탭은 같은 목록을 발행 횟수로 나눠 보이는 보기일 뿐이다.
 *
 * ⭐ **발행 대기 / 재발행은 서버가 준 발행 횟수로만 가른다**(`issueCount`) — 화면이 세면 다른
 *    단말이 찍은 회차를 놓친다(스펙 §5-4).
 * ⛔ **종류를 미리 골라 두지 않는다**(스펙 §5-7) — 하나를 기본으로 세워 두면 사용자가 고르지 않은
 *    종류의 대상이 목록에 서고, 그것을 그대로 발행하면 엉뚱한 라벨이 나온다.
 */
export const ShippingPackingLabelScreen = ({
  shipmentId: shipmentIdOverride,
  workerNo: workerNoOverride,
  embedded = false,
  onBack,
}: ShipmentLabelPanelProps = {}) => {
  const entry = useShippingLabelEntry();
  const shipmentId = shipmentIdOverride === undefined ? entry.shipmentId : shipmentIdOverride;
  const workerNo = workerNoOverride === undefined ? entry.workerNo : workerNoOverride;
  const shipment = useShipment(shipmentId);

  const [kind, setKind] = useState<LabelKind | null>(null);
  const [tab, setTab] = useState<LabelTab>('WAIT');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  /** 오른쪽 띠·모양이 보이는 대상 — 마지막으로 누른 고른 줄. */
  const [focusId, setFocusId] = useState<number | null>(null);
  const [printerName, setPrinterName] = useState<string | null>(null);
  const [historyTargetId, setHistoryTargetId] = useState<number | null>(null);
  const [isPreviewOpen, setPreviewOpen] = useState(false);
  const [isRecoveryOpen, setRecoveryOpen] = useState(false);
  const [isRecoveryPrintQueued, setRecoveryPrintQueued] = useState(false);
  const [reissueReasonCode, setReissueReasonCode] = useState<string | null>(null);
  const [folded, setFolded] = useState(false);

  const allocations = useAllocations(shipmentId);
  const allocationItems = useMemo(() => allocations.data ?? [], [allocations.data]);
  const units = useHandlingUnits(allocationItems, embedded || (kind !== null && !isDelivery(kind)));
  /* 납품 라벨의 대상은 출하 단위다(SHIP-UNIT-01) — 배분으로 두면 서버가 422 로 막는다. */
  const shippingUnits = useShippingUnits(
    shipmentId,
    embedded || (kind !== null && isDelivery(kind)),
  );
  const uomCodeOf = useUomCodes();

  const packingRows = useMemo(() => units.units.map(toPackingRow), [units.units]);
  const deliveryRows = useMemo(
    () =>
      shippingUnits.units.map((unit) =>
        toDeliveryRow(unit, t.targets.status.closed, t.targets.status.composing),
      ),
    [shippingUnits.units],
  );
  const rows: TargetRow[] = useMemo(() => {
    if (kind === null) return [];

    return isDelivery(kind) ? deliveryRows : packingRows;
  }, [deliveryRows, kind, packingRows]);

  /* 서버에 묻는 것은 줄 식별자가 아니라 대상 식별자다(`issueTargetId`). */
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

  /* 발행 대기 = 발행 기록이 없는 대상, 재발행 = 한 번 이상 발행한 대상(서버의 발행 횟수).
     발행할 수 없는 대상(구성 중인 출하 단위)은 발행 대기에 두지 않는다(사용자 지시 2026-11-19). */
  const waitRows = useMemo(
    () =>
      rows.filter(
        (row) =>
          row.isIssuable && (summaryOf(summaryItems, row.issueTargetId)?.issueCount ?? 0) === 0,
      ),
    [rows, summaryItems],
  );
  const reissueRows = useMemo(
    () => rows.filter((row) => (summaryOf(summaryItems, row.issueTargetId)?.issueCount ?? 0) > 0),
    [rows, summaryItems],
  );
  const tabRows = tab === 'WAIT' ? waitRows : reissueRows;
  const waitCount = waitRows.length;

  /* ⛔ 재발행 여부를 화면이 세지 않는다 — 서버가 준 발행 횟수로만 가른다(스펙 §5-4). */
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

  /* 포장 라벨 · 납품 라벨 모두 POP 이 그린다(SHIP-UNIT-01 P2 · 전달본 v4). */
  const drawPackingLabel = usePackingLabelDrawer({
    shipmentNo: shipment.data?.shipmentNo ?? null,
    allocations: allocationItems,
  });
  const drawDeliveryLabel = useDeliveryLabelDrawer({ units: shippingUnits.units });
  const drawLabel = useCallback(
    (labelKind: LabelKind, row: TargetRow, issued: IssueView) =>
      drawPackingLabel(labelKind, row, issued) ?? drawDeliveryLabel(labelKind, row, issued),
    [drawDeliveryLabel, drawPackingLabel],
  );
  /* 포장 라벨은 종이를 80 × 30 mm TSPL 로 찍는다 — 납품 라벨은 아직 그림 그대로다. */
  const drawCommand = usePackingLabelCommand({
    shipmentNo: shipment.data?.shipmentNo ?? null,
    allocations: allocationItems,
  });
  const issue = useLabelIssue({ workerNo, drawLabel, drawCommand });

  const focusRow = selectedRows.find((row) => row.targetId === focusId) ?? null;
  const focusSummary =
    focusRow === null ? undefined : summaryOf(summaryItems, focusRow.issueTargetId);
  const focusIssueCount = focusSummary?.issueCount ?? 0;

  /* 오른쪽 라벨 모양: «이번 회차»로 그려 본다. 그리지 못하면(출하 번호 미수신 등) 비운다. */
  const shapeBytes = useMemo(() => {
    if (focusRow === null || kind === null) return null;
    try {
      return drawLabel(kind, focusRow, {
        documentIssueLogId: 0,
        targetId: focusRow.issueTargetId,
        displayName: focusRow.displayName,
        issueSeq: focusIssueCount + 1,
        reissueReasonName: null,
        issuedAt: '',
        printOutcome: 'PENDING',
      });
    } catch {
      return null;
    }
  }, [drawLabel, focusIssueCount, focusRow, kind]);

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
  const composingUnitCount = deliveryRows.filter((row) => !row.isIssuable).length;
  const recoveryReissueCount = [
    ...(packingSummaries.data ?? []),
    ...(deliverySummaries.data ?? []),
  ].filter((summary) => summary.issueCount > 0 && summary.lastPrintOutcome !== 'SUCCEEDED').length;

  const printerItems = printers.data ?? [];
  /* 고르지 않았으면 기본 프린터를 쓴다 — 계약이 `printer_name` 을 선택으로 둔다(스펙 §6). */
  const effectivePrinterName = printerName ?? toDefaultPrinterName(printerItems);

  const isBusy = issue.phase === 'issuing' || issue.phase === 'printing';
  const isListError =
    allocations.isError ||
    units.isError ||
    shippingUnits.isError ||
    (kind !== null && summaries.isError);
  const isListPending =
    allocations.isPending ||
    units.isPending ||
    shippingUnits.isPending ||
    (kind !== null && summaries.isPending);
  const isRecoveryError =
    allocations.isError ||
    units.isError ||
    shippingUnits.isError ||
    (packingTargetIds.length > 0 && packingSummaries.isError) ||
    (deliveryTargetIds.length > 0 && deliverySummaries.isError);
  const isRecoveryPending =
    allocations.isPending ||
    units.isPending ||
    shippingUnits.isPending ||
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

  /* [발행·인쇄]는 발행이 끝나면 곧바로 인쇄한다(사용자 지적 2026-09-17). */
  const {
    phase: issuePhase,
    labels: issuedLabels,
    print: printIssued,
    result: issueResult,
  } = issue;

  useEffect(() => {
    if (issuePhase === 'issued' && issuedLabels.length > 0) printIssued();
  }, [issuePhase, issuedLabels, printIssued]);

  /* 끝까지 잘 갔으면 결과 알림을 낸다. 결과 줄은 종전처럼 [닫기]로 닫는다. */
  useEffect(() => {
    if (issuePhase === 'printed' && issueResult.failedAt === null) {
      puToast(t.outcome.printed(issueResult.printed));
    }
  }, [issuePhase, issueResult]);

  /** 발행할 수 있는가 — 막는 사유를 순서대로 본다(종전과 같다). */
  const blockedReason = ((): string | null => {
    if (issue.phase !== 'idle') return t.actions.finishCurrentIssue;
    if (workerNo === null) return t.actions.needsWorker;
    if (kind === null) return t.actions.needsKind;
    if (selectedRows.length === 0) return t.actions.needsTarget;
    if (summaries.isPending) return t.actions.checkingHistory;
    if (summaries.isError) return t.actions.historyUnavailable;
    if (hasMixedIssueModes) return t.actions.mixedIssueModes;
    if (isReissue && reissueReasonCode === null) return t.actions.needsReason;
    return null;
  })();
  /* 「대상을 고르세요」·「종류를 고르세요」는 적지 않는다(사용자 지시 2026-09-17) — 단추 잠김만. */
  const shownBlock =
    blockedReason === null ||
    blockedReason === t.actions.needsTarget ||
    blockedReason === t.actions.needsKind
      ? null
      : blockedReason;

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

  const listRef = useRef<HTMLDivElement>(null);
  const pageSize = useFitCount(listRef, { fallback: 4 });
  const listPage = useClientPage(tabRows, pageSize);
  const { setPage: setListPage } = listPage;

  const changeKind = (next: LabelKind): void => {
    // 고른 종류를 한 번 더 누르면 무른다(종전과 같다).
    setKind(next === kind ? null : next);
    // 종류가 바뀌면 대상이 통째로 달라진다 — 고른 것을 들고 가면 남의 대상이 된다.
    setSelectedIds([]);
    setFocusId(null);
    setReissueReasonCode(null);
    setPrinterName(null);
    setListPage(1);
    issue.reset();
  };

  /* ⛔ 발행할 수 없는 대상은 선택으로 남기지 않는다 — 「하나라도 실패하면 전건 실패」. */
  const toggleRow = (row: TargetRow): void => {
    if (!row.isIssuable) return;
    if (selectedIds.includes(row.targetId)) {
      setSelectedIds(selectedIds.filter((id) => id !== row.targetId));
      if (focusId === row.targetId) setFocusId(null);

      return;
    }
    setSelectedIds([...selectedIds, row.targetId]);
    setFocusId(row.targetId);
  };

  const tabIssuableIds = tabRows.filter((row) => row.isIssuable).map((row) => row.targetId);
  const isTabAllSelected =
    tabIssuableIds.length > 0 && tabIssuableIds.every((id) => selectedIds.includes(id));

  /** 줄 아래 회색 글: 포장은 유형 · 수량 · LOT 건수, 납품은 상자 · 수량. */
  const subOf = (row: TargetRow) => {
    if (kind !== null && isDelivery(kind)) {
      const unit = shippingUnits.units.find((each) => each.shippingUnitId === row.issueTargetId);
      const sum =
        unit === undefined
          ? null
          : sumOf(unit.itemTotals.map((total) => ({ qty: total.qty, uom: total.uomCode })));

      return (
        <>
          {unit === undefined ? null : (
            <span>
              {t.list.boxes} <b>{t.band.boxCount(unit.boxCount)}</b>
            </span>
          )}
          {sum === null ? null : (
            <span>
              {t.list.qty} <b>{qtyText(sum)}</b>
            </span>
          )}
          {row.isIssuable ? null : <span>{t.targets.status.blockedNote}</span>}
        </>
      );
    }
    const handlingUnit = units.units.find((each) => each.handlingUnitId === row.issueTargetId);
    const contents = allocationItems.filter(
      (allocation) => allocation.handlingUnitId === row.issueTargetId,
    );
    const sum = sumOf(
      contents.map((allocation) => ({
        qty: allocation.allocatedQty,
        uom: uomCodeOf(allocation.uomId),
      })),
    );

    return (
      <>
        {handlingUnit === undefined ? null : <span>{handlingUnit.handlingUnitTypeCode}</span>}
        {sum === null ? null : (
          <span>
            {t.list.qty} <b>{qtyText(sum)}</b>
          </span>
        )}
        <span>
          {t.list.lot} <b>{t.list.lotCount(contents.length)}</b>
        </span>
      </>
    );
  };

  const chipsOf = (row: TargetRow) => {
    const summary = summaryOf(summaryItems, row.issueTargetId);
    if (summary !== undefined && summary.issueCount > 0) {
      const outcome: PrintOutcome = summary.lastPrintOutcome ?? 'PENDING';

      return (
        <>
          <PuChip>{t.history.step(summary.issueCount)}</PuChip>
          <PuChip tone={OUTCOME_TONE[outcome]}>{t.history.outcome[outcome]}</PuChip>
        </>
      );
    }
    if (kind !== null && isDelivery(kind)) {
      return <PuChip tone="ok">{t.targets.status.closed}</PuChip>;
    }

    return <PuChip>{t.list.notIssued}</PuChip>;
  };

  const focusUnit =
    focusRow === null || kind === null || !isDelivery(kind)
      ? undefined
      : shippingUnits.units.find((each) => each.shippingUnitId === focusRow.issueTargetId);
  const focusHandlingUnit =
    focusRow === null || kind === null || isDelivery(kind)
      ? undefined
      : units.units.find((each) => each.handlingUnitId === focusRow.issueTargetId);

  const outcomeNote = ((): { tone: 'bad' | 'warn' | 'ok'; text: string } | null => {
    const { failedAt, printed } = issue.result;
    if (isBusy) return null;
    if (failedAt === null) {
      if (issue.phase === 'printed') return { tone: 'ok', text: t.outcome.printed(printed) };
      if (issue.phase === 'issued')
        return { tone: 'ok', text: t.outcome.issued(issue.labels.length) };

      return null;
    }
    if (failedAt === 'issue') return { tone: 'bad', text: t.outcome.issueFailed };
    if (failedAt === 'render') return { tone: 'warn', text: t.outcome.renderFailed };
    if (failedAt === 'print') return { tone: 'warn', text: t.outcome.printFailed(printed) };

    return { tone: 'warn', text: t.outcome.reportFailed };
  })();

  const reloadList = (): void => {
    void allocations.refetch();
    units.refetch();
    shippingUnits.refetch();
    void summaries.refetch();
  };

  const actionBar = (
    <PuActionBar
      lead={
        shipmentId === null || !embedded ? undefined : (
          <PuButton
            /* 누락 라벨이 없으면 누를 일이 없다(사용자 지시 2026-11-19). 확인 실패는 창에서 알리므로 열어 둔다. */
            disabled={
              !isRecoveryError &&
              (isRecoveryPending ||
                (missingPackingRows.length === 0 && missingDeliveryRows.length === 0))
            }
            onClick={() => {
              setRecoveryOpen(true);
            }}
          >
            {t.recovery.title}
          </PuButton>
        )
      }
    >
      {onBack === undefined ? null : <PuButton onClick={onBack}>{t.actions.back}</PuButton>}
      {shipmentId === null ? null : (
        <>
          <PuButton
            disabled={issue.labels.length === 0 || isBusy}
            title={issue.labels.length === 0 ? t.actions.previewPending : undefined}
            onClick={() => {
              setPreviewOpen(true);
            }}
          >
            {t.actions.preview}
          </PuButton>
          <PuButton
            variant="primary"
            disabled={blockedReason !== null || isBusy}
            onClick={startIssue}
          >
            {isReissue ? t.actions.reissue : t.actions.issue}
          </PuButton>
        </>
      )}
    </PuActionBar>
  );

  /* 프린터는 공통 메뉴 맨 위 줄 프린터 자리에 서고, 누르면 고른다(사용자 지시 2026-11-17 · #291). */
  const printerChip = (
    <PopTopPrinter>
      <PrinterChip
        printers={kind === null ? undefined : printerItems.map(toPrinterView)}
        selected={
          printerItems
            .map(toPrinterView)
            .find((each) => each.printerName === effectivePrinterName) ?? null
        }
        isLoading={kind !== null && printers.isPending}
        isError={printers.isError}
        isSelectable
        isLocked={isBusy}
        onRetry={() => {
          void printers.refetch();
        }}
        onSelect={setPrinterName}
        showNone={kind !== null}
        noneLabel={messages.productionResult.flow.work.printerNone}
      />
    </PopTopPrinter>
  );

  if (shipmentId === null) {
    // ⛔ 출하가 없으면 아무 목록도 그리지 않는다 — 남의 출하 라벨을 뽑게 된다.
    return (
      <PuScreen actionBar={actionBar} className="spl-screen">
        <PuSection title={t.title}>
          <PuEmpty icon="warn" title={t.shipment.missing} />
        </PuSection>
      </PuScreen>
    );
  }

  const emptyHint =
    kind === null
      ? t.targets.beforeKind
      : rows.length > 0
        ? undefined
        : isDelivery(kind)
          ? t.targets.empty
          : t.targets.emptyPacking;

  return (
    <PuScreen actionBar={actionBar} className="spl-screen">
      {printerChip}
      <PuCols variant="list">
        <PuSection
          head={
            <PuSeg
              label={t.tabs.label}
              value={tab}
              onChange={(next) => {
                setTab(next);
                setListPage(1);
              }}
              options={[
                {
                  value: 'WAIT',
                  label: (
                    <>
                      {t.tabs.wait} <PuCount>{waitCount}</PuCount>
                    </>
                  ),
                },
                { value: 'REISSUE', label: t.tabs.reissue },
              ]}
            />
          }
          fold={{ label: t.tabs.wait, folded, onChange: setFolded }}
          bodyClassName="spl-list-body"
        >
          <PuField label={t.kind.legend}>
            <PuTiles
              label={t.kind.legend}
              cols={2}
              disabled={isBusy}
              value={kind}
              onChange={changeKind}
              options={LABEL_KINDS.map((each) => ({
                value: each,
                label: each === DELIVERY_LABEL ? t.kind.delivery : t.kind.packing,
              }))}
            />
          </PuField>
          <div className="spl-select-row">
            <label className="pu-check">
              <input
                type="checkbox"
                aria-label={t.targets.selectAll}
                checked={isTabAllSelected}
                disabled={tabIssuableIds.length === 0 || isBusy}
                onChange={() => {
                  if (isTabAllSelected) {
                    setSelectedIds(selectedIds.filter((id) => !tabIssuableIds.includes(id)));

                    return;
                  }
                  setSelectedIds([...new Set([...selectedIds, ...tabIssuableIds])]);
                }}
              />
              {t.targets.selectAll}
            </label>
            <span className="spl-select-count">{t.targets.selectedCount(selectedIds.length)}</span>
            <PuButton
              size="sm"
              disabled={selectedIds.length === 0 || isBusy}
              onClick={() => {
                setSelectedIds([]);
                setFocusId(null);
              }}
            >
              {t.targets.clearSelection}
            </PuButton>
          </div>
          {isListError ? (
            <PuNote
              tone="bad"
              action={
                <PuButton size="sm" onClick={reloadList}>
                  {t.targets.retry}
                </PuButton>
              }
            >
              {t.targets.loadFailed}
            </PuNote>
          ) : (
            <div className="pu-list pu-fit" ref={listRef}>
              {tabRows.length === 0 && (kind === null || !isListPending) ? (
                <PuEmpty
                  icon="print"
                  title={
                    kind === null
                      ? t.targets.beforeKind
                      : tab === 'WAIT'
                        ? t.list.waitEmpty
                        : t.list.reissueEmpty
                  }
                  hint={kind === null ? undefined : emptyHint}
                />
              ) : null}
              {listPage.items.map((row) => {
                const isSelected = selectedIds.includes(row.targetId);

                return (
                  <button
                    key={row.targetId}
                    type="button"
                    role="checkbox"
                    aria-checked={isSelected}
                    className={puCx('pu-item', isSelected && 'is-selected')}
                    disabled={!row.isIssuable || isBusy}
                    onClick={() => {
                      toggleRow(row);
                    }}
                  >
                    <div className="pu-item-top">
                      <span className="no">{row.displayName}</span>
                      <span className="chips">{chipsOf(row)}</span>
                    </div>
                    <div className="pu-item-sub">{subOf(row)}</div>
                  </button>
                );
              })}
            </div>
          )}
          <PuPager
            total={listPage.total}
            page={listPage.page}
            pages={listPage.pages}
            onPage={setListPage}
            label={t.tabs.label}
          />
        </PuSection>

        <PuSection bodyClassName="spl-work-body">
          <PuBand
            label={t.band.label}
            items={[
              { label: t.band.shipment, value: shipment.data?.shipmentNo ?? '—' },
              {
                label: kind !== null && isDelivery(kind) ? t.band.unitNo : t.band.packingNo,
                value: focusRow?.displayName ?? '—',
              },
              kind !== null && isDelivery(kind)
                ? {
                    label: t.band.boxes,
                    value: focusUnit === undefined ? '—' : t.band.boxCount(focusUnit.boxCount),
                  }
                : {
                    label: t.band.type,
                    value: focusHandlingUnit?.handlingUnitTypeCode ?? '—',
                  },
              {
                label: t.band.seq,
                value: focusRow === null ? '—' : t.history.step(focusIssueCount + 1),
              },
            ]}
          />
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
          {shownBlock === null ? null : <PuNote tone="warn">{shownBlock}</PuNote>}
          {issue.step === null ? null : <PuNote live>{t.actions.running[issue.step]}</PuNote>}
          {outcomeNote === null ? null : (
            <PuNote
              tone={outcomeNote.tone}
              action={
                <PuButton
                  size="sm"
                  onClick={issue.result.failedAt === 'render' ? issue.retryRendition : issue.reset}
                >
                  {issue.result.failedAt === 'render' ? t.outcome.retryRendition : t.outcome.close}
                </PuButton>
              }
            >
              <span>{outcomeNote.text}</span>
              {issue.result.error === null ? null : (
                <span> {describeError(issue.result.error)}</span>
              )}
              {issue.result.failureReason === null ? null : (
                <span> {issue.result.failureReason}</span>
              )}
            </PuNote>
          )}
          {focusRow === null ? (
            <PuEmpty icon="print" title={tab === 'WAIT' ? t.list.pickWait : t.list.pickReissue} />
          ) : (
            <>
              <div className="spl-shape-head">
                <span className="spl-sec">{t.preview.shape}</span>
                {focusIssueCount > 0 ? (
                  <PuButton
                    size="sm"
                    onClick={() => {
                      setHistoryTargetId(focusRow.issueTargetId);
                    }}
                  >
                    {t.history.open}
                  </PuButton>
                ) : null}
              </div>
              <LabelShape
                bytes={shapeBytes}
                alt={t.preview.alt(focusRow.displayName, focusIssueCount + 1)}
              />
            </>
          )}
        </PuSection>
      </PuCols>

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

      {isRecoveryOpen ? (
        <PuDialog
          title={t.recovery.title}
          onClose={() => {
            setRecoveryOpen(false);
          }}
          closeLabel={t.history.close}
        >
          <div className="spl-dialog-body">
            {isRecoveryError ? (
              <PuNote
                tone="bad"
                action={
                  <PuButton
                    size="sm"
                    onClick={() => {
                      void allocations.refetch();
                      units.refetch();
                      shippingUnits.refetch();
                      void packingSummaries.refetch();
                      void deliverySummaries.refetch();
                    }}
                  >
                    {t.targets.retry}
                  </PuButton>
                }
              >
                {t.recovery.loadFailed}
              </PuNote>
            ) : (
              <>
                <div className="spl-recovery-row" role="group" aria-label={t.recovery.packingLabel}>
                  <span className="spl-recovery-name">{t.recovery.packingLabel}</span>
                  <b>{missingPackingRows.length}</b>
                  <span>{t.recovery.countUnit}</span>
                  <PuButton
                    disabled={
                      isRecoveryPending ||
                      missingPackingRows.length === 0 ||
                      workerNo === null ||
                      issue.phase !== 'idle'
                    }
                    onClick={() => {
                      setRecoveryOpen(false);
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
                  </PuButton>
                </div>
                <div
                  className="spl-recovery-row"
                  role="group"
                  aria-label={t.recovery.deliveryLabel}
                >
                  <span className="spl-recovery-name">{t.recovery.deliveryLabel}</span>
                  <b>{missingDeliveryRows.length}</b>
                  <span>{t.recovery.countUnit}</span>
                  <PuButton
                    variant="primary"
                    disabled={
                      isRecoveryPending ||
                      missingDeliveryRows.length === 0 ||
                      workerNo === null ||
                      issue.phase !== 'idle'
                    }
                    onClick={() => {
                      setRecoveryOpen(false);
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
                  </PuButton>
                </div>
                {composingUnitCount > 0 ? (
                  <PuNote>{t.recovery.composingUnits(composingUnitCount)}</PuNote>
                ) : null}
                {recoveryReissueCount > 0 ? (
                  <PuNote tone="warn">{t.recovery.reissueRequired(recoveryReissueCount)}</PuNote>
                ) : null}
                {!isRecoveryPending &&
                missingPackingRows.length === 0 &&
                missingDeliveryRows.length === 0 &&
                recoveryReissueCount === 0 ? (
                  <PuNote tone="ok">{t.recovery.complete}</PuNote>
                ) : null}
              </>
            )}
          </div>
        </PuDialog>
      ) : null}
    </PuScreen>
  );
};
