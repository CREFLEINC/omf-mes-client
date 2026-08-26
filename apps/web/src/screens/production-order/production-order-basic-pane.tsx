import { AlertBanner, Card, EmptyState, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import type { ProductionOrderItemName } from './item-lookups';
import { describeReference, resolveReference, type ReferenceSource } from './reference-lookups';
import type { ProductionOrderFact } from './types';

const t = messages.productionOrder;

export type ProductionOrderBasicDetailState =
  { kind: 'LOADING' } | { kind: 'ERROR' } | { kind: 'DATA'; data: ProductionOrderFact };

export interface ProductionOrderBasicPaneProps {
  isSelected: boolean;
  detailState: ProductionOrderBasicDetailState;
  itemName: ProductionOrderItemName | null;
  businessUnits: ReferenceSource;
  plants: ReferenceSource;
  uoms: ReferenceSource;
  action?: ReactNode;
}

interface DetailField {
  key: string;
  label: string;
  value: ReactNode;
}

const describeItem = (item: ProductionOrderItemName | null, itemId: number): string => {
  if (item === null || item.itemId !== itemId || item.status === 'unknown') {
    return t.values.itemUnknown;
  }
  if (item.status === 'loading') return t.values.itemLoading;
  if (item.status === 'failed') return t.values.itemFailed;
  return item.label === null || item.label.trim() === '' ? t.values.itemUnknown : item.label;
};

const displayOr = (value: string | null, fallback: string): string =>
  value === null || value.trim() === '' ? fallback : value;

const workOrderProgress = (expanded: number | null, planned: number | null): string =>
  `${expanded === null ? '-' : String(expanded)} / ${planned === null ? '-' : String(planned)}`;

export const ProductionOrderBasicPane = ({
  isSelected,
  detailState,
  itemName,
  businessUnits,
  plants,
  uoms,
  action,
}: ProductionOrderBasicPaneProps) => {
  if (!isSelected) {
    return (
      <section className="pane" aria-label={t.panes.basic}>
        <EmptyState
          size="sm"
          title={t.basic.unselectedTitle}
          description={t.basic.unselectedDescription}
        />
      </section>
    );
  }
  if (detailState.kind === 'LOADING') {
    return (
      <section className="pane" aria-label={t.panes.basic}>
        <h2>{t.basic.heading}</h2>
        <div role="status" aria-label={t.basic.loading}>
          <SkeletonText lines={4} />
        </div>
      </section>
    );
  }
  if (detailState.kind === 'ERROR') {
    return (
      <section className="pane" aria-label={t.panes.basic}>
        <h2>{t.basic.heading}</h2>
        <AlertBanner variant="error" title={t.basic.loadFailedTitle}>
          {t.basic.loadFailedDescription}
        </AlertBanner>
      </section>
    );
  }

  const { data } = detailState;
  const unit = describeReference(resolveReference(uoms, data.uomId));
  const fields: DetailField[] = [
    { key: 'productionOrderNo', label: t.fields.productionOrderNo, value: data.productionOrderNo },
    {
      key: 'erpOrderNo',
      label: t.fields.erpProductionOrderNo,
      value: displayOr(data.erpOrderNo, t.values.missingErpOrderNo),
    },
    {
      key: 'businessUnit',
      label: t.fields.businessUnit,
      value: describeReference(resolveReference(businessUnits, data.businessUnitId)),
    },
    {
      key: 'plant',
      label: t.fields.plant,
      value: describeReference(resolveReference(plants, data.plantId)),
    },
    { key: 'item', label: t.fields.item, value: describeItem(itemName, data.itemId) },
    { key: 'orderedQty', label: t.fields.orderedQty, value: `${String(data.orderQty)} ${unit}` },
    {
      key: 'dueDate',
      label: t.fields.dueDate,
      value: displayOr(data.dueDate, t.values.missingDueDate),
    },
    { key: 'statusCode', label: t.fields.statusCode, value: data.statusCode },
    {
      key: 'workOrderProgress',
      label: t.fields.workOrderProgress,
      value: workOrderProgress(data.expandedWorkOrderCount, data.plannedWorkOrderCount),
    },
    {
      key: 'remarks',
      label: t.fields.remarks,
      value: displayOr(data.remarks, t.values.missingRemarks),
    },
  ];

  return (
    <section className="pane" aria-label={t.panes.basic}>
      <h2>{t.basic.heading}</h2>
      <Card bordered>
        <Card.Body>
          <dl className="filter-bar">
            {fields.map((field) => (
              <div className="field-cell" key={field.key}>
                <dt className="field-label">{field.label}</dt>
                <dd>{field.value}</dd>
              </div>
            ))}
          </dl>
        </Card.Body>
      </Card>
      {action !== undefined && <div className="form-actions">{action}</div>}
    </section>
  );
};
