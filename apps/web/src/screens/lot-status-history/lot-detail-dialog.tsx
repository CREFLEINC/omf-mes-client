import { AlertBanner, Button, Chip, Dialog, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import { lookupDisplayLabelWithInactive, type LookupSource } from '../../patterns/lookup-display';
import type { FilterOption } from './lot-filter-bar';
import { LotHoldDocuments } from './lot-hold-documents';
import { LotTimeline } from './lot-timeline';
import { lotStatusTone } from './options';
import { useLotDetail } from './queries';
import { useItemNameSources } from './reference-options';
import { formatPlantDateTime } from '../../patterns/plant-time';

const t = messages.lotStatusHistory;
const EMPTY = '—';

const formatDateTime = (value: string | null): string => {
  if (value === null) return EMPTY;
  return formatPlantDateTime(value) ?? value;
};

const labelOf = (options: readonly FilterOption[], value: string): string =>
  options.find((option) => option.value === value)?.label ?? t.values.unlisted(value);

interface LotDetailDialogProps {
  lotId: number;
  lotTypeOptions: readonly FilterOption[];
  statusOptions: readonly FilterOption[];
  onClose: () => void;
}

export const LotDetailDialog = ({
  lotId,
  lotTypeOptions,
  statusOptions,
  onClose,
}: LotDetailDialogProps) => {
  const detail = useLotDetail(lotId);
  const transitionNoteId = useId();
  const itemId = detail.data?.itemId;
  const itemNames = useItemNameSources(itemId === undefined ? [] : [itemId]);
  const itemSource: LookupSource = (itemId === undefined ? undefined : itemNames.get(itemId)) ?? {
    entries: [],
    isError: false,
    isLoading: true,
  };
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
      className="lot-status-detail-dialog"
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
      {/*
       * 기본 정보 — 긴 값(LOT 번호·품목)은 첫 줄에 넓게, 짧은 값은 둘째 줄에 좁게 둔다
       * (사용자 지시 2026-09-19). 칸 배치는 app.css .lot-detail-fields.
       */}
      {detail.data !== undefined && (
        <dl className="lot-detail-fields" aria-label={t.detail.attributes}>
          {(
            [
              ['wide', t.detail.fields.lotNo, detail.data.lotNo],
              [
                'wide',
                t.detail.fields.item,
                lookupDisplayLabelWithInactive(itemSource, detail.data.itemId),
              ],
              [
                'short',
                t.detail.fields.status,
                <Chip variant="status" status={lotStatusTone(detail.data.statusCode)} size="sm">
                  {labelOf(statusOptions, detail.data.statusCode)}
                </Chip>,
              ],
              ['short', t.detail.fields.lotType, labelOf(lotTypeOptions, detail.data.lotTypeCode)],
              ['short', t.detail.fields.initialQty, String(detail.data.initialQty)],
              ['short', t.detail.fields.expiryDate, detail.data.expiryDate ?? EMPTY],
              ['short', t.detail.fields.manufacturedAt, formatDateTime(detail.data.manufacturedAt)],
            ] as const
          ).map(([size, label, value]) => (
            <div className="lot-detail-field" data-size={size} key={label}>
              <dt className="field-label">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}

      <LotTimeline lotId={lotId} statusOptions={statusOptions} />

      <LotHoldDocuments key={lotId} lotId={lotId} />

      {/* 가능한 작업 — 막힌 단추와 그 까닭을 한 묶음으로, 참고 안내는 따로 둔다. */}
      <div className="lot-detail-actions">
        <div className="lot-detail-action">
          <Button disabled aria-describedby={transitionNoteId}>
            {t.detail.transition}
          </Button>
          <span id={transitionNoteId} className="field-note">
            {t.detail.transitionNote}
          </span>
        </div>
        <p className="field-note">{t.detail.suspiciousNote}</p>
      </div>
    </Dialog>
  );
};
