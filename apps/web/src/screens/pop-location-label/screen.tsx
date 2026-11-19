import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

import {
  PuActionBar,
  PuButton,
  PuChip,
  PuCols,
  PuCount,
  PuEmpty,
  PuIcon,
  PuNote,
  PuPager,
  PuScreen,
  PuSection,
  puCx,
  puToast,
  useClientPage,
  useFitCount,
  useFitTableRows,
} from '../../patterns/pop-uniform';
import { PopWorkerMissingBanner } from '../../patterns/pop-worker-missing-banner';
import { usePopLocationLabelEntry } from './entry-context';
import { useLocationLabelWrite, usePrintFlow, type PrintReport } from './mutations';
import { hasPrintBridge } from '../../patterns/pop-print';
import { PopTopPrinter } from '../../patterns/pop-top-status';
import { PrinterChip } from '../pop-material-lot-label/printer-chip';
import { toPrinterView } from '../pop-material-lot-label/types';
import {
  useIssueSummary,
  useLocations,
  usePrinters,
  useReissueReasons,
  useWarehouses,
} from './queries';
import { ReissueDialog } from './reissue-dialog';
import {
  DOCUMENT_TYPE_CODE,
  LOCATION_PAGE_SIZE,
  MAX_TARGETS,
  TARGET_TYPE_CODE,
  type DocumentIssue,
  type Location,
} from './types';
import './uniform.css';

const t = messages.popLocationLabel;

/** 인쇄 결과 한 줄 알림(아래 가운데) — 통로가 없으면 시도조차 안 했으니 알리지 않는다(머리 안내가 이미 말한다). */
const announce = (reports: readonly PrintReport[]): void => {
  if (reports.length === 0 || reports.every((each) => each.attempt.kind === 'noBridge')) return;

  const printed = reports.filter((each) => each.attempt.kind === 'printed').length;
  const failed = reports.filter((each) => each.attempt.kind === 'failed').length;

  if (failed === 0) puToast(t.print.printed(printed));
  else puToast(t.print.summary(printed, failed), 'warn');
};

/**
 * P-06-01 창고 적재 위치 라벨 발행.
 *
 * ⭐ **설계보다 앞선 화면이다**(`docs/decisions.md` 결정 16). 고정 설계 `W-06-07` §3은
 *    「물리 인쇄는 범위 밖 · POP 인쇄 화면은 신설하지 않는다」였고, 사용자 지시로 진행한다.
 *    관리웹 `W-06-07` 의 라벨 이미지 생성은 **그대로 둔다** — 같은 발행 경로를 쓰므로 회차와
 *    재발행 사유는 서버가 한 곳에서 센다.
 *
 * 걸음은 넷이다 — **창고를 고르고 · 자리를 고르고 · 발행하고 · 찍는다.**
 */
export const PopLocationLabelScreen = () => {
  const titleId = useId();
  const entry = usePopLocationLabelEntry();

  const [warehouseId, setWarehouseId] = useState<number | null>(null);
  /** 서버 쪽(50건 묶음) — 조회 조건·시점은 전과 같다. */
  const [batchPage, setBatchPage] = useState(1);
  /** 묶음 안에서 보던 첫 줄 — 한 쪽 건수(표 높이)가 바뀌어도 그 줄이 든 쪽을 지킨다(규칙 15). */
  const [firstRow, setFirstRow] = useState(0);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [chosenPrinter, setChosenPrinter] = useState<string | null>(null);
  const [reasonCode, setReasonCode] = useState('');
  const [reissueAsked, setReissueAsked] = useState(false);
  const [reports, setReports] = useState<PrintReport[] | null>(null);
  const [folded, setFolded] = useState(false);

  /*
   * 구획 안 스크롤 없음(#295) — 서버에서는 전처럼 50건 묶음으로 받고, 그 묶음을 표 높이에 맞춰 화면 쪽으로
   * 나눈다. 쪽 번호는 전체 기준 하나로 센다: 묶음마다 화면 쪽이 `pagesPerBatch` 개.
   */
  const tableFitRef = useRef<HTMLDivElement>(null);
  const pageSize = useFitTableRows(tableFitRef, { fallback: 5 });
  const pagesPerBatch = Math.ceil(LOCATION_PAGE_SIZE / pageSize);

  const warehouses = useWarehouses();
  const locations = useLocations(warehouseId, batchPage);
  const printers = usePrinters();
  const summary = useIssueSummary(selectedIds, selectedIds.length > 0);

  /* 창고 목록은 한 번에 다 받는다 — 화면에서 쪽으로 자른다. */
  const warehouseFitRef = useRef<HTMLUListElement>(null);
  const warehouseSize = useFitCount(warehouseFitRef, { fallback: 6 });
  const warehousePage = useClientPage(warehouses.data ?? [], warehouseSize);
  const currentWarehouse = warehouses.data?.find((each) => each.warehouseId === warehouseId);

  const locationItems = useMemo(() => locations.data?.items ?? [], [locations.data]);

  /** 고른 자리 가운데 **서버가 「이미 찍었다」고 말한** 수. 화면이 세지 않는다. */
  const reissueCount = useMemo(
    () => (summary.data ?? []).filter((each) => each.issueCount > 0).length,
    [summary.data],
  );

  /**
   * 실제로 나갈 프린터 — **고르지 않았으면 단말의 기본 프린터다.**
   *
   * ⭐ **서버 기본값에 맡기지 않는다.** 이 화면은 프린터가 붙은 단말에서 도는데, 이름을 비워
   *    보내면 서버가 고르고 **다른 자리에서 라벨이 나올 수 있다** — 창고 작업자는 손에 라벨이
   *    없는 채로 선반 앞에 선다. 어느 프린터로 나가는지 칸에도 그대로 보인다.
   */
  const printerViews = useMemo(() => printers.data?.map(toPrinterView), [printers.data]);
  const printerName =
    chosenPrinter ?? printers.data?.find((each) => each.isDefault)?.printerName ?? null;

  const reasons = useReissueReasons(reissueAsked);

  /**
   * 본 적 있는 위치 — **라벨 값은 고를 때 본 줄에서 읽는다.** 고른 자리는 여러 쪽에 걸칠 수 있어
   * 지금 쪽의 목록만으로는 앞 쪽에서 고른 위치를 풀지 못한다.
   */
  const seenLocations = useRef(new Map<number, Location>());

  useEffect(() => {
    for (const each of locationItems) seenLocations.current.set(each.locationId, each);
  }, [locationItems]);

  const printFlow = usePrintFlow(entry.workerNo, (record) => {
    const location = seenLocations.current.get(record.target.targetId);
    const warehouse = warehouses.data?.find((each) => each.warehouseId === location?.warehouseId);

    if (location === undefined || warehouse === undefined) return null;

    return {
      warehouseCode: warehouse.warehouseCode,
      locationCode: location.locationCode,
      locationName: location.locationName,
      issueSeq: record.issueSeq,
    };
  });

  const write = useLocationLabelWrite({
    /* 사번이 없으면 아래 `guard` 가 발행을 열지 않는다 — 여기 오는 값은 확보된 것이다. */
    workerNo: entry.workerNo ?? '',
    onSuccess: (issued: DocumentIssue[]) => {
      setReissueAsked(false);
      setReasonCode('');
      /*
       * ⛔ **거절을 받을 곳을 둔다.** 건별 실패는 안에서 값으로 접히지만, 그 바깥이
       *    거절하면 결과 구획이 영영 비어 「눌렀는데 아무 일도 없다」가 된다. 발행은 이미
       *    끝났으므로 **인쇄가 통째로 실패한 것**으로 적는다 — 없던 일로 두지 않는다.
       */
      void printFlow
        .mutateAsync(issued)
        .then((result) => {
          setReports(result.reports);
          announce(result.reports);
        })
        .catch((cause: unknown) => {
          const failed = issued.map((record) => ({
            documentIssueLogId: record.documentIssueLogId,
            targetId: record.target.targetId,
            attempt: {
              kind: 'failed' as const,
              reason: cause instanceof Error ? cause.message : String(cause),
            },
            reported: false,
          }));

          setReports(failed);
          announce(failed);
        });
    },
  });

  const issue = (reissueReasonCode: string | null): void => {
    write.write({
      documentTypeCode: DOCUMENT_TYPE_CODE,
      targets: selectedIds.map((targetId) => ({ targetTypeCode: TARGET_TYPE_CODE, targetId })),
      ...(reissueReasonCode === null ? {} : { reissueReasonCode }),
      ...(printerName === null ? {} : { printerName }),
    });
  };

  /**
   * 발행을 열 수 있는가. **막는 사유를 하나씩 가른다** — 뭉치면 작업자가 무엇을 고쳐야 할지
   * 모른다(공유계약 G-9).
   *
   * ⛔ **「묻는 중」과 「못 물었다」를 한 값으로 뭉치지 않는다.** 앞은 기다리면 풀리고 뒤는
   *    기다려도 안 풀린다 — 작업자가 할 일이 다르다. 한 값으로 두었더니 조회가 실패했을 때
   *    **단추가 사유 없이 잠긴 채** 남았다(리뷰 지적 · PR #1313).
   */
  type Guard =
    'ready' | 'noWorker' | 'noSelection' | 'tooMany' | 'summaryLoading' | 'summaryFailed';

  const guard = ((): Guard => {
    if (entry.workerNo === null) return 'noWorker';
    if (selectedIds.length === 0) return 'noSelection';
    if (selectedIds.length > MAX_TARGETS) return 'tooMany';
    /* 회차를 모르는 채 보내면 사유가 빠져 전건이 실패한다 — 요약을 받은 뒤에 연다. */
    if (summary.isError) return 'summaryFailed';
    if (summary.isPending) return 'summaryLoading';

    return 'ready';
  })();

  const onIssueClick = (): void => {
    setReports(null);

    if (reissueCount > 0) {
      setReissueAsked(true);
      setReasonCode('');

      return;
    }

    issue(null);
  };

  const total = locations.data?.total ?? 0;
  const batchCount = Math.max(1, Math.ceil(total / LOCATION_PAGE_SIZE));
  const lastBatchSize = total - (batchCount - 1) * LOCATION_PAGE_SIZE;
  const pages = Math.max(
    1,
    (batchCount - 1) * pagesPerBatch + Math.ceil(Math.max(0, lastBatchSize) / pageSize),
  );
  const localPage = Math.floor(firstRow / pageSize);
  const page = Math.min(pages, (batchPage - 1) * pagesPerBatch + localPage + 1);
  const visibleItems = locationItems.slice(localPage * pageSize, (localPage + 1) * pageSize);
  /* 전체 기준 쪽 → 묶음(서버 쪽)과 묶음 안 첫 줄. 묶음이 바뀌면 그 묶음을 받는다. */
  const setPage = (next: number): void => {
    const index = Math.max(0, Math.min(pages, next) - 1);

    setBatchPage(Math.floor(index / pagesPerBatch) + 1);
    setFirstRow((index % pagesPerBatch) * pageSize);
  };

  const isPageAllSelected =
    locationItems.length > 0 &&
    locationItems.every((each) => selectedIds.includes(each.locationId));

  const toggle = (locationId: number): void => {
    setSelectedIds((current) =>
      current.includes(locationId)
        ? current.filter((id) => id !== locationId)
        : [...current, locationId],
    );
    setReports(null);
  };

  const isBusy = write.isSaving || printFlow.isPending;

  const actionBar = (
    <PuActionBar label={t.issue.action}>
      <PuButton
        variant="primary"
        icon="print"
        disabled={guard !== 'ready' || isBusy}
        onClick={onIssueClick}
      >
        {selectedIds.length === 0 ? t.issue.action : t.issue.actionCount(selectedIds.length)}
      </PuButton>
    </PuActionBar>
  );

  const leftSection = (
    <PuSection
      title={t.warehouse.label}
      fold={{ label: t.warehouse.label, folded, onChange: setFolded }}
      split
    >
      {warehouses.isError ? (
        <PuNote
          tone="bad"
          action={
            <PuButton size="sm" onClick={() => void warehouses.refetch()}>
              {t.warehouse.retry}
            </PuButton>
          }
        >
          {t.warehouse.loadFailed}
        </PuNote>
      ) : warehouses.data?.length === 0 ? (
        <PuNote tone="warn">{t.warehouse.none}</PuNote>
      ) : (
        <ul
          ref={warehouseFitRef}
          className="pu-list pu-fit ll-warehouses"
          aria-label={t.warehouse.label}
        >
          {warehousePage.items.map((warehouse) => (
            <li key={warehouse.warehouseId}>
              <button
                type="button"
                className={puCx('pu-item', warehouse.warehouseId === warehouseId && 'is-selected')}
                aria-pressed={warehouse.warehouseId === warehouseId}
                disabled={isBusy}
                onClick={() => {
                  setWarehouseId(warehouse.warehouseId);
                  /* 창고가 바뀌면 앞서 고른 자리는 이 창고의 것이 아니다. */
                  setSelectedIds([]);
                  setBatchPage(1);
                  setFirstRow(0);
                  setReports(null);
                }}
              >
                <span className="ll-warehouse-name">
                  {`${warehouse.warehouseCode} ${warehouse.warehouseName}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <PuPager
        label={t.warehouse.label}
        total={warehousePage.total}
        page={warehousePage.page}
        pages={warehousePage.pages}
        onPage={warehousePage.setPage}
      />
    </PuSection>
  );

  const failures = (reports ?? []).filter((each) => each.attempt.kind === 'failed');
  const unreported = (reports ?? []).filter(
    (each) => each.attempt.kind !== 'noBridge' && !each.reported,
  );
  const locationCodeOf = (targetId: number): string =>
    seenLocations.current.get(targetId)?.locationCode ?? String(targetId);

  const rightSection = (
    <PuSection
      className="ll-right"
      title={
        currentWarehouse === undefined ? (
          t.location.heading
        ) : (
          <>
            {`${currentWarehouse.warehouseCode} · ${currentWarehouse.warehouseName}`}
            {locations.data === undefined ? null : <PuCount>{locations.data.total}</PuCount>}
          </>
        )
      }
      meta={
        warehouseId !== null && locationItems.length > 0 ? (
          <>
            {/* 받은 묶음(서버 한 쪽 · 최대 50건)을 한 번에 고르거나 푼다 — 전과 같다(사용자 지시 2026-09-17). */}
            <PuButton
              size="sm"
              disabled={isBusy}
              onClick={() => {
                const pageIds = locationItems.map((each) => each.locationId);
                setSelectedIds((current) =>
                  isPageAllSelected
                    ? current.filter((id) => !pageIds.includes(id))
                    : [...new Set([...current, ...pageIds])],
                );
                setReports(null);
              }}
            >
              {isPageAllSelected
                ? t.location.clearAll(locationItems.length)
                : t.location.selectAll(locationItems.length)}
            </PuButton>
            <PuButton
              size="sm"
              disabled={selectedIds.length === 0 || isBusy}
              onClick={() => {
                setSelectedIds([]);
                setReports(null);
              }}
            >
              {t.location.clearSelection}
            </PuButton>
          </>
        ) : undefined
      }
    >
      {/*
       * ⚠ **통로가 없다는 사실을 미리 말한다.** 브라우저로 이 화면을 열면 발행은 되지만 라벨은
       *   나오지 않는다 — 찍고 나서야 알면 작업자는 프린터를 의심하며 헛걸음한다.
       */}
      {hasPrintBridge() ? null : <PuNote>{t.print.noBridge}</PuNote>}
      {printFlow.isPending ? <PuNote live>{t.print.pending}</PuNote> : null}
      {/*
       * ⛔ **「전부 됐다」로 뭉치지 않는다.** 그리기·인쇄는 트랜잭션 밖이라 건별 실패가 정상이고,
       *    어느 자리가 안 나왔는지 모르면 작업자는 선반 앞에서 라벨을 세어 봐야 한다.
       */}
      {failures.length > 0 ? (
        <PuNote tone="warn">
          {failures
            .map((each) =>
              t.print.failedAt(
                locationCodeOf(each.targetId),
                each.attempt.kind === 'failed' ? each.attempt.reason : '',
              ),
            )
            .join(' · ')}
        </PuNote>
      ) : null}
      {unreported.length > 0 ? <PuNote>{t.print.reportFailed(unreported.length)}</PuNote> : null}
      {/*
       * ⛔ **못 물은 것은 조용히 잠그지 않는다.** 이 조회가 실패하면 발행이 막히는데, 사유가
       *   없으면 작업자는 고른 자리를 앞에 두고 죽은 단추만 누른다(리뷰 지적 · PR #1313).
       */}
      {guard === 'summaryFailed' ? (
        <PuNote
          tone="bad"
          action={
            <PuButton size="sm" onClick={() => void summary.refetch()}>
              {t.issue.retrySummary}
            </PuButton>
          }
        >
          {t.issue.summaryFailed}
        </PuNote>
      ) : null}
      {guard === 'tooMany' ? <PuNote tone="warn">{t.location.tooMany(MAX_TARGETS)}</PuNote> : null}
      {/* 「묻는 중」도 말한다 — 잠깐이라도 단추가 잠기는 까닭이 보여야 한다. */}
      {guard === 'summaryLoading' ? <PuNote live>{t.issue.checkingHistory}</PuNote> : null}

      {warehouseId === null ? (
        <PuEmpty icon="list" title={t.location.awaitingWarehouse} />
      ) : locations.isError ? (
        <PuEmpty icon="bad" title={t.location.loadFailed}>
          <PuButton onClick={() => void locations.refetch()}>{t.location.retry}</PuButton>
        </PuEmpty>
      ) : locations.isPending ? (
        /*
         * ⛔ **빈 표를 그려 두지 않는다.** 불러오는 중과 「한 자리도 없다」가 눈으로 갈리지 않으면,
         *   작업자는 없는 자리를 찾다가 창고를 다시 고른다.
         */
        <div ref={tableFitRef} className="ll-table" aria-busy="true" />
      ) : locationItems.length === 0 ? (
        <PuEmpty icon="box" title={t.location.empty} />
      ) : (
        <div ref={tableFitRef} className="ll-table" role="group" aria-label={t.location.heading}>
          <div className="pu-table-wrap">
            <table className="pu-table">
              <thead>
                <tr>
                  <th className="fit mid">{t.location.columnSelect}</th>
                  <th className="fit">{t.location.columnCode}</th>
                  <th>{t.location.columnName}</th>
                  <th className="fit mid">{t.location.columnState}</th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((row) => {
                  const isSelected = selectedIds.includes(row.locationId);

                  return (
                    /* 줄 어디를 눌러도 고르기·풀기(시안) — 체크 칸은 같은 일을 하는 큰 표적이다. */
                    <tr
                      key={row.locationId}
                      className={isSelected ? 'is-on' : undefined}
                      onClick={() => {
                        toggle(row.locationId);
                      }}
                    >
                      <td className="fit mid">
                        <button
                          type="button"
                          role="checkbox"
                          className="ll-box"
                          aria-checked={isSelected}
                          aria-label={t.location.choose(row.locationCode)}
                          onClick={(event) => {
                            event.stopPropagation();
                            toggle(row.locationId);
                          }}
                        >
                          {isSelected ? <PuIcon name="check" /> : null}
                        </button>
                      </td>
                      <td className="fit pu-mono ll-code" title={row.locationCode}>
                        {row.locationCode}
                      </td>
                      <td title={row.locationName}>{row.locationName}</td>
                      <td className="fit mid">
                        {/* 모든 줄에 사용 여부를 적는다 — 사용은 초록, 미사용은 빨강(omf-all-around#11). */}
                        {row.isActive ? (
                          <PuChip tone="ok">{t.location.active}</PuChip>
                        ) : (
                          <PuChip tone="bad">{t.location.inactive}</PuChip>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {warehouseId === null ? null : (
        <PuPager
          label={t.location.heading}
          total={locations.data?.total ?? null}
          page={page}
          pages={pages}
          onPage={setPage}
        />
      )}
    </PuSection>
  );

  return (
    <main className="pop-ui ll-screen" aria-labelledby={titleId}>
      <h1 id={titleId} className="ll-title">
        {t.title}
      </h1>

      {/* ⭐ 사번 미확인은 모든 POP 화면이 같은 맨 위 띠로 말한다(사용자 지시 2026-09-17). */}
      <PopWorkerMissingBanner workerNo={entry.workerNo} />

      {/*
       * ⛔ 「등록된 프린터가 없다」 띠는 두지 않는다(사용자 지시 2026-11-17 · #291) — 프린터 연결은
       *    공통 메뉴 맨 위 줄이 상시 보인다. 발행은 그대로 막지 않는다.
       *    프린터는 공통 메뉴 맨 위 줄 프린터 자리에 서고, 누르면 고른다.
       */}
      <PopTopPrinter>
        <PrinterChip
          printers={printerViews}
          selected={printerViews?.find((each) => each.printerName === printerName) ?? null}
          isLoading={printers.isPending}
          isError={printers.isError}
          isSelectable
          isLocked={isBusy}
          onRetry={() => void printers.refetch()}
          onSelect={setChosenPrinter}
          showNone
          noneLabel={messages.productionResult.flow.work.printerNone}
        />
      </PopTopPrinter>

      <PuScreen className="ll-body" actionBar={actionBar}>
        <PuCols variant="list">
          {leftSection}
          {rightSection}
        </PuCols>
      </PuScreen>

      {reissueAsked && (
        <ReissueDialog
          reissueCount={reissueCount}
          reasons={reasons.data ?? []}
          reasonsFailed={reasons.isError}
          value={reasonCode}
          onChange={setReasonCode}
          isSaving={write.isSaving}
          onConfirm={() => {
            issue(reasonCode);
          }}
          onClose={() => {
            setReissueAsked(false);
          }}
        />
      )}
    </main>
  );
};
