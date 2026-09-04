import { Button, TextArea, TextField } from '@crefle/web-ui';
import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import { SaveErrorBanner } from '../../patterns/master';
import type { Lock } from './lock';
import type { RequestFormErrors, RequestFormValue } from './request-form';

export interface RequestPaneProps {
  value: RequestFormValue;
  errors: RequestFormErrors;
  /** 의뢰 상한 — 대상 수량. 표시용 문자열과 단위 이름을 함께 받는다 */
  maxQtyText: string;
  uomLabel: string;
  lock: Lock;
  onCheckOutcome: () => void;
  writeError: ApiError | null;
  isSaving: boolean;
  canCancel: boolean;
  onChange: (value: RequestFormValue) => void;
  onSave: () => void;
  onCancel: () => void;
  onReload: () => void;
}

/** ② 판정 의뢰. 부적합이 등록된 뒤에만 열린다. 의뢰하면 품질 화면으로 넘어간다(§3 ②). */
export const RequestPane = ({
  value,
  errors,
  maxQtyText,
  uomLabel,
  lock,
  onCheckOutcome,
  writeError,
  isSaving,
  canCancel,
  onChange,
  onSave,
  onCancel,
  onReload,
}: RequestPaneProps) => {
  const t = messages.dispositionRequest;
  const lockReasonId = useId();
  const afterNoteId = useId();
  const isLocked = lock.reason !== undefined;

  return (
    <div className="disposition-request-form" role="group" aria-label={t.panes.request}>
      <SaveErrorBanner error={writeError} onReload={onReload} />

      <TextField
        label={uomLabel === '' ? t.request.qtyLabel : `${t.request.qtyLabel} (${uomLabel})`}
        value={value.qty}
        required
        fullWidth
        inputMode="decimal"
        disabled={isLocked}
        aria-describedby={isLocked ? lockReasonId : afterNoteId}
        error={errors.requestedQty}
        helperText={t.request.qtyHelp(maxQtyText, uomLabel)}
        onChange={(event) => onChange({ ...value, qty: event.target.value })}
      />

      <TextArea
        label={t.request.remarksLabel}
        value={value.remarks}
        fullWidth
        rows={2}
        disabled={isLocked}
        aria-describedby={isLocked ? lockReasonId : undefined}
        helperText={t.request.remarksHelp}
        onChange={(event) => onChange({ ...value, remarks: event.target.value })}
      />

      {/* 의뢰하면 무엇이 일어나는지 — 품질 화면으로 넘어가고 결과가 돌아온다(스펙 §3 ②). */}
      <p id={afterNoteId} className="field-note">
        {t.request.afterNote}
      </p>

      {isLocked && (
        <div className="form-actions">
          <p id={lockReasonId} className="field-note form-actions-secondary">
            {lock.reason}
          </p>
          {lock.isUncertain && (
            <Button variant="outlined" size="sm" onClick={onCheckOutcome}>
              {t.actions.checkOutcome}
            </Button>
          )}
        </div>
      )}

      <div className="form-actions">
        <p className="field-note form-actions-secondary">{t.request.irreversible}</p>
        <Button variant="outlined" disabled={!canCancel || isSaving} onClick={onCancel}>
          {t.actions.cancel}
        </Button>
        <Button
          disabled={isLocked || isSaving}
          aria-describedby={isLocked ? lockReasonId : undefined}
          onClick={onSave}
        >
          {t.actions.request}
        </Button>
      </div>
    </div>
  );
};
