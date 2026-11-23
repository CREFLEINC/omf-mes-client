import type { MaterialLotSummary, WaitingMaterialLotGroup } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { usePopIdentity } from '../../patterns/pop-identity';
import { ListOrderFoot, sortByTime, type ListOrder } from '../../patterns/pop-list-order';
import { PopTopPrinter } from '../../patterns/pop-top-status';
import {
  PuButton,
  PuChip,
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
  PuTiles,
  puToast,
  useClientPage,
  useFitCount,
  useFitTableRows,
} from '../../patterns/pop-uniform';
import { PuSearchBox } from '../../patterns/pop-uniform/search-box';
import { PopWorkerMissingBanner } from '../../patterns/pop-worker-missing-banner';
import { toApiError } from '../../patterns/request';
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
import {
  REPRINT_DAYS,
  usePrinters,
  useReissueReasons,
  useShellSelectsPrinter,
  useSupplierItemDefaults,
  useWaitingGroups,
} from './queries';
import { ReasonPicker } from './reason-picker';
import { defaultLineOf, SupplierList } from './supplier-list';
import { isVoided, isWaiting, pairKeyOf, toLabelLots, type LabelLot } from './types';
import { VoidDialog } from './void-dialog';
import './uniform.css';

const t = messages.popMaterialLotLabel;

type Tab = 'pairs' | 'reprint';

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

/** 발행 단위 타일 값 — 「전체」는 `all`. */
const unitValue = (unit: IssueUnit): string => (unit === null ? 'all' : String(unit));

const normalize = (value: string): string => value.trim().toLocaleLowerCase('en-US');

const matchesPair = (group: WaitingMaterialLotGroup, query: string): boolean =>
  query === '' ||
  [group.supplierCode, group.supplierName, group.itemCode, group.itemName].some((value) =>
    value.toLocaleLowerCase('en-US').includes(query),
  );

/** 라벨을 아직 발행하지 않았다 — 발행 대기 탭의 대상. 발행 기록이 하나라도 있으면 재발행 탭이다. */
const isUnissued = (lot: LabelLot): boolean => lot.lastIssue === null;

/** 재인쇄 대상 — 최근 2주 안에 출력했고 폐기되지 않은 LOT(screens/P-01-01.md 「재발행」 탭). */
const reprintable = (lots: readonly LabelLot[], now: Date): LabelLot[] => {
  const since = now.getTime() - REPRINT_DAYS * 24 * 60 * 60 * 1000;

  return lots
    .filter(
      (lot) =>
        lot.lastIssue !== null && !isVoided(lot) && Date.parse(lot.lastIssue.issuedAt) >= since,
    )
    .sort((left, right) =>
      (right.lastIssue?.issuedAt ?? '').localeCompare(left.lastIssue?.issuedAt ?? ''),
    );
};

/**
 * `P-01-01` 자재 관리 LOT 라벨 (POP) — 005 · omf-all-around#254 · screens/P-01-01.md · #295 시안.
 *
 * ```
 * ┌ [발행 대기 N | 재발행] [|<] ┐┌ V144030603 SCREW            [입하 대기 25] [?] [+ 자재 관리 LOT 만들기] ┐
 * │ 🔍 공급사 또는 품목          ││ CMS VINA 100569 · 기본 단위 EA · 기본 BOX 10 × 100 = 1,000 EA          │
 * │ ▣ 품목 · 공급사 [입하 대기 3] ││ ⓘ 할 일 한 줄                                                         │
 * │ ▢ …                         ││ 발행 단위 [전체|10장|20장|50장] [입하 대기 전체 선택 (N건)] [선택 해제] │
 * │            총 N건 ‹ 1 / 2 ›  ││ 표(선택 · 번호 · 재고 수량·포장 · 상태 · 라벨) — 맨 뒤 최근 입하(흐림)    │
 * └─────────────────────────────┘└──────────────────────────────────────────────── 총 N건 ‹ 1 / 7 › ┘
 * 작업 줄: [입하 대기 N개 폐기] [라벨 N장 발행]  (재발행 탭: [N장 재인쇄])
 * ```
 *
 * ⭐ 라벨은 입하 전 입하 대기 자재 관리 LOT 에 찍는다. 입하 LOT 탭 · 입하 LOT 고르기는 없다(FR-036 · D-19·D-25).
 * ⭐ 인쇄 길(발행 기록 → 라벨 짜기 → 셸 인쇄 → 결과 보고) · 발행 단위 · 결과 표 · 다시 발행은 그대로다
 *    (개편안 2026-10-24 · omf-all-around#184). #295 는 모양 · 배치 · 문구만 시안에 맞췄다.
 */
export const PopMaterialLotLabelScreen = () => {
  const { client } = useApiClient();
  const createNoteId = useId();
  const { workerNo, plantId = null } = usePopIdentity();
  const batch = useBatchIssue({ workerNo });
  const isIssuing = batch.isRunning;

  const [tab, setTab] = useState<Tab>('pairs');
  const [folded, setFolded] = useState(false);
  const [query, setQuery] = useState('');
  const [scanNote, setScanNote] = useState<string | null>(null);
  const [pairKey, setPairKey] = useState<string | null>(null);
  const [checked, setChecked] = useState<ReadonlySet<number>>(new Set());
  const [reasonCode, setReasonCode] = useState<string | null>(null);
  const [unit, setUnit] = useState<IssueUnit>(storedIssueUnit);
  const [snapshot, setSnapshot] = useState<ResultSnapshot | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [voidSaving, setVoidSaving] = useState(false);
  const [voidError, setVoidError] = useState<string | null>(null);

  const waiting = useWaitingGroups(plantId, isIssuing || dialog !== null);
  const defaults = useSupplierItemDefaults(plantId);
  const defaultsMap = defaults.data ?? new Map();
  const queryClient = useQueryClient();
  /*
   * 다시 불러오기는 목록과 함께 공급사·품목 기본 정보도 다시 받는다 — 기본 정보는 오래 들고 있어(60초)
   * W-06-25 에서 고친 값이 「기본 …」 줄 · 머리에 늦게 섰다(G2 L19).
   */
  const refreshAll = (): void => {
    waiting.refetch();
    void defaults.refetch();
    void queryClient.invalidateQueries({ queryKey: ['material-lot-batch', 'defaults'] });
  };
  /* 늘 받는다 — 인쇄 실패한 장을 「인쇄 실패」 사유로 다시 보낼지 이 목록으로 가른다(`PRINT_FAILURE_REASON_CODE`). */
  const reasons = useReissueReasons(true);

  const printers = usePrinters();
  /*
   * 프린터 선택(2단계 검증 2026-10-16) — 고른 것 → 단말에 기억해 둔 것 → 셸의 출력 대상.
   * ⛔ 셸이 고른 프린터를 받지 못하면(브라우저·옛 설치본) 기억해 둔 값을 쓰지 않는다 — 머리줄이 실제로
   *    나가지 않을 프린터를 가리키게 된다.
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
    // 프린터 배정이 정해지기 전에는 한 대 전제다 — 고른 것이 없으면 서버 기본값에 맡긴다.
    printerName: headPrinter?.printerName ?? null,
    // 셸이 고른 프린터를 받을 때만 싣는다 — 아니면 셸이 기동 시 지정값 → OS 기본으로 보낸다.
    shellPrinterName: isPrinterSelectable ? (headPrinter?.printerName ?? null) : null,
    ...(plantId === null ? {} : { plantId }),
  };

  const normalized = normalize(query);
  const groups = useMemo(
    () => (tab === 'pairs' ? waiting.groups.filter((group) => matchesPair(group, normalized)) : []),
    [tab, waiting.groups, normalized],
  );
  const current =
    groups.find((group) => pairKeyOf(group.supplierId, group.itemId) === pairKey) ??
    groups[0] ??
    null;
  const currentKey = current === null ? null : pairKeyOf(current.supplierId, current.itemId);
  /*
   * 표 정렬 [최신순 | 오래된순](사용자 지시 2026-11-19) — 발행 대기는 등록일시, 재발행은 최근 출력일시. 처음은 둘 다
   * 최신순. 입하 대기 → 폐기 → 최근 입하 묶음 차례는 그대로 두고 묶음 안에서만 줄 세운다.
   */
  const [waitOrder, setWaitOrder] = useState<ListOrder>('newest');
  const [reprintOrder, setReprintOrder] = useState<ListOrder>('newest');
  const currentLots = useMemo(
    () =>
      current === null ? [] : sortByTime(toLabelLots(current), waitOrder, (lot) => lot.createdAt),
    [current, waitOrder],
  );
  /*
   * 발행 대기 표는 입하 대기 LOT 만 — 폐기한 LOT 은 목록에서 뺀다(사용자 지시 2026-11-23).
   * ⭐ 라벨을 이미 발행한 LOT 은 발행 대기 표에 두지 않는다 — 재발행 탭에만 선다(사용자 지시 2026-11-19).
   */
  const waitingLots = useMemo(
    () => currentLots.filter(isUnissued).filter(isWaiting),
    [currentLots],
  );
  const receivedLots = useMemo(
    () => currentLots.filter((lot) => !isWaiting(lot) && !isVoided(lot)),
    [currentLots],
  );
  const allLots = useMemo(() => waiting.groups.flatMap(toLabelLots), [waiting.groups]);
  const reprintLots = useMemo(() => {
    const list = sortByTime(
      reprintable(allLots, new Date()),
      reprintOrder,
      (lot) => lot.lastIssue?.issuedAt,
    );

    return normalized === ''
      ? list
      : list.filter(
          (lot) =>
            lot.lotNo.toLocaleLowerCase('en-US').includes(normalized) ||
            lot.itemCode.toLocaleLowerCase('en-US').includes(normalized),
        );
  }, [allLots, normalized, reprintOrder]);
  /* 탭 건수는 표와 같은 규칙 — 라벨을 아직 발행하지 않은 입하 대기 LOT(사용자 지시 2026-11-19). */
  const waitingTotal = allLots.filter((lot) => isWaiting(lot) && isUnissued(lot)).length;
  const waitingCount = waitingLots.filter(isWaiting).length;

  const lotById = useMemo(
    () => new Map(allLots.map((lot) => [lot.lotId, lot] as const)),
    [allLots],
  );
  const selected = [...checked].flatMap((lotId) => {
    const lot = lotById.get(lotId);

    return lot === undefined ? [] : [lot];
  });
  const selectedWaiting = selected.filter(isWaiting);
  const selectedUnprinted = selectedWaiting.filter((lot) => lot.lastIssue === null);
  const blockedLot =
    tab === 'reprint'
      ? selected.find((lot) => LABEL_LOCKED_LOT_STATUS.includes(lot.statusCode))
      : undefined;

  const isLocked = isIssuing;
  const isShowingResults = snapshot !== null;

  /* 쪽 넘김(규칙 1) — 한 쪽 건수는 구획 높이에 들어가는 만큼. */
  const pairFitRef = useRef<HTMLUListElement>(null);
  const tableFitRef = useRef<HTMLDivElement>(null);
  const pairSize = useFitCount(pairFitRef, { fallback: 4 });
  const rowSize = useFitTableRows(tableFitRef, { fallback: 5 });
  /* 입하 대기 · 폐기 다음에 최근 입하된 LOT(흐림, 고를 수 없음) — 결과를 그리는 동안은 그때 표 그대로. */
  const pairTableLots = snapshot?.lots ?? [...waitingLots, ...receivedLots.filter(isUnissued)];
  const reprintTableLots = snapshot?.lots ?? reprintLots;
  const pairPage = useClientPage(groups, pairSize);
  const waitPage = useClientPage(pairTableLots, rowSize);
  const reprintPage = useClientPage(reprintTableLots, rowSize);

  const clearSelection = (): void => {
    setChecked(new Set());
  };

  const chooseTab = (next: Tab): void => {
    if (next === tab) return;
    setTab(next);
    setQuery('');
    setScanNote(null);
    setReasonCode(null);
    clearSelection();
    pairPage.setPage(1);
    waitPage.setPage(1);
    reprintPage.setPage(1);
  };

  const changePairQuery = (next: string): void => {
    setQuery(next);
    pairPage.setPage(1);
  };

  const choosePair = (key: string): void => {
    if (key === currentKey) return;
    setPairKey(key);
    clearSelection();
    waitPage.setPage(1);
  };

  const toggle = (lotId: number): void => {
    setChecked((previous) => {
      const next = new Set(previous);

      if (next.has(lotId)) next.delete(lotId);
      else next.add(lotId);

      return next;
    });
  };

  const selectAllWaiting = (): void => {
    setChecked(new Set(waitingLots.filter(isWaiting).map((lot) => lot.lotId)));
  };

  /* 재발행 탭 전체 선택 — 지금 보이는 목록(찾기 반영) 전부(사용자 지시 2026-11-19). */
  const selectAllReprint = (): void => {
    setChecked(new Set(reprintLots.map((lot) => lot.lotId)));
  };

  const chooseUnit = (next: IssueUnit): void => {
    setUnit(next);
    rememberIssueUnit(next);
  };

  const reasonName =
    reasonCode === null
      ? null
      : (reasons.data?.find((reason) => reason.code === reasonCode)?.name ?? null);

  /** 미리 보기에서 [인쇄] — 첫 발행은 미출력 입하 대기 LOT 만, 재인쇄는 고른 LOT 을 사유와 함께. */
  const startPrint = (lots: readonly LabelLot[], reprint: boolean): void => {
    if (workerNo === null || lots.length === 0) return;

    const commands: IssueCommand[] = lots.map((lot) =>
      reprint
        ? { ...base, lot, reissueReasonCode: reasonCode }
        : {
            ...base,
            lot,
            reissueReasonCode: null,
            /* 보내기 직전에 다른 단말이 먼저 찍지 않았는지 본다(`verifyCommands`). */
            verifyUnissued: true,
          },
    );

    setDialog(null);
    /* 결과 표는 그때 보이던 줄 그대로다. */
    setSnapshot({ lots: reprint ? reprintLots : waitingLots, isReprint: reprint });
    batch.reset();
    batch.run(commands, reprint ? null : unit);
    clearSelection();
  };

  /** 사유 목록에 「인쇄 실패」가 있으면 실패한 장을 그 사유로 다시 보낸다(`PRINT_FAILURE_REASON_CODE`). */
  const printFailureCode =
    reasons.data?.some((reason) => reason.code === PRINT_FAILURE_REASON_CODE) === true
      ? PRINT_FAILURE_REASON_CODE
      : null;
  const summary = summarize(batch);
  const retry = retryCommands(
    summary.retryable,
    new Map((snapshot?.lots ?? []).map((lot) => [lot.lotId, lot] as const)),
    batch.results,
    base,
    printFailureCode,
  );

  const confirmResults = (): void => {
    batch.reset();
    setSnapshot(null);
  };

  const pairName = current === null ? null : `${current.itemCode} ${current.itemName}`;

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
      : tab === 'pairs'
        ? {
            kind: 'pending',
            count: selectedWaiting.length,
            unprinted: selectedUnprinted.length,
            unit,
            isBlocked: workerNo === null || plantId === null,
          }
        : {
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

  /** 재발행 탭 스캔 칸 — **라벨 스캔**이다. 번호가 정확히 맞는 LOT 을 고르고 그 줄이 있는 쪽으로 넘긴다. */
  const submitScan = (scanned: string): void => {
    if (tab !== 'reprint') return;

    const value = scanned.trim();

    if (value === '') return;

    /* 표와 같은 차례로 찾아야 그 줄이 든 쪽으로 넘어간다. */
    const list = sortByTime(
      reprintable(allLots, new Date()),
      reprintOrder,
      (lot) => lot.lastIssue?.issuedAt,
    );
    const index = list.findIndex((lot) => lot.lotNo === value);
    const found = list[index];

    if (found === undefined) {
      setQuery('');
      setScanNote(t.reprint.notFound(value));

      return;
    }

    setScanNote(null);
    setQuery('');
    setChecked((previous) => new Set([...previous, found.lotId]));
    reprintPage.showIndex(index);
  };

  const onCreated = (lots: MaterialLotSummary[]): void => {
    setDialog(null);
    waiting.refetch();
    /* 만든 LOT 을 고른 채로 둔다 — 바로 라벨을 발행하게(screens/P-01-01.md). */
    setChecked(new Set(lots.map((lot) => lot.lotId)));
    waitPage.setPage(1);
    puToast(t.batch.created(lots.length));
  };

  const confirmVoid = async (lots: readonly LabelLot[]): Promise<void> => {
    if (workerNo === null || voidSaving) return;

    setVoidSaving(true);
    setVoidError(null);
    try {
      const result = await voidMaterialLots(
        client,
        lots.map((lot) => lot.lotId),
        workerNo,
      );
      const voided = result.items.filter((item) => item.voided).length;
      const failed = result.items.length - voided;

      setDialog(null);
      clearSelection();
      waiting.refetch();
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

  const isFrozen = isLocked || isShowingResults;
  const printedPicked = selectedWaiting.length - selectedUnprinted.length;
  const statusNote = <IssueStatusNote state={barState} />;
  const hasStatusNote =
    barState.kind === 'running' || barState.kind === 'paused' || barState.kind === 'done';

  const loadProblem =
    plantId === null ? (
      <PuEmpty icon="info" title={t.work.noPlant} />
    ) : waiting.isError ? (
      <PuNote
        tone="bad"
        action={
          <PuButton size="sm" onClick={refreshAll}>
            {t.work.retry}
          </PuButton>
        }
      >
        {t.work.loadFailed}
      </PuNote>
    ) : null;

  const leftSection = (
    <PuSection
      className="mll-left"
      head={
        <PuSeg
          label={t.tabs.label}
          value={tab}
          options={(['pairs', 'reprint'] as const).map((each) => ({
            value: each,
            /* 결과를 「확인」하기 전에는 보기를 바꾸지 않는다 — 결과가 어느 보기의 것인지 흐려진다. */
            disabled: isFrozen,
            label:
              each === 'pairs' ? (
                <>
                  {t.tabs.pairs}
                  {waiting.isPending ? null : <PuCount>{waitingTotal}</PuCount>}
                </>
              ) : (
                t.tabs.reprint
              ),
          }))}
          onChange={chooseTab}
        />
      }
      fold={{ label: t.tabs[tab], folded, onChange: setFolded }}
      split={tab === 'pairs'}
    >
      {tab === 'pairs' ? (
        <>
          <div className="mll-left-top">
            <PuSearchBox
              className="mll-search"
              label={t.search.label}
              heading={t.search.pairsLabel}
              value={query}
              disabled={isFrozen}
              onChange={changePairQuery}
            />
            {waiting.isPending ? null : groups.length === 0 ? (
              <PuEmpty icon="search" title={normalized === '' ? t.pairs.empty : t.pairs.noMatch} />
            ) : (
              <SupplierList
                groups={pairPage.items}
                defaults={defaultsMap}
                selectedKey={currentKey}
                isLocked={isFrozen}
                onSelect={choosePair}
                fitRef={pairFitRef}
              />
            )}
          </div>
          <PuPager
            label={t.pairs.label}
            total={pairPage.total}
            page={pairPage.page}
            pages={pairPage.pages}
            onPage={pairPage.setPage}
          />
        </>
      ) : (
        <>
          <PuScanField
            label={t.search.scanLabel}
            value={query}
            disabled={isFrozen}
            error={scanNote}
            manual={{ search: true }}
            onChange={(value) => {
              setQuery(value);
              setScanNote(null);
              reprintPage.setPage(1);
            }}
            onSubmit={submitScan}
          />
        </>
      )}
    </PuSection>
  );

  const pairSection =
    current === null ? (
      <PuSection>
        {loadProblem ??
          (waiting.isPending ? null : <PuEmpty icon="list" title={t.work.pickPair} />)}
      </PuSection>
    ) : (
      <PuSection
        className="mll-right"
        labelId={`${createNoteId}-pair`}
        /* 공급사 · 기본 단위 · 기본 정보는 제목 오른쪽에 작고 흐리게 한 줄 — 넘치면 말줄임(사용자 지시 2026-11-19).
           기본 정보가 없으면 그 칸을 뺀다(사용자 지시 2026-11-23). */
        title={
          <>
            <span className="mll-head-name">{pairName}</span>
            <span className="mll-head-sub">
              {t.work.meta(
                current.supplierName,
                current.uomCode,
                defaultLineOf(defaultsMap.get(currentKey ?? '')),
              )}
            </span>
          </>
        }
        meta={
          isShowingResults ? (
            <b>{t.work.resultSummary(summary.printed, summary.unfinished.length)}</b>
          ) : (
            <>
              {/* 「입하 대기 N」 칩은 두지 않는다 — 건수는 표·아래 단추가 말한다(사용자 지시 2026-11-19). */}
              {receivedLots.length > 0 ? (
                <PuChip tone="ok">{t.work.receivedChip(receivedLots.length)}</PuChip>
              ) : null}
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
        {loadProblem}
        {hasStatusNote ? (
          statusNote
        ) : printedPicked > 0 ? (
          <PuNote tone="warn">{t.bar.printedNote(printedPicked)}</PuNote>
        ) : unit !== null && selectedUnprinted.length > unit ? (
          /* 발행 단위보다 많이 골랐다 — N장마다 멈춘다(사용자 지시 2026-11-19 · 타일이 아무 일도 안 하는 것처럼 보였다). */
          <PuNote>{t.bar.unitNote(unit)}</PuNote>
        ) : null}
        <div className="mll-units">
          <span className="pu-label">{t.bar.unit.label}</span>
          <PuTiles
            label={t.bar.unit.label}
            cols={4}
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
          <PuButton size="sm" disabled={isFrozen || waitingCount === 0} onClick={selectAllWaiting}>
            {t.bar.selectAllWaiting(waitingCount)}
          </PuButton>
          <PuButton size="sm" disabled={isFrozen || checked.size === 0} onClick={clearSelection}>
            {t.bar.clear}
          </PuButton>
        </div>
        {pairTableLots.length === 0 ? (
          <PuEmpty icon="box" title={t.work.waitingEmpty} hint={t.work.waitingEmptyHint} />
        ) : (
          <LabelTable
            mode="waiting"
            lots={waitPage.items}
            checked={checked}
            onToggle={toggle}
            isLocked={isLocked}
            showResults={isShowingResults}
            batch={batch}
            label={t.work.waitingTitle}
            fitRef={tableFitRef}
          />
        )}
        <ListOrderFoot
          order={waitOrder}
          onOrder={(next) => {
            setWaitOrder(next);
            waitPage.setPage(1);
          }}
          showOrder={!isShowingResults && pairTableLots.length > 0}
        >
          <PuPager
            label={t.work.waitingTitle}
            total={waitPage.total}
            page={waitPage.page}
            pages={waitPage.pages}
            onPage={waitPage.setPage}
          />
        </ListOrderFoot>
      </PuSection>
    );

  const reprintSection = (
    <PuSection
      className="mll-right"
      meta={
        <>
          {/* 「출력한 자재 관리 LOT N개」는 두지 않는다 — 건수는 아래 쪽 넘김이 말한다(사용자 지시 2026-11-19). */}
          {isShowingResults ? (
            <span>{t.work.resultSummary(summary.printed, summary.unfinished.length)}</span>
          ) : null}
          <PuButton
            size="sm"
            disabled={isFrozen || reprintLots.length === 0}
            onClick={selectAllReprint}
          >
            {t.bar.selectAllReprint(reprintLots.length)}
          </PuButton>
          <PuButton size="sm" disabled={isFrozen || checked.size === 0} onClick={clearSelection}>
            {t.bar.clear}
          </PuButton>
        </>
      }
    >
      {loadProblem}
      {hasStatusNote ? statusNote : null}
      {barState.kind === 'reprint' && barState.blockedReason !== null ? (
        <PuNote tone="bad">{barState.blockedReason}</PuNote>
      ) : null}
      {reprintTableLots.length === 0 ? (
        waiting.isPending ? null : (
          <PuEmpty icon="print" title={t.work.reprintEmpty} />
        )
      ) : (
        <LabelTable
          mode="reprint"
          lots={reprintPage.items}
          checked={checked}
          onToggle={toggle}
          isLocked={isLocked}
          showResults={isShowingResults}
          batch={batch}
          label={t.work.reprintTitle}
          fitRef={tableFitRef}
        />
      )}
      <ListOrderFoot
        order={reprintOrder}
        onOrder={(next) => {
          setReprintOrder(next);
          reprintPage.setPage(1);
        }}
        showOrder={!isShowingResults && reprintTableLots.length > 0}
      >
        <PuPager
          label={t.work.reprintTitle}
          total={reprintPage.total}
          page={reprintPage.page}
          pages={reprintPage.pages}
          onPage={reprintPage.setPage}
        />
      </ListOrderFoot>
      {/* 사유는 재인쇄할 LOT을 고른(스캔한) 뒤에만 보인다(사용자 지시 2026-11-19). */}
      {isShowingResults || selected.length === 0 ? null : (
        <ReasonPicker
          reasons={reasons.data ?? []}
          isLoading={reasons.isPending}
          isError={reasons.isError}
          selected={reasonCode}
          isLocked={isLocked}
          onSelect={setReasonCode}
        />
      )}
    </PuSection>
  );

  return (
    /*
     * ⚠ **이 화면이 최상위 랜드마크다.** POP 라우트는 관리웹 셸을 지나지 않으므로(`routes/pop`)
     * `main`을 세워 주는 바깥이 없다 — 먼저 선 POP 화면들과 같은 형태다.
     */
    <main className="pop-ui mll-screen" aria-label={t.title}>
      <h1 className="mll-title">{t.title}</h1>
      {/* 프린터는 공통 메뉴 맨 위 줄 프린터 자리에 서고, 누르면 고른다(사용자 지시 2026-11-17 · #291). */}
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

      {/* ⭐ 사번 미확인은 모든 POP 화면이 같은 맨 위 띠로 말한다(사용자 지시 2026-09-17). */}
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
              if (tab === 'reprint') {
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
        <PuCols variant="list">
          {leftSection}
          {tab === 'pairs' ? pairSection : reprintSection}
        </PuCols>
      </PuScreen>

      {dialog?.kind === 'batch' && current !== null && plantId !== null && workerNo !== null ? (
        <BatchDialog
          plantId={plantId}
          workerNo={workerNo}
          group={current}
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
