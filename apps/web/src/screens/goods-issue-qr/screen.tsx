import { AlertBanner, Button, Chip, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, useMemo, useState, type FormEvent } from 'react';

import { formatPlantClock, formatPlantDateTime, plantToday } from '../../patterns/plant-time';
import { usePopIdentity } from '../../patterns/pop-identity';
import { PopWorkerMissingBanner } from '../../patterns/pop-worker-missing-banner';
import { PopWorkerTag } from '../../patterns/pop-worker-tag';
import { popTouchClass } from '../../patterns/pop-touch';
import { formatBaseQty } from '../../patterns/package-qty';
import { PrinterChip } from '../pop-material-lot-label/printer-chip';
import {
  choosePrinter,
  rememberPrinterName,
  storedPrinterName,
} from '../pop-material-lot-label/printer-choice';
import {
  usePrinters,
  useReissueReasons,
  useShellSelectsPrinter,
} from '../pop-material-lot-label/queries';
import { ReasonPicker } from '../pop-material-lot-label/reason-picker';
import { LabelPreview } from './label-preview';
import {
  PRINTED_PERIODS,
  PRINT_FAILED,
  isUnprinted,
  matchesSplitLot,
  needsReissueReason,
  nextIssueSeq,
  toLabelLot,
  useSplitMaterialLots,
  type LabelState,
  type PrintedPeriod,
  type SplitMaterialLot,
} from './split-lots';
import { useSplitLabelPrint, type SplitPrintResult } from './split-print';

const t = messages.goodsIssueQr;

/** 분할 시각(공장 시각) `MM-DD HH:mm`. */
const shortAt = (value: string): string => (formatPlantDateTime(value) ?? value).slice(5);

/** 분할 뒤 며칠 지났나 — 공장 날짜로 센다. */
const daysSince = (value: string, today: string): number => {
  const date = (formatPlantDateTime(value) ?? value).slice(0, 10);

  return Math.max(0, Math.round((Date.parse(today) - Date.parse(date)) / 86_400_000));
};

const ageText = (value: string, today: string): string => {
  const days = daysSince(value, today);

  return days === 0 ? t.table.today : t.table.daysAgo(days);
};

const destinationOf = (lot: SplitMaterialLot): string =>
  lot.destination === null
    ? ''
    : `${lot.destination.warehouseCode} / ${lot.destination.locationCode}`;

interface ResultView {
  tone: 'success' | 'warning' | 'error';
  text: string;
}

/** 찍은 뒤 한 줄 — 몇 장 나왔고 무엇이 남았는가. */
const toResultView = (results: readonly SplitPrintResult[], isReprint: boolean): ResultView => {
  const count = (outcome: SplitPrintResult['outcome']) =>
    results.filter((each) => each.outcome === outcome).length;
  const printed = count('printed');
  const failed = count('printFailed');
  const notSent = count('notSent');
  const issueFailed = results.filter((each) => each.outcome === 'issueFailed');

  if (count('issueForbidden') > 0) return { tone: 'error', text: t.result.forbidden };

  const tail = [
    issueFailed.length > 0
      ? t.result.issueFailed(issueFailed.length, issueFailed[0]?.message ?? '')
      : '',
    notSent > 0 ? t.result.notSent(notSent) : '',
  ].join('');

  if (failed > 0) {
    return { tone: 'warning', text: t.result.partial(results.length, printed, failed) + tail };
  }

  if (printed === 0) return { tone: 'error', text: tail.trim() };

  return {
    tone: tail === '' ? 'success' : 'warning',
    text: (isReprint ? t.result.reprinted(printed) : t.result.printed(printed)) + tail,
  };
};

/**
 * `P-01-02` 분할 LOT 라벨 (POP) — 008 부분 출고 LOT 분할 · omf-all-around#289 · 확정 시안 P0102-After.
 *
 * ```
 * ┌ 머리줄: 화면 이름 · 사번 · 프린터 · 단말 ──────────────────────────────────────────────┐
 * │ ▣ 라벨 안 찍은 분할 LOT N건(기간 무관) · 인쇄 실패 · 가장 오래된 것                       │
 * │ [라벨 안 찍음 N | 찍음]  🔍 분할·원래 LOT 번호 스캔 …  (찍음: 출고일 기간)  [새로 고침]     │
 * │ 표: 선택 · 분할 LOT 번호/원래 LOT · 품목 · 수량 · 출고번호/라인 · 도착 · 분할 시각 · 라벨   │
 * │ 재발행 사유(인쇄 실패를 골랐거나 찍음 보기일 때)                                          │
 * ├ 동작 바: 지금 상태 · [전체 선택] [선택 해제] [라벨 N장 찍기] ─────────────────────────────┤
 * ```
 *
 * ⭐ 출고 QR(라인·파렛트) 발행은 없다(FR-010 · D-6). 분할 LOT 은 자재 관리 LOT 라벨과 같은 양식으로 찍는다(FR-007).
 * ⭐ 미발행은 기간과 상관없이 모두 보이고 오래된 것이 위다(FR-008 · SC-004). 인쇄 실패는 미발행으로 남는다.
 */
export const GoodsIssueQrScreen = () => {
  const { workerNo, terminalId, plantId = null } = usePopIdentity();
  /* 동작 바의 지금 상태 — 막힌 [라벨 찍기]가 그 까닭으로 잇는다(C-4). */
  const stateId = useId();
  const printing = useSplitLabelPrint(workerNo);

  const [tab, setTab] = useState<LabelState>('UNPRINTED');
  const [period, setPeriod] = useState<PrintedPeriod>('week');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());
  const [reasonCode, setReasonCode] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ index: number } | null>(null);
  const [result, setResult] = useState<{ view: ResultView; isReprint: boolean } | null>(null);

  const unprinted = useSplitMaterialLots(plantId, 'UNPRINTED', period);
  const printed = useSplitMaterialLots(
    tab === 'PRINTED' || query.trim() !== '' ? plantId : null,
    'PRINTED',
    period,
  );
  const current = tab === 'UNPRINTED' ? unprinted : printed;
  const other = tab === 'UNPRINTED' ? printed : unprinted;

  const printers = usePrinters();
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

  const today = plantToday();
  const unprintedLots = (unprinted.data?.items ?? []).filter(isUnprinted);
  const unprintedCount = unprinted.data?.unprintedCount ?? null;
  const failedCount = unprintedLots.filter((lot) => lot.labelIssue !== null).length;
  const oldest = unprintedLots[0];

  const rows = useMemo(
    () => (current.data?.items ?? []).filter((lot) => matchesSplitLot(lot, query)),
    [current.data, query],
  );
  const lotById = useMemo(
    () => new Map((current.data?.items ?? []).map((lot) => [lot.lotId, lot] as const)),
    [current.data],
  );
  const chosen = [...selected].flatMap((lotId) => {
    const lot = lotById.get(lotId);

    return lot === undefined ? [] : [lot];
  });
  const chosenNeedingReason = chosen.filter(needsReissueReason);
  const needsReason = chosenNeedingReason.length > 0;
  const reasons = useReissueReasons(needsReason);
  const reasonName =
    reasonCode === null
      ? null
      : (reasons.data?.find((reason) => reason.code === reasonCode)?.name ?? reasonCode);
  const isBusy = printing.isRunning;
  const canPrint =
    chosen.length > 0 && (!needsReason || reasonCode !== null) && workerNo !== null && !isBusy;
  const allOn = rows.length > 0 && rows.every((lot) => selected.has(lot.lotId));

  const chooseTab = (next: LabelState, keepQuery = false): void => {
    setTab(next);
    setSelected(new Set());
    setReasonCode(null);
    setResult(null);
    if (!keepQuery) setQuery('');
  };

  const toggle = (lotId: number): void => {
    setSelected((previous) => {
      const next = new Set(previous);

      if (next.has(lotId)) next.delete(lotId);
      else next.add(lotId);

      return next;
    });
  };

  const selectAll = (on: boolean): void => {
    setSelected(on ? new Set(rows.map((lot) => lot.lotId)) : new Set());
    if (!on) setReasonCode(null);
  };

  /* 스캐너가 번호를 치고 Enter — 그 번호의 분할 LOT 하나면 고르고 칸을 비운다(다음 봉지를 바로 읽게). */
  const submitSearch = (event: FormEvent): void => {
    event.preventDefault();

    const exact = rows.filter((lot) => lot.lotNo === query.trim());

    if (exact.length !== 1 || exact[0] === undefined) return;

    toggle(exact[0].lotId);
    setQuery('');
  };

  /* 찍는 차례는 오래된 순 — 봉지를 쌓아 둔 차례와 같다. */
  const printList = [...chosen].sort((left, right) => left.splitAt.localeCompare(right.splitAt));

  const startPrint = async (): Promise<void> => {
    const lots = printList;
    const isReprint = tab === 'PRINTED';

    setPreview(null);
    const results = await printing.run(lots, {
      printerName: headPrinter?.printerName ?? null,
      shellPrinterName: isPrinterSelectable ? (headPrinter?.printerName ?? null) : null,
      reissueReasonCode: reasonCode,
    });

    setSelected(new Set());
    setReasonCode(null);
    setResult({ view: toResultView(results, isReprint), isReprint });
  };

  const isPrintedTab = tab === 'PRINTED';
  const searchElsewhere =
    query.trim() === ''
      ? undefined
      : (other.data?.items ?? []).find((lot) => matchesSplitLot(lot, query));

  return (
    <main className="pop-lot-screen pop-ui pop-split" aria-label={t.title}>
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
            isLocked={isBusy}
            onRetry={() => {
              void printers.refetch();
            }}
            onSelect={(name) => {
              setPickedPrinter(name);
              rememberPrinterName(name);
            }}
          />
          <Chip status={terminalId === null ? 'warning' : 'info'}>
            {`${t.terminalLabel} ${terminalId === null ? t.terminalUnknown : String(terminalId)}`}
          </Chip>
        </div>
      </header>

      <PopWorkerMissingBanner workerNo={workerNo} />

      <SplitBand
        isError={unprinted.isError}
        count={unprintedCount}
        failed={failedCount}
        oldest={oldest === undefined ? null : oldest.splitAt}
        today={today}
        showUnprinted={isPrintedTab}
        onShowUnprinted={() => {
          chooseTab('UNPRINTED');
        }}
      />

      <div className="pop-split-tool">
        <div className="pop-mlot-tabs" role="group" aria-label={t.tabs.label}>
          {(['UNPRINTED', 'PRINTED'] as const).map((each) => (
            <button
              key={each}
              type="button"
              className="pop-mlot-tab"
              aria-pressed={tab === each}
              disabled={isBusy}
              onClick={() => {
                if (each !== tab) chooseTab(each);
              }}
            >
              {each === 'UNPRINTED' ? t.tabs.unprinted : t.tabs.printed}
              {each === 'UNPRINTED' ? (
                <span className="pop-mlot-tab-count">
                  {unprintedCount === null ? '?' : unprintedCount}
                </span>
              ) : null}
            </button>
          ))}
        </div>
        <form className="pop-mlot-search" role="search" onSubmit={submitSearch}>
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M4 6v12M7 6v12M10.5 6v12M14 6v12M16.5 6v12M20 6v12" />
          </svg>
          <input
            className="pop-mlot-search-input"
            type="search"
            aria-label={t.search.label}
            placeholder={t.search.placeholder}
            value={query}
            disabled={isBusy}
            autoComplete="off"
            onChange={(event) => {
              setQuery(event.target.value);
              setSelected(new Set());
            }}
          />
          {query === '' ? null : (
            <button
              type="button"
              className="pop-mlot-search-clear"
              aria-label={t.search.clear}
              onClick={() => {
                setQuery('');
              }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M7 7l10 10M17 7L7 17" />
              </svg>
            </button>
          )}
        </form>
        {isPrintedTab ? (
          <div className="pop-split-periods" role="group" aria-label={t.periods.label}>
            {PRINTED_PERIODS.map((each) => (
              <button
                key={each}
                type="button"
                className="pop-mlot-reason"
                aria-pressed={period === each}
                disabled={isBusy}
                onClick={() => {
                  setPeriod(each);
                  setSelected(new Set());
                }}
              >
                {t.periods[each]}
              </button>
            ))}
          </div>
        ) : null}
        <div className="pop-mlot-refresh">
          <button
            type="button"
            className="pop-mlot-refresh-button"
            aria-busy={current.isFetching}
            disabled={isBusy || plantId === null}
            onClick={() => {
              void unprinted.refetch();
              if (isPrintedTab) void printed.refetch();
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4.2h-4.2" />
            </svg>
            {t.refresh}
          </button>
          <span className="pop-mlot-refresh-at">
            {current.dataUpdatedAt === 0
              ? ''
              : t.refreshedAt(formatPlantClock(new Date(current.dataUpdatedAt)))}
          </span>
        </div>
      </div>

      <section className="pop-split-work" aria-label={t.table.label}>
        {isPrintedTab ? null : <p className="pop-split-info">{t.info}</p>}
        {result === null ? null : (
          <div className="banner-slot">
            <AlertBanner variant={result.view.tone} title={result.view.text}>
              {result.view.tone === 'success' && !result.isReprint ? (
                <Button
                  variant="outlined"
                  size="md"
                  onClick={() => {
                    chooseTab('PRINTED');
                  }}
                >
                  {t.result.showPrinted}
                </Button>
              ) : null}
            </AlertBanner>
          </div>
        )}

        {current.isError ? (
          <div className="pop-split-empty" role="alert">
            <b>{t.empty.loadFailedTitle}</b>
            <span>{t.empty.loadFailedBody}</span>
            <Button
              className={popTouchClass('primary')}
              size="xl"
              onClick={() => {
                void current.refetch();
              }}
            >
              {t.empty.retry}
            </Button>
          </div>
        ) : current.isPending && plantId !== null ? null : rows.length > 0 ? (
          <div className="pop-split-table" role="list">
            <div className="pop-split-row pop-split-head" aria-hidden="true">
              <span>{t.table.select}</span>
              <span>{t.table.lotNo}</span>
              <span>{t.table.item}</span>
              <span className="pop-split-num">{t.table.qty}</span>
              <span>{t.table.issue}</span>
              <span>{t.table.destination}</span>
              <span>{isPrintedTab ? t.table.splitAt : t.table.splitAtOldestFirst}</span>
              <span>{t.table.labelColumn}</span>
            </div>
            {rows.map((lot) => (
              <SplitRow
                key={lot.lotId}
                lot={lot}
                today={today}
                isChecked={selected.has(lot.lotId)}
                showAge={!isPrintedTab}
                isLocked={isBusy}
                onToggle={toggle}
              />
            ))}
          </div>
        ) : (
          <EmptyList
            tab={tab}
            period={period}
            query={query}
            elsewhere={searchElsewhere ?? null}
            onShowElsewhere={() => {
              chooseTab(isPrintedTab ? 'UNPRINTED' : 'PRINTED', true);
            }}
          />
        )}

        {needsReason || (isPrintedTab && chosen.length > 0) ? (
          <div className="pop-split-reasons">
            <ReasonPicker
              reasons={reasons.data ?? []}
              isLoading={reasons.isPending}
              isError={reasons.isError}
              selected={reasonCode}
              isLocked={isBusy}
              onSelect={setReasonCode}
            />
            {reasonCode === null ? (
              <span className="pop-split-hint-bad">
                {isPrintedTab ? t.reasons.need : t.reasons.needFailed(chosenNeedingReason.length)}
              </span>
            ) : null}
          </div>
        ) : null}
      </section>

      <footer className="pop-split-bar">
        <span id={stateId} className="pop-split-state" role="status">
          {printing.progress !== null
            ? t.bar.running(printing.progress.done + 1, printing.progress.total)
            : current.isError
              ? t.bar.listFirst
              : isPrintedTab
                ? chosen.length === 0
                  ? t.bar.reprintHint
                  : t.bar.reprintSelected(chosen.length) +
                    (reasonName === null ? '' : t.bar.withReason(reasonName))
                : chosen.length === 0
                  ? t.bar.pickHint
                  : t.bar.selected(chosen.length) +
                    (chosenNeedingReason.length > 0
                      ? t.bar.withFailed(chosenNeedingReason.length)
                      : '')}
          {chosen.length > 0 && needsReason && reasonCode === null ? (
            <small>{isPrintedTab ? t.bar.reprintNeedsReason : t.bar.failedNeedsReason}</small>
          ) : null}
        </span>
        {isPrintedTab ? null : (
          <Button
            className={popTouchClass('normal')}
            variant="outlined"
            size="xl"
            disabled={rows.length === 0 || isBusy}
            onClick={() => {
              selectAll(!allOn);
            }}
          >
            {allOn ? t.bar.clearAll : t.bar.selectAll(rows.length)}
          </Button>
        )}
        <Button
          className={popTouchClass('normal')}
          variant="outlined"
          size="xl"
          disabled={chosen.length === 0 || isBusy}
          onClick={() => {
            selectAll(false);
          }}
        >
          {t.bar.clearSelection}
        </Button>
        <Button
          className={popTouchClass('primary')}
          size="xl"
          disabled={!canPrint}
          aria-describedby={stateId}
          onClick={() => {
            setPreview({ index: 0 });
          }}
        >
          {isPrintedTab
            ? chosen.length === 0
              ? t.bar.reprintNone
              : t.bar.reprint(chosen.length)
            : chosen.length === 0
              ? t.bar.printNone
              : t.bar.print(chosen.length)}
        </Button>
      </footer>

      {preview === null ? null : (
        <PreviewDialog
          lots={printList}
          index={preview.index}
          isReprint={isPrintedTab}
          reasonName={needsReason ? reasonName : null}
          printerName={headPrinter?.displayName ?? null}
          onMove={(index) => {
            setPreview({ index });
          }}
          onCancel={() => {
            setPreview(null);
          }}
          onPrint={() => {
            void startPrint();
          }}
        />
      )}
    </main>
  );
};

const SplitBand = ({
  isError,
  count,
  failed,
  oldest,
  today,
  showUnprinted,
  onShowUnprinted,
}: {
  isError: boolean;
  count: number | null;
  failed: number;
  oldest: string | null;
  today: string;
  showUnprinted: boolean;
  onShowUnprinted: () => void;
}) => {
  if (isError || count === null) {
    return (
      <div className="pop-split-band pop-split-band--unknown" role="status">
        <span className="pop-split-count">?</span>
        <span className="pop-split-band-text">
          <b>{t.band.unknownTitle}</b>
          <span>{t.band.unknownBody}</span>
        </span>
      </div>
    );
  }

  if (count === 0) {
    return (
      <div className="pop-split-band pop-split-band--ok" role="status">
        <span className="pop-split-count">0</span>
        <span className="pop-split-band-text">
          <b>{t.band.noneTitle}</b>
          <span>{t.band.noneBody}</span>
        </span>
      </div>
    );
  }

  return (
    <div className="pop-split-band pop-split-band--alert" role="status" aria-live="polite">
      <span className="pop-split-count">{count}</span>
      <span className="pop-split-band-text">
        <b>{t.band.title(count)}</b>
        <span>{t.band.body}</span>
      </span>
      <span className="pop-split-band-aside">
        {failed > 0 ? <Chip status="error">{t.band.failed(failed)}</Chip> : null}
        {oldest === null ? null : (
          <Chip status={daysSince(oldest, today) > 0 ? 'error' : 'warning'}>
            {t.band.oldest(shortAt(oldest), ageText(oldest, today))}
          </Chip>
        )}
        {showUnprinted ? (
          <Button size="md" onClick={onShowUnprinted}>
            {t.band.showUnprinted}
          </Button>
        ) : null}
      </span>
    </div>
  );
};

const LabelStatus = ({ lot }: { lot: SplitMaterialLot }) => {
  const issue = lot.labelIssue;

  if (issue === null) return <Chip status="error">{t.status.unissued}</Chip>;

  if (issue.lastPrintOutcomeCode === PRINT_FAILED) {
    return (
      <span className="pop-split-two">
        <Chip status="error">{t.status.failed(issue.issueCount)}</Chip>
        <small className="pop-split-old">{t.status.failedHint}</small>
      </span>
    );
  }

  return (
    <span className="pop-split-two">
      <Chip status={issue.lastPrintOutcomeCode === 'PENDING' ? 'info' : 'success'}>
        {issue.lastPrintOutcomeCode === 'PENDING'
          ? t.status.pending(issue.lastIssueSeq)
          : t.status.printed(issue.lastIssueSeq)}
      </Chip>
      <small>{shortAt(issue.lastIssuedAt)}</small>
    </span>
  );
};

const SplitRow = ({
  lot,
  today,
  isChecked,
  showAge,
  isLocked,
  onToggle,
}: {
  lot: SplitMaterialLot;
  today: string;
  isChecked: boolean;
  showAge: boolean;
  isLocked: boolean;
  onToggle: (lotId: number) => void;
}) => (
  <div className="pop-split-row" role="listitem">
    <span>
      <input
        type="checkbox"
        className="pop-split-check"
        aria-label={t.table.choose(lot.lotNo)}
        checked={isChecked}
        disabled={isLocked}
        onChange={() => {
          onToggle(lot.lotId);
        }}
      />
    </span>
    <span className="pop-split-two">
      <span className="pop-split-lotno">{lot.lotNo}</span>
      <span className="pop-split-parent">{t.table.parent(lot.parentLot.lotNo)}</span>
    </span>
    <span className="pop-split-two">
      <b>{lot.item.itemCode}</b>
      <small>{lot.item.itemName}</small>
    </span>
    <span className="pop-split-num">{formatBaseQty(lot.qty, lot.uomCode)}</span>
    <span className="pop-split-two">
      <span>{lot.goodsIssue.goodsIssueNo}</span>
      <small>{t.table.line(lot.goodsIssue.lineNo)}</small>
    </span>
    <span className="pop-split-two">
      <span>{lot.destination?.warehouseCode ?? ''}</span>
      <small>{lot.destination?.locationCode ?? ''}</small>
    </span>
    <span className="pop-split-two">
      <span>{shortAt(lot.splitAt)}</span>
      {showAge ? (
        <small className={daysSince(lot.splitAt, today) > 0 ? 'pop-split-old' : undefined}>
          {ageText(lot.splitAt, today)}
        </small>
      ) : null}
    </span>
    <span>
      <LabelStatus lot={lot} />
    </span>
  </div>
);

const EmptyList = ({
  tab,
  period,
  query,
  elsewhere,
  onShowElsewhere,
}: {
  tab: LabelState;
  period: PrintedPeriod;
  query: string;
  elsewhere: SplitMaterialLot | null;
  onShowElsewhere: () => void;
}) => {
  if (query.trim() !== '') {
    return (
      <div className="pop-split-empty">
        <b>{t.empty.searchTitle}</b>
        {elsewhere === null ? (
          <span>{t.empty.searchNone}</span>
        ) : (
          <>
            <span>
              {tab === 'UNPRINTED'
                ? t.empty.searchInPrinted(elsewhere.lotNo)
                : t.empty.searchInUnprinted(elsewhere.lotNo)}
            </span>
            <Button variant="outlined" size="xl" onClick={onShowElsewhere}>
              {tab === 'UNPRINTED' ? t.empty.showInPrinted : t.empty.showInUnprinted}
            </Button>
          </>
        )}
      </div>
    );
  }

  return tab === 'UNPRINTED' ? (
    <div className="pop-split-empty">
      <b>{t.empty.unprintedTitle}</b>
      <span>{t.empty.unprintedBody}</span>
    </div>
  ) : (
    <div className="pop-split-empty">
      <b>{t.empty.printedTitle(t.periods[period])}</b>
      <span>{t.empty.printedBody}</span>
    </div>
  );
};

const PreviewDialog = ({
  lots,
  index,
  isReprint,
  reasonName,
  printerName,
  onMove,
  onCancel,
  onPrint,
}: {
  lots: readonly SplitMaterialLot[];
  index: number;
  isReprint: boolean;
  reasonName: string | null;
  printerName: string | null;
  onMove: (index: number) => void;
  onCancel: () => void;
  onPrint: () => void;
}) => {
  const lot = lots[Math.min(index, lots.length - 1)];

  if (lot === undefined) return null;

  const label = toLabelLot(lot);

  return (
    <Dialog
      open
      /* POP 팝업은 바깥을 눌러 닫히지 않는다(#1005). */
      closeOnBackdropClick={false}
      onClose={onCancel}
      title={isReprint ? t.preview.reprintTitle : t.preview.title}
      size="lg"
      className="pop-split-preview"
      footer={
        <>
          <span className="pop-mlot-hint">
            {printerName === null ? t.preview.printerDefault : t.preview.printer(printerName)}
          </span>
          <Button
            className={popTouchClass('normal')}
            variant="outlined"
            size="xl"
            onClick={onCancel}
          >
            {t.preview.cancel}
          </Button>
          <Button className={popTouchClass('primary')} size="xl" onClick={onPrint}>
            {isReprint ? t.preview.reprint(lots.length) : t.preview.print(lots.length)}
          </Button>
        </>
      }
    >
      <p className="pop-mlot-hint">
        {t.preview.note}
        {reasonName === null ? '' : t.preview.reissueNote(reasonName)}
      </p>
      <LabelPreview
        fields={{
          itemCode: label.itemCode,
          itemName: label.itemName,
          lotNo: label.lotNo,
          qty: label.lotQty,
          uomCode: label.uomCode,
          issueSeq: nextIssueSeq(lot),
          supplier:
            label.supplierName === null || label.supplierCode === null
              ? null
              : `${label.supplierName} (${label.supplierCode})`,
          receipt: null,
          kind: 'material',
        }}
      />
      <dl className="pop-split-meta">
        <dt>{t.preview.bag}</dt>
        <dd>
          {t.preview.bagValue(
            formatBaseQty(lot.qty, lot.uomCode),
            lot.goodsIssue.goodsIssueNo,
            lot.goodsIssue.lineNo,
            destinationOf(lot),
          )}
        </dd>
        <dt>{t.preview.parent}</dt>
        <dd className="pop-split-parent">{lot.parentLot.lotNo}</dd>
      </dl>
      <nav className="pop-mlot-preview-pager" aria-label={t.preview.page(index + 1, lots.length)}>
        <Button
          className={popTouchClass('normal')}
          variant="outlined"
          size="xl"
          disabled={index <= 0}
          onClick={() => {
            onMove(index - 1);
          }}
        >
          {t.preview.prev}
        </Button>
        <span className="pop-mlot-preview-page">{t.preview.page(index + 1, lots.length)}</span>
        <Button
          className={popTouchClass('normal')}
          variant="outlined"
          size="xl"
          disabled={index >= lots.length - 1}
          onClick={() => {
            onMove(index + 1);
          }}
        >
          {t.preview.next}
        </Button>
      </nav>
    </Dialog>
  );
};
