import { AlertBanner, Button, Dialog, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { lookupDisplayLabelWithInactive, type LookupSource } from '../../patterns/lookup-display';
import type { FilterOption } from './lot-filter-bar';
import type { ReferenceOption } from './reference-options';
import { LotHoldDocuments } from './lot-hold-documents';
import { useLotDetail } from './queries';

const t = messages.lotStatusHistory;
const EMPTY = '—';

const formatDateTime = (value: string | null): string => {
  if (value === null) return EMPTY;
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value);
  return match === null ? value : `${match[1]} ${match[2]}`;
};

const labelOf = (options: readonly FilterOption[], value: string): string =>
  options.find((option) => option.value === value)?.label ?? t.values.unlisted(value);

interface LotDetailDialogProps {
  lotId: number;
  itemSource: LookupSource<ReferenceOption>;
  lotTypeOptions: readonly FilterOption[];
  statusOptions: readonly FilterOption[];
  onClose: () => void;
}

export const LotDetailDialog = ({
  lotId,
  itemSource,
  lotTypeOptions,
  statusOptions,
  onClose,
}: LotDetailDialogProps) => {
  const detail = useLotDetail(lotId);
  const retry = (
    <Button
      variant="outlined"
      size="sm"
      aria-label={t.actions.retryLabel(t.detail.title)}
      onClick={() => void detail.refetch()}
    >
      {t.actions.retry}
    </Button>
  );

  return (
    <Dialog
      open
      onClose={onClose}
      title={t.detail.title}
      size="lg"
      footer={
        <Button variant="outlined" onClick={onClose}>
          {t.detail.close}
        </Button>
      }
    >
      {detail.isPending && (
        <div role="status" aria-label={t.detail.loading}>
          <SkeletonText lines={3} />
        </div>
      )}
      {detail.isError && <AlertBanner variant="error" title={t.detail.failed} action={retry} />}
      {detail.data !== undefined && (
        <dl className="filter-bar" aria-label={t.detail.attributes}>
          {[
            [t.detail.fields.lotNo, detail.data.lotNo],
            [t.detail.fields.item, lookupDisplayLabelWithInactive(itemSource, detail.data.itemId)],
            [t.detail.fields.lotType, labelOf(lotTypeOptions, detail.data.lotTypeCode)],
            [t.detail.fields.status, labelOf(statusOptions, detail.data.statusCode)],
            [t.detail.fields.initialQty, String(detail.data.initialQty)],
            [t.detail.fields.expiryDate, detail.data.expiryDate ?? EMPTY],
            [t.detail.fields.manufacturedAt, formatDateTime(detail.data.manufacturedAt)],
          ].map(([label, value]) => (
            <div className="field-cell" key={label}>
              <dt className="field-label">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}

      <LotHoldDocuments key={lotId} lotId={lotId} />

      <div className="form-actions">
        <Button disabled>{t.detail.transition}</Button>
        <p className="field-note">{t.detail.transitionNote}</p>
      </div>
      <p className="field-note">{t.detail.suspiciousNote}</p>
    </Dialog>
  );
};
