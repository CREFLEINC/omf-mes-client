import { AlertBanner, Chip, type Column, EmptyState, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { ProductionOrderPlanFact, ProductionOrderWorkOrderFact } from './detail-queries';
import { describeReference, resolveReference, type ReferenceSource } from './reference-lookups';

const t = messages.productionOrder;

export type ProductionOrderDetailListState<T> =
  { kind: 'LOADING' } | { kind: 'ERROR' } | { kind: 'DATA'; items: T[] };

interface SharedProps {
  isSelected: boolean;
  uoms: ReferenceSource;
}

export type ProductionOrderDetailListPaneProps = SharedProps &
  (
    | { kind: 'plans'; state: ProductionOrderDetailListState<ProductionOrderPlanFact> }
    | {
        kind: 'workOrders';
        state: ProductionOrderDetailListState<ProductionOrderWorkOrderFact>;
      }
  );

const quantity = (value: number, uomId: number, uoms: ReferenceSource): string =>
  `${String(value)} ${describeReference(resolveReference(uoms, uomId))}`;

const plannedRange = (start: string | null, end: string | null): string => {
  if (start === null && end === null) return t.detail.unscheduled;
  return `${start ?? '-'} ~ ${end ?? '-'}`;
};

const status = (code: string) => (
  <Chip variant="status" status="idle" size="sm">
    {code}
  </Chip>
);

const planColumns = (uoms: ReferenceSource): Column<ProductionOrderPlanFact>[] => [
  { key: 'planNo', header: t.detail.columns.planNo },
  { key: 'planDate', header: t.detail.columns.planDate },
  {
    key: 'plannedQty',
    header: t.detail.columns.plannedQty,
    align: 'end',
    render: (row) => quantity(row.plannedQty, row.uomId, uoms),
  },
  {
    key: 'statusCode',
    header: t.detail.columns.status,
    render: (row) => status(row.statusCode),
  },
];

const workOrderColumns = (uoms: ReferenceSource): Column<ProductionOrderWorkOrderFact>[] => [
  { key: 'workOrderNo', header: t.detail.columns.workOrderNo },
  { key: 'workOrderTypeCode', header: t.detail.columns.workOrderType },
  {
    key: 'orderQty',
    header: t.detail.columns.orderQty,
    align: 'end',
    render: (row) => quantity(row.orderQty, row.uomId, uoms),
  },
  {
    key: 'plannedRange',
    header: t.detail.columns.plannedRange,
    render: (row) => plannedRange(row.plannedStartAt, row.plannedEndAt),
  },
  {
    key: 'statusCode',
    header: t.detail.columns.status,
    render: (row) => status(row.statusCode),
  },
];

export const ProductionOrderDetailListPane = (props: ProductionOrderDetailListPaneProps) => {
  const isPlans = props.kind === 'plans';
  const paneLabel = isPlans ? t.panes.plans : t.panes.workOrders;
  const heading = isPlans ? t.detail.planHeading : t.detail.workOrderHeading;

  if (!props.isSelected) {
    return (
      <section className="pane" aria-label={paneLabel}>
        <EmptyState
          size="sm"
          title={t.detail.unselectedTitle}
          description={t.detail.unselectedDescription}
        />
      </section>
    );
  }
  if (props.state.kind === 'LOADING') {
    return (
      <section className="pane" aria-label={paneLabel}>
        <h2>{heading}</h2>
        <div role="status" aria-label={isPlans ? t.detail.planLoading : t.detail.workOrderLoading}>
          <SkeletonText lines={3} />
        </div>
      </section>
    );
  }
  if (props.state.kind === 'ERROR') {
    return (
      <section className="pane" aria-label={paneLabel}>
        <h2>{heading}</h2>
        <AlertBanner
          variant="error"
          title={isPlans ? t.detail.planLoadFailedTitle : t.detail.workOrderLoadFailedTitle}
        >
          {t.detail.loadFailedDescription}
        </AlertBanner>
      </section>
    );
  }

  return (
    <section className="pane" aria-label={paneLabel}>
      <h2>{heading}</h2>
      <div className="wide-table">
        {props.kind === 'plans' ? (
          <Table
            density="compact"
            columns={planColumns(props.uoms)}
            rows={props.state.items}
            getRowId={(row) => String(row.productionPlanId)}
            sort={null}
            empty={<EmptyState size="sm" live title={t.detail.planEmptyTitle} />}
          />
        ) : (
          <Table
            density="compact"
            columns={workOrderColumns(props.uoms)}
            rows={props.state.items}
            getRowId={(row) => String(row.workOrderId)}
            sort={null}
            empty={<EmptyState size="sm" live title={t.detail.workOrderEmptyTitle} />}
          />
        )}
      </div>
    </section>
  );
};
