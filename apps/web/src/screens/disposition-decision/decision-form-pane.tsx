import { Button, Radio, RadioGroup, TextArea, TextField } from '@crefle/web-ui';
import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import { lookupDisplayLabel } from '../../patterns/lookup-display';
import { SaveErrorBanner } from '../../patterns/master';
import type { DecisionFormErrors, DecisionFormValue } from './decision-form';
import type { CodeOption } from './disposition-codes';
import type { DispositionLookup } from './lookups';

export interface DecisionFormPaneProps {
  value: DecisionFormValue;
  errors: DecisionFormErrors;
  /** 남은 수량에 대한 예고. 저장을 막지 않는다 — 잔량 판정은 서버 몫이다. */
  qtyNotice: string | undefined;
  /** 판정 컨트롤 전체를 잠그는 사유. 없으면 잠그지 않는다. */
  lockReason: string | undefined;
  /**
   * ⭐ 적용 여부를 모르는 저장이 남아 있다. **잠그되 빠져나갈 길을 함께 낸다** — 길이 없으면
   * 사용자는 새로고침으로 나가고, 그 순간 멱등 키가 사라져 이중 실행 위험이 되살아난다.
   */
  isUncertain: boolean;
  onCheckOutcome: () => void;
  dispositionOptions: CodeOption[];
  uomId: number | undefined;
  uoms: DispositionLookup;
  writeError: ApiError | null;
  isSaving: boolean;
  canCancel: boolean;
  onChange: (value: DecisionFormValue) => void;
  onSave: () => void;
  onCancel: () => void;
  onReload: () => void;
}

export const DecisionFormPane = ({
  value,
  errors,
  qtyNotice,
  lockReason,
  isUncertain,
  onCheckOutcome,
  dispositionOptions,
  uomId,
  uoms,
  writeError,
  isSaving,
  canCancel,
  onChange,
  onSave,
  onCancel,
  onReload,
}: DecisionFormPaneProps) => {
  const t = messages.dispositionDecision;
  const groupLabelId = useId();
  const lockReasonId = useId();
  const noticeId = useId();
  const isLocked = lockReason !== undefined;
  const uomLabel = uomId === undefined ? '' : lookupDisplayLabel(uoms, uomId);

  return (
    <div role="group" aria-label={t.panes.decision}>
      <SaveErrorBanner error={writeError} onReload={onReload} />

      <div className="field-cell">
        <span className="field-label" id={groupLabelId}>
          {t.form.dispositionLabel}
        </span>
        {/*
         * G-2 — 값 목록이 확정되기 전에는 선택지를 지어내지 않는다. 필드를 감추지 않고
         * 비활성 + 사유로 두며, 저장 버튼도 같은 사유로 함께 잠근다(스펙 §6).
         */}
        <RadioGroup
          name="disposition-type"
          orientation="horizontal"
          value={value.dispositionTypeCode}
          disabled={isLocked || dispositionOptions.length === 0}
          aria-labelledby={groupLabelId}
          aria-describedby={isLocked ? lockReasonId : undefined}
          onChange={(next) => onChange({ ...value, dispositionTypeCode: next })}
        >
          {dispositionOptions.map((option) => (
            <Radio key={option.value} value={option.value}>
              {option.label}
            </Radio>
          ))}
        </RadioGroup>
        {errors.dispositionTypeCode !== undefined && (
          <span className="field-error">{errors.dispositionTypeCode}</span>
        )}
      </div>

      <TextField
        label={uomLabel === '' ? t.form.qtyLabel : `${t.form.qtyLabel} (${uomLabel})`}
        value={value.qty}
        required
        fullWidth
        inputMode="decimal"
        disabled={isLocked}
        aria-describedby={
          [isLocked ? lockReasonId : '', qtyNotice === undefined ? '' : noticeId]
            .filter((id) => id !== '')
            .join(' ') || undefined
        }
        error={errors.decisionQty}
        helperText={t.form.qtyHelp}
        onChange={(event) => onChange({ ...value, qty: event.target.value })}
      />
      {qtyNotice !== undefined && (
        <p id={noticeId} className="field-note">
          {qtyNotice}
        </p>
      )}

      {/* ⛔ 디자인 시스템에 여러 줄 입력이 없다 — 토큰을 입힌 후보 부품을 쓴다(DS #74). */}
      <TextArea
        label={t.form.reasonLabel}
        value={value.reason}
        required
        fullWidth
        rows={3}
        disabled={isLocked}
        aria-describedby={isLocked ? lockReasonId : undefined}
        error={errors.reason}
        helperText={t.form.reasonHelp}
        onChange={(event) => onChange({ ...value, reason: event.target.value })}
      />

      {isLocked && (
        <div className="form-actions">
          <p id={lockReasonId} className="field-note form-actions-secondary">
            {lockReason}
          </p>
          {isUncertain && (
            <Button variant="outlined" size="sm" onClick={onCheckOutcome}>
              {t.form.checkOutcome}
            </Button>
          )}
        </div>
      )}

      <div className="form-actions">
        <p className="field-note form-actions-secondary">{t.form.irreversible}</p>
        <Button variant="outlined" disabled={!canCancel || isSaving} onClick={onCancel}>
          {t.actions.cancel}
        </Button>
        <Button
          disabled={isLocked || isSaving}
          aria-describedby={isLocked ? lockReasonId : undefined}
          onClick={onSave}
        >
          {t.actions.save}
        </Button>
      </div>
    </div>
  );
};
