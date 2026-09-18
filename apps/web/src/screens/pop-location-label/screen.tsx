import { AlertBanner, Button, Chip, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, useMemo, useState } from 'react';

import { PopPageNav, pageBoundaryOf } from '../../patterns/pop-page-nav';
import { PopSelect as Select } from '../../patterns/pop-select';
import { popTouchClass } from '../../patterns/pop-touch';
import { PopWorkerMissingBanner } from '../../patterns/pop-worker-missing-banner';
import { PopWorkerTag } from '../../patterns/pop-worker-tag';
import { usePopLocationLabelEntry } from './entry-context';
import { useLocationLabelWrite, usePrintFlow, type PrintReport } from './mutations';
import { hasPrintBridge } from '../../patterns/pop-print';
import { PrinterSelect } from './printer-select';
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
} from './types';

const t = messages.popLocationLabel;

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
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [chosenPrinter, setChosenPrinter] = useState<string | null>(null);
  const [reasonCode, setReasonCode] = useState('');
  const [reissueAsked, setReissueAsked] = useState(false);
  const [reports, setReports] = useState<PrintReport[] | null>(null);

  const warehouses = useWarehouses();
  const locations = useLocations(warehouseId, page);
  const printers = usePrinters();
  const summary = useIssueSummary(selectedIds, selectedIds.length > 0);

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
  const printerName =
    chosenPrinter ?? printers.data?.find((each) => each.isDefault)?.printerName ?? null;

  const reasons = useReissueReasons(reissueAsked);

  const printFlow = usePrintFlow(entry.workerNo);

  const write = useLocationLabelWrite({
    /* 사번이 없으면 아래 `guard` 가 발행을 열지 않는다 — 여기 오는 값은 확보된 것이다. */
    workerNo: entry.workerNo ?? '',
    onSuccess: (issued: DocumentIssue[]) => {
      setReissueAsked(false);
      setReasonCode('');
      /*
       * ⛔ **거절을 받을 곳을 둔다.** 건별 실패는 안에서 값으로 접히지만, 그 바깥(형식 협상)이
       *    거절하면 결과 구획이 영영 비어 「눌렀는데 아무 일도 없다」가 된다. 발행은 이미
       *    끝났으므로 **인쇄가 통째로 실패한 것**으로 적는다 — 없던 일로 두지 않는다.
       */
      void printFlow
        .mutateAsync(issued)
        .then((result) => {
          setReports(result.reports);
        })
        .catch((cause: unknown) => {
          setReports(
            issued.map((record) => ({
              documentIssueLogId: record.documentIssueLogId,
              targetId: record.target.targetId,
              attempt: {
                kind: 'failed' as const,
                reason: cause instanceof Error ? cause.message : String(cause),
              },
              reported: false,
            })),
          );
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

  const boundary = pageBoundaryOf({
    page,
    size: LOCATION_PAGE_SIZE,
    total: locations.data?.total ?? 0,
  });

  const isPageAllSelected =
    locationItems.length > 0 &&
    locationItems.every((each) => selectedIds.includes(each.locationId));

  return (
    <main className="pop-shell pop-ui" aria-labelledby={titleId}>
      <header className="pop-header">
        <h1 id={titleId} className="pop-title">
          {t.title}
        </h1>
        <div className="pop-context-right">
          <PopWorkerTag workerNo={entry.workerNo} />
        </div>
      </header>

      {/* ⭐ 사번 미확인은 모든 POP 화면이 같은 맨 위 띠로 말한다(사용자 지시 2026-09-17). */}
      <PopWorkerMissingBanner workerNo={entry.workerNo} />

      {/*
       * ⚠ **통로가 없다는 사실을 미리 말한다.** 브라우저로 이 화면을 열면 발행은 되지만 라벨은
       *   나오지 않는다 — 찍고 나서야 알면 작업자는 프린터를 의심하며 헛걸음한다.
       */}
      {!hasPrintBridge() && <AlertBanner variant="info">{t.print.noBridge}</AlertBanner>}

      {/* 인쇄 결과는 화면 맨 위 띠 자리에 선다(사용자 지시 2026-09-17). */}
      <PrintResult
        reports={reports}
        isPending={printFlow.isPending}
        locationCodeOf={(targetId) =>
          locationItems.find((each) => each.locationId === targetId)?.locationCode ??
          String(targetId)
        }
      />

      {/* `pop-fixed` — 윗줄은 제 높이만 쓴다. 남는 높이는 적재 위치 목록이 받는다(사용자 지시 2026-09-17). */}
      <div className="pop-loclabel-top pop-fixed">
        <div className="pop-loclabel-warehouse">
          <span className="field-label">{t.warehouse.label}</span>
          {warehouses.isError ? (
            <>
              <AlertBanner variant="error">{t.warehouse.loadFailed}</AlertBanner>
              <Button
                className={popTouchClass('normal')}
                variant="outlined"
                size="xl"
                onClick={() => void warehouses.refetch()}
              >
                {t.warehouse.retry}
              </Button>
            </>
          ) : warehouses.data?.length === 0 ? (
            <AlertBanner variant="warning">{t.warehouse.none}</AlertBanner>
          ) : (
            <Select
              aria-label={t.warehouse.label}
              size="xl"
              value={warehouseId === null ? null : String(warehouseId)}
              placeholder={t.warehouse.placeholder}
              options={(warehouses.data ?? []).map((warehouse) => ({
                value: String(warehouse.warehouseId),
                label: `${warehouse.warehouseCode} · ${warehouse.warehouseName}`,
              }))}
              onChange={(value) => {
                setWarehouseId(Number(value));
                /* 창고가 바뀌면 앞서 고른 자리는 이 창고의 것이 아니다. */
                setSelectedIds([]);
                setPage(1);
                setReports(null);
              }}
            />
          )}
        </div>

        <PrinterSelect
          printers={printers.data ?? []}
          value={printerName}
          onChange={setChosenPrinter}
          isLoading={printers.isPending}
          isError={printers.isError}
          onRetry={() => void printers.refetch()}
          disabled={write.isSaving || printFlow.isPending}
        />
      </div>

      <section className="pop-loclabel-list" aria-label={t.location.heading}>
        <div className="pop-loclabel-list-head">
          <h2 className="pane-title">{t.location.heading}</h2>
          {/* 이 쪽의 적재 위치를 한 번에 고르거나 푼다(사용자 지시 2026-09-17). */}
          {warehouseId !== null && locationItems.length > 0 && (
            <Button
              type="button"
              variant="outlined"
              size="xl"
              className="pop-loclabel-select-all"
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
              {isPageAllSelected ? t.location.clearSelection : t.location.selectAll}
            </Button>
          )}
        </div>
        {warehouseId === null ? (
          <p className="field-note pop-loclabel-empty">{t.location.awaitingWarehouse}</p>
        ) : locations.isError ? (
          <>
            <AlertBanner variant="error">{t.location.loadFailed}</AlertBanner>
            <Button
              className={popTouchClass('normal')}
              variant="outlined"
              size="xl"
              onClick={() => void locations.refetch()}
            >
              {t.location.retry}
            </Button>
          </>
        ) : locations.isPending ? (
          /*
           * ⛔ **빈 표를 그려 두지 않는다.** 불러오는 중과 「한 자리도 없다」가 눈으로 갈리지 않으면,
           *   작업자는 없는 자리를 찾다가 창고를 다시 고른다.
           */
          <div role="status" aria-label={t.location.loading}>
            <SkeletonText lines={3} />
          </div>
        ) : locationItems.length === 0 ? (
          <p className="field-note">{t.location.empty}</p>
        ) : (
          <>
            <Table
              /*
               * ⭐ **체크 칸 대신 줄 오른쪽 [선택]으로 고른다**(사용자 지시 2026-09-17). 장갑 낀 손에는
               *    작은 체크 칸보다 단추가 낫다. 누를 때마다 고르기·풀기가 바뀌고, 고른 줄은 채운 단추다.
               *    모든 열은 머리·값 모두 가운데 정렬이다.
               */
              getRowId={(row) => String(row.locationId)}
              columns={[
                { key: 'locationCode', header: t.location.columnCode, align: 'center' },
                { key: 'locationName', header: t.location.columnName, align: 'center' },
                {
                  key: 'state',
                  header: t.location.columnIssued,
                  align: 'center',
                  render: (row) =>
                    row.isActive ? null : <Chip status="warning">{t.location.inactive}</Chip>,
                },
                {
                  key: 'pick',
                  header: '',
                  align: 'center',
                  width: '10rem',
                  render: (row) => {
                    const isSelected = selectedIds.includes(row.locationId);

                    return (
                      <Button
                        type="button"
                        variant={isSelected ? 'filled' : 'outlined'}
                        size="xl"
                        className="pop-loclabel-pick"
                        aria-pressed={isSelected}
                        onClick={() => {
                          setSelectedIds((current) =>
                            isSelected
                              ? current.filter((id) => id !== row.locationId)
                              : [...current, row.locationId],
                          );
                          setReports(null);
                        }}
                      >
                        {t.location.pick}
                      </Button>
                    );
                  },
                },
              ]}
              rows={locationItems}
            />
            <PopPageNav boundary={boundary} label={t.location.heading} onChange={setPage} />
          </>
        )}
      </section>

      {/*
       * ⛔ **못 물은 것은 조용히 잠그지 않는다.** 이 조회가 실패하면 발행이 막히는데, 사유가
       *   없으면 작업자는 고른 자리를 앞에 두고 죽은 단추만 누른다 — 다른 세 조회는 모두
       *   실패 배너와 [다시 시도]를 갖췄고 이 자리만 빠져 있었다(리뷰 지적 · PR #1313).
       */}
      {guard === 'summaryFailed' && (
        <section className="pop-loclabel-summary-error">
          <AlertBanner variant="error">{t.issue.summaryFailed}</AlertBanner>
          <Button
            className={popTouchClass('normal')}
            variant="outlined"
            size="xl"
            onClick={() => void summary.refetch()}
          >
            {t.issue.retrySummary}
          </Button>
        </section>
      )}

      <div className="pop-action-bar pop-loclabel-actions">
        {guard === 'tooMany' && <p className="field-note">{t.location.tooMany(MAX_TARGETS)}</p>}
        {/* 「묻는 중」도 말한다 — 잠깐이라도 단추가 잠기는 까닭이 보여야 한다. */}
        {guard === 'summaryLoading' && <p className="field-note">{t.issue.checkingHistory}</p>}
        <Button
          className={popTouchClass('primary')}
          variant="filled"
          size="xl"
          disabled={guard !== 'ready' || write.isSaving || printFlow.isPending}
          loading={write.isSaving}
          onClick={onIssueClick}
        >
          {t.issue.action}
        </Button>
      </div>

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

interface PrintResultProps {
  reports: PrintReport[] | null;
  isPending: boolean;
  locationCodeOf: (targetId: number) => string;
}

/**
 * 인쇄 결과 — **건별로 말한다.**
 *
 * ⛔ **「전부 됐다」로 뭉치지 않는다.** 그리기·인쇄는 트랜잭션 밖이라 건별 실패가 정상이고,
 *    어느 자리가 안 나왔는지 모르면 작업자는 선반 앞에서 라벨을 세어 봐야 한다.
 */
const PrintResult = ({ reports, isPending, locationCodeOf }: PrintResultProps) => {
  if (isPending) {
    return (
      <section className="pop-loclabel-print-result pop-fixed" aria-label={t.print.heading}>
        <AlertBanner variant="info">{t.print.pending}</AlertBanner>
      </section>
    );
  }
  if (reports === null || reports.length === 0) return null;

  /*
   * ⛔ **통로가 없는 것은 인쇄 결과가 아니다.** 시도조차 하지 않았으므로 「성공 0 · 실패 0」으로
   *    셈해 보이면 거짓이 된다. 그 사정은 머리 쪽 안내가 이미 상시로 말하고 있으므로 여기서
   *    되풀이하지 않는다 — 같은 문장이 화면에 둘이면 어느 쪽이 방금 일인지 갈리지 않는다.
   */
  if (reports.every((each) => each.attempt.kind === 'noBridge')) return null;

  const printed = reports.filter((each) => each.attempt.kind === 'printed').length;
  const failures = reports.filter((each) => each.attempt.kind === 'failed');
  const unreported = reports.filter((each) => each.attempt.kind !== 'noBridge' && !each.reported);

  return (
    <section className="pop-loclabel-print-result pop-fixed" aria-label={t.print.heading}>
      <AlertBanner variant={failures.length > 0 ? 'warning' : 'success'}>
        {t.print.summary(printed, failures.length)}
      </AlertBanner>

      {failures.map((each) => (
        <p key={each.documentIssueLogId} className="field-note">
          {t.print.failedAt(
            locationCodeOf(each.targetId),
            each.attempt.kind === 'failed' ? each.attempt.reason : '',
          )}
        </p>
      ))}

      {unreported.length > 0 && (
        <AlertBanner variant="info">{t.print.reportFailed(unreported.length)}</AlertBanner>
      )}
    </section>
  );
};
