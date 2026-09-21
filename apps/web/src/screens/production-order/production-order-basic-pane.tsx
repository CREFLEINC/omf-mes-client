import { AlertBanner, Card, Chip, IconButton, SkeletonText, Tooltip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import type { CodeNameOf } from './code-names';
import type { ProductionOrderItemName } from './item-lookups';
import { productionOrderStatusTone } from './status-tone';
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
  statusNameOf: CodeNameOf;
  action?: ReactNode;
}

/**
 * 값의 무게 — 선택 직후 먼저 읽는 것(번호·품목·수량·납기·상태)과 참조 정보, 보조 설명(비고)을 가른다.
 * 데이터를 숨기거나 접지 않는다 — 글자 무게만 다르다.
 */
type DetailTier = 'primary' | 'secondary' | 'note';

interface DetailField {
  key: string;
  label: string;
  value: ReactNode;
  tier: DetailTier;
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
  statusNameOf,
  action,
}: ProductionOrderBasicPaneProps) => {
  if (!isSelected) {
    return (
      <section
        className="pane production-order-pane production-order-basic-pane"
        aria-label={t.panes.basic}
      >
        <h2>{t.basic.heading}</h2>
        <p className="production-order-pane-description">{t.detail.unselectedNote}</p>
      </section>
    );
  }
  if (detailState.kind === 'LOADING') {
    return (
      <section
        className="pane production-order-pane production-order-basic-pane"
        aria-label={t.panes.basic}
      >
        <h2>{t.basic.heading}</h2>
        <div role="status" aria-label={t.basic.loading}>
          <SkeletonText lines={4} />
        </div>
      </section>
    );
  }
  if (detailState.kind === 'ERROR') {
    return (
      <section
        className="pane production-order-pane production-order-basic-pane"
        aria-label={t.panes.basic}
      >
        <h2>{t.basic.heading}</h2>
        <AlertBanner variant="error" title={t.basic.loadFailedTitle}>
          {t.basic.loadFailedDescription}
        </AlertBanner>
      </section>
    );
  }

  const { data } = detailState;
  const unit = describeReference(resolveReference(uoms, data.uomId));
  /* 1행은 선택 직후 확인하는 값, 2행은 진행 집계·참조·비고 — 5열 × 2행 구조는 그대로다. */
  const fields: DetailField[] = [
    {
      key: 'productionOrderNo',
      label: t.fields.productionOrderNo,
      value: data.productionOrderNo,
      tier: 'primary',
    },
    {
      key: 'item',
      label: t.fields.item,
      value: describeItem(itemName, data.itemId),
      tier: 'primary',
    },
    {
      key: 'orderedQty',
      label: t.fields.orderedQty,
      value: `${String(data.orderQty)} ${unit}`,
      tier: 'primary',
    },
    {
      key: 'dueDate',
      label: t.fields.dueDate,
      value: displayOr(data.dueDate, t.values.missingDueDate),
      tier: 'primary',
    },
    {
      key: 'statusCode',
      label: t.fields.statusCode,
      /* 목록과 같은 상태 표식을 쓴다. */
      value: (
        <Chip variant="status" status={productionOrderStatusTone(data.statusCode)} size="sm">
          {statusNameOf(data.statusCode)}
        </Chip>
      ),
      tier: 'primary',
    },
    {
      key: 'workOrderProgress',
      label: t.fields.workOrderProgress,
      /* 두 숫자의 뜻은 도움말로 말한다 — 진행률로 읽히지 않게 막대나 백분율로 바꾸지 않는다. */
      value: (
        <span className="production-order-detail-with-help">
          {workOrderProgress(data.expandedWorkOrderCount, data.plannedWorkOrderCount)}
          <Tooltip content={t.basic.workOrderProgressTooltip} placement="right">
            <IconButton size="sm" icon="help" aria-label={t.basic.workOrderProgressHelp} />
          </Tooltip>
        </span>
      ),
      tier: 'secondary',
    },
    {
      key: 'erpOrderNo',
      label: t.fields.erpProductionOrderNo,
      value: displayOr(data.erpOrderNo, t.values.missingErpOrderNo),
      tier: 'secondary',
    },
    {
      key: 'businessUnit',
      label: t.fields.businessUnit,
      value: describeReference(resolveReference(businessUnits, data.businessUnitId)),
      tier: 'secondary',
    },
    {
      key: 'plant',
      label: t.fields.plant,
      value: describeReference(resolveReference(plants, data.plantId)),
      tier: 'secondary',
    },
    {
      key: 'remarks',
      label: t.fields.remarks,
      value: displayOr(data.remarks, t.values.missingRemarks),
      tier: 'note',
    },
  ];

  return (
    <section
      className="pane production-order-pane production-order-basic-pane"
      aria-label={t.panes.basic}
    >
      <div className="production-order-pane-heading">
        <h2>{t.basic.heading}</h2>
        {action}
      </div>
      <Card bordered>
        <Card.Body className="production-order-detail-body">
          <dl className="production-order-detail-fields">
            {fields.map((field) => (
              <div className="production-order-detail-field" data-tier={field.tier} key={field.key}>
                <dt className="field-label">{field.label}</dt>
                <dd>{field.value}</dd>
              </div>
            ))}
          </dl>
        </Card.Body>
      </Card>
    </section>
  );
};
