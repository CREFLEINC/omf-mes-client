/**
 * W-02-01 작업지시 목록 작업함
 * 유형: T-W-C 처리형 (작업함: ProductionOrderScreen, 처리 화면: ProductionOrderProcessScreen)
 * 조건, 건수, 행 칩은 서버 칩 판정(`worklistState`) 하나로 거르고 센다(C-17). 막힌 까닭은 사유 칩이 말한다.
 * 이탈: C-12 기간 칸의 「시작일부터」 적용은 DS 기간 선택이 지원하지 않아 미구현.
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
import { ForbiddenNotice, isForbidden } from './forbidden-notice';
import { WorklistBulkDialog } from './bulk-dialog';
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
import { useWorklist, useWorklistCount, type WorklistFilters } from './worklist-queries';
import { CountChip, ProcessStateChip, ReasonChips } from './worklist-chips';

const t = messages.erpWorkOrderFlow;

/** 조회 조건 칸(번호, 납기, 품목)에 값이 있는가. 처리 상태 칩은 조건으로 치지 않는다. */
const hasSearchConditions = (filters: WorklistFilters): boolean =>
  filters.q !== '' || filters.dueFrom !== '' || filters.dueTo !== '' || filters.item !== '';

/** 칩 건수. 건수를 받지 못했으면(권한 없음, 오류, 불러오는 중) 0으로 보이지 않고 이름만 보인다. */
const countLabel = (
  count: number | undefined,
  withCount: (count: number) => string,
  name: string,
): string => (count === undefined ? name : withCount(count));
const quantity = (value: number): string =>
  new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 6 }).format(value);

export interface WorklistRow {
  fact: ProductionOrderFact;
  derived: WorklistDerived;
  uom: string;
  itemCode: string;
  itemName: string;
  qtyLabel: string;
  outcome: BulkOutcome | undefined;
}

export interface ProductionOrderScreenProps {
  /** 권한 안내가 가리킬 메뉴 경로(「시스템 관리 › 사용자·역할·권한」). 라우트가 사이드바 이름으로 넘긴다. */
  permissionMenuPath?: string | null;
}

export const ProductionOrderScreen = ({
  permissionMenuPath = null,
}: ProductionOrderScreenProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const filters = useMemo(() => readWorklistFilters(searchParams), [searchParams]);
  const list = useWorklist(filters);
  const actionRequiredCount = useWorklistCount('ACTION_REQUIRED');
  const releasePendingCount = useWorklistCount('RELEASE_PENDING');
  const allCount = useWorklistCount('ALL');
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
    const item = itemNames.get(fact.itemId);
    const uom = uoms.entries.find((option) => option.value === String(fact.uomId))?.label ?? '';
    return {
      fact,
      derived: deriveWorklistState(fact),
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
        row.fact.releasePendingWorkOrderCount === null || row.fact.liveWorkOrderCount === null ? (
          ''
        ) : (
          <span className="nowrap-cell">
            {t.list.pendingWorkOrders(
              row.fact.releasePendingWorkOrderCount,
              row.fact.liveWorkOrderCount,
            )}
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
          <ProcessStateChip state={row.derived.state} />
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
           * 조건 칩은 「전체」를 맨 앞에 두고 나머지는 처리 순서대로 놓는다. 사용자가 처리할 조건만 칩으로 둔다(계획 전,
           * 배포 완료, 취소는 행 칩으로만 보인다). 보이는 묶음 이름은 두지 않고 접근명만 붙인다.
           */
          <span className="erp-wo-counts" role="group" aria-label={t.counts.label}>
            <CountChip
              state="BEFORE_PLAN"
              label={countLabel(allCount.data, t.counts.all, t.counts.allName)}
              selected={filters.state === 'ALL'}
              onSelect={() => apply({ ...filters, state: 'ALL', page: 1 })}
            />
            <CountChip
              state="ACTION_REQUIRED"
              label={countLabel(
                actionRequiredCount.data,
                t.counts.actionRequired,
                t.status.ACTION_REQUIRED,
              )}
              selected={filters.state === 'ACTION_REQUIRED'}
              onSelect={() => apply({ ...filters, state: 'ACTION_REQUIRED', page: 1 })}
            />
            <CountChip
              state="RELEASE_PENDING"
              label={countLabel(
                releasePendingCount.data,
                t.counts.releasePending,
                t.status.RELEASE_PENDING,
              )}
              selected={filters.state === 'RELEASE_PENDING'}
              onSelect={() => apply({ ...filters, state: 'RELEASE_PENDING', page: 1 })}
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
      <section className="pane erp-wo-list-pane" aria-label={t.list.pane}>
        {list.isError && isForbidden(list.error) ? (
          <ForbiddenNotice menuPath={permissionMenuPath} />
        ) : list.isError ? (
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
                hasSearchConditions(filters) ? (
                  /* 조회 조건 때문에 비었으면 조건을 지우는 길을 둔다. 고른 칩(처리 상태)과 쪽 크기는 그대로다. */
                  <EmptyState
                    size="sm"
                    title={t.list.emptyTitle}
                    description={t.list.emptyDescription}
                    action={
                      <Button
                        size="sm"
                        variant="outlined"
                        onClick={() =>
                          apply({
                            ...DEFAULT_WORKLIST_FILTERS,
                            state: filters.state,
                            size: filters.size,
                          })
                        }
                      >
                        {messages.common.reset}
                      </Button>
                    }
                  />
                ) : (
                  <EmptyState
                    size="sm"
                    title={
                      filters.state === 'ACTION_REQUIRED'
                        ? t.list.emptyActionRequiredTitle
                        : t.list.emptyTitle
                    }
                    description={
                      filters.state === 'ACTION_REQUIRED'
                        ? t.list.emptyActionRequiredDescription
                        : undefined
                    }
                  />
                )
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
