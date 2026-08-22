import { Card, EmptyState } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

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

const displayLabel = (value: string | null | undefined): string =>
  value === null || value === undefined || value.trim() === '' ? t.values.unavailable : value;

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
    <section className="pane" aria-label={t.pane}>
      <h2>{t.heading(view.workOrderNo)}</h2>
      <Card bordered>
        <Card.Body>
          <dl className="filter-bar">
            <div className="field-cell">
              <dt className="field-label">{t.fields.item}</dt>
              <dd>{displayLabel(view.itemLabel)}</dd>
            </div>
            <div className="field-cell">
              <dt className="field-label">{t.fields.quantity}</dt>
              <dd>{view.quantityLabel}</dd>
            </div>
            {DISPLAY_FIELDS.slice(1).map((field) => (
              <div key={field.key} className="field-cell">
                <dt className="field-label">{field.label}</dt>
                <dd>{displayLabel(view[field.key])}</dd>
              </div>
            ))}
          </dl>
        </Card.Body>
      </Card>
    </section>
  );
};
