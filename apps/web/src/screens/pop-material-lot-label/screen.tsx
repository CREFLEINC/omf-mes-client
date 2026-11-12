import { AlertBanner, Button, Chip, useToast } from '@crefle/web-ui';
import type { MaterialLotSummary, WaitingMaterialLotGroup } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useId, useMemo, useState, type FormEvent } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { formatPlantClock } from '../../patterns/plant-time';
import { usePopIdentity } from '../../patterns/pop-identity';
import { PopWorkerMissingBanner } from '../../patterns/pop-worker-missing-banner';
import { PopWorkerTag } from '../../patterns/pop-worker-tag';
import { popTouchClass } from '../../patterns/pop-touch';
import { toApiError } from '../../patterns/request';
import { serverReasonOf } from '../../patterns/server-reason';
import { BatchDialog } from './batch-dialog';
import { retryCommands, summarize } from './batch-view';
import { PRINT_FAILURE_REASON_CODE } from './codes';
import { IssueBar, type BarState } from './issue-bar';
import { rememberIssueUnit, storedIssueUnit, type IssueUnit } from './issue-unit';
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

const t = messages.popMaterialLotLabel;

type Tab = 'pairs' | 'reprint';

const TABS: readonly Tab[] = ['pairs', 'reprint'];

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

const normalize = (value: string): string => value.trim().toLocaleLowerCase('en-US');

const matchesPair = (group: WaitingMaterialLotGroup, query: string): boolean =>
  query === '' ||
  [group.supplierCode, group.supplierName, group.itemCode, group.itemName].some((value) =>
    value.toLocaleLowerCase('en-US').includes(query),
  );

/** 다시 인쇄 대상 — 최근 2주 안에 출력했고 폐기되지 않은 LOT(screens/P-01-01.md 「다시 인쇄」 탭). */
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
 * `P-01-01` 자재 관리 LOT 라벨 (POP) — 005 · omf-all-around#254 · screens/P-01-01.md.
 *
 * ```
 * ┌ 머리줄: 화면 이름 · 사번 · 프린터(누르면 바꾼다) · 단말 ────────────────────────────────────┐
 * │ [공급사·품목 N | 다시 인쇄] │ CAP-2041 사출 캡 원자재                [자재 관리 LOT 만들기] │
 * │ 🔍 공급사 또는 품목          │ (주)한빛소재 HB01 · 기본 단위 EA · 기본 봉지 10 × 100 = 1,000 EA│
 * │ [⟳ 새로 고침] 10:42:05 받음  │ ⓘ 안내                                                        │
 * │ ▣ 품목 · 공급사 [대기 3]      │ 대기 자재 관리 LOT — 표(체크 · 번호 · 수량 · 패키징 · 공급사 LOT · 상태 · 라벨)│
 * │ ▢ …                         │ 최근 입하된 자재 관리 LOT — 같은 표(고를 수 없음)              │
 * ├ 동작 바: 지금 상태 · 발행 단위 · [대기 전체 선택] [선택 해제] [대기 N개 폐기] [라벨 N장 발행] ┤
 * ```
 *
 * ⭐ **005 에서 왼쪽 목록이 「라벨 대기 입하 줄」에서 「공급사·품목」으로 바뀌었다**(기존 화면 디자인 변경 — PR 에 고지).
 *    라벨은 입하 전 대기 자재 관리 LOT 에 찍는다. 입하 LOT 탭 · 입하 LOT 고르기는 없다(FR-036 · D-19·D-25).
 * ⭐ 인쇄 길(발행 기록 → 라벨 짜기 → 셸 인쇄 → 결과 보고) · 발행 단위 · 결과 표 · 다시 발행은 옛 화면 그대로다
 *    (개편안 2026-10-24 · omf-all-around#184). 「LOT 등록」 걸음만 없어졌다.
 * ⚠ **E-3(POP 관리웹 기본 밀도)과 다르게 정한 곳** — 줄 56px, 단추 48px, 주 동작 56px(사용자 승인 #184).
 */
export const PopMaterialLotLabelScreen = () => {
  const { client } = useApiClient();
  const toast = useToast();
  const createNoteId = useId();
  const { workerNo, terminalId, plantId = null } = usePopIdentity();
  const batch = useBatchIssue({ workerNo });
  const isIssuing = batch.isRunning;

  const [tab, setTab] = useState<Tab>('pairs');
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
  const currentLots = useMemo(() => (current === null ? [] : toLabelLots(current)), [current]);
  /* 대기를 위에, 폐기를 아래에 — 폐기는 고를 수 없다(screens/P-01-01.md). */
  const waitingLots = useMemo(
    () =>
      currentLots
        .filter((lot) => isWaiting(lot) || isVoided(lot))
        .sort((left, right) => Number(isVoided(left)) - Number(isVoided(right))),
    [currentLots],
  );
  const receivedLots = currentLots.filter((lot) => !isWaiting(lot) && !isVoided(lot));
  const allLots = useMemo(() => waiting.groups.flatMap(toLabelLots), [waiting.groups]);
  const reprintLots = useMemo(() => {
    const list = reprintable(allLots, new Date());

    return normalized === ''
      ? list
      : list.filter(
          (lot) =>
            lot.lotNo.toLocaleLowerCase('en-US').includes(normalized) ||
            lot.itemCode.toLocaleLowerCase('en-US').includes(normalized),
        );
  }, [allLots, normalized]);
  const waitingTotal = waiting.groups.reduce((sum, group) => sum + group.waitingCount, 0);

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
  };

  const choosePair = (key: string): void => {
    if (key === currentKey) return;
    setPairKey(key);
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

  const selectAllWaiting = (): void => {
    setChecked(new Set(waitingLots.filter(isWaiting).map((lot) => lot.lotId)));
  };

  const chooseUnit = (next: IssueUnit): void => {
    setUnit(next);
    rememberIssueUnit(next);
  };

  const reasonName =
    reasonCode === null
      ? null
      : (reasons.data?.find((reason) => reason.code === reasonCode)?.name ?? null);

  /** 미리 보기에서 [인쇄] — 첫 발행은 미출력 대기 LOT 만, 다시 인쇄는 고른 LOT 을 사유와 함께. */
  const startPrint = (lots: readonly LabelLot[], reprint: boolean): void => {
    if (workerNo === null || lots.length === 0) return;

    const commands: IssueCommand[] = lots.map((lot) =>
      reprint
        ? { ...base, lot, reissueReasonCode: reasonCode, lotStatusCode: lot.statusCode }
        : {
            ...base,
            lot,
            reissueReasonCode: null,
            lotStatusCode: lot.statusCode,
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
            hasWaiting: waitingLots.some(isWaiting),
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

  /** 다시 인쇄의 찾기 칸에서 Enter — **라벨 스캔**이다. 번호가 정확히 맞는 LOT 을 고른다. */
  const submitSearch = (event: FormEvent): void => {
    event.preventDefault();

    if (tab !== 'reprint') return;

    const value = query.trim();

    if (value === '') return;

    const found = reprintable(allLots, new Date()).find((lot) => lot.lotNo === value);

    if (found === undefined) {
      setScanNote(t.reprint.notFound);

      return;
    }

    setScanNote(null);
    setQuery('');
    setChecked((previous) => new Set([...previous, found.lotId]));
  };

  const onCreated = (lots: MaterialLotSummary[]): void => {
    setDialog(null);
    waiting.refetch();
    /* 만든 LOT 을 고른 채로 둔다 — 바로 라벨을 발행하게(screens/P-01-01.md). */
    setChecked(new Set(lots.map((lot) => lot.lotId)));
    toast.show({ variant: 'success', description: t.batch.created(lots.length) });
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
      toast.show({
        variant: failed === 0 ? 'success' : 'warning',
        description:
          failed === 0 ? t.voidDialog.done(voided) : t.voidDialog.partial(voided, failed),
      });
    } catch (cause) {
      setVoidError(serverReasonOf(toApiError(cause)) ?? t.voidDialog.failed);
    } finally {
      setVoidSaving(false);
    }
  };

  const emptyPairs = normalized !== '' && groups.length === 0;

  return (
    /*
     * ⚠ **이 화면이 최상위 랜드마크다.** POP 라우트는 관리웹 셸을 지나지 않으므로(`routes/pop`)
     * `main`을 세워 주는 바깥이 없다 — 먼저 선 POP 화면들과 같은 형태다.
     */
    <main className="pop-lot-screen pop-ui" aria-label={t.title}>
      <header className="pop-header">
        <h1 className="pop-title">{t.title}</h1>
        <div className="pop-context-right">
          <PopWorkerTag workerNo={workerNo} />
          <PrinterChip
            printers={printers.data}
            selected={headPrinter}
            isLoading={printers.isPending}
            isError={printers.isError}
            isSelectable={isPrinterSelectable}
            isLocked={isLocked}
            onRetry={() => {
              void printers.refetch();
            }}
            onSelect={(name) => {
              setPickedPrinter(name);
              rememberPrinterName(name);
            }}
          />
          {/* 단말도 상시 보인다(스펙 §3 머리줄) — 다른 POP 화면과 같은 자리·순서다. */}
          <Chip status={terminalId === null ? 'warning' : 'info'}>
            {`${t.device.terminalLabel} ${
              terminalId === null ? t.device.terminalUnknown : String(terminalId)
            }`}
          </Chip>
        </div>
      </header>

      {/* ⭐ 사번 미확인은 모든 POP 화면이 같은 맨 위 띠로 말한다(사용자 지시 2026-09-17). */}
      <PopWorkerMissingBanner workerNo={workerNo} />
      {printerChoice.missingStoredName === null ? null : (
        <div className="banner-slot">
          <AlertBanner
            variant="warning"
            title={t.printer.storedMissing(printerChoice.missingStoredName)}
          />
        </div>
      )}

      <div className="pop-mlot-body">
        <aside className="pop-mlot-side">
          <div className="pop-mlot-tabs" role="group" aria-label={t.tabs.label}>
            {TABS.map((each) => (
              <button
                key={each}
                type="button"
                className="pop-mlot-tab"
                aria-pressed={tab === each}
                /* 결과를 「확인」하기 전에는 보기를 바꾸지 않는다 — 결과가 어느 보기의 것인지 흐려진다. */
                disabled={isLocked || isShowingResults}
                onClick={() => {
                  chooseTab(each);
                }}
              >
                {t.tabs[each]}
                {each === 'pairs' && !waiting.isPending ? (
                  <span className="pop-mlot-tab-count">{waitingTotal}</span>
                ) : null}
              </button>
            ))}
          </div>

          <form className="pop-mlot-search" role="search" onSubmit={submitSearch}>
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              {tab === 'reprint' ? (
                <path d="M4 6v12M7 6v12M10.5 6v12M14 6v12M16.5 6v12M20 6v12" />
              ) : (
                <path d="M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM15.5 15.5L20 20" />
              )}
            </svg>
            <input
              id="pop-mlot-search"
              className="pop-mlot-search-input"
              type="search"
              aria-label={t.search.label}
              placeholder={
                tab === 'pairs' ? t.search.pairsPlaceholder : t.search.reprintPlaceholder
              }
              value={query}
              disabled={isLocked || isShowingResults}
              autoComplete="off"
              onChange={(event) => {
                setQuery(event.target.value);
                setScanNote(null);
              }}
            />
            {query === '' ? null : (
              <button
                type="button"
                className="pop-mlot-search-clear"
                aria-label={t.search.clear}
                onClick={() => {
                  setQuery('');
                  setScanNote(null);
                }}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M7 7l10 10M17 7L7 17" />
                </svg>
              </button>
            )}
          </form>
          {scanNote === null ? null : (
            <p className="pop-mlot-scan-note" role="status">
              {scanNote}
            </p>
          )}

          <div className="pop-mlot-refresh">
            <button
              type="button"
              className="pop-mlot-refresh-button"
              aria-busy={waiting.isFetching}
              disabled={isLocked || plantId === null}
              onClick={waiting.refetch}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4.2h-4.2" />
              </svg>
              {t.work.refresh}
            </button>
            <span className="pop-mlot-refresh-at">
              {waiting.updatedAt === 0
                ? ''
                : t.work.refreshedAt(formatPlantClock(new Date(waiting.updatedAt)))}
            </span>
          </div>

          {tab === 'pairs' ? (
            <>
              {waiting.isPending ? null : (
                <SupplierList
                  groups={groups}
                  defaults={defaultsMap}
                  selectedKey={currentKey}
                  isLocked={isLocked || isShowingResults}
                  isFiltered={emptyPairs}
                  onSelect={choosePair}
                />
              )}
              <p className="pop-mlot-hint">{t.pairs.hint}</p>
            </>
          ) : (
            <p className="pop-mlot-info">{t.reprintInfo}</p>
          )}
        </aside>

        <section
          className="pop-mlot-work"
          data-reprint={tab === 'reprint' && !isShowingResults}
          aria-label={tab === 'reprint' ? t.work.reprintTitle : (pairName ?? t.title)}
        >
          {plantId === null ? (
            <p className="pop-mlot-empty">{t.work.noPlant}</p>
          ) : waiting.isError ? (
            <div className="banner-slot">
              <AlertBanner
                variant="error"
                title={t.work.loadFailed}
                action={
                  <Button
                    className={popTouchClass('normal')}
                    variant="outlined"
                    size="xl"
                    onClick={waiting.refetch}
                  >
                    {t.work.retry}
                  </Button>
                }
              />
            </div>
          ) : tab === 'reprint' ? (
            <>
              <div className="pop-mlot-work-head">
                <div className="pop-mlot-work-title">
                  <h2>{t.work.reprintTitle}</h2>
                  <span className="pop-mlot-work-code">
                    {isShowingResults
                      ? t.work.resultSummary(summary.printed, summary.unfinished.length)
                      : t.work.reprintCount(reprintLots.length)}
                  </span>
                </div>
              </div>
              <div className="pop-mlot-scroll">
                <LabelTable
                  mode="reprint"
                  lots={snapshot?.lots ?? reprintLots}
                  checked={checked}
                  onToggle={toggle}
                  isLocked={isLocked}
                  showResults={isShowingResults}
                  batch={batch}
                  empty={waiting.isPending ? null : t.work.reprintEmpty}
                  label={t.work.reprintTitle}
                />
              </div>
              {isShowingResults ? null : (
                <ReasonPicker
                  reasons={reasons.data ?? []}
                  isLoading={reasons.isPending}
                  isError={reasons.isError}
                  selected={reasonCode}
                  isLocked={isLocked}
                  onSelect={setReasonCode}
                />
              )}
            </>
          ) : current === null ? (
            <p className="pop-mlot-empty">{waiting.isPending ? '' : t.work.pickPair}</p>
          ) : (
            <>
              <div className="pop-mlot-work-head pop-mlot-pair-head">
                <div className="pop-mlot-work-title">
                  <h2>
                    {current.itemCode}{' '}
                    <span className="pop-mlot-pair-name">{current.itemName}</span>
                  </h2>
                  <span className="pop-mlot-work-code">
                    {t.work.meta(
                      current.supplierName,
                      current.supplierCode,
                      current.uomCode,
                      defaultLineOf(defaultsMap.get(currentKey ?? '')),
                    )}
                  </span>
                </div>
                {isShowingResults ? (
                  <span className="pop-mlot-work-sum">
                    {t.work.resultSummary(summary.printed, summary.unfinished.length)}
                  </span>
                ) : (
                  <>
                    {/* C-4 — 사번이 없어 잠긴 까닭은 맨 위 띠와 같은 말이다. */}
                    {workerNo === null ? (
                      <span id={createNoteId} hidden>
                        {messages.popChrome.workerMissing}
                      </span>
                    ) : null}
                    <Button
                      className={popTouchClass('primary')}
                      size="xl"
                      disabled={isLocked || workerNo === null}
                      aria-describedby={workerNo === null ? createNoteId : undefined}
                      onClick={() => {
                        setDialog({ kind: 'batch' });
                      }}
                    >
                      {t.work.create}
                    </Button>
                  </>
                )}
              </div>
              <p className="pop-mlot-info">{t.work.info}</p>
              <div className="pop-mlot-scroll">
                <h3 className="pop-mlot-section">
                  {t.work.waitingTitle}{' '}
                  <small>{t.work.waitingSub(current.itemCode, current.supplierName)}</small>
                </h3>
                <LabelTable
                  mode="waiting"
                  lots={snapshot?.lots ?? waitingLots}
                  checked={checked}
                  onToggle={toggle}
                  isLocked={isLocked}
                  showResults={isShowingResults}
                  batch={batch}
                  empty={t.work.waitingEmpty}
                  label={t.work.waitingTitle}
                />
                {receivedLots.length === 0 || isShowingResults ? null : (
                  <>
                    <h3 className="pop-mlot-section">
                      {t.work.receivedTitle(receivedLots.length)}{' '}
                      <small>{t.work.receivedSub}</small>
                    </h3>
                    <LabelTable
                      mode="received"
                      lots={receivedLots}
                      checked={checked}
                      onToggle={toggle}
                      isLocked={isLocked}
                      showResults={false}
                      batch={batch}
                      empty={null}
                      label={t.work.receivedTitle(receivedLots.length)}
                    />
                  </>
                )}
              </div>
            </>
          )}
        </section>
      </div>

      <IssueBar
        state={barState}
        onIssue={() => {
          if (tab === 'reprint') {
            if (reasonCode === null || blockedLot !== undefined || selected.length === 0) return;
            setDialog({ kind: 'preview', lots: selected, reprint: true });
          } else if (selectedUnprinted.length > 0) {
            setDialog({ kind: 'preview', lots: selectedUnprinted, reprint: false });
          }
        }}
        onClear={clearSelection}
        onSelectAllWaiting={selectAllWaiting}
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
        onUnitChange={chooseUnit}
      />

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
          printerName={headPrinter?.displayName ?? null}
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
