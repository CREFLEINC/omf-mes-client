import type {
  MaterialLotPair,
  MaterialLotSummary,
  MaterialLotSupplier,
  MaterialLotTab,
} from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import {
  TAB_ORDER,
  creatableRemainingOf,
  isMaterialLotNoText,
  lookupMaterialLot,
  materialLotKeys,
  useMaterialLotPairs,
  useMaterialLotSuppliers,
  useMaterialLots,
  type LotsTarget,
} from '../../patterns/material-lot-precreate';
import { usePopIdentity } from '../../patterns/pop-identity';
import { PopSelect } from '../../patterns/pop-select';
import { PopTopPrinter } from '../../patterns/pop-top-status';
import {
  PuButton,
  PuCols,
  PuCount,
  PuEmpty,
  PuHelpButton,
  PuNote,
  PuPager,
  PuScanField,
  PuScreen,
  PuSection,
  PuSeg,
  puToast,
  useFitCount,
  useFitTableRows,
} from '../../patterns/pop-uniform';
import { PopWorkerMissingBanner } from '../../patterns/pop-worker-missing-banner';
import { ApiRequestError, toApiError } from '../../patterns/request';
import { serverReasonOf } from '../../patterns/server-reason';
import { BatchDialog } from './batch-dialog';
import { retryCommands, summarize } from './batch-view';
import { PRINT_FAILURE_REASON_CODE } from './codes';
import { IssueBar, IssueStatusNote, type BarState } from './issue-bar';
import { ISSUE_UNITS, rememberIssueUnit, storedIssueUnit, type IssueUnit } from './issue-unit';
import { LabelTable } from './label-table';
import { useBatchIssue, voidMaterialLots, type IssueCommand } from './mutations';
import { PreviewDialog } from './preview-dialog';
import { PrinterChip } from './printer-chip';
import { choosePrinter, rememberPrinterName, storedPrinterName } from './printer-choice';
import { usePrinters, useReissueReasons, useShellSelectsPrinter } from './queries';
import { ReasonPicker } from './reason-picker';
import { ItemTable, SupplierList, pairDefaultLine, pairUnprintedOf } from './supplier-list';
import { isWaiting, pairKeyOf, toLabelLotFromRow, type LabelLot, type PairRef } from './types';
import { VoidDialog } from './void-dialog';
import './uniform.css';

const t = messages.popMaterialLotLabel;
const tp = t.precreate;
const tc = tp.threeCols;

/** 라벨을 낼 수 없는 LOT 품질 상태 — 서버 `qualifyDocumentIssueTarget`(MATERIAL_LOT_LABEL)이 검사 대기·정상만 받는다. */
const LABEL_LOCKED_LOT_STATUS: readonly string[] = ['DEFECTIVE', 'SCRAPPED'];

/** 발행 결과를 그리는 동안 붙잡아 둔 표 — 찍은 LOT 이 목록에서 바뀌어도 「확인」 전까지 결과와 함께 남는다. */
interface ResultSnapshot {
  lots: LabelLot[];
  isReprint: boolean;
}

type DialogState =
  | { kind: 'batch' }
  | { kind: 'void'; lots: LabelLot[] }
  | { kind: 'preview'; lots: LabelLot[]; reprint: boolean }
  | null;

/** 고른 공급사 — 공급사 칸 줄 또는 번호 스캔이 정한다. */
interface PickedSupplier {
  supplierId: number;
  name: string;
}

/** 고른 공급사·품목 — 품목 표 줄(`row`)이 있으면 수 · 기본값을 함께 보인다. 번호 스캔으로 고르면 줄이 없을 수 있다. */
interface PickedPair {
  ref: PairRef;
  row: MaterialLotPair | null;
}

/** 번호 스캔으로 찾은 LOT — 그 탭 표 맨 위에 골라 둔다(FR-021). */
interface ScannedLot {
  lot: LabelLot;
  tab: MaterialLotTab;
}

/** 발행 단위 타일 값 — 「전체」는 `all`. */
const unitValue = (unit: IssueUnit): string => (unit === null ? 'all' : String(unit));

const pairRefOf = (pair: MaterialLotPair): PairRef => ({
  supplierId: pair.supplier.supplierId,
  supplierCode: pair.supplier.code,
  supplierName: pair.supplier.name,
  itemId: pair.item.itemId,
  itemCode: pair.item.code,
  itemName: pair.item.name,
  uomCode: pair.item.baseUomCode,
});

const keyOfRef = (ref: PairRef): string => pairKeyOf(ref.supplierId, ref.itemId);

/**
 * `P-01-01` 자재 관리 LOT 라벨 (POP) — 005 · #1751 세 칸 · 피처 014(omf-all-around#349 · 시안 P0101 5판 · screens/P-01-01.md).
 *
 * ```
 * ┌ 공급사 ──────────┐┌ 품목 · 대한포장 ─────────────────┐┌ 품목코드 · 품목명 · 공급사 · 기본 단위  [?] [+ 생성] ┐
 * │ 스캔 또는 찾기       ││ 품목코드│품목명│미출력│출력됨│IQC│최근 발행 ││ 기본 100 EA · ROLL 10 × 10 (품목 기본값)        │
 * │ 대한포장   미출력 47  ││ 00022S │포장 필름│ 45 │ 5 │검사│11-23 ││ [미출력 45 | 출력됨(입하 전) | 입하된 | 폐기]     │
 * │ …                 ││ 00031S │포장 테이프│2 기본값 없음│…    ││ 발행 단위 [10장 ▾]                 [선택 해제] │
 * │ 총 18건 ‹ 1/1 ›    ││ 총 3건 ‹ 1/1 ›                    ││ 표 · 아직 만들지 않은 37건 포함    총 45건 ‹ 1/6 › │
 * └─────────────────┘└─────────────────────────────────┘└──────────────────────────────────────────────┘
 * 작업 줄: [입하 대기 N개 폐기] [라벨 N장 발행]  (출력됨 · 입하된 탭: [N장 재인쇄] + 사유)
 * ```
 *
 * ⭐ 세 칸은 #1751 짜임 그대로(폭 280 · 640 · 나머지, 1100px 이하 220 · 260, 공급사 칸 접기 56). 공급사 칸
 *    (`material-lot-suppliers`) · 품목 표(`material-lot-pairs?supplierId`) · 상세 탭 모두 서버 쪽 나눔이다 —
 *    공장 전체를 한 번에 받던 목록과 20초 다시 받기는 없앴다(FR-010). 찾기 글자는 두 칸을 함께 거른다.
 * ⭐ 품목을 고르면 서버가 미입고 P/O 남은 양 중 이 쪽에 필요한 만큼만 LOT 을 만든다(FR-001 · FR-008). 그동안
 *    상세를 덮어 「자재 관리 LOT 을 조회하고 생성하고 있습니다」를 보인다(FR-013).
 * ⭐ 인쇄 길(발행 기록 → 라벨 짜기 → 셸 인쇄 → 결과 보고) · 발행 단위 · 결과 표 · 다시 발행은 그대로다.
 * ⚠ 화면을 열자마자 고르지 않는다 — 품목을 고르는 순간 LOT 이 만들어진다(시안 ①).
 */
export const PopMaterialLotLabelScreen = () => {
  const { client } = useApiClient();
  const queryClient = useQueryClient();
  const createNoteId = useId();
  const { workerNo, plantId = null } = usePopIdentity();
  const batch = useBatchIssue({ workerNo });
  const isIssuing = batch.isRunning;

  const [scanText, setScanText] = useState('');
  /** 찾기 글자 — 공급사 칸 · 품목 표를 함께 거른다(서버 `q`). */
  const [findQ, setFindQ] = useState('');
  const [supplierPage, setSupplierPage] = useState(1);
  const [itemPage, setItemPage] = useState(1);
  const [pickedSupplier, setPickedSupplier] = useState<PickedSupplier | null>(null);
  const [folded, setFolded] = useState(false);
  const [picked, setPicked] = useState<PickedPair | null>(null);
  const [tab, setTab] = useState<MaterialLotTab>('UNPRINTED');
  const [lotPage, setLotPage] = useState(1);
  const [scanned, setScanned] = useState<ScannedLot | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanFound, setScanFound] = useState<string | null>(null);
  const [checked, setChecked] = useState<ReadonlySet<number>>(new Set());
  const [reasonCode, setReasonCode] = useState<string | null>(null);
  const [unit, setUnit] = useState<IssueUnit>(storedIssueUnit);
  const [snapshot, setSnapshot] = useState<ResultSnapshot | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [voidSaving, setVoidSaving] = useState(false);
  const [voidError, setVoidError] = useState<string | null>(null);
  /** 받은 쪽들에서 본 LOT — 쪽을 넘겨도 고른 줄을 잃지 않는다. */
  const known = useRef(new Map<number, LabelLot>());

  /* 쪽 넘김(규칙 1) — 한 쪽 건수는 구획 높이에 들어가는 만큼. */
  const supplierFitRef = useRef<HTMLUListElement>(null);
  const itemFitRef = useRef<HTMLDivElement>(null);
  const tableFitRef = useRef<HTMLDivElement>(null);
  const supplierSize = useFitCount(supplierFitRef, { fallback: 6 });
  const itemSize = useFitTableRows(itemFitRef, { fallback: 8 });
  const rowSize = useFitTableRows(tableFitRef, { fallback: 5 });

  const suppliers = useMaterialLotSuppliers(
    plantId === null ? null : { plantId, q: findQ, page: supplierPage, size: supplierSize },
  );
  const supplierRows = suppliers.data?.items ?? [];
  const supplierTotal = suppliers.data?.total ?? 0;

  const pairs = useMaterialLotPairs(
    plantId === null || pickedSupplier === null
      ? null
      : {
          plantId,
          supplierId: pickedSupplier.supplierId,
          q: findQ,
          page: itemPage,
          size: itemSize,
        },
  );
  const pairRows = pickedSupplier === null ? [] : (pairs.data?.items ?? []);
  const pairTotal = pickedSupplier === null ? 0 : (pairs.data?.total ?? 0);

  const target: LotsTarget | null =
    picked === null || plantId === null
      ? null
      : { plantId, supplierId: picked.ref.supplierId, itemId: picked.ref.itemId };
  const lots = useMaterialLots(target, tab, lotPage, rowSize);
  const lotsData = lots.data;
  const generation = tab === 'UNPRINTED' ? (lotsData?.generation ?? null) : null;

  const reasons = useReissueReasons(true);
  const printers = usePrinters();
  /*
   * 프린터 선택(2단계 검증 2026-10-16) — 고른 것 → 단말에 기억해 둔 것 → 셸의 출력 대상.
   * ⛔ 셸이 고른 프린터를 받지 못하면(브라우저·옛 설치본) 기억해 둔 값을 쓰지 않는다.
   */
  const printerSelectable = useShellSelectsPrinter();
  const isPrinterSelectable = printerSelectable.data === true;
  const [pickedPrinter, setPickedPrinter] = useState<string | null>(null);
  const [rememberedPrinter] = useState(storedPrinterName);
  const printerChoice = choosePrinter(
    printers.data ?? [],
    pickedPrinter,
    isPrinterSelectable ? rememberedPrinter : null,
  );
  const headPrinter = printerChoice.printer;
  const base = {
    printerName: headPrinter?.printerName ?? null,
    shellPrinterName: isPrinterSelectable ? (headPrinter?.printerName ?? null) : null,
    ...(plantId === null ? {} : { plantId }),
  };

  const pickedKey = picked === null ? null : keyOfRef(picked.ref);
  /* 품목 표 줄이 다시 오면(수가 바뀜) 그 줄로 바꿔 든다. */
  const pickedRow =
    picked === null
      ? null
      : (pairRows.find(
          (row) => pairKeyOf(row.supplier.supplierId, row.item.itemId) === pickedKey,
        ) ?? picked.row);

  const pageLots = useMemo(
    () =>
      picked === null || lotsData === undefined
        ? []
        : lotsData.items.map((row) => toLabelLotFromRow(row, picked.ref)),
    [lotsData, picked],
  );
  for (const each of pageLots) known.current.set(each.lotId, each);
  if (scanned !== null) known.current.set(scanned.lot.lotId, scanned.lot);

  /* 스캔한 LOT 은 그 탭 표 맨 위에(FR-021). */
  const tableLots = useMemo(() => {
    if (scanned === null || scanned.tab !== tab) return pageLots;

    return [scanned.lot, ...pageLots.filter((each) => each.lotId !== scanned.lot.lotId)];
  }, [pageLots, scanned, tab]);

  const selected = [...checked].flatMap((lotId) => {
    const found = known.current.get(lotId);

    return found === undefined ? [] : [found];
  });
  const selectedWaiting = selected.filter(isWaiting);
  const selectedUnprinted = selectedWaiting.filter((each) => each.lastIssue === null);
  const isReprintTab = tab === 'PRINTED' || tab === 'RECEIVED';
  const blockedLot =
    tab === 'RECEIVED'
      ? selected.find((each) => LABEL_LOCKED_LOT_STATUS.includes(each.statusCode))
      : undefined;

  const isLocked = isIssuing;
  const isShowingResults = snapshot !== null;
  const isFrozen = isLocked || isShowingResults;

  const clearSelection = (): void => {
    setChecked(new Set());
  };

  /** 공급사를 고르면 품목 표가 그 공급사 품목으로 바뀐다 — 품목은 고르지 않는다(고르면 LOT 이 생긴다). */
  const chooseSupplier = (row: MaterialLotSupplier): void => {
    if (pickedSupplier?.supplierId === row.supplier.supplierId) return;
    setPickedSupplier({ supplierId: row.supplier.supplierId, name: row.supplier.name });
    setItemPage(1);
    setPicked(null);
    setTab('UNPRINTED');
    setLotPage(1);
    setScanned(null);
    setScanFound(null);
    setReasonCode(null);
    clearSelection();
  };

  const changeFind = (next: string): void => {
    setFindQ(next);
    setSupplierPage(1);
    setItemPage(1);
  };

  const choosePair = (next: PickedPair): void => {
    if (pickedKey === keyOfRef(next.ref)) return;
    setPicked(next);
    setTab('UNPRINTED');
    setLotPage(1);
    setScanned(null);
    setScanFound(null);
    setReasonCode(null);
    clearSelection();
  };

  const chooseTab = (next: MaterialLotTab): void => {
    if (next === tab) return;
    setTab(next);
    setLotPage(1);
    setReasonCode(null);
    setScanFound(null);
    clearSelection();
  };

  const toggle = (lotId: number): void => {
    setChecked((previous) => {
      const next = new Set(previous);

      if (next.has(lotId)) next.delete(lotId);
      else next.add(lotId);

      return next;
    });
  };

  const chooseUnit = (next: IssueUnit): void => {
    setUnit(next);
    rememberIssueUnit(next);
  };

  const refreshLots = (): void => {
    void queryClient.invalidateQueries({ queryKey: materialLotKeys.all });
  };

  /**
   * 「스캔 또는 찾기」(FR-021) — 자재 관리 LOT 번호면 공장 전체에서 찾아 그 공급사(공급사 칸) · 품목(품목 표) ·
   * 탭을 열고 맨 위에 골라 둔다. 번호가 아닌 글자는 공급사 칸 · 품목 표를 함께 거른다(서버 `q`).
   */
  const submitScan = async (value: string): Promise<void> => {
    const text = value.trim();

    setScanError(null);
    setScanFound(null);

    if (!isMaterialLotNoText(text)) {
      changeFind(text);

      return;
    }

    if (plantId === null) return;

    try {
      const found = await lookupMaterialLot(client, plantId, text);

      setScanText('');

      if (found === null) {
        setScanError(tp.lookup.notFound);

        return;
      }

      const ref: PairRef = {
        supplierId: found.supplier.supplierId,
        supplierCode: found.supplier.code,
        supplierName: found.supplier.name,
        itemId: found.item.itemId,
        itemCode: found.item.code,
        itemName: found.item.name,
        uomCode: found.item.baseUomCode,
      };
      const lot = toLabelLotFromRow(found.lot, ref);
      const row =
        pairRows.find(
          (each) => each.supplier.supplierId === ref.supplierId && each.item.itemId === ref.itemId,
        ) ?? null;

      /* 두 칸 모두 골라 둔다 — 찾기 글자는 비워 그 공급사 · 품목이 칸에 서게 한다. */
      if (findQ !== '') changeFind('');
      if (pickedSupplier?.supplierId !== ref.supplierId) setItemPage(1);
      setPickedSupplier({ supplierId: ref.supplierId, name: ref.supplierName });
      setPicked({ ref, row });
      setTab(found.tab);
      setLotPage(1);
      setReasonCode(null);
      setScanned({ lot, tab: found.tab });
      known.current.set(lot.lotId, lot);

      if (found.tab === 'VOIDED') {
        setChecked(new Set());
        setScanError(tp.lookup.voided);

        return;
      }

      setChecked(new Set([lot.lotId]));
      setScanFound(tp.lookup.found(tp.tabs[found.tab]));
    } catch {
      setScanError(tp.lookup.failed);
    }
  };

  const reasonName =
    reasonCode === null
      ? null
      : (reasons.data?.find((reason) => reason.code === reasonCode)?.name ?? null);

  /** 미리 보기에서 [인쇄] — 첫 발행은 미출력 입하 대기 LOT 만, 재인쇄는 고른 LOT 을 사유와 함께. */
  const startPrint = (printLots: readonly LabelLot[], reprint: boolean): void => {
    if (workerNo === null || printLots.length === 0) return;

    const commands: IssueCommand[] = printLots.map((each) =>
      reprint
        ? { ...base, lot: each, reissueReasonCode: reasonCode }
        : { ...base, lot: each, reissueReasonCode: null, verifyUnissued: true },
    );

    setDialog(null);
    /* 결과 표는 그때 보이던 줄 + 찍는 줄(다른 쪽에서 고른 것)이다. */
    const shown = new Set(tableLots.map((each) => each.lotId));
    setSnapshot({
      lots: [...tableLots, ...printLots.filter((each) => !shown.has(each.lotId))],
      isReprint: reprint,
    });
    batch.reset();
    batch.run(commands, reprint ? null : unit);
    clearSelection();
  };

  const printFailureCode =
    reasons.data?.some((reason) => reason.code === PRINT_FAILURE_REASON_CODE) === true
      ? PRINT_FAILURE_REASON_CODE
      : null;
  const summary = summarize(batch);
  const retry = retryCommands(
    summary.retryable,
    new Map((snapshot?.lots ?? []).map((each) => [each.lotId, each] as const)),
    batch.results,
    base,
    printFailureCode,
  );

  const confirmResults = (): void => {
    batch.reset();
    setSnapshot(null);
  };

  const pairName = picked === null ? null : `${picked.ref.itemCode} ${picked.ref.itemName}`;

  const barState: BarState = isIssuing
    ? {
        kind: 'running',
        supplierName: snapshot?.isReprint === true ? null : pairName,
        done: batch.results.size + batch.skipped.size,
        total: batch.order.length,
        isStopping: batch.isStopping,
      }
    : snapshot !== null
      ? batch.remaining > 0
        ? {
            kind: 'paused',
            done: batch.results.size + batch.skipped.size,
            total: batch.order.length,
            remaining: batch.remaining,
            next: batch.nextCount,
          }
        : {
            kind: 'done',
            isReprint: snapshot.isReprint,
            printed: summary.printed,
            unfinished: summary.unfinished.length,
            headline: summary.headline,
            retryCount: retry.commands.length,
            needsReasonCount: retry.needsReason.length,
          }
      : isReprintTab
        ? {
            kind: 'reprint',
            count: selected.length,
            reasonName,
            blockedReason:
              blockedLot === undefined
                ? null
                : t.reprint.lotBlocked(
                    t.reprint.lotStatus[blockedLot.statusCode] ?? blockedLot.statusCode,
                  ),
            isBlocked: workerNo === null,
            ...(tab === 'PRINTED' ? { voidCount: selectedWaiting.length } : {}),
          }
        : {
            kind: 'pending',
            count: tab === 'VOIDED' ? 0 : selectedWaiting.length,
            unprinted: tab === 'VOIDED' ? 0 : selectedUnprinted.length,
            unit,
            isBlocked: workerNo === null || plantId === null,
          };

  /* 발행 · 재인쇄 결과는 아래 가운데 알림으로도 낸다(규칙 13) — 안내 줄은 「확인」 전까지 남는다. */
  const doneMessage =
    barState.kind === 'done' && barState.unfinished === 0
      ? barState.isReprint
        ? t.bar.reprinted(barState.printed)
        : t.bar.done(barState.printed)
      : null;
  useEffect(() => {
    if (doneMessage !== null) puToast(doneMessage);
  }, [doneMessage]);

  const onCreated = (created: MaterialLotSummary[]): void => {
    setDialog(null);
    if (picked !== null) {
      for (const each of created) {
        known.current.set(each.lotId, {
          lotId: each.lotId,
          lotNo: each.lotNo,
          supplierId: picked.ref.supplierId,
          supplierCode: picked.ref.supplierCode,
          supplierName: picked.ref.supplierName,
          itemId: picked.ref.itemId,
          itemCode: picked.ref.itemCode,
          itemName: picked.ref.itemName,
          uomCode: picked.ref.uomCode,
          lotQty: each.lotQty,
          package: each.package,
          supplierLotNo: each.supplierLotNo,
          lifecycleStatusCode: each.lifecycleStatusCode,
          statusCode: each.statusCode,
          inboundLotNo: each.inboundLotNo,
          lastIssue: each.lastLabelIssue,
          createdAt: each.createdAt,
          creationModeCode: 'MANUAL',
          purchaseOrderLine: null,
        });
      }
    }
    refreshLots();
    /* 만든 LOT 을 고른 채로 둔다 — 바로 라벨을 발행하게(screens/P-01-01.md). */
    setTab('UNPRINTED');
    setChecked(new Set(created.map((each) => each.lotId)));
    puToast(t.batch.created(created.length));
  };

  const confirmVoid = async (voidLots: readonly LabelLot[]): Promise<void> => {
    if (workerNo === null || voidSaving) return;

    setVoidSaving(true);
    setVoidError(null);
    try {
      const result = await voidMaterialLots(
        client,
        voidLots.map((each) => each.lotId),
        workerNo,
      );
      const voided = result.items.filter((item) => item.voided).length;
      const failed = result.items.length - voided;

      setDialog(null);
      clearSelection();
      setScanned(null);
      refreshLots();
      puToast(
        failed === 0 ? t.voidDialog.done(voided) : t.voidDialog.partial(voided, failed),
        failed === 0 ? 'ok' : 'warn',
      );
    } catch (cause) {
      setVoidError(serverReasonOf(toApiError(cause)) ?? t.voidDialog.failed);
    } finally {
      setVoidSaving(false);
    }
  };

  const statusNote = <IssueStatusNote state={barState} />;
  const hasStatusNote =
    barState.kind === 'running' || barState.kind === 'paused' || barState.kind === 'done';
  const printedPicked = selectedWaiting.length - selectedUnprinted.length;

  const listProblem = (query: { isError: boolean; refetch: () => unknown }) =>
    query.isError ? (
      <PuNote
        tone="bad"
        action={
          <PuButton
            size="sm"
            onClick={() => {
              void query.refetch();
            }}
          >
            {t.work.retry}
          </PuButton>
        }
      >
        {t.work.loadFailed}
      </PuNote>
    ) : null;

  /* ── 첫째 칸: 스캔 또는 찾기 + 공급사(서버 쪽, #1751 접기) ── */
  const leftSection = (
    <PuSection
      className="mll-left"
      title={tc.suppliers}
      fold={{ label: tc.suppliers, folded, onChange: setFolded }}
      split
    >
      <div className="mll-left-top">
        <PuScanField
          label={tp.scanLabel}
          value={scanText}
          disabled={isFrozen || plantId === null}
          error={scanError}
          manual={{ label: tp.scanManual, search: true }}
          onChange={(value) => {
            setScanText(value);
            setScanError(null);
            if (value.trim() === '' && findQ !== '') changeFind('');
          }}
          onSubmit={(value) => {
            void submitScan(value);
          }}
        />
        {plantId === null ? (
          <PuEmpty icon="info" title={t.work.noPlant} />
        ) : suppliers.isError ? (
          listProblem(suppliers)
        ) : suppliers.isPending ? null : supplierRows.length === 0 ? (
          <PuEmpty icon="search" title={findQ === '' ? tc.emptySuppliers : tc.noMatchSuppliers} />
        ) : (
          <SupplierList
            suppliers={supplierRows}
            selectedId={pickedSupplier?.supplierId ?? null}
            isLocked={isFrozen}
            onSelect={chooseSupplier}
            fitRef={supplierFitRef}
          />
        )}
      </div>
      <PuPager
        label={tc.suppliers}
        total={supplierTotal}
        page={supplierPage}
        pages={Math.max(1, Math.ceil(supplierTotal / Math.max(1, supplierSize)))}
        onPage={setSupplierPage}
      />
    </PuSection>
  );

  /* ── 둘째 칸: 고른 공급사의 품목 표(서버 쪽, #1751) ── */
  const itemSection = (
    <PuSection
      className="mll-mid"
      title={pickedSupplier === null ? tc.items : tc.itemsOf(pickedSupplier.name)}
      split
    >
      {pickedSupplier === null ? (
        <PuEmpty icon="box" title={tc.pickSupplier} hint={tc.pickSupplierHint} />
      ) : pairs.isError ? (
        listProblem(pairs)
      ) : pairs.isPending ? (
        <div className="mll-mid-empty" />
      ) : pairRows.length === 0 ? (
        <PuEmpty icon="search" title={tc.emptyItems} />
      ) : (
        <ItemTable
          pairs={pairRows}
          selectedKey={pickedKey}
          isLocked={isFrozen}
          onSelect={(row) => {
            choosePair({ ref: pairRefOf(row), row });
          }}
          fitRef={itemFitRef}
        />
      )}
      <PuPager
        label={tc.items}
        total={pairTotal}
        page={itemPage}
        pages={Math.max(1, Math.ceil(pairTotal / Math.max(1, itemSize)))}
        onPage={setItemPage}
      />
    </PuSection>
  );

  /* ── 오른쪽 ── */
  const unprintedCount =
    tab === 'UNPRINTED' && lotsData !== undefined
      ? lotsData.total
      : pickedRow === null
        ? null
        : pairUnprintedOf(pickedRow);

  const tabs = (
    <div className="mll-tabs">
      <PuSeg
        label={tp.tabsLabel}
        value={tab}
        options={TAB_ORDER.map((each) => ({
          value: each,
          /* 결과를 「확인」하기 전에는 보기를 바꾸지 않는다 — 결과가 어느 보기의 것인지 흐려진다. */
          disabled: isFrozen,
          label:
            each === 'UNPRINTED' && unprintedCount !== null ? (
              <>
                {tp.tabs[each]}
                <PuCount>{unprintedCount}</PuCount>
              </>
            ) : (
              tp.tabs[each]
            ),
        }))}
        onChange={chooseTab}
      />
    </div>
  );

  const lotsConflict = lots.error instanceof ApiRequestError && lots.error.httpStatus === 409;

  /** 표 자리의 알림(FR-005 · FR-012 · SC-005) — 빈 표만 남기지 않는다. */
  const renderGenerationNotice = () => {
    if (tab !== 'UNPRINTED' || generation === null) return null;

    if (generation.status === 'NO_DEFAULT') {
      return (
        <PuNote tone="warn">
          <b>{tp.notes.NO_DEFAULT}</b> {tp.notes.noDefaultHint}
        </PuNote>
      );
    }

    if (generation.status === 'NO_CONVERSION' && tableLots.length > 0) {
      return <PuNote tone="bad">{tp.notes.NO_CONVERSION}</PuNote>;
    }

    return null;
  };

  const renderEmpty = () => {
    if (tab === 'UNPRINTED' && generation !== null) {
      if (generation.status === 'NO_OPEN_PO') {
        return (
          <PuEmpty icon="info" title={tp.notes.NO_OPEN_PO} hint={tp.notes.noOpenPoHint}>
            <span className="mll-dim">{tp.notes.manualHint}</span>
          </PuEmpty>
        );
      }
      if (generation.status === 'NO_CONVERSION') {
        return (
          <PuEmpty icon="info" title={tp.notes.NO_CONVERSION} hint={tp.notes.noConversionHint}>
            <span className="mll-dim">{tp.notes.manualHint}</span>
          </PuEmpty>
        );
      }
      if (generation.status === 'NO_DEFAULT') return null;
    }

    return <PuEmpty icon="box" title={tp.empty[tab]} />;
  };

  const defaultLine = pickedRow === null ? null : pairDefaultLine(pickedRow, true);
  const remaining = creatableRemainingOf(generation);
  const lotTotal = lotsData?.total ?? 0;
  const tableShown = snapshot?.lots ?? tableLots;
  const isLoadingLots = target !== null && (lots.isPending || lots.isFetching) && !isShowingResults;

  const pairSection =
    picked === null ? (
      <PuSection label={tc.items}>
        <PuEmpty icon="list" title={tc.pickItem} />
      </PuSection>
    ) : (
      <PuSection
        className="mll-right"
        labelId={`${createNoteId}-pair`}
        title={
          <>
            <span className="mll-head-field">
              <small>{t.work.fields.itemCode}</small>
              <span className="mll-head-name">{picked.ref.itemCode}</span>
            </span>
            <span className="mll-head-field">
              <small>{t.work.fields.itemName}</small>
              <span className="mll-head-name">{picked.ref.itemName}</span>
            </span>
            <span className="mll-head-field">
              <small>{t.work.fields.supplier}</small>
              <span className="mll-head-value">{picked.ref.supplierName}</span>
            </span>
            <span className="mll-head-field">
              <small>{t.work.fields.uom}</small>
              <span className="mll-head-value">{picked.ref.uomCode}</span>
            </span>
            {defaultLine === null ? null : (
              <span className={defaultLine.isMissing ? 'mll-head-sub mll-miss' : 'mll-head-sub'}>
                {defaultLine.isMissing ? defaultLine.text : tp.headDefault(defaultLine.text)}
              </span>
            )}
          </>
        }
        meta={
          isShowingResults ? (
            <b>{t.work.resultSummary(summary.printed, summary.unfinished.length)}</b>
          ) : (
            <>
              <PuHelpButton title={t.work.help}>
                <div className="mll-help">
                  <p>{t.work.helpIntro}</p>
                  <ul>
                    {t.work.helpItems.map((item) => (
                      <li key={item.term}>
                        <b>{item.term}</b> {item.text}
                      </li>
                    ))}
                  </ul>
                </div>
              </PuHelpButton>
              {/* C-4 — 사번이 없어 잠긴 까닭은 맨 위 띠와 같은 말이다. */}
              {workerNo === null ? (
                <span id={createNoteId} hidden>
                  {messages.popChrome.workerMissing}
                </span>
              ) : null}
              <PuButton
                size="sm"
                icon="plus"
                disabled={isLocked || workerNo === null}
                aria-describedby={workerNo === null ? createNoteId : undefined}
                onClick={() => {
                  setDialog({ kind: 'batch' });
                }}
              >
                {t.work.create}
              </PuButton>
            </>
          )
        }
      >
        {tabs}
        {hasStatusNote ? statusNote : null}
        {scanFound === null || hasStatusNote ? null : (
          <PuNote tone="ok" live>
            {scanFound}
            {isReprintTab ? ` ${tp.lookup.foundReprint}` : null}
          </PuNote>
        )}
        {isReprintTab || tab === 'VOIDED' ? <PuNote>{tp.tabNotes[tab]}</PuNote> : null}
        {lotsConflict ? (
          <PuNote
            tone="bad"
            action={
              <PuButton size="sm" onClick={refreshLots}>
                {t.work.retry}
              </PuButton>
            }
          >
            {tp.notes.conflict}
          </PuNote>
        ) : lots.isError ? (
          <PuNote
            tone="bad"
            action={
              <PuButton size="sm" onClick={refreshLots}>
                {t.work.retry}
              </PuButton>
            }
          >
            {t.work.loadFailed}
          </PuNote>
        ) : null}
        {renderGenerationNotice()}
        {hasStatusNote ? null : printedPicked > 0 && tab === 'UNPRINTED' ? (
          <PuNote tone="warn">{t.bar.printedNote(printedPicked)}</PuNote>
        ) : tab === 'UNPRINTED' && unit !== null && selectedUnprinted.length > unit ? (
          <PuNote>{t.bar.unitNote(unit)}</PuNote>
        ) : null}
        {tab === 'UNPRINTED' ? (
          <div className="mll-units">
            <span className="pu-label" id={`${createNoteId}-unit`}>
              {t.bar.unit.label}
            </span>
            <PopSelect
              className="mll-unit-select"
              aria-labelledby={`${createNoteId}-unit`}
              value={unitValue(unit)}
              disabled={isFrozen}
              options={ISSUE_UNITS.map((each) => ({
                value: unitValue(each),
                label: each === null ? t.bar.unit.all : t.bar.unit.each(each),
              }))}
              onChange={(value) => {
                chooseUnit(value === 'all' ? null : Number(value));
              }}
            />
            <PuButton size="sm" disabled={isFrozen || checked.size === 0} onClick={clearSelection}>
              {t.bar.clear}
            </PuButton>
          </div>
        ) : null}
        {tableShown.length === 0 && !isLoadingLots && !lots.isError ? (
          renderEmpty()
        ) : (
          <LabelTable
            tab={tab}
            lots={tableShown}
            checked={checked}
            onToggle={toggle}
            isLocked={isLocked}
            showResults={isShowingResults}
            batch={batch}
            label={tp.tabs[tab]}
            fitRef={tableFitRef}
            scannedLotId={scanned?.tab === tab ? scanned.lot.lotId : null}
            defaultLotQty={pickedRow?.lotDefaults?.lotQty ?? null}
            hasMoreAfter={lotPage < Math.ceil(lotTotal / Math.max(1, rowSize))}
          />
        )}
        {isReprintTab && !isShowingResults && selected.length > 0 ? (
          <ReasonPicker
            reasons={reasons.data ?? []}
            isLoading={reasons.isPending}
            isError={reasons.isError}
            selected={reasonCode}
            isLocked={isLocked}
            onSelect={setReasonCode}
          />
        ) : null}
        {barState.kind === 'reprint' && barState.blockedReason !== null ? (
          <PuNote tone="bad">{barState.blockedReason}</PuNote>
        ) : null}
        <div className="mll-foot">
          {tab === 'UNPRINTED' && remaining > 0 ? (
            <span className="mll-foot-note">{tp.notCreatedYet(remaining)}</span>
          ) : null}
          <PuPager
            label={tp.tabs[tab]}
            total={lotTotal}
            page={lotPage}
            pages={Math.max(1, Math.ceil(lotTotal / Math.max(1, rowSize)))}
            onPage={(next) => {
              setLotPage(next);
            }}
          />
        </div>
        {isLoadingLots ? (
          <div className="mll-loading" role="status">
            <b>{tab === 'UNPRINTED' ? tp.loading : tp.loadingOther}</b>
            {tab === 'UNPRINTED' ? <span>{tp.loadingHint}</span> : null}
          </div>
        ) : null}
      </PuSection>
    );

  return (
    /*
     * ⚠ **이 화면이 최상위 랜드마크다.** POP 라우트는 관리웹 셸을 지나지 않으므로(`routes/pop`)
     * `main`을 세워 주는 바깥이 없다 — 먼저 선 POP 화면들과 같은 형태다.
     */
    <main className="pop-ui mll-screen" aria-label={t.title}>
      <h1 className="mll-title">{t.title}</h1>
      <PopTopPrinter>
        <PrinterChip
          printers={printers.data}
          selected={headPrinter}
          isLoading={printers.isPending}
          isError={printers.isError}
          isLocked={isLocked}
          onRetry={() => {
            void printers.refetch();
          }}
          onSelect={(name) => {
            setPickedPrinter(name);
            rememberPrinterName(name);
          }}
          showNone
          noneLabel={messages.productionResult.flow.work.printerNone}
        />
      </PopTopPrinter>

      <PopWorkerMissingBanner workerNo={workerNo} />
      {printerChoice.missingStoredName === null ? null : (
        <div className="mll-banner">
          <PuNote tone="warn">{t.printer.storedMissing(printerChoice.missingStoredName)}</PuNote>
        </div>
      )}

      <PuScreen
        className="mll-body"
        actionBar={
          <IssueBar
            state={barState}
            onIssue={() => {
              if (isReprintTab) {
                if (reasonCode === null || blockedLot !== undefined || selected.length === 0)
                  return;
                setDialog({ kind: 'preview', lots: selected, reprint: true });
              } else if (selectedUnprinted.length > 0) {
                setDialog({ kind: 'preview', lots: selectedUnprinted, reprint: false });
              }
            }}
            onVoid={() => {
              setVoidError(null);
              setDialog({ kind: 'void', lots: selectedWaiting });
            }}
            onStop={batch.stop}
            onResume={batch.resume}
            onConfirm={confirmResults}
            onRetry={() => {
              batch.run(retry.commands, snapshot?.isReprint === true ? null : unit);
            }}
          />
        }
      >
        <PuCols variant="list" className="mll-cols3">
          {leftSection}
          {itemSection}
          {pairSection}
        </PuCols>
      </PuScreen>

      {dialog?.kind === 'batch' && picked !== null && plantId !== null && workerNo !== null ? (
        <BatchDialog
          plantId={plantId}
          workerNo={workerNo}
          group={picked.ref}
          onClose={() => {
            setDialog(null);
          }}
          onCreated={onCreated}
        />
      ) : null}
      {dialog?.kind === 'void' ? (
        <VoidDialog
          lots={dialog.lots}
          isSaving={voidSaving}
          error={voidError}
          onCancel={() => {
            setDialog(null);
          }}
          onConfirm={() => {
            void confirmVoid(dialog.lots);
          }}
        />
      ) : null}
      {dialog?.kind === 'preview' ? (
        <PreviewDialog
          lots={dialog.lots}
          reasonName={dialog.reprint ? reasonName : null}
          onCancel={() => {
            setDialog(null);
          }}
          onPrint={() => {
            startPrint(dialog.lots, dialog.reprint);
          }}
        />
      ) : null}
    </main>
  );
};
