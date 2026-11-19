import { messages } from '@omf-mes/i18n';
import { useMemo, useRef, useState, type RefObject } from 'react';

import { formatPlantDateTime, plantToday } from '../../patterns/plant-time';
import { usePopIdentity } from '../../patterns/pop-identity';
import { PopWorkerMissingBanner } from '../../patterns/pop-worker-missing-banner';
import { PopTopPrinter } from '../../patterns/pop-top-status';
import {
  PuActionBar,
  PuButton,
  PuChip,
  PuCount,
  PuDialog,
  PuEmpty,
  PuHelpButton,
  PuIcon,
  PuNote,
  PuPager,
  PuScanField,
  PuScreen,
  PuSection,
  PuSeg,
  PuStack,
  PuTiles,
  puToast,
  useClientPage,
  useFitTableRows,
  type PuToastTone,
} from '../../patterns/pop-uniform';
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
import {
  PRINTED_PERIODS,
  PRINT_FAILED,
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
import './uniform.css';

const t = messages.goodsIssueQr;

/** 표 정렬(분할 시각). 보기마다 처음 차례는 서버가 주던 차례와 같다 — 발행 대기는 오래된 순, 재발행은 최신 순. */
type Order = 'newest' | 'oldest';

const DEFAULT_ORDER: Record<LabelState, Order> = { UNPRINTED: 'oldest', PRINTED: 'newest' };

/** 분할 시각(공장 시각) `MM-DD HH:mm`. */
const shortAt = (value: string): string => (formatPlantDateTime(value) ?? value).slice(5);

const destinationOf = (lot: SplitMaterialLot): string =>
  lot.destination === null
    ? ''
    : `${lot.destination.warehouseCode} / ${lot.destination.locationCode}`;

interface ResultView {
  tone: PuToastTone;
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

  if (count('issueForbidden') > 0) return { tone: 'bad', text: t.result.forbidden };

  const tail = [
    issueFailed.length > 0
      ? t.result.issueFailed(issueFailed.length, issueFailed[0]?.message ?? '')
      : '',
    notSent > 0 ? t.result.notSent(notSent) : '',
  ].join('');

  if (failed > 0) {
    return { tone: 'warn', text: t.result.partial(results.length, printed, failed) + tail };
  }

  if (printed === 0) return { tone: 'bad', text: tail.trim() };

  return {
    tone: tail === '' ? 'ok' : 'warn',
    text: (isReprint ? t.result.reprinted(printed) : t.result.printed(printed)) + tail,
  };
};

/**
 * `P-01-02` 분할 LOT 라벨 (POP) — 008 부분 출고 LOT 분할 · omf-all-around#289 · #295 시안.
 *
 * ```
 * ┌ 위 구획: LOT 번호 · 출고번호 · 품목코드 스캔 [직접 입력]   (재발행: 출고일 오늘 | 최근 7일 | 최근 30일) ┐
 * ├ 아래 구획: [발행 대기 N | 재발행]                         [?] [전체 선택 (N건)] [선택 해제]       ┤
 * │ 표: 선택 · 분할 LOT 번호/기존 LOT · 품목 · 수량 · 출고번호/도착 · 분할 시각 · 라벨                    │
 * │ [최신순 | 오래된순]                                                          총 N건 ‹ 1 / 2 ›      │
 * │ 재인쇄 사유 *(인쇄 실패를 골랐거나 재발행일 때)                                                     │
 * ├ 작업 줄: [라벨 N장 발행] / [N장 재인쇄] ───────────────────────────────────────────────────────────┤
 * ```
 *
 * ⭐ 출고 QR(라인·파렛트) 발행은 없다(FR-010 · D-6). 분할 LOT 은 자재 관리 LOT 라벨과 같은 양식으로 찍는다(FR-007).
 * ⭐ 발행 대기는 기간과 상관없이 모두 보인다(FR-008 · SC-004). 인쇄 실패는 발행 대기로 남는다.
 */
export const GoodsIssueQrScreen = () => {
  const { workerNo, plantId = null } = usePopIdentity();
  const printing = useSplitLabelPrint(workerNo);

  const [tab, setTab] = useState<LabelState>('UNPRINTED');
  const [period, setPeriod] = useState<PrintedPeriod>('week');
  const [order, setOrder] = useState<Order>(DEFAULT_ORDER.UNPRINTED);
  /* 재발행 탭은 사용자가 정렬을 고르기 전까지 서버가 준 차례 그대로 보인다. */
  const [isOrderPicked, setOrderPicked] = useState(false);
  /* 첫 발행이 다 찍혔다 — 「재발행」으로 옮겨 볼 길을 구획 안에 남긴다(전의 [찍음 보기]). */
  const [printedNote, setPrintedNote] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [scanError, setScanError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());
  const [reasonCode, setReasonCode] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ index: number } | null>(null);
  /* 재인쇄 사유 창 — [라벨 N장 발행]·[재인쇄]를 누르면 사유가 필요할 때 먼저 뜬다(사용자 지시 2026-11-19). */
  const [isReasonOpen, setReasonOpen] = useState(false);

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

  const unprintedCount = unprinted.data?.unprintedCount ?? null;

  /* 표에 보이는 차례 — 분할 시각으로 줄 세운다. 찍는 차례(`printList`)와는 따로다. */
  const keepsServerOrder = tab === 'PRINTED' && !isOrderPicked;
  const sorted = useMemo(
    () =>
      keepsServerOrder
        ? (current.data?.items ?? [])
        : [...(current.data?.items ?? [])].sort((left, right) =>
            order === 'oldest'
              ? left.splitAt.localeCompare(right.splitAt)
              : right.splitAt.localeCompare(left.splitAt),
          ),
    [current.data, order, keepsServerOrder],
  );
  const rows = useMemo(() => sorted.filter((lot) => matchesSplitLot(lot, query)), [sorted, query]);
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
  /* 재발행 탭은 늘 사유가 있어야 한다. 발행 대기 탭은 인쇄가 실패한 LOT 을 골랐을 때만. */
  const asksReason = needsReason || (tab === 'PRINTED' && chosen.length > 0);
  const reasons = useReissueReasons(asksReason);
  const reasonName =
    reasonCode === null
      ? null
      : (reasons.data?.find((reason) => reason.code === reasonCode)?.name ?? reasonCode);
  const isBusy = printing.isRunning;
  /* 사유는 단추를 누른 뒤 뜨는 사유 창이 받는다 — 단추는 고른 것이 있으면 켜진다. */
  const canPrint = chosen.length > 0 && workerNo !== null && !isBusy;
  const allOn = rows.length > 0 && rows.every((lot) => selected.has(lot.lotId));

  const tableFitRef = useRef<HTMLDivElement>(null);
  const pageSize = useFitTableRows(tableFitRef, { fallback: 5 });
  const page = useClientPage(rows, pageSize);

  const chooseTab = (next: LabelState, keepQuery = false): void => {
    setTab(next);
    setOrder(DEFAULT_ORDER[next]);
    setOrderPicked(false);
    setPrintedNote(null);
    setSelected(new Set());
    setReasonCode(null);
    setScanError(null);
    page.setPage(1);
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
  const submitScan = (value: string): void => {
    const code = value.trim();
    const matching = sorted.filter((lot) => matchesSplitLot(lot, code));
    const exact = matching.filter((lot) => lot.lotNo === code);

    if (exact.length === 1 && exact[0] !== undefined) {
      const lot = exact[0];

      toggle(lot.lotId);
      setQuery('');
      page.showIndex(sorted.indexOf(lot));
      return;
    }

    /* 어느 보기에도 없다(다른 보기 목록을 받은 뒤에만 그렇게 말한다) — 칸을 비우고 칸 아래에 알린다. */
    const isNowhere =
      matching.length === 0 &&
      other.data !== undefined &&
      !other.data.items.some((lot) => matchesSplitLot(lot, code));

    if (isNowhere) {
      setQuery('');
      setScanError(t.search.notFound(code));
    }
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
    const view = toResultView(results, isReprint);

    if (view.tone === 'ok' && !isReprint) setPrintedNote(view.text);
    else {
      setPrintedNote(null);
      puToast(view.text, view.tone);
    }
  };

  const isPrintedTab = tab === 'PRINTED';
  const searchElsewhere =
    query.trim() === ''
      ? undefined
      : (other.data?.items ?? []).find((lot) => matchesSplitLot(lot, query));

  const actionBar = (
    <PuActionBar label={t.bar.label}>
      <PuButton
        variant="primary"
        icon="print"
        disabled={!canPrint}
        onClick={() => {
          /* 사유가 필요하면 사유 창 → 미리 보기 → 인쇄. 아니면 사유 없이(null) 바로 미리 보기. */
          setReasonCode(null);
          if (asksReason) setReasonOpen(true);
          else setPreview({ index: 0 });
        }}
      >
        {isPrintedTab
          ? chosen.length === 0
            ? t.bar.reprintNone
            : t.bar.reprint(chosen.length)
          : chosen.length === 0
            ? t.bar.printNone
            : t.bar.print(chosen.length)}
      </PuButton>
    </PuActionBar>
  );

  const list = current.isError ? (
    <PuEmpty icon="bad" title={t.empty.loadFailedTitle} hint={t.empty.loadFailedBody}>
      <PuButton
        onClick={() => {
          void current.refetch();
        }}
      >
        {t.empty.retry}
      </PuButton>
    </PuEmpty>
  ) : current.isPending && plantId !== null ? null : rows.length > 0 ? (
    <SplitTable
      lots={page.items}
      selected={selected}
      isLocked={isBusy}
      onToggle={toggle}
      fitRef={tableFitRef}
    />
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
  );

  return (
    <main className="pop-ui giq-screen" aria-label={t.title}>
      <h1 className="giq-title">{t.title}</h1>
      {/*
       * 프린터는 공통 메뉴 맨 위 줄 프린터 자리에 서고, 누르면 고른다. 사번·단말도 맨 위 줄이 보인다
       * (사용자 지시 2026-11-17 · #291).
       */}
      <PopTopPrinter>
        <PrinterChip
          printers={printers.data}
          selected={headPrinter}
          isLoading={printers.isPending}
          isError={printers.isError}
          isLocked={isBusy}
          onRetry={() => {
            void printers.refetch();
          }}
          onSelect={(name) => {
            setPickedPrinter(name);
            rememberPrinterName(name);
          }}
        />
      </PopTopPrinter>

      <PopWorkerMissingBanner workerNo={workerNo} />

      <PuScreen className="giq-body" actionBar={actionBar}>
        <PuStack fill>
          <PuSection className="giq-top" grow={false}>
            <div className="giq-scan">
              <PuScanField
                label={t.search.label}
                value={query}
                disabled={isBusy}
                error={scanError}
                manual={{ search: true }}
                onChange={(value) => {
                  setQuery(value);
                  setSelected(new Set());
                  setScanError(null);
                  page.setPage(1);
                }}
                onSubmit={submitScan}
              >
                {query.trim() === '' ? null : (
                  <PuNote
                    action={
                      <PuButton
                        size="sm"
                        onClick={() => {
                          setQuery('');
                          page.setPage(1);
                        }}
                      >
                        {t.search.clearFilter}
                      </PuButton>
                    }
                  >
                    {t.search.filtered(query.trim())}
                  </PuNote>
                )}
              </PuScanField>
            </div>
            {isPrintedTab ? (
              <div className="pu-field giq-period">
                <span className="pu-label">{t.periods.label}</span>
                <PuTiles
                  label={t.periods.label}
                  cols={3}
                  value={period}
                  disabled={isBusy}
                  options={PRINTED_PERIODS.map((each) => ({
                    value: each,
                    label: t.periods[each],
                  }))}
                  onChange={(next) => {
                    setPeriod(next);
                    setSelected(new Set());
                    page.setPage(1);
                  }}
                />
              </div>
            ) : null}
          </PuSection>

          <PuSection
            className="giq-list"
            head={
              <PuSeg
                label={t.tabs.label}
                value={tab}
                options={(['UNPRINTED', 'PRINTED'] as const).map((each) => ({
                  value: each,
                  disabled: isBusy,
                  label:
                    each === 'UNPRINTED' ? (
                      <>
                        {t.tabs.unprinted}
                        <PuCount>{unprintedCount === null ? '?' : unprintedCount}</PuCount>
                      </>
                    ) : (
                      t.tabs.printed
                    ),
                }))}
                onChange={(next) => {
                  if (next !== tab) chooseTab(next);
                }}
              />
            }
            meta={
              <>
                <PuHelpButton title={t.help.title}>
                  <div className="giq-help">
                    <p>{t.help.intro}</p>
                    <ul>
                      {t.help.items.map((item) => (
                        <li key={item.term}>
                          <b>{item.term}</b> {item.text}
                        </li>
                      ))}
                    </ul>
                  </div>
                </PuHelpButton>
                {isPrintedTab ? null : (
                  <PuButton
                    size="sm"
                    disabled={rows.length === 0 || allOn || isBusy}
                    onClick={() => {
                      selectAll(true);
                    }}
                  >
                    {/* 해제는 옆 [선택 해제]가 한다 — 이 단추는 이름을 바꾸지 않는다(자재 관리 LOT 라벨과 같다). */}
                    {t.bar.selectAll(rows.length)}
                  </PuButton>
                )}
                <PuButton
                  size="sm"
                  disabled={chosen.length === 0 || isBusy}
                  onClick={() => {
                    selectAll(false);
                  }}
                >
                  {t.bar.clearSelection}
                </PuButton>
              </>
            }
          >
            {/* 인쇄 실패·가장 오래된 것 요약 줄은 두지 않는다(사용자 지시 2026-11-19). */}
            {printedNote === null ? null : (
              <PuNote
                tone="ok"
                live
                action={
                  <PuButton
                    size="sm"
                    onClick={() => {
                      chooseTab('PRINTED');
                    }}
                  >
                    {t.result.showPrinted}
                  </PuButton>
                }
              >
                {printedNote}
              </PuNote>
            )}
            {printing.progress === null ? null : (
              <PuNote live>
                {t.bar.running(printing.progress.done + 1, printing.progress.total)}
              </PuNote>
            )}
            {list}
            <div className="giq-foot">
              {/* 정렬은 [최신순·오래된순] 단추로(사용자 지시 2026-11-19) — 머리글 누르기는 두지 않는다. */}
              <PuSeg
                label={t.order.label}
                value={order}
                options={(['newest', 'oldest'] as const).map((each) => ({
                  value: each,
                  label: t.order[each],
                }))}
                onChange={(next) => {
                  setOrder(next);
                  setOrderPicked(true);
                  page.setPage(1);
                }}
              />
              <PuPager
                label={t.table.label}
                total={page.total}
                page={page.page}
                pages={page.pages}
                onPage={page.setPage}
              />
            </div>
          </PuSection>
        </PuStack>
      </PuScreen>

      {isReasonOpen ? (
        <ReasonDialog
          reasons={reasons}
          count={chosen.length}
          needCount={isPrintedTab ? null : chosenNeedingReason.length}
          isReprint={isPrintedTab}
          onCancel={() => {
            setReasonOpen(false);
          }}
          onConfirm={(code) => {
            setReasonCode(code);
            setReasonOpen(false);
            setPreview({ index: 0 });
          }}
        />
      ) : null}
      {preview === null ? null : (
        <PreviewDialog
          lots={printList}
          index={preview.index}
          isReprint={isPrintedTab}
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

/**
 * LOT 번호 — **`|` 칸 경계에서만 줄을 바꾼다.** 칸(`0001-S1` 등)은 한 덩어리로 둔다 — 칸 가운데서 끊기면 끝 마디
 * (`-S1`)를 원래 LOT 과 대조할 수 없다. `-` 도 줄바꿈 자리라 칸마다 `nowrap` 으로 묶고 `|` 뒤에만 기회를 준다.
 */
const LotNoText = ({ lotNo, className }: { lotNo: string; className?: string }) => {
  const parts = lotNo.split('|');

  return (
    <span className={className} title={lotNo}>
      {parts.map((part, index) => (
        <span key={`${String(index)}-${part}`}>
          <span className="giq-seg">{index < parts.length - 1 ? `${part}|` : part}</span>
          {index < parts.length - 1 ? <wbr /> : null}
        </span>
      ))}
    </span>
  );
};

const LabelStatus = ({ lot }: { lot: SplitMaterialLot }) => {
  const issue = lot.labelIssue;

  if (issue === null) return <PuChip>{t.status.unissued}</PuChip>;

  if (issue.lastPrintOutcomeCode === PRINT_FAILED) {
    return <PuChip tone="bad">{t.status.failed(issue.issueCount)}</PuChip>;
  }

  return (
    <>
      <PuChip tone={issue.lastPrintOutcomeCode === 'PENDING' ? 'info' : 'ok'}>
        {issue.lastPrintOutcomeCode === 'PENDING'
          ? t.status.pending(issue.lastIssueSeq)
          : t.status.printed(issue.lastIssueSeq)}
      </PuChip>
      <span className="giq-sub">{shortAt(issue.lastIssuedAt)}</span>
    </>
  );
};

const SplitTable = ({
  lots,
  selected,
  isLocked,
  onToggle,
  fitRef,
}: {
  lots: readonly SplitMaterialLot[];
  selected: ReadonlySet<number>;
  isLocked: boolean;
  onToggle: (lotId: number) => void;
  fitRef: RefObject<HTMLDivElement | null>;
}) => (
  <div ref={fitRef} className="giq-table" role="group" aria-label={t.table.label}>
    <div className="pu-table-wrap">
      <table className="pu-table">
        <thead>
          <tr>
            <th className="fit mid">{t.table.select}</th>
            {/* 칸마다 값 하나(사용자 지시 2026-11-19) — 분할 LOT·기존 LOT, 출고번호·도착을 나눈다. */}
            <th className="fit">{t.table.lotNo}</th>
            <th className="fit">{t.table.parentLot}</th>
            <th>{t.table.item}</th>
            <th className="num fit">{t.table.qty}</th>
            <th className="fit">{t.table.issue}</th>
            <th>{t.table.destination}</th>
            <th className="fit">{t.table.splitAt}</th>
            <th className="fit mid">{t.table.labelColumn}</th>
          </tr>
        </thead>
        <tbody>
          {lots.map((lot) => {
            const isChecked = selected.has(lot.lotId);

            return (
              <tr
                key={lot.lotId}
                className={isChecked ? 'is-on' : undefined}
                onClick={
                  isLocked
                    ? undefined
                    : () => {
                        onToggle(lot.lotId);
                      }
                }
              >
                <td className="fit mid">
                  <button
                    type="button"
                    role="checkbox"
                    className="giq-box"
                    aria-checked={isChecked}
                    aria-label={t.table.choose(lot.lotNo)}
                    disabled={isLocked}
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggle(lot.lotId);
                    }}
                  >
                    {isChecked ? <PuIcon name="check" /> : null}
                  </button>
                </td>
                <td className="fit giq-lotcol">
                  <LotNoText className="pu-mono giq-lotno" lotNo={lot.lotNo} />
                </td>
                <td className="fit giq-lotcol">
                  <LotNoText className="pu-mono giq-one" lotNo={lot.parentLot.lotNo} />
                </td>
                <td title={`${lot.item.itemCode} ${lot.item.itemName}`}>
                  <span className="giq-one">
                    <b>{lot.item.itemCode}</b> {lot.item.itemName}
                  </span>
                </td>
                <td className="num fit">{formatBaseQty(lot.qty, lot.uomCode)}</td>
                <td className="fit">
                  {t.table.issueLine(lot.goodsIssue.goodsIssueNo, lot.goodsIssue.lineNo)}
                </td>
                <td title={destinationOf(lot)}>
                  <span className="giq-one">
                    {destinationOf(lot) === '' ? '—' : destinationOf(lot)}
                  </span>
                </td>
                <td className="fit">{shortAt(lot.splitAt)}</td>
                <td className="fit mid">
                  <LabelStatus lot={lot} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
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
      <PuEmpty
        icon="search"
        title={t.empty.searchTitle(tab === 'UNPRINTED' ? t.tabs.unprinted : t.tabs.printed)}
        hint={
          elsewhere === null
            ? t.empty.searchNone
            : tab === 'UNPRINTED'
              ? t.empty.searchInPrinted(elsewhere.lotNo)
              : t.empty.searchInUnprinted(elsewhere.lotNo)
        }
      >
        {elsewhere === null ? null : (
          <PuButton onClick={onShowElsewhere}>
            {tab === 'UNPRINTED' ? t.empty.showInPrinted : t.empty.showInUnprinted}
          </PuButton>
        )}
      </PuEmpty>
    );
  }

  return tab === 'UNPRINTED' ? (
    <PuEmpty icon="box" title={t.empty.unprintedTitle} hint={t.empty.unprintedBody} />
  ) : (
    <PuEmpty
      icon="print"
      title={t.empty.printedTitle(t.periods[period])}
      hint={t.empty.printedBody}
    />
  );
};

/**
 * 재인쇄 사유 창(사용자 지시 2026-11-19) — 머리 X 없이 사유 타일 + [취소] · [N장 발행]. 사유를 골라야 켜진다.
 * 고른 사유는 미리 보기 → 인쇄로 그대로 이어진다(보내는 값은 전과 같다).
 */
const ReasonDialog = ({
  reasons,
  count,
  needCount,
  isReprint,
  onCancel,
  onConfirm,
}: {
  reasons: ReturnType<typeof useReissueReasons>;
  count: number;
  /** 발행 대기 탭에서 인쇄가 실패한 LOT 수 — 재발행 탭이면 null. */
  needCount: number | null;
  isReprint: boolean;
  onCancel: () => void;
  onConfirm: (code: string) => void;
}) => {
  const [code, setCode] = useState<string | null>(null);

  return (
    <PuDialog
      title={t.reasons.title}
      wide
      onClose={onCancel}
      footer={
        <>
          <PuButton onClick={onCancel}>{messages.popUniform.dialog.cancel}</PuButton>
          <PuButton
            variant="primary"
            icon="print"
            disabled={code === null}
            onClick={() => {
              if (code !== null) onConfirm(code);
            }}
          >
            {isReprint ? t.bar.reprint(count) : t.reasons.confirm(count)}
          </PuButton>
        </>
      }
    >
      <div className="giq-reasons">
        <ReasonPicker
          reasons={reasons.data ?? []}
          isLoading={reasons.isPending}
          isError={reasons.isError}
          selected={code}
          isLocked={false}
          onSelect={setCode}
          label={t.reasons.label}
          hint={
            code === null ? (
              <PuChip tone="bad">
                {needCount === null ? t.reasons.need : t.reasons.needFailed(needCount)}
              </PuChip>
            ) : undefined
          }
        />
      </div>
    </PuDialog>
  );
};

const PreviewDialog = ({
  lots,
  index,
  isReprint,
  onMove,
  onCancel,
  onPrint,
}: {
  lots: readonly SplitMaterialLot[];
  index: number;
  isReprint: boolean;
  onMove: (index: number) => void;
  onCancel: () => void;
  onPrint: () => void;
}) => {
  const lot = lots[Math.min(index, lots.length - 1)];

  if (lot === undefined) return null;

  const label = toLabelLot(lot);

  return (
    <PuDialog
      /* POP 팝업은 바깥을 눌러 닫히지 않는다(#1005) — 공통 창도 같다. */
      title={isReprint ? t.preview.reprintTitle : t.preview.title}
      wide
      onClose={onCancel}
      footer={
        <>
          {/* 자재 관리 LOT 라벨 미리보기와 같은 모양(사용자 지시 2026-11-19): [닫기] · [N장 인쇄]. */}
          <PuButton onClick={onCancel}>{t.preview.close}</PuButton>
          <PuButton variant="primary" icon="print" onClick={onPrint}>
            {isReprint ? t.preview.reprint(lots.length) : t.preview.print(lots.length)}
          </PuButton>
        </>
      }
    >
      <div className="giq-preview">
        <figure className="pu-label-preview giq-label" aria-label={label.lotNo}>
          <b>{`${t.preview.kind} · ${plantToday()}`}</b>
          <div className="qr" aria-hidden="true" />
          <b className="giq-label-code">{label.itemCode}</b>
          <span>{label.itemName}</span>
          <span>
            {`${t.preview.qty} `}
            <b className="giq-label-qty">{formatBaseQty(label.lotQty, label.uomCode)}</b>
          </span>
          {label.supplierName === null || label.supplierCode === null ? null : (
            <span>{`${label.supplierName} (${label.supplierCode})`}</span>
          )}
          <span className="pu-mono giq-label-lot">{label.lotNo}</span>
          {isReprint ? (
            <span className="giq-label-reissue">{t.preview.reissue(nextIssueSeq(lot))}</span>
          ) : null}
        </figure>
        <dl className="giq-meta">
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
          <dd className="pu-mono">
            <LotNoText lotNo={lot.parentLot.lotNo} />
          </dd>
        </dl>
        {lots.length > 1 ? (
          <nav className="giq-preview-pager" aria-label={t.preview.page(index + 1, lots.length)}>
            <PuButton
              disabled={index <= 0}
              onClick={() => {
                onMove(index - 1);
              }}
            >
              {t.preview.prev}
            </PuButton>
            <span>{t.preview.page(index + 1, lots.length)}</span>
            <PuButton
              disabled={index >= lots.length - 1}
              onClick={() => {
                onMove(index + 1);
              }}
            >
              {t.preview.next}
            </PuButton>
          </nav>
        ) : null}
      </div>
    </PuDialog>
  );
};
