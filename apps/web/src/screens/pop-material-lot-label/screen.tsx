import { AlertBanner, Button, Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { toLookupDisplayState } from '../../patterns/lookup-display';
import { usePopIdentity } from '../../patterns/pop-identity';
import { PopWorkerMissingBanner } from '../../patterns/pop-worker-missing-banner';
import { PopWorkerTag } from '../../patterns/pop-worker-tag';
import { popTouchClass } from '../../patterns/pop-touch';
import { retryCommands, summarize } from './batch-view';
import { PRINT_FAILURE_REASON_CODE } from './codes';
import { IssueBar, type BarState } from './issue-bar';
import { LabelTable } from './label-table';
import { useItemNameSources, useSupplierLookup, useUomLookup } from './lookups';
import { useBatchIssue, type IssueCommand } from './mutations';
import {
  groupBySupplier,
  matchesQuery,
  normalizeQuery,
  pageOf,
  type SupplierGroup,
} from './pending';
import { PrinterChip } from './printer-chip';
import { choosePrinter, rememberPrinterName, storedPrinterName } from './printer-choice';
import {
  findLotByNo,
  useLabelRows,
  useLotDetails,
  usePrinters,
  useReissueReasons,
  useShellSelectsPrinter,
} from './queries';
import { ReasonPicker } from './reason-picker';
import { useRowsThatFit } from './row-fit';
import { SupplierList, supplierLabelOf, supplierNameOf } from './supplier-list';
import type { TargetRow } from './types';

const t = messages.popMaterialLotLabel;

type Tab = 'pending' | 'reprint';

const TABS: readonly Tab[] = ['pending', 'reprint'];

/** 라벨을 낼 수 없는 LOT 상태 — 서버 `qualifyDocumentIssueTarget`(MATERIAL_LOT_LABEL)이 검사 대기·정상만 받는다. */
const LABEL_LOCKED_LOT_STATUS: readonly string[] = ['DEFECTIVE', 'SCRAPPED'];

/**
 * 다시 인쇄는 **최근 발행이 위**다 — 상한 라벨은 대개 방금 찍은 것이다. 발행 대기와 차례가 반대다.
 */
const newestFirst = (groups: SupplierGroup[]): SupplierGroup[] =>
  groups
    .map((group) => ({ ...group, rows: [...group.rows].reverse() }))
    .sort((left, right) =>
      (right.rows[0]?.receiptDatetime ?? '').localeCompare(left.rows[0]?.receiptDatetime ?? ''),
    );

/** 발행 결과를 그리는 동안 붙잡아 둔 표 — 찍은 줄이 대기에서 빠져도 「확인」 전까지 결과와 함께 남는다. */
interface ResultSnapshot {
  supplierId: number;
  rows: TargetRow[];
}

/**
 * `P-01-01` 자재 LOT 라벨 발행 (POP) — **공급사로 묶고 여러 장을 한 번에**(개편안 승인 2026-10-24 ·
 * omf-all-around#184).
 *
 * ```
 * ┌ 머리줄: 화면 이름 · 사번 · 프린터(누르면 바꾼다) · 단말 ─────────────────────────────┐
 * │ [발행 대기 | 다시 인쇄] │ 공급사 이름 코드                         [전체 선택] │
 * │ [찾기 칸 — 스캐너 입력] │ ☐ 품목코드 품목명 수량 입하            (열 머리 한 번) │
 * │ ▣ 공급사 · 남은 장수    │ ☑ …                                                │
 * │ ▢ 공급사 · 남은 장수    │ (한 쪽 줄 수 = 칸 높이에 들어가는 만큼)          │
 * │                         │ 새로 고침   1–13 / 29줄          [◀ 이전][다음 ▶] │
 * ├ 동작 바: 지금 상태 한 줄                       [선택 해제] [라벨 N장 발행] ┤
 * ```
 *
 * ⭐ **왜 바꿨는가**(고객 평가 최하 · 실측 2026-10-24) — 모든 공급사가 섞인 목록에서 한 줄씩 골라 찍어
 *    29장이면 58번 누르고 29번 기다렸다. 한 쪽 8줄 고정이라 넓은 화면은 비고 좁은 화면은 줄이 가려졌다.
 *    결과는 오른쪽 창 아래 글 한 줄이었고, 실패하면 다른 탭에서 그 줄을 다시 찾아야 했다.
 * ⚠ **E-3(POP 관리웹 기본 밀도)과 다르게 정한 곳** — 줄 56px, 단추 48px, 주 동작 56px. 손으로 누르는
 *   화면이라 개편안에서 키웠고 사용자가 승인했다. 이 화면의 클래스(`pop-mlot-*`)에만 둔다.
 */
export const PopMaterialLotLabelScreen = () => {
  const { client } = useApiClient();
  /*
   * 귀속 사번은 **셸이 아는 값**이다(진입점 화면 소관). 쓰기가 헤더로 요구하므로 없으면 부를 수 없고,
   * 그 사실을 감추지 않고 맨 위 띠로 말한다(공유계약 F-1·F-6 · 사용자 지시 2026-09-17).
   */
  const { workerNo, terminalId } = usePopIdentity();
  const batch = useBatchIssue({ workerNo });
  const isIssuing = batch.isRunning;

  const [tab, setTab] = useState<Tab>('pending');
  const [query, setQuery] = useState('');
  const [scanNote, setScanNote] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [checked, setChecked] = useState<ReadonlySet<number>>(new Set());
  const [page, setPage] = useState(1);
  const [focusLineId, setFocusLineId] = useState<number | null>(null);
  const [reasonCode, setReasonCode] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<ResultSnapshot | null>(null);

  const pending = useLabelRows('unissued', true, isIssuing);
  const issued = useLabelRows('issued', tab === 'reprint', isIssuing);
  const source = tab === 'pending' ? pending : issued;

  const supplierLookup = useSupplierLookup();
  const uomLookup = useUomLookup(true);
  /*
   * ⭐ **품목 이름은 받은 줄의 것만 푼다**(omf-all-around#27) — 마스터 목록 조회는 한 쪽만 돌려준다.
   *    찾기 칸이 품목코드로 거르므로 보이는 쪽이 아니라 받은 줄 전부의 품목을 푼다.
   */
  const itemNames = useItemNameSources(source.rows.map((row) => row.itemId));
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

  const normalized = normalizeQuery(query);

  const groups = useMemo(() => {
    const matched = source.rows.filter(
      (row) =>
        matchesQuery(row, normalized, itemNames.get(row.itemId)?.item?.code ?? null) ||
        (row.lotNo !== null && row.lotNo.toLocaleLowerCase('en-US').includes(normalized)),
    );
    const grouped = groupBySupplier(matched);

    return tab === 'reprint' ? newestFirst(grouped) : grouped;
  }, [source.rows, normalized, itemNames, tab]);

  /* 결과를 그리는 동안은 그 공급사에 머문다 — 결과가 다른 공급사 표 밑에 서면 남의 결과로 읽힌다. */
  const activeSupplierId = snapshot?.supplierId ?? supplierId;
  const current =
    groups.find((group) => group.supplierId === activeSupplierId) ??
    (snapshot === null ? groups[0] : undefined) ??
    null;
  const tableRows = snapshot?.rows ?? current?.rows ?? [];

  const rowsRef = useRef<HTMLDivElement | null>(null);
  const rowsPerPage = useRowsThatFit(rowsRef);
  const pageView = pageOf(tableRows, page, rowsPerPage);

  /* 스캔으로 고른 줄이 있는 쪽으로 옮긴다 — 고른 줄이 다른 쪽에 숨어 있으면 고른 것이 보이지 않는다. */
  useEffect(() => {
    if (focusLineId === null) return;

    const index = tableRows.findIndex((row) => row.inboundReceiptLineId === focusLineId);

    if (index >= 0) {
      setPage(Math.floor(index / rowsPerPage) + 1);
      setFocusLineId(null);
    }
  }, [focusLineId, tableRows, rowsPerPage]);

  const visibleLotIds =
    tab === 'reprint'
      ? pageView.items.flatMap((row) =>
          row.lotNo === null && row.lotId !== null ? [row.lotId] : [],
        )
      : [];
  const lots = useLotDetails(visibleLotIds);

  const uomCodeOf = (uomId: number): string | null => {
    const state = toLookupDisplayState(uomLookup, uomId);

    return state.kind === 'named' ? state.label : null;
  };
  /** 줄마다 라벨에 실을 말 — 단위 코드와 「공급사 (코드)」. 못 풀었으면 그 칸을 비운다. */
  const describe = (row: TargetRow): Pick<IssueCommand, 'uomCode' | 'supplierText'> => ({
    uomCode: uomCodeOf(row.uomId),
    supplierText: supplierLabelOf(supplierLookup, row.supplierId),
  });
  const base = {
    // 프린터 배정이 정해지기 전에는 한 대 전제다 — 고른 것이 없으면 서버 기본값에 맡긴다.
    printerName: headPrinter?.printerName ?? null,
    // 셸이 고른 프린터를 받을 때만 싣는다 — 아니면 셸이 기동 시 지정값 → OS 기본으로 보낸다.
    shellPrinterName: isPrinterSelectable ? (headPrinter?.printerName ?? null) : null,
  };

  const lotStatusOf = (row: TargetRow): string | null =>
    row.lotStatusCode ??
    (row.lotId === null ? null : (lots.get(row.lotId)?.data?.statusCode ?? null));

  const clearSelection = (): void => {
    setChecked(new Set());
  };

  const chooseSupplier = (id: number): void => {
    if (id === activeSupplierId) return;
    setSupplierId(id);
    setPage(1);
    clearSelection();
  };

  const chooseTab = (next: Tab): void => {
    if (next === tab) return;
    setTab(next);
    setSupplierId(null);
    setQuery('');
    setScanNote(null);
    setPage(1);
    clearSelection();
  };

  const toggle = (lineId: number): void => {
    setChecked((previous) => {
      const next = new Set(previous);

      if (next.has(lineId)) next.delete(lineId);
      else next.add(lineId);

      return next;
    });
  };

  const currentRows = current?.rows ?? [];
  const allChecked =
    currentRows.length > 0 && currentRows.every((row) => checked.has(row.inboundReceiptLineId));
  const someChecked = currentRows.some((row) => checked.has(row.inboundReceiptLineId));
  const toggleAll = (): void => {
    setChecked(
      allChecked ? new Set() : new Set(currentRows.map((row) => row.inboundReceiptLineId)),
    );
  };

  const selectedRows = currentRows.filter((row) => checked.has(row.inboundReceiptLineId));
  const blockedRow =
    tab === 'reprint'
      ? selectedRows.find((row) => {
          const status = lotStatusOf(row);

          return status !== null && LABEL_LOCKED_LOT_STATUS.includes(status);
        })
      : undefined;
  const blockedStatus = blockedRow === undefined ? null : lotStatusOf(blockedRow);

  const startIssue = (): void => {
    if (current === null || selectedRows.length === 0 || workerNo === null) return;

    const commands: IssueCommand[] = selectedRows.map((row) =>
      tab === 'pending'
        ? {
            ...base,
            ...describe(row),
            row,
            reissueReasonCode: null,
            lotStatusCode: row.lotStatusCode,
            /* 보내기 직전에 다른 단말이 먼저 찍지 않았는지 본다(`verifyCommands`). */
            verify: 'unissued',
          }
        : {
            ...base,
            ...describe(row),
            row,
            reissueReasonCode: reasonCode,
            lotStatusCode: lotStatusOf(row),
          },
    );

    if (tab === 'reprint' && (reasonCode === null || blockedRow !== undefined)) return;

    setSnapshot({ supplierId: current.supplierId, rows: current.rows });
    batch.reset();
    batch.run(commands);
    clearSelection();
  };

  /** 사유 목록에 「인쇄 실패」가 있으면 실패한 장을 그 사유로 다시 보낸다(`PRINT_FAILURE_REASON_CODE`). */
  const printFailureCode =
    reasons.data?.some((reason) => reason.code === PRINT_FAILURE_REASON_CODE) === true
      ? PRINT_FAILURE_REASON_CODE
      : null;
  const summary = summarize(batch);
  const snapshotRows = new Map(
    (snapshot?.rows ?? []).map((row) => [row.inboundReceiptLineId, row] as const),
  );
  const retry = retryCommands(
    summary.retryable,
    snapshotRows,
    batch.results,
    base,
    describe,
    printFailureCode,
  );

  const confirmResults = (): void => {
    batch.reset();
    setSnapshot(null);
    setPage(1);
  };

  const supplierName = current === null ? null : supplierNameOf(supplierLookup, current.supplierId);
  const reasonName =
    reasonCode === null
      ? null
      : (reasons.data?.find((reason) => reason.code === reasonCode)?.name ?? null);

  const barState: BarState = isIssuing
    ? {
        kind: 'running',
        supplierName,
        done: batch.results.size + batch.skipped.size,
        total: batch.order.length,
        isStopping: batch.isStopping,
      }
    : snapshot !== null
      ? {
          kind: 'done',
          printed: summary.printed,
          unfinished: summary.unfinished.length,
          headline: summary.headline,
          retryCount: retry.commands.length,
          needsReasonCount: retry.needsReason.length,
        }
      : tab === 'pending'
        ? {
            kind: 'pending',
            supplierName,
            count: selectedRows.length,
            isBlocked: workerNo === null,
          }
        : {
            kind: 'reprint',
            count: selectedRows.length,
            reasonName,
            blockedReason:
              blockedStatus === null
                ? null
                : t.reprint.lotBlocked(t.reprint.lotStatus[blockedStatus] ?? blockedStatus),
            isBlocked: workerNo === null,
          };

  /**
   * 찾기 칸에서 Enter — 다시 인쇄에서는 **라벨 스캔**이다. LOT 번호가 받은 줄에 있으면 그 줄을 고르고,
   * 없으면 정확 일치로 LOT 을 찾아 그 줄을 찾는다. 발행 대기에서는 칸이 거르기만 하므로 할 일이 없다.
   */
  const submitSearch = async (event: FormEvent): Promise<void> => {
    event.preventDefault();

    if (tab !== 'reprint') return;

    const value = query.trim();

    if (value === '') return;

    let found = issued.rows.find((row) => row.lotNo === value);

    if (found === undefined) {
      try {
        const lot = await findLotByNo(client, value);

        found = lot === null ? undefined : issued.rows.find((row) => row.lotId === lot.lotId);
      } catch {
        setScanNote(t.reprint.lookupFailed);

        return;
      }
    }

    if (found === undefined) {
      setScanNote(t.reprint.notFound);

      return;
    }

    setScanNote(null);
    setQuery('');
    setSupplierId(found.supplierId);
    setChecked(new Set([found.inboundReceiptLineId]));
    setFocusLineId(found.inboundReceiptLineId);
  };

  const isLocked = isIssuing;
  const isShowingResults = snapshot !== null;
  const tableMode = isShowingResults ? 'result' : tab === 'reprint' ? 'reprint' : 'pending';
  const emptyText = source.isPending
    ? ''
    : groups.length === 0
      ? normalized === ''
        ? tab === 'pending'
          ? t.suppliers.pendingEmpty
          : t.suppliers.reprintEmpty
        : t.table.noMatch
      : t.table.pickSupplier;

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
                {each === 'pending' && !pending.isPending ? (
                  <span className="pop-mlot-tab-count">{pending.rows.length}</span>
                ) : null}
              </button>
            ))}
          </div>

          <form
            className="pop-mlot-search"
            role="search"
            onSubmit={(event) => {
              void submitSearch(event);
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M4 6v12M7 6v12M10.5 6v12M14 6v12M16.5 6v12M20 6v12" />
            </svg>
            <input
              id="pop-mlot-search"
              className="pop-mlot-search-input"
              type="search"
              aria-label={t.search.label}
              placeholder={
                tab === 'pending' ? t.search.pendingPlaceholder : t.search.reprintPlaceholder
              }
              value={query}
              disabled={isLocked || isShowingResults}
              autoComplete="off"
              onChange={(event) => {
                setQuery(event.target.value);
                setScanNote(null);
                setPage(1);
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

          <SupplierList
            groups={groups}
            selectedId={current?.supplierId ?? null}
            supplierLookup={supplierLookup}
            mode={tab}
            isLocked={isLocked || isShowingResults}
            onSelect={chooseSupplier}
          />
        </aside>

        <section
          className="pop-mlot-work"
          data-reprint={tab === 'reprint' && !isShowingResults}
          aria-label={supplierName ?? t.title}
        >
          <div className="pop-mlot-work-head">
            <div className="pop-mlot-work-title">
              <h2>{supplierName ?? ''}</h2>
              {current === null ? null : (
                <span className="pop-mlot-work-code">
                  {supplierLookup.byId.get(current.supplierId)?.code ?? ''}
                </span>
              )}
            </div>
            {isShowingResults ? (
              <span className="pop-mlot-work-sum">
                {t.table.resultSummary(summary.printed, summary.unfinished.length)}
              </span>
            ) : currentRows.length === 0 ? null : (
              <button
                type="button"
                role="checkbox"
                aria-checked={allChecked ? true : someChecked ? 'mixed' : false}
                className="pop-mlot-select-all"
                disabled={isLocked}
                onClick={toggleAll}
              >
                <span className="pop-mlot-checkbox" data-checked={allChecked || someChecked}>
                  {allChecked ? (
                    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                      <path d="M5 12.5l4.5 4.5L19 7.5" />
                    </svg>
                  ) : someChecked ? (
                    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                      <path d="M6 12h12" />
                    </svg>
                  ) : null}
                </span>
                {t.table.selectAll}
              </button>
            )}
          </div>

          {source.isError ? (
            <div className="banner-slot">
              <AlertBanner
                variant="error"
                title={t.table.loadFailed}
                action={
                  <Button
                    className={popTouchClass('normal')}
                    variant="outlined"
                    size="xl"
                    onClick={source.refetch}
                  >
                    {t.table.retry}
                  </Button>
                }
              />
            </div>
          ) : null}

          <LabelTable
            mode={tableMode}
            rows={pageView.items}
            checked={checked}
            onToggle={toggle}
            isLocked={isLocked}
            itemNames={itemNames}
            uomLookup={uomLookup}
            batch={batch}
            lots={lots}
            rowsRef={rowsRef}
            empty={emptyText}
          />

          {tab === 'reprint' && !isShowingResults ? (
            <ReasonPicker
              reasons={reasons.data ?? []}
              isLoading={reasons.isPending}
              isError={reasons.isError}
              selected={reasonCode}
              isLocked={isLocked}
              onSelect={setReasonCode}
            />
          ) : null}

          <div className="pop-mlot-work-foot">
            <button
              type="button"
              className="pop-mlot-foot-button"
              disabled={isLocked}
              onClick={source.refetch}
            >
              {t.table.refresh}
            </button>
            <span className="pop-mlot-range">
              {pageView.total === 0
                ? ''
                : t.table.range(pageView.from, pageView.to, pageView.total)}
            </span>
            <nav className="pop-mlot-pager" aria-label={t.table.pageNav}>
              <button
                type="button"
                className="pop-mlot-foot-button"
                disabled={pageView.page <= 1}
                onClick={() => {
                  setPage(pageView.page - 1);
                }}
              >
                {t.table.prev}
              </button>
              <button
                type="button"
                className="pop-mlot-foot-button"
                disabled={pageView.page >= pageView.totalPages}
                onClick={() => {
                  setPage(pageView.page + 1);
                }}
              >
                {t.table.next}
              </button>
            </nav>
          </div>
        </section>
      </div>

      <IssueBar
        state={barState}
        onIssue={startIssue}
        onClear={clearSelection}
        onStop={batch.stop}
        onConfirm={confirmResults}
        onRetry={() => {
          batch.run(retry.commands);
        }}
      />
    </main>
  );
};
