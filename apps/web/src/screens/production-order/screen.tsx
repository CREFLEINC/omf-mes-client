/**
 * W-02-01 작업지시 목록 작업함
 * 유형: T-W-C 처리형 (작업함: ProductionOrderScreen, 처리 화면: ProductionOrderProcessScreen)
 * 이탈: C-17 「배포 대기」(서버 자동 계획 결과 DONE)는 배포 가능을 뜻하지 않는다. 서버가 배포 가능 여부로 거르고 세지 못해(계약 대기,
 *       omf-all-around#129) 잠정 규칙대로 조건, 건수, 행 칩을 서버 자동 계획 결과로 두고
 *       막힘(W/O 생산 라인 없음)은 사유 칩으로만 보인다. 상태 이름은 omf-all-around#204 사용자 결정이다. C-12 기간 칸의 「시작일부터」 적용은 DS 기간 선택이 지원하지 않아 미구현.
 */
import {
  AlertBanner,
  Breadcrumb,
  Button,
  EmptyState,
  PageHeader,
  SkeletonText,
  type Column,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import {
  BulkOutcomeChip,
  BulkResult,
  type BulkOutcome,
  type BulkResultFilter,
} from '../../patterns/bulk-result';
import { PageNav } from '../../patterns/page-nav';
import { SelectableTable } from '../../patterns/selectable-table';
import { useWorklistBulk, type BulkKind, type BulkTarget } from './bulk-actions';
import { WorklistBulkDialog } from './bulk-dialog';
import { useProductionOrderCodeNames } from './code-names';
import { useItemCodeNames } from './item-lookups';
import { useUomReferenceLookup } from './reference-lookups';
import type { ProductionOrderFact } from './types';
import {
  DEFAULT_WORKLIST_FILTERS,
  processPath,
  readWorklistFilters,
  rememberWorklistSearch,
  toWorklistSearchParams,
} from './worklist-filters';
import { WorklistFilterBar } from './worklist-filter-bar';
import { deriveWorklistState, type WorklistDerived } from './worklist-model';
import {
  useReleaseBacklog,
  useWorklist,
  useWorklistCount,
  type WorklistFilters,
} from './worklist-queries';
import { CountChip, ProcessStateChip, ReasonChips } from './worklist-chips';

const t = messages.erpWorkOrderFlow;
const quantity = (value: number): string =>
  new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 6 }).format(value);

export interface WorklistRow {
  fact: ProductionOrderFact;
  derived: WorklistDerived;
  pending: number | null;
  /** 배포 전 W/O 가운데 생산 라인이 없는 수. 모르면 null. */
  lineMissing: number | null;
  uom: string;
  itemCode: string;
  itemName: string;
  qtyLabel: string;
  outcome: BulkOutcome | undefined;
}

export const ProductionOrderScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const filters = useMemo(() => readWorklistFilters(searchParams), [searchParams]);
  const list = useWorklist(filters);
  const backlog = useReleaseBacklog();
  const needsReviewCount = useWorklistCount('NEEDS_REVIEW');
  const doneCount = useWorklistCount('DONE');
  const allCount = useWorklistCount('ALL');
  const codeNames = useProductionOrderCodeNames();
  const uoms = useUomReferenceLookup();
  const bulk = useWorklistBulk();
  const [checked, setChecked] = useState<string[]>([]);
  const [dialog, setDialog] = useState<{ kind: BulkKind; targets: BulkTarget[] } | null>(null);
  const [resultFilter, setResultFilter] = useState<BulkResultFilter>(null);
  /* 실행 당시의 행. 결과로 목록을 좁힐 때 다음 조회에서 빠진 건도 보이게 한다(C-18). */
  const [runRows, setRunRows] = useState<WorklistRow[]>([]);
  const bulkReasonId = useId();

  const facts = list.data?.items ?? [];
  const itemNames = useItemCodeNames(facts.map((fact) => fact.itemId));
  const outcomes = new Map((bulk.run?.outcomes ?? []).map((item) => [item.id, item]));
  const toRow = (fact: ProductionOrderFact): WorklistRow => {
    /* 목록이 잘렸거나 받지 못했으면 목록에 없는 건은 판정 불가(undefined)로 둔다. 「배포 완료」로 읽지 않는다. */
    const entry =
      backlog.data === undefined
        ? undefined
        : (backlog.data.byOrder.get(fact.productionOrderId) ??
          (backlog.data.complete ? { pending: 0, blocked: 0 } : undefined));
    const item = itemNames.get(fact.itemId);
    const uom = uoms.entries.find((option) => option.value === String(fact.uomId))?.label ?? '';
    return {
      fact,
      derived: deriveWorklistState(fact, entry),
      pending: entry?.pending ?? null,
      lineMissing: entry?.blocked ?? null,
      uom,
      itemCode: item?.itemCode ?? '',
      itemName: item?.itemName ?? '',
      qtyLabel: `${quantity(fact.orderQty)} ${uom}`.trim(),
      outcome: outcomes.get(String(fact.productionOrderId)),
    };
  };
  const liveRows = facts.map(toRow);
  const rows =
    resultFilter === null
      ? liveRows
      : runRows
          .filter(
            (row) => outcomes.get(String(row.fact.productionOrderId))?.status === resultFilter,
          )
          .map(
            (row) =>
              liveRows.find(
                (live) => live.fact.productionOrderId === row.fact.productionOrderId,
              ) ?? {
                ...row,
                outcome: outcomes.get(String(row.fact.productionOrderId)),
              },
          );

  const apply = (next: WorklistFilters) => {
    bulk.clear();
    setResultFilter(null);
    setChecked([]);
    const params = toWorklistSearchParams(next);
    rememberWorklistSearch(params);
    setSearchParams(params);
  };
  const checkedRows = liveRows.filter((row) =>
    checked.includes(String(row.fact.productionOrderId)),
  );
  const targets: BulkTarget[] = checkedRows.map((row) => ({
    productionOrderId: row.fact.productionOrderId,
    productionOrderNo: row.fact.productionOrderNo,
  }));
  /* 두 일괄 동작이 같은 사유로 잠긴다. 사유는 버튼 아래 한 줄로 보이고 두 버튼이 함께 가리킨다(C-4). */
  const bulkReason = bulk.isRunning
    ? t.bulk.reasons.running
    : targets.length === 0
      ? t.bulk.reasons.noneChecked
      : null;

  const columns: Column<WorklistRow>[] = [
    {
      key: 'orderNo',
      header: t.list.columns.orderNo,
      render: (row) => <span className="nowrap-cell mono-cell">{row.fact.productionOrderNo}</span>,
    },
    {
      key: 'itemCode',
      header: t.list.columns.itemCode,
      render: (row) => <span className="nowrap-cell">{row.itemCode}</span>,
    },
    {
      key: 'itemName',
      header: t.list.columns.itemName,
      render: (row) => (
        <span className="ellipsis-cell" title={row.itemName}>
          {row.itemName}
        </span>
      ),
    },
    {
      key: 'orderQty',
      header: t.list.columns.orderQty,
      align: 'end',
      render: (row) => <span className="nowrap-cell">{row.qtyLabel}</span>,
    },
    {
      key: 'dueDate',
      header: t.list.columns.dueDate,
      render: (row) => <span className="nowrap-cell">{row.fact.dueDate ?? ''}</span>,
    },
    {
      key: 'pending',
      header: t.list.columns.pendingWorkOrders,
      align: 'end',
      render: (row) =>
        row.pending === null ? (
          !backlog.isPending &&
          row.derived.state === 'DONE' &&
          (row.fact.expandedWorkOrderCount ?? 0) > 0 ? (
            <span className="nowrap-cell">{t.list.pendingUnknown}</span>
          ) : (
            ''
          )
        ) : (
          <span className="nowrap-cell">
            {t.list.pendingWorkOrders(row.pending, row.fact.expandedWorkOrderCount ?? 0)}
          </span>
        ),
    },
    {
      key: 'status',
      header: t.list.columns.status,
      /*
       * 일괄 결과가 있는 행은 결과 칩을 상태 칩 자리에 보인다. 칩을 둘 놓으면 칸이 넓어져 이동 표시 열이 밀린다(C-16, G-49).
       * 결과를 닫으면 상태 칩으로 돌아간다.
       */
      render: (row) =>
        row.outcome !== undefined ? (
          <BulkOutcomeChip outcome={row.outcome} />
        ) : (
          <ProcessStateChip
            state={row.derived.state}
            cancelledName={codeNames.productionOrderStatus('CANCELLED')}
          />
        ),
    },
    {
      key: 'reasons',
      header: t.list.columns.reasons,
      render: (row) => (
        <ReasonChips
          reasons={row.derived.reasons}
          detail={{
            orderQty: quantity(row.fact.orderQty),
            uom: row.uom,
            pendingWorkOrders: row.pending ?? undefined,
            lineMissingWorkOrders: row.lineMissing ?? undefined,
          }}
        />
      ),
    },
    {
      key: 'open',
      header: <span className="visually-hidden">{t.list.columns.open}</span>,
      align: 'end',
      render: () => (
        <span className="row-chevron" aria-hidden="true">
          ›
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={
          <Breadcrumb
            items={[{ label: t.breadcrumbRoot }, { label: t.title }]}
            aria-label={messages.common.shell.breadcrumb}
          />
        }
        description={
          /*
           * 조건 칩은 「전체」를 맨 앞에 두고 나머지는 처리 순서대로 놓는다. 서버가 거를 수 있는 조건만 칩으로 둔다(계획 전과
           * 배포 완료는 거를 수 없다). 보이는 묶음 이름은 두지 않고 접근명만 붙인다.
           */
          <span className="erp-wo-counts" role="group" aria-label={t.counts.label}>
            <CountChip
              state="NOT_PLANNED"
              label={t.counts.all(allCount.data ?? 0)}
              selected={filters.autoPlan === 'ALL'}
              onSelect={() => apply({ ...filters, autoPlan: 'ALL', page: 1 })}
            />
            <CountChip
              state="NEEDS_REVIEW"
              label={t.counts.needsReview(needsReviewCount.data ?? 0)}
              selected={filters.autoPlan === 'NEEDS_REVIEW'}
              onSelect={() => apply({ ...filters, autoPlan: 'NEEDS_REVIEW', page: 1 })}
            />
            <CountChip
              state="DONE"
              label={t.counts.done(doneCount.data ?? 0)}
              selected={filters.autoPlan === 'DONE'}
              onSelect={() => apply({ ...filters, autoPlan: 'DONE', page: 1 })}
            />
          </span>
        }
        actions={
          <div className="erp-wo-bulk-actions">
            <Button
              variant="outlined"
              disabled={bulkReason !== null}
              aria-describedby={bulkReason === null ? undefined : bulkReasonId}
              onClick={() => setDialog({ kind: 'autoPlan', targets })}
            >
              {t.bulk.autoPlan}
            </Button>
            <Button
              disabled={bulkReason !== null}
              loading={bulk.isRunning}
              aria-describedby={bulkReason === null ? undefined : bulkReasonId}
              onClick={() => setDialog({ kind: 'release', targets })}
            >
              {t.bulk.release}
            </Button>
            <span id={bulkReasonId} className="erp-wo-bulk-reason">
              {bulkReason}
            </span>
          </div>
        }
      />
      <section className="pane erp-wo-filter-pane" aria-label={t.filters.pane}>
        <WorklistFilterBar
          applied={filters}
          onSearch={(draft) => apply({ ...filters, ...draft, page: 1 })}
          onReset={() => apply(DEFAULT_WORKLIST_FILTERS)}
        />
      </section>
      {bulk.run !== null && (
        <BulkResult
          title={t.bulk.resultTitle[bulk.run.kind]}
          itemName={bulk.run.kind === 'release' ? t.bulk.itemName : undefined}
          outcomes={bulk.run.outcomes}
          filter={resultFilter}
          onFilterChange={setResultFilter}
          onClose={() => {
            bulk.clear();
            setResultFilter(null);
          }}
        />
      )}
      {backlog.isError && <AlertBanner variant="info">{t.list.readinessFailed}</AlertBanner>}
      {backlog.data?.complete === false && (
        <AlertBanner variant="info">{t.list.readinessTruncated}</AlertBanner>
      )}
      <section className="pane erp-wo-list-pane" aria-label={t.list.pane}>
        {list.isError ? (
          <AlertBanner
            variant="error"
            title={t.list.loadFailed}
            action={
              <Button size="sm" variant="outlined" onClick={() => void list.refetch()}>
                {messages.common.retry}
              </Button>
            }
          >
            {t.list.loadFailedDescription}
          </AlertBanner>
        ) : list.isPending ? (
          <div role="status" aria-label={t.list.loading}>
            <SkeletonText lines={5} />
          </div>
        ) : (
          <>
            <SelectableTable
              className="erp-wo-table"
              caption={<span className="visually-hidden">{t.list.caption}</span>}
              columns={columns}
              rows={rows}
              getRowId={(row) => String(row.fact.productionOrderId)}
              rowLabel={(row) => t.list.openRow(row.fact.productionOrderNo)}
              rowRole="link"
              checkLabel={(row) => t.list.checkRow(row.fact.productionOrderNo)}
              onActivate={(row) => {
                rememberWorklistSearch(searchParams);
                void navigate(processPath(row.fact.productionOrderNo));
              }}
              checkedIds={checked}
              onCheckedChange={setChecked}
              empty={
                <EmptyState
                  size="sm"
                  title={
                    filters.autoPlan === 'NEEDS_REVIEW'
                      ? t.list.emptyNeedsReviewTitle
                      : t.list.emptyTitle
                  }
                  description={
                    filters.autoPlan === 'NEEDS_REVIEW'
                      ? t.list.emptyNeedsReviewDescription
                      : t.list.emptyDescription
                  }
                />
              }
            />
            {resultFilter === null && (
              <PageNav
                meta={list.data.page}
                onChangePage={(page) => apply({ ...filters, page })}
                onChangeSize={(size) => apply({ ...filters, size, page: 1 })}
              />
            )}
          </>
        )}
      </section>
      {dialog !== null && (
        <WorklistBulkDialog
          kind={dialog.kind}
          targets={dialog.targets}
          forecast={bulk.forecast}
          onCancel={() => setDialog(null)}
          onConfirm={() => {
            const { kind, targets: chosen } = dialog;
            setDialog(null);
            setRunRows(checkedRows);
            setResultFilter(null);
            void bulk.start(kind, chosen).then(() => setChecked([]));
          }}
        />
      )}
    </>
  );
};
