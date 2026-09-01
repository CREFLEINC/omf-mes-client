import { AlertBanner, EmptyState, TextArea, TextField } from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useEffect, useMemo, useState } from 'react';

import {
  EMPTY_WORK_ORDER_RELEASE_DRAFT,
  evaluateWorkOrderReleaseDraft,
  type WorkOrderReleaseDraft,
} from './release-draft';

type WorkOrderRelease = components['schemas']['WorkOrderRelease'];
type ReleaseField = keyof WorkOrderRelease;

const t = messages.workOrderRelease.input;

interface OwnedDraft {
  ownerKey: number | null;
  value: WorkOrderReleaseDraft;
}

const formatQuantity = (value: number): string =>
  new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 6 }).format(value);

export interface WorkOrderReleaseInputPaneProps {
  ownerKey: number | null;
  orderQty: number | null;
  uomLabel: string | null;
  lockedReason: string | null;
  fieldErrors?: Partial<Record<ReleaseField, string>>;
  onClearFieldError?: (field: ReleaseField) => void;
  onBodyChange: (body: WorkOrderRelease | null) => void;
}

export const WorkOrderReleaseInputPane = ({
  ownerKey,
  orderQty,
  uomLabel,
  lockedReason,
  fieldErrors = {},
  onClearFieldError,
  onBodyChange,
}: WorkOrderReleaseInputPaneProps) => {
  const [ownedDraft, setOwnedDraft] = useState<OwnedDraft>({
    ownerKey,
    value: EMPTY_WORK_ORDER_RELEASE_DRAFT,
  });
  const draft =
    ownedDraft.ownerKey === ownerKey ? ownedDraft.value : EMPTY_WORK_ORDER_RELEASE_DRAFT;
  const evaluation = useMemo(
    () => evaluateWorkOrderReleaseDraft(draft, orderQty),
    [draft, orderQty],
  );

  useEffect(() => {
    if (ownedDraft.ownerKey !== ownerKey) {
      setOwnedDraft({ ownerKey, value: EMPTY_WORK_ORDER_RELEASE_DRAFT });
    }
  }, [ownedDraft.ownerKey, ownerKey]);
  useEffect(() => onBodyChange(evaluation.body), [evaluation.body, onBodyChange]);

  if (ownerKey === null || orderQty === null) {
    return (
      <section className="pane" aria-label={t.pane}>
        <EmptyState size="sm" title={t.empty.title} description={t.empty.description} />
      </section>
    );
  }

  const unit = uomLabel === null || uomLabel.trim() === '' ? t.values.unitUnavailable : uomLabel;
  const lotSizeLockedReason = lockedReason === null ? undefined : t.locked.lotSize(lockedReason);
  const handoverNoteLockedReason =
    lockedReason === null ? undefined : t.locked.handoverNote(lockedReason);
  const update = (field: ReleaseField, value: string): void => {
    setOwnedDraft((current) => ({
      ownerKey,
      value: {
        ...(current.ownerKey === ownerKey ? current.value : EMPTY_WORK_ORDER_RELEASE_DRAFT),
        [field === 'lotSize' ? 'lotSizeText' : 'handoverNote']: value,
      },
    }));
    onClearFieldError?.(field);
  };

  return (
    <section className="pane" aria-label={t.pane}>
      <h2>{t.heading}</h2>
      <div className="form-grid">
        <TextField
          fullWidth
          required
          inputMode="decimal"
          label={t.fields.lotSize}
          value={draft.lotSizeText}
          disabled={lockedReason !== null}
          disabledReason={lotSizeLockedReason}
          error={
            lockedReason === null ? (evaluation.lotSizeError ?? fieldErrors.lotSize) : undefined
          }
          helperText={t.helper.lotSize(unit)}
          onChange={(event) => update('lotSize', event.target.value)}
        />
        <TextArea
          fullWidth
          rows={3}
          label={t.fields.handoverNote}
          value={draft.handoverNote}
          disabled={lockedReason !== null}
          disabledReason={handoverNoteLockedReason}
          error={lockedReason === null ? fieldErrors.handoverNote : undefined}
          helperText={t.helper.handoverNote}
          onChange={(event) => update('handoverNote', event.target.value)}
        />
        {evaluation.preview !== null && (
          <div className="form-grid-full">
            <div className={evaluation.preview.isSingleSlotWarning ? 'banner-slot' : undefined}>
              <AlertBanner variant="info" title={t.preview.title(evaluation.preview.slotCount)}>
                {t.preview.formula(
                  formatQuantity(orderQty),
                  formatQuantity(evaluation.body?.lotSize ?? 0),
                  evaluation.preview.slotCount,
                  unit,
                )}{' '}
                {t.preview.planNotice}
              </AlertBanner>
            </div>
            {evaluation.preview.isSingleSlotWarning && (
              <AlertBanner variant="warning" title={t.warning.title}>
                {t.warning.description}
              </AlertBanner>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
