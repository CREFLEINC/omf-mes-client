import { Card, EmptyState } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { ItemLabelLines } from './item-label-lines';

const t = messages.workOrderRelease.summary;

export interface WorkOrderReleaseSummaryView {
  workOrderNo: string;
  itemLabel: string | null;
  quantityLabel: string;
  operationLabel: string | null;
  routingRevisionLabel: string | null;
  productionLineLabel: string | null;
  equipmentLabel: string | null;
  moldLabel: string | null;
  shiftLabel: string | null;
  plannedPeriodLabel: string | null;
}

type NullableDisplayField = Exclude<
  keyof WorkOrderReleaseSummaryView,
  'workOrderNo' | 'quantityLabel'
>;

const DISPLAY_FIELDS: ReadonlyArray<{ key: NullableDisplayField; label: string }> = [
  { key: 'itemLabel', label: t.fields.item },
  { key: 'operationLabel', label: t.fields.operation },
  { key: 'routingRevisionLabel', label: t.fields.routingRevision },
  { key: 'productionLineLabel', label: t.fields.productionLine },
  { key: 'equipmentLabel', label: t.fields.equipment },
  { key: 'moldLabel', label: t.fields.mold },
  { key: 'shiftLabel', label: t.fields.shift },
  { key: 'plannedPeriodLabel', label: t.fields.plannedPeriod },
];

const isBlank = (value: string | null | undefined): value is null | undefined | '' =>
  value === null || value === undefined || value.trim() === '';

/** 값 없음은 공통 표기(—)를 흐리게 — 여러 칸에 반복돼도 채워진 값보다 눈에 띄지 않게 한다. */
const DisplayValue = ({ value }: { value: string | null | undefined }) =>
  isBlank(value) ? (
    <dd className="work-order-release-summary-empty">{messages.common.reference.empty}</dd>
  ) : (
    <dd>{value}</dd>
  );

export interface WorkOrderReleaseSummaryPaneProps {
  view: WorkOrderReleaseSummaryView | null;
}

export const WorkOrderReleaseSummaryPane = ({ view }: WorkOrderReleaseSummaryPaneProps) => {
  if (view === null) {
    return (
      <section className="pane" aria-label={t.pane}>
        <EmptyState size="sm" title={t.empty.title} description={t.empty.description} />
      </section>
    );
  }

  return (
    <section className="pane work-order-release-summary-pane" aria-label={t.pane}>
      <h2 className="pane-title">{t.heading(view.workOrderNo)}</h2>
      <Card bordered>
        <Card.Body>
          <dl className="work-order-release-summary-grid">
            <div className="field-cell work-order-release-summary-field">
              <dt className="field-label">{t.fields.item}</dt>
              {isBlank(view.itemLabel) ? (
                <DisplayValue value={view.itemLabel} />
              ) : (
                <dd>
                  <ItemLabelLines label={view.itemLabel} />
                </dd>
              )}
            </div>
            <div className="field-cell work-order-release-summary-field">
              <dt className="field-label">{t.fields.quantity}</dt>
              <dd>{view.quantityLabel}</dd>
            </div>
            {DISPLAY_FIELDS.slice(1).map((field) => (
              <div key={field.key} className="field-cell work-order-release-summary-field">
                <dt className="field-label">{field.label}</dt>
                <DisplayValue value={view[field.key]} />
              </div>
            ))}
          </dl>
        </Card.Body>
      </Card>
    </section>
  );
};
