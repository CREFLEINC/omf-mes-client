import { Button, Select, TextArea } from '@crefle/web-ui';
import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import { SaveErrorBanner } from '../../patterns/master';
import type { Lock } from './lock';
import type { CodeOptionSource } from './lookups';
import type { NonconformanceFormErrors, NonconformanceFormValue } from './nonconformance-form';

export interface RegisterPaneProps {
  value: NonconformanceFormValue;
  errors: NonconformanceFormErrors;
  /** A-12 — 짧은 내용의 예고. 저장을 막지 않는다 */
  warning: string | undefined;
  severity: CodeOptionSource;
  departments: CodeOptionSource;
  /** 대상 수량 전량을 등록한다는 안내. 대상이 없으면 없다 */
  qtyNote: string | undefined;
  lock: Lock;
  onCheckOutcome: () => void;
  writeError: ApiError | null;
  isSaving: boolean;
  canCancel: boolean;
  onChange: (value: NonconformanceFormValue) => void;
  onSave: () => void;
  onCancel: () => void;
  onReload: () => void;
}

/** ① 부적합 등록. 심각도·내용 필수, 담당 부서 선택. 원천 입력 위젯은 그리지 않는다(§5-1-1 ⓓ). */
export const RegisterPane = ({
  value,
  errors,
  warning,
  severity,
  departments,
  qtyNote,
  lock,
  onCheckOutcome,
  writeError,
  isSaving,
  canCancel,
  onChange,
  onSave,
  onCancel,
  onReload,
}: RegisterPaneProps) => {
  const t = messages.dispositionRequest;
  const severityId = useId();
  const departmentId = useId();
  const lockReasonId = useId();
  const warningId = useId();
  const qtyNoteId = useId();
  const isLocked = lock.reason !== undefined;
  const severityPending = severity.options.length === 0;
  const describedBy = (...ids: (string | undefined)[]): string | undefined => {
    const joined = ids.filter((id): id is string => id !== undefined).join(' ');
    return joined === '' ? undefined : joined;
  };

  return (
    <div className="disposition-request-form" role="group" aria-label={t.panes.register}>
      <SaveErrorBanner error={writeError} onReload={onReload} />

      {qtyNote !== undefined && (
        <p id={qtyNoteId} className="field-note">
          {qtyNote}
        </p>
      )}

      <div className="field-cell">
        <label className="field-label" htmlFor={severityId}>
          {t.register.severityLabel}
        </label>
        {/* G-2 — 값 목록이 비면 선택지를 지어내지 않고 비활성 + 사유. 저장 버튼도 같은 사유로 잠긴다. */}
        <Select
          id={severityId}
          options={severity.options}
          value={value.severityCode === '' ? null : value.severityCode}
          placeholder={severityPending ? t.codePlaceholder : t.register.severityPlaceholder}
          disabled={isLocked || severityPending}
          invalid={errors.severityCode !== undefined}
          aria-describedby={describedBy(isLocked ? lockReasonId : undefined)}
          onChange={(next) => onChange({ ...value, severityCode: next })}
        />
        {errors.severityCode !== undefined && (
          <span className="field-error">{errors.severityCode}</span>
        )}
      </div>

      {/* 내용 — 판정자의 유일한 입력이다. 형식을 도움말로 유도한다(§5-3 · A-12). */}
      <TextArea
        label={t.register.descriptionLabel}
        value={value.description}
        required
        fullWidth
        rows={3}
        disabled={isLocked}
        aria-describedby={describedBy(
          isLocked ? lockReasonId : undefined,
          warning === undefined ? undefined : warningId,
        )}
        error={errors.description}
        helperText={t.register.descriptionHelp}
        onChange={(event) => onChange({ ...value, description: event.target.value })}
      />
      {warning !== undefined && (
        <p id={warningId} className="field-note">
          {warning}
        </p>
      )}

      <div className="field-cell">
        <label className="field-label" htmlFor={departmentId}>
          {t.register.departmentLabel}
        </label>
        <Select
          id={departmentId}
          options={[{ value: '', label: t.register.departmentNone }, ...departments.options]}
          value={value.departmentId}
          disabled={isLocked}
          onChange={(next) => onChange({ ...value, departmentId: next })}
        />
      </div>

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
        <p className="field-note form-actions-secondary">{t.register.irreversible}</p>
        <Button variant="outlined" disabled={!canCancel || isSaving} onClick={onCancel}>
          {t.actions.cancel}
        </Button>
        <Button
          disabled={isLocked || isSaving}
          aria-describedby={isLocked ? lockReasonId : undefined}
          onClick={onSave}
        >
          {t.actions.register}
        </Button>
      </div>
    </div>
  );
};
